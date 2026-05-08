import { Module } from "@nestjs/common";
import { MyBusinessController } from "./my-business.controller";
import { MyBusinessService } from "./my-business.service";
import { UsersModule } from "../users/users.module";
import { SellersModule } from "../sellers/sellers.module";
import { BuyersModule } from "../buyers/buyers.module";

@Module({
  imports: [UsersModule, SellersModule, BuyersModule],
  controllers: [MyBusinessController],
  providers: [MyBusinessService],
})
export class MyBusinessModule {}
