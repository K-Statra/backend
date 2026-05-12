import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { IsXrplAddress } from "../../../common/decorators/is-xrpl-address.decorator";

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
    description:
      "상대방(거래 상대) XRPL 지갑 주소. buyer가 생성하면 seller 주소, seller가 생성하면 buyer 주소.",
    example: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
  })
  @IsXrplAddress()
  counterpartyWalletAddress: string;

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
