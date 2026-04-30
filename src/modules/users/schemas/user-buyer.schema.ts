import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { User } from "./user.schema";

export type UserBuyerDocument = UserBuyer &
  User &
  Document & { _id: Types.ObjectId; type: "buyer" };

@Schema()
export class UserBuyer {
  @Prop({ type: [String], required: true })
  needs: string[];
}

export const UserBuyerSchema = SchemaFactory.createForClass(UserBuyer);

UserBuyerSchema.index({ needs: 1 });
