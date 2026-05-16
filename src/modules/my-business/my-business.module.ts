import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MyBusinessController } from "./my-business.controller";
import { MyBusinessService } from "./my-business.service";
import { UsersModule } from "../users/users.module";
import { Seller, SellerSchema } from "../sellers/schemas/seller.schema";
import { Buyer, BuyerSchema } from "../buyers/schemas/buyer.schema";

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Seller.name, schema: SellerSchema },
      { name: Buyer.name, schema: BuyerSchema },
    ]),
  ],
  controllers: [MyBusinessController],
  providers: [MyBusinessService],
})
export class MyBusinessModule {}
