import { Module } from "@nestjs/common";
import { MyBusinessController } from "./my-business.controller";
import { MyBusinessService } from "./my-business.service";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [UsersModule],
  controllers: [MyBusinessController],
  providers: [MyBusinessService],
})
export class MyBusinessModule {}
