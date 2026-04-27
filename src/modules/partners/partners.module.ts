import { Module } from "@nestjs/common";
import { PartnersController } from "./partners.controller";
import { PartnersService } from "./partners.service";
import { EmbeddingsModule } from "../embeddings/embeddings.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [UsersModule, EmbeddingsModule],
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
