import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsNumber,
  IsIn,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export class QuerySellerDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() industry?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tag?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional({
    enum: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
  })
  @IsOptional()
  @IsIn(["1-10", "11-50", "51-200", "201-1000", "1000+"])
  size?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() partnership?: string;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;
  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
  @ApiPropertyOptional({
    enum: ["updatedAt", "name", "nameNumeric"],
    default: "updatedAt",
  })
  @IsOptional()
  @IsIn(["updatedAt", "name", "nameNumeric"])
  sortBy?: string = "updatedAt";
  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc" = "desc";
}
