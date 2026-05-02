import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConsultationsController } from "./consultations.controller";
import { ConsultationsService } from "./consultations.service";
import {
  Consultation,
  ConsultationSchema,
} from "./schemas/consultation.schema";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Consultation.name, schema: ConsultationSchema },
    ]),
    UsersModule,
  ],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
})
export class ConsultationsModule {}
