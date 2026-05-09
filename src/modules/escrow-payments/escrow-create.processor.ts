import { Processor, Process, OnQueueFailed } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { Job } from "bull";
import { EscrowPaymentsService } from "./escrow-payments.service";
import {
  ESCROW_CREATE_QUEUE,
  EscrowCreateJobData,
} from "./escrow-create.constants";
import {
  EscrowPayment,
  EscrowPaymentDocument,
} from "./schemas/escrow-payment.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { XrplService, XrplWallet } from "../xrpl/xrpl.service";
import {
  EscrowItemNotFoundException,
  EscrowPaymentNotFoundException,
  InvalidEscrowItemStatusException,
  PaymentNotActiveException,
  WalletNotAvailableException,
} from "../../common/exceptions";

// 재시도해도 해결되지 않는 XRPL 오류 코드
const NON_RETRYABLE_CODES = [
  "tecUNFUNDED", // 잔고 부족
  "tecINSUF_RESERVE", // reserve 부족
  "temBAD_AMOUNT", // 금액 형식 오류
  "temINSUF_FEE_P", // 수수료 부족
  "temDISABLED", // amendment 미활성 (XLS-85 미활성 포함)
  "tecNO_LINE", // trust line 없음 (IOU 에스크로)
  "tecPATH_DRY", // IOU 경로 없음
  "tecNO_PERMISSION", // 권한 없음
];

function isNonRetryable(err: Error): boolean {
  return NON_RETRYABLE_CODES.some((code) => err.message.includes(code));
}

/**
 * XRPL 결제요청이 비동기로 들어와 실행됨(Redis MQ)
 */
@Processor(ESCROW_CREATE_QUEUE)
export class EscrowCreateProcessor {
  private readonly logger = new Logger(EscrowCreateProcessor.name);

  constructor(
    @InjectModel(EscrowPayment.name)
    private readonly escrowPaymentModel: Model<EscrowPaymentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly xrplService: XrplService,
    private readonly escrowPaymentsService: EscrowPaymentsService,
  ) {}

  @Process()
  async handle(job: Job<EscrowCreateJobData>): Promise<void> {
    const { paymentId, escrowIds } = job.data;
    this.logger.log(
      `EscrowCreate job 시작: paymentId=${paymentId} escrowIds=${escrowIds.join(",")} attempt=${job.attemptsMade}`,
    );

    // 같은 buyer 계정의 항목을 순차 실행 — XRPL sequence 충돌 방지
    for (const escrowId of escrowIds) {
      // 멱등성: 재시도 시 이미 처리된 항목 건너뜀
      const current = await this.escrowPaymentsService.getEscrowStatus(
        paymentId,
        escrowId,
      );
      if (current.status === "ESCROWED") {
        this.logger.log(`Skip already-ESCROWED: escrowId=${escrowId}`);
        continue;
      }
      if (current.status === "SUBMITTING") {
        // XRPL 제출 성공 후 post-flight DB 저장 실패 상태
        // 재시도 시 중복 EscrowCreate 방지를 위해 건너뜀 — 수동 복구 필요
        this.logger.error(
          `escrowId=${escrowId} is SUBMITTING — XRPL may have succeeded but DB save failed. Manual recovery required (paymentId=${paymentId})`,
        );
        continue;
      }
      if (current.status !== "PENDING_ESCROW") {
        this.logger.warn(
          `Unexpected status ${current.status} for escrowId=${escrowId}, skipping`,
        );
        continue;
      }

      try {
        await this.createXrplEscrow(paymentId, escrowId);
      } catch (err: any) {
        if (isNonRetryable(err)) {
          // 잔고/금액 오류 → 재시도해도 해결 안 됨, 즉시 전체 롤백 후 종료
          this.logger.error(
            `EscrowCreate 금액 오류 (재시도 불가): paymentId=${paymentId} escrowId=${escrowId} — ${err.message}`,
          );
          await this.escrowPaymentsService.rollbackAllEscrows(paymentId);
          return; // 정상 종료 처리 — Bull이 재시도하지 않음
        }
        throw err; // 네트워크 등 일시적 오류 → Bull 재시도
      }
    }
  }

  @OnQueueFailed()
  async onFailed(job: Job<EscrowCreateJobData>, error: Error): Promise<void> {
    // attemptsMade는 이번 실패 포함 누적 시도 횟수
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return; // 재시도 남아있음

    this.logger.error(
      `EscrowCreate job FAILED after ${job.attemptsMade} attempts: paymentId=${job.data.paymentId} — ${error.message}`,
      error.stack,
    );

    try {
      await this.escrowPaymentsService.rollbackAllEscrows(job.data.paymentId);
    } catch (err) {
      this.logger.error(
        `rollbackAllEscrows failed for paymentId=${job.data.paymentId}: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * XRPL EscrowCreate 제출 — EscrowItem을 ESCROWED 상태로 전환
   * 결제가 PROCESSING 상태여야 실행 가능
   * 모든 에스크로가 ESCROWED 되면 payment → ACTIVE
   */
  async createXrplEscrow(
    paymentId: string,
    escrowId: string,
  ): Promise<EscrowPaymentDocument> {
    const payment = await this.escrowPaymentModel.findById(paymentId);
    if (!payment) throw new EscrowPaymentNotFoundException();

    if (payment.status !== "PROCESSING") {
      throw new PaymentNotActiveException(payment.status);
    }

    const escrow = payment.escrows.find((e) => e._id.toString() === escrowId);
    if (!escrow) throw new EscrowItemNotFoundException();
    if (escrow.status !== "PENDING_ESCROW") {
      throw new InvalidEscrowItemStatusException(
        "PENDING_ESCROW",
        escrow.status,
      );
    }

    const buyerUser = await this.userModel
      .findById(payment.buyerId)
      .select("+wallet.seed");
    if (!buyerUser?.wallet?.seed) {
      throw new WalletNotAvailableException("Buyer");
    }

    const sellerUser = await this.userModel.findById(payment.sellerId);
    if (!sellerUser?.wallet?.address) {
      throw new WalletNotAvailableException("Seller");
    }

    const decryptedSeed = this.xrplService.decrypt(buyerUser.wallet.seed);
    const buyerWallet: XrplWallet = {
      address: buyerUser.wallet.address,
      seed: decryptedSeed,
      publicKey: buyerUser.wallet.publicKey,
      privateKey: "",
    };

    const { condition, fulfillment } =
      this.xrplService.generateCryptoCondition();
    const encryptedFulfillment = this.xrplService.encrypt(fulfillment);

    // Pre-flight: PENDING_ESCROW → SUBMITTING + condition/fulfillment 원자적 저장
    // XRPL 제출 전에 상태를 선점해 재시도 시 중복 EscrowCreate 방지
    const preFlighted = await this.escrowPaymentModel.findOneAndUpdate(
      {
        _id: paymentId,
        escrows: { $elemMatch: { _id: escrow._id, status: "PENDING_ESCROW" } },
      },
      {
        $set: {
          "escrows.$.status": "SUBMITTING",
          "escrows.$.condition": condition,
          "escrows.$.fulfillment": encryptedFulfillment,
          "escrows.$.submittingAt": new Date(),
        },
      },
    );
    if (!preFlighted) {
      throw new InvalidEscrowItemStatusException(
        "PENDING_ESCROW",
        escrow.status,
      );
    }

    const currency = payment.currency ?? "XRP";
    let txHash: string;
    let sequence: number;
    try {
      this.logger.log(
        `Submitting EscrowCreate: buyer=${buyerUser.wallet.address} seller=${sellerUser.wallet.address} amount=${escrow.amountXrp} ${currency}`,
      );
      ({ txHash, sequence } = await this.xrplService.createEscrow(
        buyerWallet,
        sellerUser.wallet.address,
        escrow.amountXrp,
        condition,
        currency,
      ));
    } catch (err) {
      // Case A: XRPL 제출 실패 — 에스크로 미생성 확정, SUBMITTING → PENDING_ESCROW 즉시 복구
      await this.escrowPaymentModel.findOneAndUpdate(
        {
          _id: paymentId,
          escrows: { $elemMatch: { _id: escrow._id, status: "SUBMITTING" } },
        },
        { $set: { "escrows.$.status": "PENDING_ESCROW" } },
      );
      throw err;
    }

    this.logger.log(
      `Submitting EscrowCreate: buyer=${buyerUser.wallet.address} ` +
        `seller=${sellerUser.wallet.address} amount=${escrow.amountXrp} ${currency}`,
    );
    // Case B: post-flight DB 저장 실패 시 최대 3회 재시도 (메모리의 txHash/sequence 활용)
    // 재시도 소진 시 SUBMITTING 유지 → 스케줄러가 XRPL 조회로 복구
    let result: EscrowPaymentDocument | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await this.escrowPaymentModel.findOneAndUpdate(
          { _id: paymentId, "escrows._id": escrow._id },
          {
            $set: {
              "escrows.$.status": "ESCROWED",
              "escrows.$.xrplSequence": sequence,
              "escrows.$.txHashCreate": txHash,
              "escrows.$.escrowedAt": new Date(),
            },
          },
          { new: true },
        );
        if (result) break;
        // null 반환 = 다른 경로가 상태를 변경한 경우 (동시성 충돌)
        if (attempt === 3) {
          this.logger.error(
            `Post-flight DB update missed for paymentId=${paymentId} escrowId=${escrow._id.toString()}; recovery scheduler must reconcile via condition lookup`,
          );
          throw new Error("Post-flight DB update did not match");
        }
        await new Promise((res) => setTimeout(res, attempt * 200));
      } catch (err: any) {
        if (attempt === 3) throw err;
        await new Promise((res) => setTimeout(res, attempt * 200));
      }
    }

    const allEscrowed = result!.escrows.every(
      (e) =>
        e.status === "ESCROWED" ||
        e.status === "RELEASED" ||
        e.status === "CANCELLED",
    );
    if (allEscrowed) {
      await this.escrowPaymentModel.findByIdAndUpdate(paymentId, {
        $set: { status: "ACTIVE" },
      });
      result!.status = "ACTIVE";
    }

    return result!;
  }
}
