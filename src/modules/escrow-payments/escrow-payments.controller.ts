import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBody,
  ApiCookieAuth,
} from "@nestjs/swagger";
import { EscrowPaymentsCrudService } from "./escrow-payments-crud.service";
import { EscrowPaymentsService } from "./escrow-payments.service";
import { CreateEscrowPaymentDto } from "./dto/create-escrow-payment.dto";
import { QueryEscrowPaymentDto } from "./dto/query-escrow-payment.dto";
import { SessionGuard } from "../../common/guards/session.guard";
import {
  CurrentUser,
  type SessionUser,
} from "../../common/decorators/current-user.decorator";
import { ParseMongoIdPipe } from "../../common/pipes/parse-mongo-id.pipe";
import { ParseXrplAddressPipe } from "../../common/pipes/parse-xrpl-address.pipe";

@ApiTags("Escrow Payments")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("escrow-payments")
export class EscrowPaymentsController {
  constructor(
    private readonly crudService: EscrowPaymentsCrudService,
    private readonly service: EscrowPaymentsService,
  ) {}

  @Get("users/wallet/:address")
  @ApiOperation({
    summary: "지갑 주소로 유저 조회",
    description: "XRPL 지갑 주소로 사용자 정보를 조회합니다.",
  })
  @ApiParam({ name: "address", description: "XRPL 지갑 주소" })
  @ApiResponse({ status: 200, description: "조회 성공" })
  @ApiResponse({ status: 400, description: "유효하지 않은 XRPL 지갑 주소" })
  @ApiResponse({ status: 404, description: "해당 지갑 주소를 가진 유저 없음" })
  findUserByWalletAddress(
    @Param("address", ParseXrplAddressPipe) address: string,
  ) {
    return this.crudService.findUserByWalletAddress(address);
  }

  @Get()
  @ApiOperation({
    summary: "내 에스크로 결제 목록 조회",
    description:
      "로그인한 유저가 buyer 또는 seller로 참여한 에스크로 결제 내역을 최신순으로 반환합니다. " +
      "group=ongoing이면 진행중(PENDING_APPROVAL/APPROVED/PROCESSING/ACTIVE), group=done이면 종료(COMPLETED/CANCELLED) 필터링.",
  })
  @ApiResponse({
    status: 200,
    description:
      "{ data: EscrowPayment[], total: number, page: number, limit: number }",
  })
  findAll(
    @Query() query: QueryEscrowPaymentDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.crudService.findAll(user.userId, query);
  }

  @Post()
  @ApiOperation({
    summary: "에스크로 결제 내역 생성",
    description:
      "buyer/seller 간 에스크로 결제 계획을 생성합니다. 생성 직후 상태는 PENDING_APPROVAL이며, 양측이 모두 승인해야 APPROVED로 전환됩니다.",
  })
  @ApiBody({ type: CreateEscrowPaymentDto })
  @ApiResponse({ status: 201, description: "결제 내역 생성 성공" })
  @ApiResponse({ status: 400, description: "잘못된 요청 (유효성 검사 실패)" })
  @ApiResponse({ status: 401, description: "인증되지 않은 사용자" })
  create(
    @Body() dto: CreateEscrowPaymentDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.crudService.create(dto, user.userId);
  }

  @Get(":id")
  @ApiOperation({
    summary: "에스크로 결제 내역 조회",
    description: "결제 ID로 에스크로 결제 내역 전체를 조회합니다.",
  })
  @ApiParam({ name: "id", description: "에스크로 결제 ID (MongoDB ObjectId)" })
  @ApiResponse({ status: 200, description: "조회 성공" })
  @ApiResponse({ status: 401, description: "인증되지 않은 사용자" })
  @ApiResponse({ status: 404, description: "결제 내역 없음" })
  findById(
    @Param("id", ParseMongoIdPipe) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.crudService.findById(id, user.userId);
  }

  @Post(":id/approve")
  @ApiOperation({
    summary: "결제 계획 승인",
    description:
      "세션 유저(buyer 또는 seller)가 결제 계획을 승인합니다. " +
      "한 쪽만 승인하면 PENDING_APPROVAL, 양측 모두 승인하면 APPROVED로 전환됩니다. " +
      "APPROVED 상태여야 XRPL 에스크로 실행이 가능합니다.",
  })
  @ApiParam({ name: "id", description: "에스크로 결제 ID (MongoDB ObjectId)" })
  @ApiResponse({ status: 201, description: "승인 처리 성공" })
  @ApiResponse({
    status: 400,
    description:
      "이미 승인됐거나 승인 불가 상태 (APPROVED/PROCESSING/ACTIVE/COMPLETED/CANCELLED)",
  })
  @ApiResponse({ status: 404, description: "결제 내역 없음" })
  approvePayment(
    @Param("id", ParseMongoIdPipe) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.approvePayment(id, user.userId);
  }

  @Post(":id/pay")
  @ApiOperation({
    summary: "결제 개시 (XRPL 에스크로 생성 요청)",
    description:
      "APPROVED 상태의 결제에서 buyer가 결제를 개시합니다. " +
      "Outbox 패턴 + Change Streams으로 MongoDB에 이벤트를 기록하고, " +
      "Bull Queue를 통해 XRPL EscrowCreate를 비동기 처리합니다. (202 Accepted)",
  })
  @ApiParam({ name: "id", description: "에스크로 결제 ID (MongoDB ObjectId)" })
  @ApiResponse({
    status: 201,
    description: "결제 개시 성공, 상태 PROCESSING으로 전환",
  })
  @ApiResponse({ status: 400, description: "결제가 APPROVED 상태가 아님" })
  @ApiResponse({ status: 403, description: "buyer만 결제를 개시할 수 있음" })
  @ApiResponse({ status: 404, description: "결제 내역 없음" })
  initiatePayment(
    @Param("id", ParseMongoIdPipe) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.initiatePayment(id, user.userId);
  }

  @Post(":id/escrows/:escrowId/events/:type/approve")
  @ApiOperation({
    summary: "에스크로 이벤트 승인",
    description:
      "ESCROWED 상태의 에스크로 항목에서 특정 이벤트를 승인합니다. " +
      "buyer와 seller 양측이 모두 승인하면 해당 이벤트가 완료되고, " +
      "모든 이벤트가 완료되면 자동으로 EscrowFinish를 제출해 XRP를 seller에게 해제합니다.",
  })
  @ApiParam({ name: "id", description: "에스크로 결제 ID (MongoDB ObjectId)" })
  @ApiParam({
    name: "escrowId",
    description: "에스크로 항목 ID (MongoDB ObjectId)",
  })
  @ApiParam({
    name: "type",
    description: "이벤트 이름",
  })
  @ApiResponse({
    status: 201,
    description: "승인 처리 성공. 모든 이벤트 완료 시 EscrowFinish 자동 제출",
  })
  @ApiResponse({
    status: 400,
    description: "이미 승인됐거나 에스크로가 ESCROWED 상태 아님",
  })
  @ApiResponse({
    status: 404,
    description: "결제 내역, 에스크로 항목, 또는 이벤트 타입 없음",
  })
  approveEvent(
    @Param("id", ParseMongoIdPipe) id: string,
    @Param("escrowId", ParseMongoIdPipe) escrowId: string,
    @Param("type") eventType: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.approveEvent(id, escrowId, eventType, user.userId);
  }

  @Get(":id/escrows/:escrowId/status")
  @ApiOperation({
    summary: "에스크로 항목 상태 조회",
    description: "특정 에스크로 항목의 상태 및 이벤트 승인 현황을 조회합니다.",
  })
  @ApiParam({ name: "id", description: "에스크로 결제 ID (MongoDB ObjectId)" })
  @ApiParam({
    name: "escrowId",
    description: "에스크로 항목 ID (MongoDB ObjectId)",
  })
  @ApiResponse({ status: 200, description: "조회 성공" })
  @ApiResponse({
    status: 404,
    description: "결제 내역 또는 에스크로 항목 없음",
  })
  getEscrowStatus(
    @Param("id", ParseMongoIdPipe) id: string,
    @Param("escrowId", ParseMongoIdPipe) escrowId: string,
  ) {
    return this.service.getEscrowStatus(id, escrowId);
  }

  @Post(":id/escrows/:escrowId/cancel")
  @ApiOperation({
    summary: "에스크로 항목 취소",
    description:
      "PENDING_ESCROW 상태인 에스크로 항목을 취소합니다. " +
      "이미 XRPL에 제출된(ESCROWED 이상) 항목은 취소할 수 없습니다.",
  })
  @ApiParam({ name: "id", description: "에스크로 결제 ID (MongoDB ObjectId)" })
  @ApiParam({
    name: "escrowId",
    description: "에스크로 항목 ID (MongoDB ObjectId)",
  })
  @ApiResponse({
    status: 201,
    description: "취소 성공, 항목 상태 CANCELLED로 전환",
  })
  @ApiResponse({
    status: 400,
    description: "PENDING_ESCROW 상태가 아니어서 취소 불가",
  })
  @ApiResponse({
    status: 404,
    description: "결제 내역 또는 에스크로 항목 없음",
  })
  cancelEscrowItem(
    @Param("id", ParseMongoIdPipe) id: string,
    @Param("escrowId", ParseMongoIdPipe) escrowId: string,
  ) {
    return this.service.cancelEscrowItem(id, escrowId);
  }
}
