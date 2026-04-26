import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNumber,
  IsPositive,
  IsString,
  IsMongoId,
  IsOptional,
  IsIn,
  MaxLength,
} from "class-validator";

export class CreatePaymentDto {
  @ApiProperty({ example: 10 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ enum: ["XRP", "USD", "KRW"], default: "XRP" })
  @IsOptional()
  @IsIn(["XRP", "USD", "KRW"])
  currency?: "XRP" | "USD" | "KRW" = "XRP";

  @ApiProperty({ example: "507f1f77bcf86cd799439011" })
  @IsMongoId()
  buyerId: string;

  @ApiProperty({ example: "507f1f77bcf86cd799439012" })
  @IsMongoId()
  companyId: string;

  @ApiPropertyOptional({ example: "파트너 매칭 결제" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;
}
