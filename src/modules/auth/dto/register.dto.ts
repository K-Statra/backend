import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsEmail,
  IsArray,
  IsOptional,
  IsNotEmpty,
  ArrayNotEmpty,
  MinLength,
  ValidateIf,
  IsUrl,
  MaxLength,
} from "class-validator";

export class RegisterCommonDto {
  @ApiProperty({ example: "K-Statra Inc." })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ example: "홍길동" })
  @IsString()
  @IsNotEmpty()
  representativeName: string; // 담당자 이름

  @ApiProperty({ example: "representative@example.com" })
  @IsEmail()
  representativeEmail: string;

  @ApiProperty({ example: "010-1234-5678" })
  @IsString()
  @IsNotEmpty()
  representativePhone: string;

  @ApiProperty({ example: "password123", minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}

export class RegisterBuyerDto extends RegisterCommonDto {
  @ApiProperty({
    type: [String],
    example: ["AI Solution", "Cloud Infrastructure"],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  needs: string[];

  @ApiPropertyOptional({ type: [String], example: ["IT", "Manufacturing"] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  industries?: string[];

  @ApiPropertyOptional({ type: [String], example: ["Global", "Tech"] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ example: "글로벌 IT 솔루션을 찾는 구매자입니다." })
  @IsString()
  @IsNotEmpty()
  companyIntroduction: string;

  @ApiProperty({ example: "클라우드 기반 협업 툴을 선호합니다." })
  @IsString()
  @IsNotEmpty()
  productIntroduction: string;

  @ApiPropertyOptional({ example: "https://buyer.example.com" })
  @IsString()
  @ValidateIf((o) => o.websiteUrl !== "" && o.websiteUrl != null)
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(500)
  websiteUrl?: string;
}

export class RegisterSellerDto extends RegisterCommonDto {
  @ApiProperty({
    type: [String],
    example: ["Smart Factory Solution", "Industrial IoT"],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  exportItems: string[];

  @ApiPropertyOptional({ example: "Industrial Tech" })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiPropertyOptional({ type: [String], example: ["IoT", "Smart Factory"] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ example: "스마트 팩토리 솔루션 전문 기업입니다." })
  @IsString()
  @IsNotEmpty()
  companyIntroduction: string;

  @ApiProperty({ example: "실시간 데이터 분석 솔루션을 제공합니다." })
  @IsString()
  @IsNotEmpty()
  productIntroduction: string;

  @ApiPropertyOptional({ example: "https://seller.example.com" })
  @IsOptional()
  @ValidateIf((o) => o.websiteUrl !== "" && o.websiteUrl != null)
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(500)
  websiteUrl?: string;
}
