import { Module } from "@nestjs/common";
import { PartnersController } from "./partners.controller";
import { PartnersService } from "./partners.service";
import { EmbeddingsModule } from "../embeddings/embeddings.module";
import { UsersModule } from "../users/users.module";
import { SellersModule } from "../sellers/sellers.module";
import { BuyersModule } from "../buyers/buyers.module";

@Module({
  imports: [UsersModule, EmbeddingsModule, SellersModule, BuyersModule],
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
