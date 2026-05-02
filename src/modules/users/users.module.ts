import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "./schemas/user.schema";
import { UserBuyer, UserBuyerSchema } from "./schemas/user-buyer.schema";
import { UserSeller, UserSellerSchema } from "./schemas/user-seller.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
        discriminators: [
          { name: UserBuyer.name, schema: UserBuyerSchema, value: "buyer" },
          { name: UserSeller.name, schema: UserSellerSchema, value: "seller" },
        ],
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class UsersModule {}
