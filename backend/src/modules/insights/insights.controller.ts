import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InsightsService } from './insights.service';

@ApiTags('Insights')
@Controller('analytics')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: '대시보드 통계' })
  @ApiResponse({
    status: 200,
    description: '파트너 수, 진행 중 딜, 대기 결제, 완료 딜 카운트',
    schema: {
      example: { totalPartners: 120, activeDeals: 8, pendingPayments: 3, completedDeals: 45 },
    },
  })
  getDashboard() { return this.insightsService.getDashboard(); }

  @Get('industries/top')
  @ApiOperation({ summary: '상위 5개 산업 통계' })
  @ApiResponse({
    status: 200,
    description: '파트너 수 기준 상위 5개 산업',
    schema: {
      example: [{ name: '자동차', partners: 30, revenue: 5000000 }],
    },
  })
  getTopIndustries() { return this.insightsService.getTopIndustries(); }

  @Get('transactions/recent')
  @ApiOperation({ summary: '최근 10건 거래 내역' })
  @ApiResponse({
    status: 200,
    description: '최신순 결제 내역 10건',
    schema: {
      example: [
        {
          id: '6632a1f0e4b0a1c2d3e4f5a6',
          company: 'ABC Corp',
          amount: 1000,
          currency: 'XRP',
          status: 'PAID',
          memo: '계약금',
          createdAt: '2024-01-15T10:00:00.000Z',
        },
      ],
    },
  })
  getRecentTransactions() { return this.insightsService.getRecentTransactions(); }
}
