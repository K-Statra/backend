import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConsultantRequestDocument = ConsultantRequest & Document;

@Schema({ timestamps: true })
export class ConsultantRequest {
  @Prop({ required: true, trim: true, maxlength: 200 })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 200 })
  email: string;

  @Prop({ trim: true, maxlength: 4000 })
  details: string;

  @Prop({ trim: true, default: 'matching-assistant', maxlength: 120 })
  serviceType: string;

  @Prop({ trim: true, maxlength: 12 })
  locale: string;

  @Prop({ trim: true, maxlength: 60, default: 'partner-search' })
  source: string;

  @Prop({ enum: ['NEW', 'IN_PROGRESS', 'CLOSED'], default: 'NEW' })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Buyer' })
  buyerId: Types.ObjectId;

  @Prop({ trim: true, maxlength: 200 })
  buyerName: string;

  @Prop({ trim: true, maxlength: 200 })
  searchTerm: string;

  @Prop({ type: Object, default: {} })
  filters: Record<string, any>;
}

export const ConsultantRequestSchema =
  SchemaFactory.createForClass(ConsultantRequest);
