import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";

export type OutboxEventStatus = "PENDING" | "PUBLISHED" | "FAILED";

@Schema({ timestamps: true, collection: "outbox_events" })
export class OutboxEvent {
  @Prop({ required: true })
  eventType: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload: Record<string, any>;

  @Prop({
    type: String,
    enum: ["PENDING", "PUBLISHED", "FAILED"],
    default: "PENDING",
    index: true,
  })
  status: OutboxEventStatus;

  @Prop() publishedAt?: Date;
  @Prop() failedReason?: string;
}

export type OutboxEventDocument = OutboxEvent & Document;
export const OutboxEventSchema = SchemaFactory.createForClass(OutboxEvent);
OutboxEventSchema.index({ status: 1, createdAt: 1 });
