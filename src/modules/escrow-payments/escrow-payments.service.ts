import { Injectable, Logger } from "@nestjs/common";
import {
  AlreadyApprovedEventException,
  AlreadyApprovedPaymentException,
  EscrowItemMustBeEscrowedException,
  EscrowItemNotFoundException,
  EscrowPaymentNotFoundException,
  EventTypeNotFoundException,
  InvalidEscrowCancelStatusException,
  InvalidPaymentStatusException,
  PaymentInitiationFailedException,
  PaymentNotApprovedForPayException,
  UnauthorizedPaymentActionException,
  WalletNotAvailableException,
  WalletSeedUnavailableException,
} from "../../common/exceptions";
import {
  EscrowPaymentDocument,
  EscrowItem,
} from "./schemas/escrow-payment.schema";
import { XrplService, XrplWallet } from "../xrpl/xrpl.service";
import { OutboxService } from "../outbox/outbox.service";
import { EscrowPaymentRepository } from "./repositories/escrow-payment.repository";
import { UserFacade } from "./repositories/user.facade";

@Injectable()
export class EscrowPaymentsService {
  private readonly logger = new Logger(EscrowPaymentsService.name);

  constructor(
    private readonly escrowPaymentRepo: EscrowPaymentRepository,
    private readonly userFacade: UserFacade,
    private readonly xrplService: XrplService,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * 결제 승인 메서드 — 결제 생성자(buyer/seller)의 상대방이 호출해 APPROVED로 전환
   * buyer 생성 시: seller가 호출 → APPROVED
   * seller 생성 시: buyer가 호출 → APPROVED
   */
  async approvePayment(
    paymentId: string,
    userId: string,
  ): Promise<EscrowPaymentDocument> {
    const payment = await this.escrowPaymentRepo.findById(paymentId);
    if (!payment) throw new EscrowPaymentNotFoundException();

    const isBuyer = payment.buyerId.toString() === userId;
    const isSeller = payment.sellerId.toString() === userId;
    if (!isBuyer && !isSeller) throw new UnauthorizedPaymentActionException();

    if (payment.status !== "PENDING_APPROVAL") {
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
    await this.escrowPaymentRepo.save(payment);

    return payment;
  }

  /**
   * Buyer가 결제 개시 — MongoDB 트랜잭션으로 PROCESSING 상태 전환 + Outbox 이벤트 원자적 기록
   * 실제 XRPL 처리는 Outbox → Bull Queue → EscrowCreateProcessor가 비동기 수행
   */
  async initiatePayment(
    paymentId: string,
    userId: string,
  ): Promise<EscrowPaymentDocument> {
    const payment = await this.escrowPaymentRepo.findById(paymentId);
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

    // RLUSD는 TrustSet 서명에 seed 필요 → +wallet.seed 포함 조회
    const withSeed = payment.currency === "RLUSD";
    const [buyerUser, sellerUser] = await Promise.all([
      withSeed
        ? this.userFacade.findByIdWithSeed(payment.buyerId)
        : this.userFacade.findById(payment.buyerId),
      withSeed
        ? this.userFacade.findByIdWithSeed(payment.sellerId)
        : this.userFacade.findById(payment.sellerId),
    ]);

    if (!buyerUser?.wallet?.address) {
      throw new WalletNotAvailableException("Buyer");
    }

    if (payment.currency === "RLUSD") {
      if (!sellerUser?.wallet?.address || !sellerUser.wallet.seed) {
        throw new WalletNotAvailableException("Seller");
      }
      await Promise.all([
        this.xrplService.ensureRlusdTrustLine(
          buyerUser.wallet.address,
          buyerUser.wallet.seed,
        ),
        this.xrplService.ensureRlusdTrustLine(
          sellerUser.wallet.address,
          sellerUser.wallet.seed,
        ),
      ]);
      await this.xrplService.validateRlusdFunds(
        buyerUser.wallet.address,
        pendingEscrows,
      );
    } else {
      await this.xrplService.validateEscrowFunds(
        buyerUser.wallet.address,
        pendingEscrows,
      );
    }

    let initiated: EscrowPaymentDocument | null = null;
    const session = await this.escrowPaymentRepo.startSession();
    try {
      await session.withTransaction(async () => {
        initiated = await this.escrowPaymentRepo.markProcessing(
          paymentId,
          session,
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
   * 에스크로 전체 롤백 — EscrowCreateProcessor / EscrowSubmitRecoveryScheduler에서 호출
   * PENDING_ESCROW → CANCELLED, ESCROWED/SUBMITTING → CANCELLING
   */
  async rollbackAllEscrows(paymentId: string): Promise<void> {
    const payment = await this.escrowPaymentRepo.findById(paymentId);
    if (!payment) {
      this.logger.error(`rollbackAllEscrows: payment ${paymentId} not found`);
      return;
    }

    if (payment.status === "CANCELLED") return;

    for (const escrow of payment.escrows) {
      if (escrow.status === "PENDING_ESCROW") {
        escrow.status = "CANCELLED";
      } else if (
        escrow.status === "ESCROWED" ||
        escrow.status === "SUBMITTING"
      ) {
        escrow.status = "CANCELLING";
      }
    }

    payment.status = "CANCELLED";
    await this.escrowPaymentRepo.save(payment);
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
    const payment =
      await this.escrowPaymentRepo.findByIdWithFulfillment(paymentId);
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
      await this.escrowPaymentRepo.save(payment);
    }

    return payment;
  }

  private async releaseEscrow(
    payment: EscrowPaymentDocument,
    escrow: EscrowItem,
  ): Promise<void> {
    escrow.status = "RELEASING";
    await this.escrowPaymentRepo.save(payment);

    try {
      const buyerUser = await this.userFacade.findByIdWithSeed(payment.buyerId);

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

      await this.escrowPaymentRepo.save(payment);
      this.logger.log(`EscrowFinish success: txHash=${txHash}`);
    } catch (err: any) {
      this.logger.error(`EscrowFinish failed: ${err.message}`, err.stack);
      escrow.status = "ESCROWED";
      await this.escrowPaymentRepo.save(payment);
      throw err;
    }
  }

  async cancelEscrowItem(
    paymentId: string,
    escrowId: string,
  ): Promise<EscrowPaymentDocument> {
    const payment = await this.escrowPaymentRepo.findById(paymentId);
    if (!payment) throw new EscrowPaymentNotFoundException();

    const escrow = payment.escrows.find((e) => e._id.toString() === escrowId);
    if (!escrow) throw new EscrowItemNotFoundException();

    if (escrow.status !== "PENDING_ESCROW") {
      throw new InvalidEscrowCancelStatusException(escrow.status);
    }

    escrow.status = "CANCELLED";
    return this.escrowPaymentRepo.save(payment);
  }

  async getEscrowStatus(
    paymentId: string,
    escrowId: string,
  ): Promise<EscrowItem> {
    const payment = await this.escrowPaymentRepo.findByIdLean(paymentId);
    if (!payment) throw new EscrowPaymentNotFoundException();

    const escrow = payment.escrows.find((e) => e._id.toString() === escrowId);
    if (!escrow) throw new EscrowItemNotFoundException();

    return escrow;
  }
}
