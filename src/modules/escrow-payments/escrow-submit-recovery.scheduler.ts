import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EscrowPaymentsService } from "./escrow-payments.service";
import { XrplService } from "../xrpl/xrpl.service";
import { EscrowPaymentRepository } from "./repositories/escrow-payment.repository";
import { UserFacade } from "./repositories/user.facade";

// 이 시간보다 오래된 SUBMITTING만 처리 — 정상 진행 중인 요청과 구분
const SUBMITTING_TIMEOUT_MS = 5 * 60 * 1000;

@Injectable()
export class EscrowSubmitRecoveryScheduler {
  private readonly logger = new Logger(EscrowSubmitRecoveryScheduler.name);

  constructor(
    private readonly escrowPaymentRepo: EscrowPaymentRepository,
    private readonly userFacade: UserFacade,
    private readonly xrplService: XrplService,
    private readonly escrowPaymentsService: EscrowPaymentsService,
  ) {}

  /**
   * 프로세스 크래시로 SUBMITTING에 고착된 에스크로 복구
   * XRPL 조회로 제출 여부 확인 → 있으면 ESCROWED 복구, 없으면 결제 취소
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async recoverStuckSubmittingEscrows(): Promise<void> {
    const cutoff = new Date(Date.now() - SUBMITTING_TIMEOUT_MS);
    const payments = await this.escrowPaymentRepo.findStuckSubmitting(cutoff);

    if (payments.length === 0) return;

    this.logger.log(
      `Found ${payments.length} payment(s) with stuck SUBMITTING escrow(s)`,
    );

    for (const payment of payments) {
      const buyerUser = await this.userFacade.findById(payment.buyerId);
      if (!buyerUser?.wallet?.address) {
        this.logger.warn(
          `Buyer wallet unavailable for payment ${payment._id.toString()}`,
        );
        continue;
      }

      const stuckEscrows = payment.escrows.filter(
        (e) =>
          e.status === "SUBMITTING" &&
          e.submittingAt != null &&
          e.submittingAt < cutoff,
      );

      for (const escrow of stuckEscrows) {
        const paymentId = payment._id.toString();
        const escrowId = escrow._id.toString();
        try {
          const outcome = await this.recoverSubmittingEscrow(
            paymentId,
            escrowId,
            buyerUser.wallet.address,
          );
          if (outcome === "recovered") {
            this.logger.log(
              `Recovered SUBMITTING escrow: paymentId=${paymentId} escrowId=${escrowId}`,
            );
          } else {
            this.logger.warn(
              `Payment cancelled — SUBMITTING escrow not found on XRPL: paymentId=${paymentId} escrowId=${escrowId}`,
            );
          }
        } catch (err: any) {
          this.logger.error(
            `Recovery failed: paymentId=${paymentId} escrowId=${escrowId} — ${err.message}`,
            err.stack,
          );
        }
      }
    }
  }

  /**
   * SUBMITTING 에스크로 복구 — XRPL 조회 결과에 따라 ESCROWED 복구 또는 결제 전체 취소
   */
  async recoverSubmittingEscrow(
    paymentId: string,
    escrowId: string,
    buyerAddress: string,
  ): Promise<"recovered" | "cancelled"> {
    const escrow = await this.escrowPaymentsService.getEscrowStatus(
      paymentId,
      escrowId,
    );
    if (escrow.status !== "SUBMITTING") return "recovered"; // 이미 다른 경로로 처리됨

    if (!escrow.condition) {
      // condition 미저장 = pre-flight 전에 프로세스 종료 → XRPL 제출 안 됨
      await this.cancelSubmittingEscrowAndRollback(paymentId, escrowId);
      return "cancelled";
    }

    // XRPL 서버에 접속하여 sequence, txHash 를 가져옴
    const xrplResult = await this.xrplService.findEscrowByCondition(
      buyerAddress,
      escrow.condition,
    );

    if (xrplResult) {
      // XRPL에 에스크로 존재 → DB만 업데이트하면 복구 완료
      const result = await this.escrowPaymentRepo.markEscrowed(
        paymentId,
        escrowId,
        xrplResult.sequence,
        xrplResult.txHash,
      );
      if (!result) return "recovered";

      const allEscrowed = result.escrows.every(
        (e) =>
          e.status === "ESCROWED" ||
          e.status === "RELEASED" ||
          e.status === "CANCELLED",
      );
      if (allEscrowed) {
        await this.escrowPaymentRepo.markActive(paymentId);
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
    await this.escrowPaymentRepo.cancelSubmittingEscrow(paymentId, escrowId);
    await this.escrowPaymentsService.rollbackAllEscrows(paymentId);
  }
}
