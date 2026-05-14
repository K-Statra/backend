import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { XrplService, XrplWallet } from "../xrpl/xrpl.service";
import { EscrowPaymentRepository } from "./repositories/escrow-payment.repository";
import { UserFacade } from "./repositories/user.facade";

@Injectable()
export class EscrowCancelScheduler {
  private readonly logger = new Logger(EscrowCancelScheduler.name);

  constructor(
    private readonly escrowPaymentRepo: EscrowPaymentRepository,
    private readonly userFacade: UserFacade,
    private readonly xrplService: XrplService,
  ) {}

  /**
   * CANCELLING 상태 에스크로 재시도
   * XRPL CancelAfter가 지난 후 EscrowCancel 제출 — 실패 시 다음 틱에 재시도
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processCancellingEscrows(): Promise<void> {
    const payments = await this.escrowPaymentRepo.findCancelling();

    if (payments.length === 0) return;

    this.logger.log(
      `Processing CANCELLING escrows in ${payments.length} payment(s)`,
    );

    for (const payment of payments) {
      const buyerUser = await this.userFacade.findByIdWithSeed(payment.buyerId);

      if (!buyerUser?.wallet?.seed) {
        this.logger.warn(
          `Buyer wallet unavailable for payment ${payment._id.toString()}`,
        );
        continue;
      }

      const decryptedSeed = this.xrplService.decrypt(buyerUser.wallet.seed);
      const buyerWallet: XrplWallet = {
        address: buyerUser.wallet.address,
        seed: decryptedSeed,
        publicKey: buyerUser.wallet.publicKey,
        privateKey: "",
      };

      for (const escrow of payment.escrows) {
        if (escrow.status !== "CANCELLING" || !escrow.xrplSequence) continue;
        try {
          await this.xrplService.cancelEscrow(
            buyerWallet,
            buyerUser.wallet.address,
            escrow.xrplSequence,
          );

          escrow.status = "CANCELLED";
          await this.escrowPaymentRepo.save(payment);
          this.logger.log(
            `EscrowCancel success: seq=${escrow.xrplSequence} payment=${payment._id.toString()}`,
          );
        } catch (err: any) {
          // CancelAfter 미도래 등 — 다음 틱에 재시도
          this.logger.warn(
            `EscrowCancel failed for seq=${escrow.xrplSequence}: ${err.message}`,
          );
        }
      }
    }
  }
}
