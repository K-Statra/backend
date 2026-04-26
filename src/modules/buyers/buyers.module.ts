import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BuyersController } from "./buyers.controller";
import { BuyersService } from "./buyers.service";
import { Buyer, BuyerSchema } from "./schemas/buyer.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Buyer.name, schema: BuyerSchema }]),
  ],
  controllers: [BuyersController],
  providers: [BuyersService],
  exports: [BuyersService, MongooseModule],
})
export class BuyersModule {}
