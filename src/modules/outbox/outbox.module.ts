import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bull";
import { OutboxEvent, OutboxEventSchema } from "./schemas/outbox-event.schema";
import {
  StreamResumeToken,
  StreamResumeTokenSchema,
} from "./schemas/stream-resume-token.schema";
import { OutboxService } from "./outbox.service";
import { OutboxWatcherService } from "./outbox-watcher.service";
import { ESCROW_CREATE_QUEUE } from "../escrow-payments/escrow-create.constants";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OutboxEvent.name, schema: OutboxEventSchema },
      { name: StreamResumeToken.name, schema: StreamResumeTokenSchema },
    ]),
    BullModule.registerQueue({ name: ESCROW_CREATE_QUEUE }),
  ],
  providers: [OutboxService, OutboxWatcherService],
  exports: [OutboxService],
})
export class OutboxModule {}
