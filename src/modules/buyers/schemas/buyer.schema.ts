import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type BuyerDocument = Buyer & Document;

@Schema()
export class Buyer {
  @Prop({ required: true, index: true }) name: string;
  @Prop({ default: "" }) country: string;
  @Prop({ type: [String], default: [] }) industries: string[];
  @Prop({ type: [String], default: [] }) needs: string[];
  @Prop({ type: [String], default: [] }) tags: string[];
  @Prop({ default: "" }) profileText: string;
  @Prop({ type: [Number], default: [] }) embedding: number[];
  @Prop({ default: Date.now }) updatedAt: Date;
}

export const BuyerSchema = SchemaFactory.createForClass(Buyer);
BuyerSchema.index({ updatedAt: -1 });
BuyerSchema.index({ tags: 1 });
BuyerSchema.index({ industries: 1 });
