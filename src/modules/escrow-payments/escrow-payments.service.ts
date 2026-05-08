import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  AlreadyApprovedEventException,
  AlreadyApprovedPaymentException,
  EscrowItemMustBeEscrowedException,
  EscrowItemNotFoundException,
  EscrowPaymentNotFoundException,
  EventTypeNotFoundException,
  InvalidEscrowCancelStatusException,
  InvalidEscrowItemStatusException,
  InvalidPaymentStatusException,
  PaymentInitiationFailedException,
  PaymentNotActiveException,
  PaymentNotApprovedForPayException,
  UnauthorizedPaymentActionException,
  WalletNotAvailableException,
  WalletSeedUnavailableException,
} from "../../common/exceptions";
import {
  EscrowPayment,
  EscrowPaymentDocument,
  EscrowItem,
} from "./schemas/escrow-payment.schema";
import { CreateEscrowPaymentDto } from "./dto/create-escrow-payment.dto";
import { QueryEscrowPaymentDto } from "./dto/query-escrow-payment.dto";
import { XrplService, XrplWallet } from "../xrpl/xrpl.service";
import { User, UserDocument } from "../users/schemas/user.schema";
import { OutboxService } from "../outbox/outbox.service";

@Injectable()
export class EscrowPaymentsService {
  private readonly logger = new Logger(EscrowPaymentsService.name);

  constructor(
    @InjectModel(EscrowPayment.name)
    private readonly escrowPaymentModel: Model<EscrowPaymentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly xrplService: XrplService,
    private readonly outboxService: OutboxService,
  ) {}

  async create(
    dto: CreateEscrowPaymentDto,
    userId: string,
  ): Promise<EscrowPaymentDocument> {
    if (userId !== dto.buyerId && userId !== dto.sellerId) {
      throw new UnauthorizedPaymentActionException();
    }

    const totalAmountXrp = dto.escrows.reduce((sum, e) => sum + e.amountXrp, 0);

    const doc = new this.escrowPaymentModel({
      buyerId: new Types.ObjectId(dto.buyerId),
      sellerId: new Types.ObjectId(dto.sellerId),
      totalAmountXrp,
      memo: dto.memo ?? "",
      escrows: dto.escrows.map((e) => ({
        label: e.label,
        amountXrp: e.amountXrp,
        order: e.order,
        requiredEventTypes: e.requiredEventTypes,
        approvals: e.requiredEventTypes.map((type) => ({
          eventType: type,
          buyerApproved: false,
          sellerApproved: false,
        })),
      })),
    });

    return doc.save();
  }

  async findAll(
    userId: string,
    dto: QueryEscrowPaymentDto,
  ): Promise<{
    data: EscrowPaymentDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { status, group, page = 1, limit = 5 } = dto;
    const uid = new Types.ObjectId(userId);

    const filter: Record<string, any> = {
      $or: [{ buyerId: uid }, { sellerId: uid }],
    };

    if (status) {
      filter.status = status;
    } else if (group === "ongoing") {
      filter.status = {
        $in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PROCESSING", "ACTIVE"],
      };
    } else if (group === "done") {
      filter.status = { $in: ["COMPLETED", "CANCELLED"] };
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.escrowPaymentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.escrowPaymentModel.countDocuments(filter),
    ]);

    return {
      data: data as unknown as EscrowPaymentDocument[],
      total,
      page,
      limit,
    };
  }

  async findById(id: string, userId: string): Promise<EscrowPaymentDocument> {
    const doc = await this.escrowPaymentModel.findById(id).lean();
    if (!doc) throw new EscrowPaymentNotFoundException();

    const isParticipant =
      doc.buyerId.toString() === userId || doc.sellerId.toString() === userId;
    if (!isParticipant) {
      throw new UnauthorizedPaymentActionException();
    }

    return doc;
  }

  /**
   * 결제 계획 승인 (buyer / seller 각각 호출)
   * 양측 모두 승인하면 APPROVED로 전환 — XRPL 실행 없음
   */
  async approvePayment(
    paymentId: string,
    userId: string,
  ): Promise<EscrowPaymentDocument> {
    const payment = await this.escrowPaymentModel.findById(paymentId);
    if (!payment) throw new EscrowPaymentNotFoundException();

    const isBuyer = payment.buyerId.toString() === userId;
    const isSeller = payment.sellerId.toString() === userId;
    if (!isBuyer && !isSeller) throw new UnauthorizedPaymentActionException();

    if (payment.status !== "DRAFT" && payment.status !== "PENDING_APPROVAL") {
      throw new InvalidPaymentStatusException(payment.status);
    }

    const now = new Date();
    if (isBuyer) {
      if (payment.buyerApproved) {
        throw new AlreadyApprovedPaymentException("Buyer");
      }
      payment.buyerApproved = true;
      payment.buyerApprovedAt = now;
    } else {
      if (payment.sellerApproved) {
        throw new AlreadyApprovedPaymentException("Seller");
      }
      payment.sellerApproved = true;
      payment.sellerApprovedAt = now;
    }

    const bothApproved = payment.buyerApproved && payment.sellerApproved;
    payment.status = bothApproved ? "APPROVED" : "PENDING_APPROVAL";
    await payment.save();

    return payment;
  }

  /**
   * Buyer가 결제 개시 — MongoDB 트랜잭션으로 PROCESSING 상태 전환 + Outbox 이벤트 원자적 기록
   * 실제 XRPL 처리는 Outbox → Bull Queue → EscrowCreateProcessor가 비동기 수행 (202)
   */
  async initiatePayment(
    paymentId: string,
    userId: string,
  ): Promise<EscrowPaymentDocument> {
    const payment = await this.escrowPaymentModel.findById(paymentId);
    if (!payment) throw new EscrowPaymentNotFoundException();

    if (payment.status !== "APPROVED") {
      throw new PaymentNotApprovedForPayException(payment.status);
    }

    const isParticipant = payment.buyerId.toString() === userId;
    if (!isParticipant) {
      throw new UnauthorizedPaymentActionException();
    }

    const pendingEscrows = payment.escrows.filter(
      (e) => e.status === "PENDING_ESCROW",
    );
    const escrowIds = pendingEscrows.map((e) => e._id.toString());

    // 트랜잭션 전 잔고 사전 검증 — 잔고 부족 시 400으로 즉시 반환 (XRPL 연결 불가 시 500)
    const buyerUser = await this.userModel.findById(payment.buyerId);
    if (!buyerUser?.wallet?.address) {
      throw new WalletNotAvailableException("Buyer");
    }
    await this.xrplService.validateEscrowFunds(
      buyerUser.wallet.address,
      pendingEscrows,
    );

    let initiated: EscrowPaymentDocument | null = null;
    const session = await this.escrowPaymentModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        initiated = await this.escrowPaymentModel.findOneAndUpdate(
          { _id: paymentId, status: "APPROVED" },
          { $set: { status: "PROCESSING" } },
          { session, new: true },
        );
        if (!initiated) throw new PaymentNotApprovedForPayException("APPROVED");
        await this.outboxService.createPendingEvent(
          session,
          "ESCROW_PAY_INITIATED",
          { paymentId, escrowIds },
        );
      });
    } catch (err: any) {
      if (err instanceof PaymentNotApprovedForPayException) throw err;
      this.logger.error(
        `Payment initiation transaction failed: ${err.message}`,
        err.stack,
      );
      throw new PaymentInitiationFailedException();
    } finally {
      await session.endSession();
    }

    this.logger.log(
      `Payment ${paymentId} initiated — ${escrowIds.length} escrow(s) queued`,
    );
    return initiated!;
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
        "escrows._id": escrow._id,
        "escrows.status": "PENDING_ESCROW",
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

    this.logger.log(
      `Submitting EscrowCreate: buyer=${buyerUser.wallet.address} seller=${sellerUser.wallet.address} amount=${escrow.amountXrp} XRP`,
    );

    let txHash: string;
    let sequence: number;
    try {
      ({ txHash, sequence } = await this.xrplService.createEscrow(
        buyerWallet,
        sellerUser.wallet.address,
        escrow.amountXrp,
        condition,
      ));
    } catch (err) {
      // Case A: XRPL 제출 실패 — 에스크로 미생성 확정, SUBMITTING → PENDING_ESCROW 즉시 복구
      await this.escrowPaymentModel.findOneAndUpdate(
        {
          _id: paymentId,
          "escrows._id": escrow._id,
          "escrows.status": "SUBMITTING",
        },
        { $set: { "escrows.$.status": "PENDING_ESCROW" } },
      );
      throw err;
    }

    // XRPL 제출 성공 — txHash/sequence를 먼저 로그에 기록해 저장 실패 시에도 복구 단서 보존
    this.logger.log(`EscrowCreate success: txHash=${txHash} seq=${sequence}`);

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

  /**
   * 에스크로 전체 롤백 — 재시도 소진 후 EscrowCreateProcessor가 호출
   * PENDING_ESCROW → CANCELLED, ESCROWED → CANCELLING (XRPL CancelAfter 대기)
   */
  async rollbackAllEscrows(paymentId: string): Promise<void> {
    const payment = await this.escrowPaymentModel.findById(paymentId);
    if (!payment) {
      this.logger.error(`rollbackAllEscrows: payment ${paymentId} not found`);
      return;
    }

    if (payment.status === "CANCELLED") return; // 멱등 처리

    for (const escrow of payment.escrows) {
      if (escrow.status === "PENDING_ESCROW") {
        escrow.status = "CANCELLED";
      } else if (
        escrow.status === "ESCROWED" ||
        escrow.status === "SUBMITTING"
      ) {
        // SUBMITTING: XRPL 제출 여부 불명 — 제출됐을 경우를 대비해 CANCELLING으로 처리
        escrow.status = "CANCELLING";
      }
    }

    payment.status = "CANCELLED";
    await payment.save();
    this.logger.warn(`Payment ${paymentId} rolled back to CANCELLED`);
  }

  /**
   * 이벤트 승인 — 양측 승인 완료 시 자동으로 EscrowFinish 제출
   */
  async approveEvent(
    paymentId: string,
    escrowId: string,
    eventType: string,
    userId: string,
  ): Promise<EscrowPaymentDocument> {
    const payment = await this.escrowPaymentModel
      .findById(paymentId)
      .select("+escrows.fulfillment");
    if (!payment) throw new EscrowPaymentNotFoundException();

    const isBuyer = payment.buyerId.toString() === userId;
    const isSeller = payment.sellerId.toString() === userId;
    if (!isBuyer && !isSeller) throw new UnauthorizedPaymentActionException();

    const escrow = payment.escrows.find((e) => e._id.toString() === escrowId);
    if (!escrow) throw new EscrowItemNotFoundException();
    if (escrow.status !== "ESCROWED") {
      throw new EscrowItemMustBeEscrowedException(escrow.status);
    }

    const approval = escrow.approvals.find((a) => a.eventType === eventType);
    if (!approval) {
      throw new EventTypeNotFoundException(eventType);
    }

    const now = new Date();
    if (isBuyer) {
      if (approval.buyerApproved) {
        throw new AlreadyApprovedEventException("Buyer");
      }
      approval.buyerApproved = true;
      approval.buyerApprovedAt = now;
    } else {
      if (approval.sellerApproved) {
        throw new AlreadyApprovedEventException("Seller");
      }
      approval.sellerApproved = true;
      approval.sellerApprovedAt = now;
    }

    if (
      approval.buyerApproved &&
      approval.sellerApproved &&
      !approval.completedAt
    ) {
      approval.completedAt = now;
    }

    const allEventsComplete = escrow.approvals.every((a) => !!a.completedAt);
    if (allEventsComplete) {
      await this.releaseEscrow(payment, escrow);
    } else {
      await payment.save();
    }

    return payment;
  }

  private async releaseEscrow(
    payment: EscrowPaymentDocument,
    escrow: EscrowItem,
  ): Promise<void> {
    escrow.status = "RELEASING";
    await payment.save();

    try {
      const buyerUser = await this.userModel
        .findById(payment.buyerId)
        .select("+wallet.seed");

      if (!buyerUser?.wallet?.seed) {
        throw new WalletSeedUnavailableException();
      }

      const decryptedSeed = this.xrplService.decrypt(buyerUser.wallet.seed);
      const buyerWallet: XrplWallet = {
        address: buyerUser.wallet.address,
        seed: decryptedSeed,
        publicKey: buyerUser.wallet.publicKey,
        privateKey: "",
      };

      const fulfillment = this.xrplService.decrypt(escrow.fulfillment!);

      this.logger.log(
        `Submitting EscrowFinish: seq=${escrow.xrplSequence} owner=${buyerUser.wallet.address}`,
      );

      const txHash = await this.xrplService.finishEscrow(
        buyerWallet,
        buyerUser.wallet.address,
        escrow.xrplSequence!,
        escrow.condition!,
        fulfillment,
      );

      escrow.status = "RELEASED";
      escrow.txHashRelease = txHash;
      escrow.releasedAt = new Date();

      const allReleased = payment.escrows.every(
        (e) => e.status === "RELEASED" || e.status === "CANCELLED",
      );
      if (allReleased) {
        payment.status = "COMPLETED";
      }

      await payment.save();
      this.logger.log(`EscrowFinish success: txHash=${txHash}`);
    } catch (err: any) {
      this.logger.error(`EscrowFinish failed: ${err.message}`, err.stack);
      escrow.status = "ESCROWED"; // 롤백
      await payment.save();
      throw err;
    }
  }

  async cancelEscrowItem(
    paymentId: string,
    escrowId: string,
  ): Promise<EscrowPaymentDocument> {
    const payment = await this.escrowPaymentModel.findById(paymentId);
    if (!payment) throw new EscrowPaymentNotFoundException();

    const escrow = payment.escrows.find((e) => e._id.toString() === escrowId);
    if (!escrow) throw new EscrowItemNotFoundException();

    if (escrow.status !== "PENDING_ESCROW") {
      throw new InvalidEscrowCancelStatusException(escrow.status);
    }

    escrow.status = "CANCELLED";
    return payment.save();
  }

  async getEscrowStatus(
    paymentId: string,
    escrowId: string,
  ): Promise<EscrowItem> {
    const payment = await this.escrowPaymentModel.findById(paymentId).lean();
    if (!payment) throw new EscrowPaymentNotFoundException();

    const escrow = payment.escrows.find((e) => e._id.toString() === escrowId);
    if (!escrow) throw new EscrowItemNotFoundException();

    return escrow;
  }

  /**
   * SUBMITTING 에스크로 복구 — EscrowSubmitRecoveryScheduler에서 호출
   * XRPL 조회 결과에 따라 ESCROWED 복구 또는 결제 전체 취소
   */
  async recoverSubmittingEscrow(
    paymentId: string,
    escrowId: string,
    buyerAddress: string,
  ): Promise<"recovered" | "cancelled"> {
    const escrow = await this.getEscrowStatus(paymentId, escrowId);
    if (escrow.status !== "SUBMITTING") return "recovered"; // 이미 다른 경로로 처리됨

    if (!escrow.condition) {
      // condition 미저장 = pre-flight 전에 프로세스 종료 → XRPL 제출 안 됨
      await this.cancelSubmittingEscrowAndRollback(paymentId, escrowId);
      return "cancelled";
    }

    const xrplResult = await this.xrplService.findEscrowByCondition(
      buyerAddress,
      escrow.condition,
    );

    if (xrplResult) {
      // XRPL에 에스크로 존재 → DB만 업데이트하면 복구 완료
      const result = await this.escrowPaymentModel.findOneAndUpdate(
        { _id: paymentId, "escrows._id": new Types.ObjectId(escrowId) },
        {
          $set: {
            "escrows.$.status": "ESCROWED",
            "escrows.$.xrplSequence": xrplResult.sequence,
            "escrows.$.txHashCreate": xrplResult.txHash,
            "escrows.$.escrowedAt": new Date(),
          },
        },
        { new: true },
      );
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
      }
      return "recovered";
    }

    // XRPL에 에스크로 없음 → 제출 실패 확정 → 결제 취소
    await this.cancelSubmittingEscrowAndRollback(paymentId, escrowId);
    return "cancelled";
  }

  private async cancelSubmittingEscrowAndRollback(
    paymentId: string,
    escrowId: string,
  ): Promise<void> {
    // XRPL에 없음이 확정된 SUBMITTING 에스크로를 CANCELLED로 직접 전환
    // (rollbackAllEscrows는 SUBMITTING → CANCELLING으로 처리하므로 별도 처리)
    await this.escrowPaymentModel.findOneAndUpdate(
      {
        _id: paymentId,
        "escrows._id": new Types.ObjectId(escrowId),
        "escrows.status": "SUBMITTING",
      },
      { $set: { "escrows.$.status": "CANCELLED" } },
    );
    await this.rollbackAllEscrows(paymentId);
  }
}
