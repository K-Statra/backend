import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { InsightsService } from './insights.service';
import { Company } from '../companies/schemas/company.schema';
import { Payment } from '../payments/schemas/payment.schema';

function buildQueryMock(resolvedValue: any) {
  const mock: any = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(resolvedValue),
  };
  return mock;
}

describe('InsightsService', () => {
  let service: InsightsService;
  let companyModel: any;
  let paymentModel: any;

  beforeEach(async () => {
    companyModel = {
      countDocuments: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue([]),
    };
    paymentModel = {
      countDocuments: jest.fn().mockResolvedValue(0),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsightsService,
        { provide: getModelToken(Company.name), useValue: companyModel },
        { provide: getModelToken(Payment.name), useValue: paymentModel },
      ],
    }).compile();

    service = module.get<InsightsService>(InsightsService);
  });

  // ── getDashboard ──────────────────────────────────────────────────────────────

  describe('getDashboard', () => {
    it('4개 카운트를 병렬 조회하여 반환', async () => {
      companyModel.countDocuments.mockResolvedValue(120);
      paymentModel.countDocuments
        .mockResolvedValueOnce(8) // activeDeals (CREATED | PENDING)
        .mockResolvedValueOnce(3) // pendingPayments (PENDING)
        .mockResolvedValueOnce(45); // completedDeals (PAID)

      const result = await service.getDashboard();

      expect(result).toEqual({
        totalPartners: 120,
        activeDeals: 8,
        pendingPayments: 3,
        completedDeals: 45,
      });
    });

    it('activeDeals은 CREATED + PENDING 상태 필터', async () => {
      companyModel.countDocuments.mockResolvedValue(0);
      paymentModel.countDocuments.mockResolvedValue(0);

      await service.getDashboard();

      expect(paymentModel.countDocuments).toHaveBeenCalledWith({
        status: { $in: ['CREATED', 'PENDING'] },
      });
    });

    it('completedDeals은 PAID 상태 필터', async () => {
      companyModel.countDocuments.mockResolvedValue(0);
      paymentModel.countDocuments.mockResolvedValue(0);

      await service.getDashboard();

      expect(paymentModel.countDocuments).toHaveBeenCalledWith({
        status: 'PAID',
      });
    });

    it('데이터 없으면 모두 0 반환', async () => {
      const result = await service.getDashboard();

      expect(result).toEqual({
        totalPartners: 0,
        activeDeals: 0,
        pendingPayments: 0,
        completedDeals: 0,
      });
    });
  });

  // ── getTopIndustries ──────────────────────────────────────────────────────────

  describe('getTopIndustries', () => {
    it('aggregate 결과를 name/partners/revenue로 매핑', async () => {
      companyModel.aggregate.mockResolvedValue([
        { _id: '자동차', partners: 30, revenue: 5000000 },
        { _id: '전자', partners: 20, revenue: 2000000 },
      ]);

      const result = await service.getTopIndustries();

      expect(result).toEqual([
        { name: '자동차', partners: 30, revenue: 5000000 },
        { name: '전자', partners: 20, revenue: 2000000 },
      ]);
    });

    it('결과 없으면 빈 배열 반환', async () => {
      companyModel.aggregate.mockResolvedValue([]);

      const result = await service.getTopIndustries();

      expect(result).toEqual([]);
    });

    it('aggregate 파이프라인에 $limit 5 포함', async () => {
      companyModel.aggregate.mockResolvedValue([]);

      await service.getTopIndustries();

      const pipeline = companyModel.aggregate.mock.calls[0][0];
      expect(pipeline).toContainEqual({ $limit: 5 });
    });

    it('aggregate 파이프라인에 industry 비어있는 문서 제외($match) 포함', async () => {
      companyModel.aggregate.mockResolvedValue([]);

      await service.getTopIndustries();

      const pipeline = companyModel.aggregate.mock.calls[0][0];
      expect(pipeline).toContainEqual({
        $match: { industry: { $exists: true, $ne: '' } },
      });
    });
  });

  // ── getRecentTransactions ─────────────────────────────────────────────────────

  describe('getRecentTransactions', () => {
    it('결제 내역을 id/company/amount 등으로 매핑', async () => {
      const fakeDocs = [
        {
          _id: 'p1',
          companyId: { name: 'ABC Corp' },
          amount: 1000,
          currency: 'XRP',
          status: 'PAID',
          memo: '계약금',
          createdAt: new Date('2024-01-15'),
        },
      ];
      paymentModel.find.mockReturnValue(buildQueryMock(fakeDocs));

      const result = await service.getRecentTransactions();

      expect(result).toEqual([
        {
          id: 'p1',
          company: 'ABC Corp',
          amount: 1000,
          currency: 'XRP',
          status: 'PAID',
          memo: '계약금',
          createdAt: new Date('2024-01-15'),
        },
      ]);
    });

    it('companyId가 null이면 company를 "Unknown"으로 표시', async () => {
      const fakeDocs = [
        {
          _id: 'p2',
          companyId: null,
          amount: 500,
          currency: 'XRP',
          status: 'PENDING',
          memo: '',
          createdAt: new Date(),
        },
      ];
      paymentModel.find.mockReturnValue(buildQueryMock(fakeDocs));

      const result = await service.getRecentTransactions();

      expect(result[0].company).toBe('Unknown');
    });

    it('결과 없으면 빈 배열 반환', async () => {
      paymentModel.find.mockReturnValue(buildQueryMock([]));

      const result = await service.getRecentTransactions();

      expect(result).toEqual([]);
    });
  });
});
