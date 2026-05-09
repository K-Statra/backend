import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type EscrowPaymentDocument = EscrowPayment & Document;
export type EscrowPaymentStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PROCESSING"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";
export type EscrowItemStatus =
  | "PENDING_ESCROW"
  | "SUBMITTING"
  | "ESCROWED"
  | "RELEASING"
  | "RELEASED"
  | "CANCELLING"
  | "CANCELLED";

@Schema({ _id: false })
export class EventApproval {
  @Prop({ required: true }) eventType: string;
  @Prop({ default: false }) buyerApproved: boolean;
  @Prop() buyerApprovedAt?: Date;
  @Prop({ default: false }) sellerApproved: boolean;
  @Prop() sellerApprovedAt?: Date;
  @Prop() completedAt?: Date;
}

export const EventApprovalSchema = SchemaFactory.createForClass(EventApproval);

@Schema()
export class EscrowItem {
  _id: Types.ObjectId;

  @Prop({ required: true }) label: string;
  @Prop({ required: true, min: 0 }) amountXrp: number;
  @Prop({ required: true }) order: number;

  @Prop({
    type: String,
    enum: [
      "PENDING_ESCROW",
      "SUBMITTING",
      "ESCROWED",
      "RELEASING",
      "RELEASED",
      "CANCELLING",
      "CANCELLED",
    ],
    default: "PENDING_ESCROW",
  })
  status: EscrowItemStatus;

  @Prop({ type: [String], default: [] }) requiredEventTypes: string[];
  @Prop({ type: [EventApprovalSchema], default: [] })
  approvals: EventApproval[];

  @Prop() xrplSequence?: number;
  @Prop() condition?: string;
  @Prop({ select: false }) fulfillment?: string; // AES-256-GCM 암호화
  @Prop() txHashCreate?: string;
  @Prop() txHashRelease?: string;
  @Prop() submittingAt?: Date;
  @Prop() escrowedAt?: Date;
  @Prop() releasedAt?: Date;
}

export const EscrowItemSchema = SchemaFactory.createForClass(EscrowItem);

export type EscrowCurrency = "XRP" | "RLUSD";

@Schema({ timestamps: true })
export class EscrowPayment {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  buyerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  sellerId: Types.ObjectId;

  @Prop({ required: true, min: 0 }) totalAmountXrp: number;

  @Prop({ type: String, enum: ["XRP", "RLUSD"], default: "XRP" })
  currency: EscrowCurrency;

  @Prop({
    type: String,
    enum: [
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "PROCESSING",
      "ACTIVE",
      "COMPLETED",
      "CANCELLED",
    ],
    default: "DRAFT",
    index: true,
  })
  status: EscrowPaymentStatus;

  @Prop({ default: false }) buyerApproved: boolean;
  @Prop() buyerApprovedAt?: Date;
  @Prop({ default: false }) sellerApproved: boolean;
  @Prop() sellerApprovedAt?: Date;

  @Prop({ default: "" }) memo: string;

  @Prop({ type: [EscrowItemSchema], default: [] }) escrows: EscrowItem[];
}

export const EscrowPaymentSchema = SchemaFactory.createForClass(EscrowPayment);
EscrowPaymentSchema.index({ createdAt: -1 });
