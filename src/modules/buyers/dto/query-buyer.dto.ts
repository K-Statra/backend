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
  @ApiPropertyOptional({ description: "이름/소개 검색" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: "South Korea" })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: "Integrated Security Service" })
  @IsOptional()
  @IsString()
  industry?: string;

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

  @ApiPropertyOptional({
    enum: ["updatedAt", "name_kr", "name_en"],
    default: "updatedAt",
  })
  @IsOptional()
  @IsIn(["updatedAt", "name_kr", "name_en"])
  sortBy?: string = "updatedAt";

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc" = "desc";
}
