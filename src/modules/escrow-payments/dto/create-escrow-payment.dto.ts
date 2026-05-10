import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";

export class EscrowItemDto {
  @ApiProperty({ description: "에스크로 항목 이름", example: "초기금" })
  @IsString()
  label: string;

  @ApiProperty({ description: "잠금할 XRP 금액", example: 500 })
  @IsNumber()
  @IsPositive()
  amountXrp: number;

  @ApiProperty({ description: "실행 순서 (0부터 시작)", example: 0 })
  @IsInt()
  @Min(0)
  order: number;

  @ApiProperty({
    description: "에스크로 해제 조건 이벤트 목록",
    example: ["SHIPMENT_CONFIRMED", "INSPECTION_PASSED"],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  requiredEventTypes: string[];
}

export class CreateEscrowPaymentDto {
  @ApiProperty({
    description: "구매자 User ID (MongoDB ObjectId)",
    example: "665f1a2b3c4d5e6f7a8b9c0d",
  })
  @IsMongoId()
  buyerId: string;

  @ApiProperty({
    description: "판매자 XRPL 지갑 주소",
    example: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
  })
  @IsString()
  @Matches(/^r[1-9A-HJ-NP-Za-km-z]{24,33}$/, {
    message: "sellerWalletAddress must be a valid XRPL address",
  })
  sellerWalletAddress: string;

  @ApiProperty({
    description: "결제 메모",
    example: "1차 수출 대금",
    required: false,
  })
  @IsString()
  @IsOptional()
  memo?: string;

  @ApiProperty({
    description: "결제 통화 (XRP 또는 RLUSD)",
    enum: ["XRP", "RLUSD"],
    default: "XRP",
    required: false,
  })
  @IsEnum(["XRP", "RLUSD"])
  @IsOptional()
  currency?: "XRP" | "RLUSD";

  @ApiProperty({
    description: "에스크로 항목 목록 (초기금/중도금/잔금 등)",
    type: [EscrowItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EscrowItemDto)
  escrows: EscrowItemDto[];
}
