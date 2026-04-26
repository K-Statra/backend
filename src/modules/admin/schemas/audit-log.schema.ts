import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  @Prop({ required: true }) type: string;
  @Prop({ default: "system" }) actor: string;
  @Prop({ required: true }) entityType: string;
  @Prop({ required: true }) entityId: string;
  @Prop() requestId: string;
  @Prop({ type: Object, default: {} }) meta: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });
