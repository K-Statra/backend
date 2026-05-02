import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

function trimDedupe(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      (value as string[]).map((s) => String(s).trim()).filter(Boolean),
    ),
  ];
}

class LocationDto {
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
}

export class CreateSellerDto {
  @ApiProperty({ example: "Acme Corp" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: "Automotive" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ type: [String], example: ["EV parts", "PCB"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => trimDedupe(value))
  exportItems?: string[];

  @ApiPropertyOptional({ type: [String], example: ["B2B", "export"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => trimDedupe(value))
  tags?: string[];

  @ApiPropertyOptional({ example: "한국 자동차 부품 제조사입니다." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sellerIntroduction?: string;

  @ApiPropertyOptional({ example: "EV 배터리 팩 및 BMS를 생산합니다." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  productIntroduction?: string;

  @ApiPropertyOptional({ example: "https://acme.com" })
  @IsOptional()
  @ValidateIf((o) => o.websiteUrl !== "" && o.websiteUrl != null)
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(500)
  websiteUrl?: string;

  @ApiPropertyOptional({
    example: { city: "Seoul", state: "", country: "South Korea" },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({
    enum: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
  })
  @IsOptional()
  @IsIn(["1-10", "11-50", "51-200", "201-1000", "1000+"])
  sizeBucket?: string;
}
