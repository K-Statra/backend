import { Module } from "@nestjs/common";
import { InsightsController } from "./insights.controller";
import { InsightsService } from "./insights.service";
import { CompaniesModule } from "../companies/companies.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [CompaniesModule, PaymentsModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
