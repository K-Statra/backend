import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  BadRequestException,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";

@ApiTags("Payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: "결제 생성 (멱등성 보장)" })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async create(
    @Body() dto: CreatePaymentDto,
    @Headers("idempotency-key") idempotencyKey: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException("Idempotency-Key header is required");
    }
    return this.paymentsService.create(dto, idempotencyKey);
  }

  @Get("summary")
  @ApiOperation({ summary: "결제 통계" })
  getSummary() {
    return this.paymentsService.getSummary();
  }

  @Get("recent")
  @ApiOperation({ summary: "최근 결제 목록" })
  getRecent() {
    return this.paymentsService.getRecent();
  }

  @Get(":id")
  @ApiOperation({ summary: "결제 조회" })
  findOne(@Param("id") id: string) {
    return this.paymentsService.findById(id);
  }

  @Post(":id/refresh")
  @ApiOperation({ summary: "XRPL 레저에서 결제 상태 수동 확인" })
  refresh(@Param("id") id: string) {
    return this.paymentsService.refreshStatus(id);
  }
}
