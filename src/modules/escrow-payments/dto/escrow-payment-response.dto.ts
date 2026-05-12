import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Types } from "mongoose";

export class EventApprovalResponse {
  @ApiProperty({ description: "이벤트 이름" })
  eventType: string;

  @ApiProperty({ description: "구매자 승인 여부" })
  buyerApproved: boolean;

  @ApiPropertyOptional({ description: "구매자 승인 일시" })
  buyerApprovedAt?: Date;

  @ApiProperty({ description: "판매자 승인 여부" })
  sellerApproved: boolean;

  @ApiPropertyOptional({ description: "판매자 승인 일시" })
  sellerApprovedAt?: Date;

  @ApiPropertyOptional({ description: "이벤트 완료 일시" })
  completedAt?: Date;
}

export class EscrowItemResponse {
  @ApiProperty({ type: String, description: "에스크로 항목 ID" })
  _id: Types.ObjectId;

  @ApiProperty({ description: "에스크로 항목 라벨" })
  label: string;

  @ApiProperty({ description: "XRP 금액" })
  amountXrp: number;

  @ApiProperty({ description: "항목 순서" })
  order: number;

  @ApiProperty({
    description: "항목 상태",
    enum: [
      "PENDING_ESCROW",
      "SUBMITTING",
      "ESCROWED",
      "RELEASING",
      "RELEASED",
      "CANCELLING",
      "CANCELLED",
    ],
  })
  status: string;

  @ApiProperty({ type: [String], description: "필요 이벤트 목록" })
  requiredEventTypes: string[];

  @ApiProperty({
    type: [EventApprovalResponse],
    description: "이벤트 승인 현황",
  })
  approvals: EventApprovalResponse[];

  @ApiPropertyOptional({ description: "XRPL 시퀀스 번호" })
  xrplSequence?: number;

  @ApiPropertyOptional({ description: "XRPL 에스크로 조건" })
  condition?: string;

  @ApiPropertyOptional({ description: "에스크로 생성 트랜잭션 해시" })
  txHashCreate?: string;

  @ApiPropertyOptional({ description: "에스크로 해제 트랜잭션 해시" })
  txHashRelease?: string;

  @ApiPropertyOptional({ description: "XRPL 제출 일시" })
  submittingAt?: Date;

  @ApiPropertyOptional({ description: "에스크로 확정 일시" })
  escrowedAt?: Date;

  @ApiPropertyOptional({ description: "에스크로 해제 일시" })
  releasedAt?: Date;
}

export class EscrowPaymentResponse {
  @ApiProperty({ type: String, description: "에스크로 결제 ID" })
  _id: Types.ObjectId;

  @ApiProperty({ type: String, description: "내 유저 ID" })
  myId: Types.ObjectId;

  @ApiProperty({ type: String, description: "상대방 유저 ID" })
  partnerId: Types.ObjectId;

  @ApiProperty({ description: "내 이름" })
  myName: string;

  @ApiProperty({ description: "상대방 이름" })
  partnerName: string;

  @ApiProperty({ description: "내 지갑 주소" })
  myWalletAddress: string;

  @ApiProperty({ description: "상대방 지갑 주소" })
  partnerWalletAddress: string;

  @ApiProperty({ description: "총 XRP 금액" })
  totalAmountXrp: number;

  @ApiProperty({ description: "통화 (XRP/RLUSD)", enum: ["XRP", "RLUSD"] })
  currency: string;

  @ApiProperty({
    description: "결제 상태",
    enum: [
      "PENDING_APPROVAL",
      "APPROVED",
      "PROCESSING",
      "ACTIVE",
      "COMPLETED",
      "CANCELLED",
    ],
  })
  status: string;

  @ApiProperty({ description: "구매자 승인 여부" })
  buyerApproved: boolean;

  @ApiPropertyOptional({ description: "구매자 승인 일시" })
  buyerApprovedAt?: Date;

  @ApiProperty({ description: "판매자 승인 여부" })
  sellerApproved: boolean;

  @ApiPropertyOptional({ description: "판매자 승인 일시" })
  sellerApprovedAt?: Date;

  @ApiProperty({ description: "메모" })
  memo: string;

  @ApiProperty({
    type: [EscrowItemResponse],
    description: "세부 에스크로 항목",
  })
  escrows: EscrowItemResponse[];

  @ApiProperty({ description: "생성 일시" })
  createdAt: Date;

  @ApiProperty({ description: "수정 일시" })
  updatedAt: Date;
}

export class EscrowPaymentListResponse {
  @ApiProperty({
    type: [EscrowPaymentResponse],
    description: "결제 목록 데이터",
  })
  data: EscrowPaymentResponse[];

  @ApiProperty({ description: "전체 항목 수" })
  total: number;

  @ApiProperty({ description: "현재 페이지 번호" })
  page: number;

  @ApiProperty({ description: "페이지당 항목 수" })
  limit: number;
}
