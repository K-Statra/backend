import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompanyDocument = Company & Document;

@Schema({ _id: true, id: false })
class MatchAnalysisItem {
  @Prop() label: string;
  @Prop() score: number;
  @Prop() description: string;
}

@Schema({ _id: true, id: false })
class CompanyImage {
  @Prop({ required: true }) url: string;
  @Prop({ default: '' }) caption: string;
  @Prop({ default: '' }) alt: string;
  @Prop({ type: [String], default: [] }) tags: string[];
  @Prop({ type: [Number], default: [] }) clipEmbedding: number[];
}

@Schema({ _id: true, id: false })
class Product {
  @Prop({ required: true }) name: string;
  @Prop() description: string;
  @Prop() imageUrl: string;
  @Prop() catalogUrl: string;
}

@Schema({ _id: true, id: false })
class Activity {
  @Prop({ enum: ['export', 'award', 'exhibition', 'article', 'other'], required: true }) type: string;
  @Prop() description: string;
  @Prop() date: Date;
  @Prop() url: string;
}

@Schema({ _id: false })
class DartInfo {
  @Prop() corpCode: string;
  @Prop() bizRegistrationNum: string;
  @Prop() fiscalYear: string;
  @Prop() reportDate: Date;
  @Prop() reportType: string;
  @Prop({ default: true }) isIFRS: boolean;
  @Prop() revenueConsolidated: number;
  @Prop() operatingProfitConsolidated: number;
  @Prop() netIncomeConsolidated: number;
  @Prop() revenueSeparate: number;
  @Prop() operatingProfitSeparate: number;
  @Prop() netIncomeSeparate: number;
  @Prop({ default: 'Financial Supervisory Service Open DART System' }) source: string;
  @Prop() lastUpdated: Date;
}

@Schema()
export class Company {
  @Prop({ required: true }) name: string;
  @Prop() industry: string;
  @Prop({ type: [String], default: [] }) offerings: string[];
  @Prop({ type: [String], default: [] }) needs: string[];
  @Prop({ type: [String], default: [] }) tags: string[];
  @Prop({ default: '' }) profileText: string;
  @Prop({ default: '' }) videoUrl: string;

  @Prop({ type: { city: String, state: String, country: String }, default: {} })
  location: { city: string; state: string; country: string };

  @Prop({ default: '' }) address: string;

  @Prop({
    enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
    default: '1-10',
  })
  sizeBucket: string;

  @Prop({ default: 0 }) projectsCount: number;
  @Prop({ default: 0 }) revenue: number;

  @Prop({ type: { name: String, email: String }, default: {} })
  primaryContact: { name: string; email: string };

  @Prop({ default: null }) accuracyScore: number;
  @Prop({ type: [MatchAnalysisItem], default: [] }) matchAnalysis: MatchAnalysisItem[];
  @Prop({ default: '' }) matchRecommendation: string;
  @Prop({ default: '' }) dataSource: string;
  @Prop() extractedAt: Date;

  @Prop({ type: [CompanyImage], default: [] }) images: CompanyImage[];
  @Prop({ type: [Product], default: [] }) products: Product[];
  @Prop({ type: [Activity], default: [] }) activities: Activity[];
  @Prop({ type: DartInfo }) dart: DartInfo;

  @Prop({ type: [Number], default: [] }) embedding: number[];
  @Prop({ default: Date.now }) updatedAt: Date;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
CompanySchema.index({ updatedAt: -1 });
CompanySchema.index({ name: 1 });
CompanySchema.index({ tags: 1 });
CompanySchema.index({ industry: 1 });
CompanySchema.index({ 'location.country': 1 });
CompanySchema.index({ name: 'text', profileText: 'text' }, { weights: { name: 10, profileText: 1 } });
