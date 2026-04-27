import { Module } from "@nestjs/common";
import { BuyersController } from "./buyers.controller";
import { BuyersService } from "./buyers.service";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [UsersModule],
  controllers: [BuyersController],
  providers: [BuyersService],
  exports: [BuyersService, UsersModule],
})
export class BuyersModule {}
