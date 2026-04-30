import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ConsultationDocument = Consultation & Document;

export enum ReqType {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
}

export enum ConsultationStatus {
  REQUESTED = "REQUESTED",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
  PAYMENT_PENDING = "PAYMENT_PENDING",
}

@Schema({ timestamps: true })
export class Consultation {
  @Prop({ type: Types.ObjectId, ref: "Buyer", required: true })
  buyerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Seller", required: true })
  sellerId: Types.ObjectId;

  @Prop({ trim: true })
  buyerName: string;

  @Prop({ trim: true })
  sellerName: string;

  @Prop({ enum: ReqType, default: ReqType.OFFLINE })
  reqType: ReqType;

  @Prop({ default: "KOAA SHOW 2026" })
  exhibitionName: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  timeSlot: string;

  @Prop({ trim: true })
  boothNumber: string;

  @Prop({ trim: true })
  meetingLink: string;

  @Prop({
    enum: ConsultationStatus,
    default: ConsultationStatus.REQUESTED,
  })
  status: ConsultationStatus;

  @Prop({ trim: true, maxlength: 4000 })
  message: string;

  @Prop({ type: Types.ObjectId, ref: "Payment" })
  paymentId: Types.ObjectId;
}

export const ConsultationSchema = SchemaFactory.createForClass(Consultation);
ConsultationSchema.index({ buyerId: 1 });
ConsultationSchema.index({ sellerId: 1 });
ConsultationSchema.index({ date: 1, timeSlot: 1 });
