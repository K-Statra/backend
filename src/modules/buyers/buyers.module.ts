import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BuyersController } from "./buyers.controller";
import { BuyersService } from "./buyers.service";
import { Buyer, BuyerSchema } from "./schemas/buyer.schema";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Buyer.name, schema: BuyerSchema }]),
    UsersModule,
  ],
  controllers: [BuyersController],
  providers: [BuyersService],
  exports: [BuyersService, MongooseModule],
})
export class BuyersModule {}
