import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsMongoId, IsDateString } from "class-validator";

export class PaymentStatsQueryDto {
  @ApiPropertyOptional({
    example: "2024-01-01",
    description: "ISO 8601 날짜 (기본: 7일 전)",
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: "2024-12-31",
    description: "ISO 8601 날짜 (기본: 현재)",
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: "507f1f77bcf86cd799439011" })
  @IsOptional()
  @IsMongoId()
  buyerId?: string;

  @ApiPropertyOptional({ example: "507f1f77bcf86cd799439012" })
  @IsOptional()
  @IsMongoId()
  companyId?: string;
}
