import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SellersController } from "./sellers.controller";
import { SellersService } from "./sellers.service";
import { Seller, SellerSchema } from "./schemas/seller.schema";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Seller.name, schema: SellerSchema }]),
    UsersModule,
  ],
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService, MongooseModule],
})
export class SellersModule {}
