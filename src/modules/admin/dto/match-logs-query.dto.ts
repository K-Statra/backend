import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsMongoId, IsNumber, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class MatchLogsQueryDto {
  @ApiPropertyOptional({ example: "507f1f77bcf86cd799439011" })
  @IsOptional()
  @IsMongoId()
  buyerId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
