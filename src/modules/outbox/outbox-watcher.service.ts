import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { InjectQueue } from "@nestjs/bull";
import type { Queue } from "bull";
import { Model } from "mongoose";
import {
  OutboxEvent,
  OutboxEventDocument,
} from "./schemas/outbox-event.schema";
import {
  StreamResumeToken,
  StreamResumeTokenDocument,
} from "./schemas/stream-resume-token.schema";
import {
  ESCROW_CREATE_QUEUE,
  EscrowCreateJobData,
} from "../escrow-payments/escrow-create.constants";

const STREAM_ID = "outbox";
/**
 * outbox_events 컬렉션을 실시간으로 감시하다가 새 이벤트가 들어오면 즉시 Bull Queue에 넣어주는 서비스입니다.
 * Cron 폴링 대신 MongoDB Change Streams를 써서 지연 없이 처리합니다.
 */
@Injectable()
export class OutboxWatcherService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxWatcherService.name);
  private changeStream: any = null;
  private isShuttingDown = false;

  constructor(
    @InjectModel(OutboxEvent.name)
    private readonly outboxModel: Model<OutboxEventDocument>,
    @InjectModel(StreamResumeToken.name)
    private readonly resumeTokenModel: Model<StreamResumeTokenDocument>,
    @InjectQueue(ESCROW_CREATE_QUEUE)
    private readonly escrowCreateQueue: Queue<EscrowCreateJobData>,
  ) {}

  async onApplicationBootstrap() {
    // 서버 시작 시 미처리된 PENDING 이벤트 먼저 처리 (다운타임 동안 누락된 이벤트 보정)
    await this.processPendingEvents();
    await this.startWatcher();
  }

  async onApplicationShutdown() {
    this.isShuttingDown = true;
    await this.changeStream?.close();
  }

  private async processPendingEvents() {
    const pending = await this.outboxModel
      .find({ status: "PENDING" })
      .sort({ createdAt: 1 });

    if (pending.length === 0) return;

    this.logger.log(
      `Processing ${pending.length} pending outbox events from startup`,
    );
    for (const event of pending) {
      await this.handleEvent(event, null);
    }
  }

  private async startWatcher() {
    const resumeTokenDoc = await this.resumeTokenModel.findOne({
      streamId: STREAM_ID,
    });
    const options: Record<string, any> = {};
    if (resumeTokenDoc?.token) {
      options.resumeAfter = resumeTokenDoc.token;
    }

    try {
      this.changeStream = this.outboxModel.watch(
        [{ $match: { operationType: "insert" } }],
        options,
      );
    } catch {
      // resume token이 만료됐을 경우 토큰 없이 재시작
      this.changeStream = this.outboxModel.watch([
        { $match: { operationType: "insert" } },
      ]);
    }

    this.changeStream.on("change", async (event: any) => {
      const doc = event.fullDocument as OutboxEventDocument;
      if (!doc || doc.status !== "PENDING") return;
      await this.handleEvent(doc, event._id);
    });

    this.changeStream.on("error", async (err: Error) => {
      if (this.isShuttingDown) return;
      this.logger.error(`Change stream error: ${err.message}`, err.stack);
      await this.restartWithBackoff();
    });

    this.logger.log("Outbox change stream watcher started");
  }

  private async handleEvent(doc: OutboxEventDocument, resumeToken: any) {
    try {
      // 원자적 acquire: 다중 인스턴스 환경에서 중복 처리 방지
      const acquired = await this.outboxModel.findOneAndUpdate(
        { _id: doc._id, status: "PENDING" },
        { status: "PUBLISHED", publishedAt: new Date() },
        { returnDocument: "before" },
      );
      if (!acquired) return; // 다른 인스턴스가 먼저 처리함

      // 금액 오류는 프로세서에서 즉시 중단, 그 외(네트워크 등)는 적극 재시도
      // 10회, 초기 60초 지수 백오프 → 최대 누적 대기 ~17시간
      await this.escrowCreateQueue.add(doc.payload as EscrowCreateJobData, {
        attempts: 10,
        backoff: { type: "exponential", delay: 60_000 },
      });

      if (resumeToken) {
        await this.resumeTokenModel.findOneAndUpdate(
          { streamId: STREAM_ID },
          { token: resumeToken },
          { upsert: true },
        );
      }

      this.logger.log(
        `Outbox event published: ${doc._id.toString()} (type=${doc.eventType})`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to publish outbox event ${doc._id.toString()}: ${err.message}`,
      );
      await this.outboxModel.findByIdAndUpdate(doc._id, {
        status: "FAILED",
        failedReason: err.message,
      });
    }
  }

  private async restartWithBackoff(attempt = 0) {
    const delay = Math.min(1_000 * 2 ** attempt, 30_000);
    this.logger.log(
      `Restarting change stream in ${delay}ms (attempt ${attempt + 1})`,
    );
    await new Promise((r) => setTimeout(r, delay));

    try {
      await this.changeStream?.close();
      await this.startWatcher();
    } catch (err: any) {
      this.logger.error(`Change stream restart failed: ${err.message}`);
      if (!this.isShuttingDown) {
        await this.restartWithBackoff(attempt + 1);
      }
    }
  }
}
