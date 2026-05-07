import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
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
    description: "에스크로 해제 조건 이벤트 타입 목록",
    example: ["SHIPMENT_CONFIRMED", "INSPECTION_PASSED"],
    enum: [
      "SHIPMENT_CONFIRMED",
      "INSPECTION_PASSED",
      "DOCUMENT_SUBMITTED",
      "DELIVERY_CONFIRMED",
      "CUSTOM",
    ],
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
    description: "판매자 User ID (MongoDB ObjectId)",
    example: "665f1a2b3c4d5e6f7a8b9c0e",
  })
  @IsMongoId()
  sellerId: string;

  @ApiProperty({
    description: "결제 메모",
    example: "1차 수출 대금",
    required: false,
  })
  @IsString()
  @IsOptional()
  memo?: string;

  @ApiProperty({
    description: "에스크로 항목 목록 (초기금/중도금/잔금 등)",
    type: [EscrowItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscrowItemDto)
  escrows: EscrowItemDto[];
}
