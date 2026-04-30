import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type MatchLogDocument = MatchLog & Document;

@Schema({ _id: false })
class MatchResult {
  @Prop({ type: Types.ObjectId, ref: "Seller", index: true })
  sellerId: Types.ObjectId;
  @Prop({ default: 0 }) score: number;
  @Prop({ type: [String], default: [] }) reasons: string[];
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class MatchLog {
  @Prop({ type: Types.ObjectId, ref: "Buyer", index: true, required: true })
  buyerId: Types.ObjectId;

  @Prop({ type: { limit: Number }, default: { limit: 10 } })
  params: { limit: number };

  @Prop({ type: [MatchResult], default: [] })
  results: MatchResult[];
}

export const MatchLogSchema = SchemaFactory.createForClass(MatchLog);
MatchLogSchema.index({ createdAt: -1 });
