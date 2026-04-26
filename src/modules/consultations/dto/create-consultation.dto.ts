import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { ReqType } from "../schemas/consultation.schema";

export class CreateConsultationDto {
  @ApiProperty({ example: "507f1f77bcf86cd799439011" })
  @IsMongoId()
  buyerId: string;

  @ApiProperty({ example: "507f1f77bcf86cd799439012" })
  @IsMongoId()
  companyId: string;

  @ApiPropertyOptional({ enum: ReqType, default: ReqType.OFFLINE })
  @IsOptional()
  @IsEnum(ReqType)
  reqType?: ReqType;

  @ApiProperty({ example: "2026-06-15" })
  @IsDateString()
  date: string;

  @ApiProperty({ example: "14:00 - 15:00" })
  @IsString()
  timeSlot: string;

  @ApiPropertyOptional({
    example: "문의 사항을 입력해주세요.",
    maxLength: 4000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}
