import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type SellerDocument = Seller & Document;

@Schema({ collection: "sellers", timestamps: true })
export class Seller {
  @Prop({ required: true, index: true })
  name: string;

  @Prop()
  nameEn?: string;

  @Prop({ index: true })
  industry: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [Number], default: [] })
  embedding: number[];

  @Prop({ type: { city: String, state: String, country: String }, default: {} })
  location: { city: string; state: string; country: string };

  @Prop({
    enum: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
    default: "1-10",
  })
  sizeBucket: string;

  @Prop({ default: "" })
  address?: string;

  @Prop({ type: Object })
  dart?: {
    corpCode: string;
    bizRegistrationNum: string;
    isIFRS: boolean;
    source: string;
  };

  @Prop({ type: Object })
  culturalTraits?: {
    innovationScore: number;
    speedScore: number;
    keywords: string[];
    summary: string;
  };

  @Prop()
  profileText?: string;

  @Prop()
  stockCode?: string;

  @Prop()
  ksicCode?: string;

  @Prop({ type: Object })
  primaryContact?: {
    email: string;
    name: string;
  };

  @Prop({ default: "" })
  dataSource?: string;

  @Prop({ type: [String], default: [] })
  activities: string[];

  @Prop({ type: [String], default: [] })
  products: string[];
}

export const SellerSchema = SchemaFactory.createForClass(Seller);

SellerSchema.index({ name: "text", profileText: "text" });
SellerSchema.index({ "location.country": 1 });
SellerSchema.index({ tags: 1 });
