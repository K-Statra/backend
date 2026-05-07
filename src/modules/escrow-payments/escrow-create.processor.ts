import { Processor, Process, OnQueueFailed } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import type { Job } from "bull";
import { EscrowPaymentsService } from "./escrow-payments.service";
import {
  ESCROW_CREATE_QUEUE,
  EscrowCreateJobData,
} from "./escrow-create.constants";

// 재시도해도 해결되지 않는 XRPL 오류 코드 (잔고·금액 관련)
const AMOUNT_ERROR_CODES = [
  "tecUNFUNDED", // 잔고 부족
  "tecINSUF_RESERVE", // reserve 부족
  "temBAD_AMOUNT", // 금액 형식 오류
  "temINSUF_FEE_P", // 수수료 부족
];

function isAmountError(err: Error): boolean {
  return AMOUNT_ERROR_CODES.some((code) => err.message.includes(code));
}

@Processor(ESCROW_CREATE_QUEUE)
export class EscrowCreateProcessor {
  private readonly logger = new Logger(EscrowCreateProcessor.name);

  constructor(private readonly escrowPaymentsService: EscrowPaymentsService) {}

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
      if (current.status !== "PENDING_ESCROW") {
        this.logger.warn(
          `Unexpected status ${current.status} for escrowId=${escrowId}, skipping`,
        );
        continue;
      }

      try {
        await this.escrowPaymentsService.createXrplEscrow(paymentId, escrowId);
      } catch (err: any) {
        if (isAmountError(err)) {
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
    await this.escrowPaymentsService.rollbackAllEscrows(job.data.paymentId);
  }
}
