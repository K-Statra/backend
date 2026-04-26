import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import envConfig from "./config/env.config";
import { PaymentsModule } from "./modules/payments/payments.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { PartnersModule } from "./modules/partners/partners.module";
import { MatchesModule } from "./modules/matches/matches.module";
import { BuyersModule } from "./modules/buyers/buyers.module";
import { AdminModule } from "./modules/admin/admin.module";
import { InsightsModule } from "./modules/insights/insights.module";
import { ConsultantsModule } from "./modules/consultants/consultants.module";
import { ConsultationsModule } from "./modules/consultations/consultations.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("mongodb.uri"),
      }),
    }),
    PaymentsModule,
    CompaniesModule,
    PartnersModule,
    MatchesModule,
    BuyersModule,
    AdminModule,
    InsightsModule,
    ConsultantsModule,
    ConsultationsModule,
  ],
})
export class AppModule {}
