import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type BuyerDocument = Buyer & Document;

@Schema({ collection: "buyer", timestamps: true })
export class Buyer {
  @Prop({ required: true, index: true })
  name_kr: string;

  @Prop({ index: true })
  name_en: string;

  @Prop()
  country: string;

  @Prop()
  intro_kr: string;

  @Prop()
  intro_en: string;

  @Prop()
  website: string;

  @Prop()
  industry_kr: string;

  @Prop()
  industry_en: string;

  @Prop()
  email: string;

  @Prop()
  source_file: string;

  @Prop({ type: [Number], default: [] })
  embedding: number[];
}

export const BuyerSchema = SchemaFactory.createForClass(Buyer);

BuyerSchema.index({
  name_kr: "text",
  name_en: "text",
  intro_kr: "text",
  intro_en: "text",
});
BuyerSchema.index({ country: 1 });
BuyerSchema.index({ industry_kr: 1 });
BuyerSchema.index({ industry_en: 1 });
