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

  async findById(id: string): Promise<EscrowPaymentDocument> {
    const doc = await this.escrowPaymentModel.findById(id).lean();
    if (!doc) throw new EscrowPaymentNotFoundException();
    return doc;
  }

  /**
   * 결제 계획 승인 (buyer / seller 각각 호출)
   * 양측 모두 승인하면 APPROVED로 전환 — XRPL 실행 없음
   */
  async approvePayment(
    paymentId: string,
    approverType: "buyer" | "seller",
  ): Promise<EscrowPaymentDocument> {
    const payment = await this.escrowPaymentModel.findById(paymentId);
    if (!payment) throw new EscrowPaymentNotFoundException();

    if (payment.status !== "DRAFT" && payment.status !== "PENDING_APPROVAL") {
      throw new InvalidPaymentStatusException(payment.status);
    }

    const now = new Date();
    if (approverType === "buyer") {
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

    const isParticipant =
      payment.buyerId.toString() === userId ||
      payment.sellerId.toString() === userId;
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

    const session = await this.escrowPaymentModel.db.startSession(); // 트랜잭션 세션 시작(payment, outbox 저장이 원자적으로 이루어지도록)
    try {
      await session.withTransaction(async () => {
        payment.status = "PROCESSING";
        await payment.save({ session });
        await this.outboxService.createPendingEvent(
          session,
          "ESCROW_PAY_INITIATED",
          { paymentId, escrowIds },
        );
      });
    } catch (err: any) {
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
    return payment;
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
    const payment = await this.escrowPaymentModel
      .findById(paymentId)
      .select("+escrows.fulfillment");
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

    this.logger.log(
      `Submitting EscrowCreate: buyer=${buyerUser.wallet.address} seller=${sellerUser.wallet.address} amount=${escrow.amountXrp} XRP`,
    );

    const { txHash, sequence } = await this.xrplService.createEscrow(
      buyerWallet,
      sellerUser.wallet.address,
      escrow.amountXrp,
      condition,
    );

    escrow.condition = condition;
    escrow.fulfillment = encryptedFulfillment;
    escrow.xrplSequence = sequence;
    escrow.txHashCreate = txHash;
    escrow.status = "ESCROWED";
    escrow.escrowedAt = new Date();

    // 모든 에스크로 완료 시 payment → ACTIVE
    const allEscrowed = payment.escrows.every(
      (e) =>
        e.status === "ESCROWED" ||
        e.status === "RELEASED" ||
        e.status === "CANCELLED",
    );
    if (allEscrowed) {
      payment.status = "ACTIVE";
    }

    await payment.save();
    this.logger.log(`EscrowCreate success: txHash=${txHash} seq=${sequence}`);
    return payment;
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
      } else if (escrow.status === "ESCROWED") {
        // 이미 XRPL에 제출됨 — CancelAfter 이후 EscrowCancelScheduler가 EscrowCancel 제출
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
    approverType: "buyer" | "seller",
  ): Promise<EscrowPaymentDocument> {
    const payment = await this.escrowPaymentModel
      .findById(paymentId)
      .select("+escrows.fulfillment");
    if (!payment) throw new EscrowPaymentNotFoundException();

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
    if (approverType === "buyer") {
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
}
