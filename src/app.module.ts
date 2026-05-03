import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import envConfig from "./config/env.config";
import { PaymentsModule } from "./modules/payments/payments.module";
import { SellersModule } from "./modules/sellers/sellers.module";
import { PartnersModule } from "./modules/partners/partners.module";
import { BuyersModule } from "./modules/buyers/buyers.module";
import { ConsultationsModule } from "./modules/consultations/consultations.module";
import { AuthModule } from "./modules/auth/auth.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || "development"}`, ".env"],
      load: [envConfig],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("mongodb.uri"),
        dbName: config.get<string>("mongodb.dbName"),
      }),
    }),
    PaymentsModule,
    SellersModule,
    PartnersModule,
    BuyersModule,
    ConsultationsModule,
    AuthModule,
  ],
})
export class AppModule {}
