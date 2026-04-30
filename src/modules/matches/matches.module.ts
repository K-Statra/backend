import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MatchesController } from "./matches.controller";
import { MatchesService } from "./matches.service";
import { MatchLog, MatchLogSchema } from "./schemas/match-log.schema";
import {
  MatchFeedback,
  MatchFeedbackSchema,
} from "./schemas/match-feedback.schema";
import { SellersModule } from "../sellers/sellers.module";
import { BuyersModule } from "../buyers/buyers.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MatchLog.name, schema: MatchLogSchema },
      { name: MatchFeedback.name, schema: MatchFeedbackSchema },
    ]),
    SellersModule,
    BuyersModule,
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
})
export class MatchesModule {}
