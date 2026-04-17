import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { AdminTokenGuard } from './guards/admin-token.guard';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PaymentStatsQueryDto } from './dto/payment-stats-query.dto';
import { MatchLogsQueryDto } from './dto/match-logs-query.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

@ApiTags('Admin')
@ApiHeader({
  name: 'x-admin-token',
  required: true,
  description: '관리자 인증 토큰',
})
@UseGuards(AdminTokenGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: '전체 통계 (회사/바이어/결제/매칭 카운트)' })
  @ApiResponse({
    status: 200,
    description: '통계 반환',
    schema: { example: { companies: 10, buyers: 5, payments: 3, matches: 2 } },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('payments')
  @ApiOperation({ summary: '결제 목록 (페이징 + 필터)' })
  @ApiResponse({
    status: 200,
    description: '결제 목록',
    schema: {
      example: { page: 1, limit: 20, total: 100, totalPages: 5, data: [] },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  getPayments(@Query() query: ListPaymentsQueryDto) {
    return this.adminService.getPayments(query);
  }

  @Get('payments/stats')
  @ApiOperation({ summary: '결제 통계 (상태별/통화별/통화+상태별)' })
  @ApiResponse({
    status: 200,
    description: '결제 통계',
    schema: {
      example: {
        since: '2024-01-01T00:00:00.000Z',
        until: '2024-01-07T00:00:00.000Z',
        byStatus: { PAID: 5 },
        byCurrency: { XRP: 5 },
        byCurrencyStatus: { XRP: { PAID: 5 } },
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  getPaymentStats(@Query() query: PaymentStatsQueryDto) {
    return this.adminService.getPaymentStats(query);
  }

  @Get('payments/export')
  @ApiOperation({ summary: '결제 CSV 내보내기 (최대 5000건)' })
  @ApiResponse({
    status: 200,
    description: 'CSV 파일',
    content: { 'text/csv': {} },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async exportPayments(
    @Query() query: ListPaymentsQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.adminService.exportPaymentsCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
    res.send(csv);
  }

  @Get('matches')
  @ApiOperation({ summary: '매칭 로그 목록 (페이징)' })
  @ApiResponse({
    status: 200,
    description: '매칭 로그 목록',
    schema: {
      example: { page: 1, limit: 20, total: 50, totalPages: 3, data: [] },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  getMatchLogs(@Query() query: MatchLogsQueryDto) {
    return this.adminService.getMatchLogs(query);
  }

  @Get('audit')
  @ApiOperation({ summary: '감사 로그 조회 (entityId 필수)' })
  @ApiResponse({
    status: 200,
    description: '감사 로그',
    schema: {
      example: { page: 1, limit: 50, total: 3, totalPages: 1, data: [] },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  getAuditLogs(@Query() query: AuditLogsQueryDto) {
    return this.adminService.getAuditLogs(query);
  }

  @Get('embedding')
  @ApiOperation({ summary: '임베딩 프로바이더 설정 상태 조회' })
  @ApiResponse({
    status: 200,
    description: '임베딩 상태',
    schema: {
      example: {
        provider: 'openai',
        matchUseEmbedding: true,
        configured: true,
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  getEmbeddingStatus() {
    return this.adminService.getEmbeddingStatus();
  }
}
