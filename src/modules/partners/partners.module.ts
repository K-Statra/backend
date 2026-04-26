import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PartnersController } from "./partners.controller";
import { PartnersService } from "./partners.service";
import { Company, CompanySchema } from "../companies/schemas/company.schema";
import { EmbeddingsModule } from "../embeddings/embeddings.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Company.name, schema: CompanySchema }]),
    EmbeddingsModule,
  ],
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
