import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, Model } from "mongoose";
import {
  OutboxEvent,
  OutboxEventDocument,
} from "./schemas/outbox-event.schema";

@Injectable()
export class OutboxService {
  constructor(
    @InjectModel(OutboxEvent.name)
    private readonly outboxModel: Model<OutboxEventDocument>,
  ) {}

  async createPendingEvent(
    session: ClientSession,
    eventType: string,
    payload: Record<string, any>,
  ): Promise<void> {
    await this.outboxModel.create([{ eventType, payload }], { session });
  }
}
