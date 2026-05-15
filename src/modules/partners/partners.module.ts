import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PartnersController } from "./partners.controller";
import { PartnersService } from "./partners.service";
import { EmbeddingsModule } from "../embeddings/embeddings.module";
import { UsersModule } from "../users/users.module";
import { Seller, SellerSchema } from "../sellers/schemas/seller.schema";
import { Buyer, BuyerSchema } from "../buyers/schemas/buyer.schema";

@Module({
  imports: [
    UsersModule,
    EmbeddingsModule,
    MongooseModule.forFeature([
      { name: Seller.name, schema: SellerSchema },
      { name: Buyer.name, schema: BuyerSchema },
    ]),
  ],
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
