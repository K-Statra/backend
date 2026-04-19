import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MatchFeedbackDocument = MatchFeedback & Document;

@Schema({ timestamps: true })
export class MatchFeedback {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 }) rating: number;
  @Prop({ default: '' }) comments: string;
  @Prop({ default: '' }) locale: string;
  @Prop({ default: '' }) source: string;
}

export const MatchFeedbackSchema = SchemaFactory.createForClass(MatchFeedback);
MatchFeedbackSchema.index({ companyId: 1, createdAt: -1 });
