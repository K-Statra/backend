import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type PaymentDocument = Payment & Document;

export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED";
export type PaymentCurrency = "XRP" | "USD" | "KRW";

@Schema({ _id: false })
class PaymentEvent {
  @Prop({ required: true }) type: string;
  @Prop({ default: () => new Date() }) at: Date;
  @Prop({ type: Object, default: {} }) meta: Record<string, unknown>;
}

@Schema({ _id: false })
class PaymentInvoice {
  @Prop({ default: "" }) qr: string;
  @Prop({ default: "" }) deeplink: string;
  @Prop() expiresAt: Date;
  @Prop({ default: "" }) destAddress: string;
  @Prop() destTag: number;
}

@Schema({ _id: false })
class PaymentQuote {
  @Prop({ default: "" }) baseCurrency: string;
  @Prop({ default: "" }) quoteCurrency: string;
  @Prop() rate: number;
  @Prop() amountQuote: number;
  @Prop() expiresAt: Date;
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: "Buyer", required: true, index: true })
  buyerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Company", required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, min: 0 }) amount: number;

  @Prop({ enum: ["XRP", "USD", "KRW"], default: "XRP" })
  currency: PaymentCurrency;

  @Prop({ required: true, unique: true, index: true })
  idempotencyKey: string;

  @Prop({ required: true }) requestHash: string;

  @Prop({ default: "xrpl-testnet", index: true }) provider: string;
  @Prop({ default: "" }) providerRef: string;

  @Prop({ type: PaymentInvoice }) invoice: PaymentInvoice;
  @Prop({ type: PaymentQuote }) quote: PaymentQuote;

  @Prop({
    type: String,
    enum: ["CREATED", "PENDING", "PAID", "FAILED", "CANCELLED"],
    default: "CREATED",
    index: true,
  })
  status: PaymentStatus;

  @Prop({ default: "" }) memo: string;

  @Prop({ type: [PaymentEvent], default: [] })
  events: PaymentEvent[];
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ createdAt: -1 });
