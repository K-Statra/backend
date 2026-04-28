import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import {
  WalletInfo,
  WalletInfoSchema,
} from "../../../common/schemas/wallet-info.schema";

export type UserDocument = User & Document;

export { WalletInfo };

@Schema({
  discriminatorKey: "type",
  collection: "users",
  timestamps: true,
})
export class User {
  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ required: true })
  name: string; // 회사명

  @Prop({ required: true })
  contactName: string; // 담당자 이름

  @Prop({ required: true })
  phone: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [Number], default: [] })
  embedding: number[];

  @Prop({ required: true })
  companyIntroduction: string;

  @Prop({ required: true })
  productIntroduction: string;

  @Prop({ default: "" })
  websiteUrl: string;

  @Prop({ type: WalletInfoSchema })
  wallet?: WalletInfo;

  @Prop({
    enum: ["PENDING_ACTIVATION", "ACTIVE", "FAILED_ACTIVATION"],
    default: "PENDING_ACTIVATION",
  })
  status: string;

  // discriminator key — managed by Mongoose, declared for TypeScript
  type: "buyer" | "seller";
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ "wallet.address": 1 }, { unique: true, sparse: true });
UserSchema.index({ status: 1 });
UserSchema.index(
  { name: "text", companyIntroduction: "text", productIntroduction: "text" },
  { weights: { name: 10, companyIntroduction: 2, productIntroduction: 2 } },
);
