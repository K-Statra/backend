import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  EscrowPayment,
  EscrowPaymentDocument,
} from "./schemas/escrow-payment.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { EscrowPaymentsService } from "./escrow-payments.service";

// 이 시간보다 오래된 SUBMITTING만 처리 — 정상 진행 중인 요청과 구분
const SUBMITTING_TIMEOUT_MS = 5 * 60 * 1000;

@Injectable()
export class EscrowSubmitRecoveryScheduler {
  private readonly logger = new Logger(EscrowSubmitRecoveryScheduler.name);

  constructor(
    @InjectModel(EscrowPayment.name)
    private readonly escrowPaymentModel: Model<EscrowPaymentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly escrowPaymentsService: EscrowPaymentsService,
  ) {}

  /**
   * 프로세스 크래시로 SUBMITTING에 고착된 에스크로 복구
   * XRPL 조회로 제출 여부 확인 → 있으면 ESCROWED 복구, 없으면 결제 취소
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async recoverStuckSubmittingEscrows(): Promise<void> {
    const cutoff = new Date(Date.now() - SUBMITTING_TIMEOUT_MS);

    const payments = await this.escrowPaymentModel.find({
      escrows: {
        $elemMatch: { status: "SUBMITTING", submittingAt: { $lt: cutoff } },
      },
    });

    if (payments.length === 0) return;

    this.logger.log(
      `Found ${payments.length} payment(s) with stuck SUBMITTING escrow(s)`,
    );

    for (const payment of payments) {
      const buyerUser = await this.userModel.findById(payment.buyerId);
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
          const outcome =
            await this.escrowPaymentsService.recoverSubmittingEscrow(
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
}
