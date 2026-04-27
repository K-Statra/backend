import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import envConfig from "./config/env.config";
import { PaymentsModule } from "./modules/payments/payments.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { PartnersModule } from "./modules/partners/partners.module";
import { MatchesModule } from "./modules/matches/matches.module";
import { BuyersModule } from "./modules/buyers/buyers.module";
import { ConsultationsModule } from "./modules/consultations/consultations.module";
import { AuthModule } from "./modules/auth/auth.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV}`, ".env.test", ".env"],
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
    ConsultationsModule,
    AuthModule,
  ],
})
export class AppModule {}
