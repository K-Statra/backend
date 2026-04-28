import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { User } from "./user.schema";

export type BuyerDocument = Buyer &
  User &
  Document & { _id: Types.ObjectId; type: "buyer" };

// User 스키마를 상속받아 Buyer 스키마를 정의합니다.
@Schema()
export class Buyer {
  @Prop({ type: [String], required: true })
  needs: string[];

  @Prop({ type: [String], default: [] })
  industries: string[];
}

export const BuyerSchema = SchemaFactory.createForClass(Buyer);

BuyerSchema.index({ needs: 1 });
BuyerSchema.index({ industries: 1 });
