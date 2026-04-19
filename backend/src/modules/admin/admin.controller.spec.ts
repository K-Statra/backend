import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminTokenGuard } from './guards/admin-token.guard';

const mockAdminService = {
  getStats: jest.fn(),
  getPayments: jest.fn(),
  getPaymentStats: jest.fn(),
  exportPaymentsCsv: jest.fn(),
  getMatchLogs: jest.fn(),
  getAuditLogs: jest.fn(),
  getEmbeddingStatus: jest.fn(),
};

// Guard는 유닛 테스트에서 별도 spec에서 검증하므로 여기서는 bypass
const mockGuard = { canActivate: () => true };

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: mockAdminService }],
    })
      .overrideGuard(AdminTokenGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AdminController>(AdminController);
  });

  // ── getStats ─────────────────────────────────────────────────────────────────

  describe('GET /admin/stats', () => {
    it('서비스 결과 그대로 반환', async () => {
      const stats = { companies: 10, buyers: 5, payments: 3, matches: 2 };
      mockAdminService.getStats.mockResolvedValue(stats);

      const result = await controller.getStats();

      expect(result).toEqual(stats);
      expect(mockAdminService.getStats).toHaveBeenCalledTimes(1);
    });
  });

  // ── getPayments ───────────────────────────────────────────────────────────────

  describe('GET /admin/payments', () => {
    it('필터 없이 결제 목록 반환', async () => {
      const payments = {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        data: [],
      };
      mockAdminService.getPayments.mockResolvedValue(payments);

      const result = await controller.getPayments({} as any);

      expect(result).toEqual(payments);
      expect(mockAdminService.getPayments).toHaveBeenCalledWith({});
    });

    it('필터와 함께 서비스 호출', async () => {
      mockAdminService.getPayments.mockResolvedValue({ data: [], total: 0 });
      const query = {
        status: 'PAID',
        buyerId: '507f1f77bcf86cd799439011',
        page: 2,
        limit: 10,
      } as any;

      await controller.getPayments(query);

      expect(mockAdminService.getPayments).toHaveBeenCalledWith(query);
    });
  });

  // ── getPaymentStats ───────────────────────────────────────────────────────────

  describe('GET /admin/payments/stats', () => {
    it('통계 반환', async () => {
      const stats = {
        since: '2024-01-01T00:00:00.000Z',
        until: '2024-01-07T00:00:00.000Z',
        byStatus: { PAID: 5 },
        byCurrency: { XRP: 5 },
        byCurrencyStatus: { XRP: { PAID: 5 } },
      };
      mockAdminService.getPaymentStats.mockResolvedValue(stats);

      const result = await controller.getPaymentStats({} as any);

      expect(result).toEqual(stats);
    });
  });

  // ── exportPayments ────────────────────────────────────────────────────────────

  describe('GET /admin/payments/export', () => {
    it('CSV 헤더와 Content-Disposition 설정', async () => {
      mockAdminService.exportPaymentsCsv.mockResolvedValue('_id,buyerId\n');
      const res = { setHeader: jest.fn(), send: jest.fn() } as any;

      await controller.exportPayments({} as any, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=utf-8',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="payments.csv"',
      );
      expect(res.send).toHaveBeenCalledWith('_id,buyerId\n');
    });
  });

  // ── getMatchLogs ──────────────────────────────────────────────────────────────

  describe('GET /admin/matches', () => {
    it('매칭 로그 반환', async () => {
      const logs = {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        data: [{ _id: 'log-1' }],
      };
      mockAdminService.getMatchLogs.mockResolvedValue(logs);

      const result = await controller.getMatchLogs({} as any);

      expect(result).toEqual(logs);
    });

    it('buyerId 필터 전달', async () => {
      mockAdminService.getMatchLogs.mockResolvedValue({ data: [] });
      const query = { buyerId: '507f1f77bcf86cd799439011' } as any;

      await controller.getMatchLogs(query);

      expect(mockAdminService.getMatchLogs).toHaveBeenCalledWith(query);
    });
  });

  // ── getAuditLogs ──────────────────────────────────────────────────────────────

  describe('GET /admin/audit', () => {
    it('감사 로그 반환', async () => {
      const logs = {
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
        data: [{ type: 'CREATE' }],
      };
      mockAdminService.getAuditLogs.mockResolvedValue(logs);

      const result = await controller.getAuditLogs({
        entityId: 'payment-1',
      } as any);

      expect(result).toEqual(logs);
      expect(mockAdminService.getAuditLogs).toHaveBeenCalledWith({
        entityId: 'payment-1',
      });
    });
  });

  // ── getEmbeddingStatus ────────────────────────────────────────────────────────

  describe('GET /admin/embedding', () => {
    it('임베딩 상태 반환', () => {
      const status = {
        provider: 'openai',
        matchUseEmbedding: false,
        configured: true,
      };
      mockAdminService.getEmbeddingStatus.mockReturnValue(status);

      const result = controller.getEmbeddingStatus();

      expect(result).toEqual(status);
      expect(mockAdminService.getEmbeddingStatus).toHaveBeenCalledTimes(1);
    });
  });
});
