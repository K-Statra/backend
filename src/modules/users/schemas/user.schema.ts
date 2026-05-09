import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
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
  industries: string[];

  @Prop({ required: false })
  sellerIntroduction: string;

  @Prop({ required: false })
  productIntroduction: string;

  @Prop({ type: WalletInfoSchema })
  wallet?: WalletInfo;

  @Prop({
    enum: ["PENDING_ACTIVATION", "ACTIVE", "FAILED_ACTIVATION"],
    default: "PENDING_ACTIVATION",
  })
  status: string;

  @Prop({
    type: [
      {
        partnerId: { type: Types.ObjectId },
        partnerType: { type: String, enum: ["seller", "buyer"] },
      },
    ],
    default: [],
  })
  savedPartners: Array<{
    partnerId: Types.ObjectId;
    partnerType: "seller" | "buyer";
  }>;

  // discriminator key — managed by Mongoose, declared for TypeScript
  type: "buyer" | "seller";
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ "wallet.address": 1 }, { unique: true, sparse: true });
UserSchema.index({ status: 1 });
UserSchema.index(
  { name: "text", sellerIntroduction: "text", productIntroduction: "text" },
  { weights: { name: 10, sellerIntroduction: 2, productIntroduction: 2 } },
);
