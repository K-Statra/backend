import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class QueryBuyerDto {
  @ApiPropertyOptional({ description: "이름/프로필 텍스트 검색" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: "US" })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: "Automotive" })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: "B2B" })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: ["updatedAt", "name"], default: "updatedAt" })
  @IsOptional()
  @IsIn(["updatedAt", "name"])
  sortBy?: string = "updatedAt";

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc" = "desc";
}
