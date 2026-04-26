import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { XrplService } from "./xrpl.service";
import { Payment, PaymentSchema } from "./schemas/payment.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, XrplService],
  exports: [PaymentsService, XrplService, MongooseModule],
})
export class PaymentsModule {}
