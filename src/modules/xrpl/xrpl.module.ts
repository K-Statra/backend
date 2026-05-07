import { Module } from "@nestjs/common";
import { XrplService } from "./xrpl.service";

@Module({
  providers: [XrplService],
  exports: [XrplService],
})
export class XrplModule {}
