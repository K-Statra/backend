import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { User } from "./user.schema";

export type CompanyDocument = Company & User & { _id: any; type: "seller" };

// User 스키마를 상속받아 Company 스키마를 정의합니다.
@Schema()
export class Company {
  @Prop({ type: [String], required: true })
  exportItems: string[];

  @Prop({ default: "" })
  industry: string;

  @Prop({ type: { city: String, state: String, country: String }, default: {} })
  location: { city: string; state: string; country: string };

  @Prop({
    enum: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
    default: "1-10",
  })
  sizeBucket: string;
}

export const CompanySchema = SchemaFactory.createForClass(Company);

CompanySchema.index({ exportItems: 1 });
CompanySchema.index({ industry: 1 });
CompanySchema.index({ "location.country": 1 });
CompanySchema.index({ sizeBucket: 1 });
