import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConsultationsController } from "./consultations.controller";
import { ConsultationsService } from "./consultations.service";
import {
  Consultation,
  ConsultationSchema,
} from "./schemas/consultation.schema";
import { BuyersModule } from "../buyers/buyers.module";
import { CompaniesModule } from "../companies/companies.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Consultation.name, schema: ConsultationSchema },
    ]),
    BuyersModule,
    CompaniesModule,
  ],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
})
export class ConsultationsModule {}
