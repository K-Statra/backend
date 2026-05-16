import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bull";
import envConfig from "./config/env.config";
import { XrplModule } from "./modules/xrpl/xrpl.module";
import { PartnersModule } from "./modules/partners/partners.module";
import { AuthModule } from "./modules/auth/auth.module";
import { MyBusinessModule } from "./modules/my-business/my-business.module";
import { EscrowPaymentsModule } from "./modules/escrow-payments/escrow-payments.module";

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
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>("REDIS_HOST") || "localhost",
          port: config.get<number>("REDIS_PORT") || 6379,
          password: config.get<string>("REDIS_PASSWORD") || undefined,
        },
      }),
    }),
    XrplModule,
    PartnersModule,
    AuthModule,
    MyBusinessModule,
    EscrowPaymentsModule,
  ],
})
export class AppModule {}
