import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { ConsultationStatus } from "../schemas/consultation.schema";

export class UpdateConsultationStatusDto {
  @ApiProperty({ enum: ConsultationStatus })
  @IsEnum(ConsultationStatus)
  status: ConsultationStatus;
}
