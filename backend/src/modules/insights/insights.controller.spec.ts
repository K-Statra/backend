import { Test, TestingModule } from '@nestjs/testing';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

const mockInsightsService = {
  getDashboard: jest.fn(),
  getTopIndustries: jest.fn(),
  getRecentTransactions: jest.fn(),
};

describe('InsightsController', () => {
  let controller: InsightsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InsightsController],
      providers: [{ provide: InsightsService, useValue: mockInsightsService }],
    }).compile();

    controller = module.get<InsightsController>(InsightsController);
  });

  // ── GET /analytics/dashboard ──────────────────────────────────────────────────

  describe('GET /analytics/dashboard', () => {
    it('서비스 결과 그대로 반환', async () => {
      const data = {
        totalPartners: 120,
        activeDeals: 8,
        pendingPayments: 3,
        completedDeals: 45,
      };
      mockInsightsService.getDashboard.mockResolvedValue(data);

      const result = await controller.getDashboard();

      expect(result).toEqual(data);
      expect(mockInsightsService.getDashboard).toHaveBeenCalledTimes(1);
    });
  });

  // ── GET /analytics/industries/top ────────────────────────────────────────────

  describe('GET /analytics/industries/top', () => {
    it('서비스 결과 그대로 반환', async () => {
      const data = [{ name: '자동차', partners: 30, revenue: 5000000 }];
      mockInsightsService.getTopIndustries.mockResolvedValue(data);

      const result = await controller.getTopIndustries();

      expect(result).toEqual(data);
      expect(mockInsightsService.getTopIndustries).toHaveBeenCalledTimes(1);
    });

    it('결과 없으면 빈 배열 반환', async () => {
      mockInsightsService.getTopIndustries.mockResolvedValue([]);

      const result = await controller.getTopIndustries();

      expect(result).toEqual([]);
    });
  });

  // ── GET /analytics/transactions/recent ───────────────────────────────────────

  describe('GET /analytics/transactions/recent', () => {
    it('서비스 결과 그대로 반환', async () => {
      const data = [
        {
          id: 'p1',
          company: 'ABC Corp',
          amount: 1000,
          currency: 'XRP',
          status: 'PAID',
          memo: '',
          createdAt: new Date(),
        },
      ];
      mockInsightsService.getRecentTransactions.mockResolvedValue(data);

      const result = await controller.getRecentTransactions();

      expect(result).toEqual(data);
      expect(mockInsightsService.getRecentTransactions).toHaveBeenCalledTimes(
        1,
      );
    });

    it('결과 없으면 빈 배열 반환', async () => {
      mockInsightsService.getRecentTransactions.mockResolvedValue([]);

      const result = await controller.getRecentTransactions();

      expect(result).toEqual([]);
    });
  });
});
