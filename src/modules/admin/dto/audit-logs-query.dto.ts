import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export class AuditLogsQueryDto {
  @ApiPropertyOptional({ default: "Payment", description: "대상 엔티티 타입" })
  @IsOptional()
  @IsString()
  entityType?: string = "Payment";

  @ApiProperty({
    description: "대상 엔티티 ID",
    example: "507f1f77bcf86cd799439011",
  })
  @IsNotEmpty()
  @IsString()
  entityId: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
