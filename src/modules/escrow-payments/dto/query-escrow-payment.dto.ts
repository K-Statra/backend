import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import type { EscrowPaymentStatus } from "../schemas/escrow-payment.schema";

export class QueryEscrowPaymentDto {
  @ApiPropertyOptional({
    description: "상태 필터",
    enum: [
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "PROCESSING",
      "ACTIVE",
      "COMPLETED",
      "CANCELLED",
    ],
  })
  @IsOptional()
  @IsEnum([
    "DRAFT",
    "PENDING_APPROVAL",
    "APPROVED",
    "PROCESSING",
    "ACTIVE",
    "COMPLETED",
    "CANCELLED",
  ])
  status?: EscrowPaymentStatus;

  @ApiPropertyOptional({
    description:
      "진행중(ongoing) / 종료(done) 그룹 필터. status와 동시 사용 불가",
    enum: ["ongoing", "done"],
  })
  @IsOptional()
  @IsEnum(["ongoing", "done"])
  group?: "ongoing" | "done";

  @ApiPropertyOptional({ description: "페이지 번호 (1부터 시작)", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "페이지당 항목 수", default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 5;
}
