import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "./schemas/user.schema";
import { Buyer, BuyerSchema } from "./schemas/buyer.schema";
import { Company, CompanySchema } from "./schemas/company.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
        discriminators: [
          { name: Buyer.name, schema: BuyerSchema, value: "buyer" }, // buyer, company 는 User 의 하위 스키마
          { name: Company.name, schema: CompanySchema, value: "seller" },
        ],
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class UsersModule {}
