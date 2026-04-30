import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { User } from "./user.schema";

export type UserSellerDocument = UserSeller &
  User &
  Document & { _id: Types.ObjectId; type: "seller" };

@Schema()
export class UserSeller {
  @Prop({ type: [String], required: true })
  exportItems: string[];

  @Prop({ type: { city: String, state: String, country: String }, default: {} })
  location: { city: string; state: string; country: string };

  @Prop({
    enum: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
    default: "1-10",
  })
  sizeBucket: string;
}

export const UserSellerSchema = SchemaFactory.createForClass(UserSeller);

UserSellerSchema.index({ exportItems: 1 });
UserSellerSchema.index({ "location.country": 1 });
UserSellerSchema.index({ sizeBucket: 1 });
