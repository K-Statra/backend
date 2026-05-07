import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UsersModule } from "../users/users.module";
import { XrplModule } from "../xrpl/xrpl.module";

@Module({
  imports: [ScheduleModule.forRoot(), UsersModule, XrplModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
