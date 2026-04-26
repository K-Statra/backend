import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { AdminService } from "./admin.service";
import { Payment } from "../payments/schemas/payment.schema";
import { Company } from "../companies/schemas/company.schema";
import { Buyer } from "../buyers/schemas/buyer.schema";
import { MatchLog } from "../matches/schemas/match-log.schema";
import { AuditLog } from "./schemas/audit-log.schema";

function buildQueryMock(resolvedValue: any) {
  const mock: any = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolvedValue),
  };
  return mock;
}

const makePaymentModel = (overrides = {}) => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  find: jest.fn().mockReturnValue(buildQueryMock([])),
  aggregate: jest.fn().mockResolvedValue([]),
  ...overrides,
});

const makeModel = (count = 0) => ({
  countDocuments: jest.fn().mockResolvedValue(count),
  find: jest.fn().mockReturnValue(buildQueryMock([])),
});

describe("AdminService", () => {
  let service: AdminService;
  let paymentModel: ReturnType<typeof makePaymentModel>;
  let companyModel: ReturnType<typeof makeModel>;
  let buyerModel: ReturnType<typeof makeModel>;
  let matchLogModel: ReturnType<typeof makeModel>;
  let auditLogModel: ReturnType<typeof makeModel>;

  beforeEach(async () => {
    paymentModel = makePaymentModel();
    companyModel = makeModel(10);
    buyerModel = makeModel(5);
    matchLogModel = makeModel(3);
    auditLogModel = makeModel(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: getModelToken(Company.name), useValue: companyModel },
        { provide: getModelToken(Buyer.name), useValue: buyerModel },
        { provide: getModelToken(MatchLog.name), useValue: matchLogModel },
        { provide: getModelToken(AuditLog.name), useValue: auditLogModel },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  // ── getStats ──────────────────────────────────────────────────────────────────

  describe("getStats", () => {
    it("전체 카운트를 병렬로 집계해 반환", async () => {
      companyModel.countDocuments.mockResolvedValue(10);
      buyerModel.countDocuments.mockResolvedValue(5);
      paymentModel.countDocuments.mockResolvedValue(3);
      matchLogModel.countDocuments.mockResolvedValue(2);

      const result = await service.getStats();

      expect(result).toEqual({
        companies: 10,
        buyers: 5,
        payments: 3,
        matches: 2,
      });
    });
  });

  // ── getPayments ───────────────────────────────────────────────────────────────

  describe("getPayments", () => {
    it("필터 없이 페이지 1 기본값으로 조회", async () => {
      const fakePayments = [{ _id: "p1" }, { _id: "p2" }];
      paymentModel.find.mockReturnValue(buildQueryMock(fakePayments));
      paymentModel.countDocuments.mockResolvedValue(2);

      const result = await service.getPayments({});

      expect(result.data).toEqual(fakePayments);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("status 필터 적용", async () => {
      paymentModel.find.mockReturnValue(buildQueryMock([]));
      paymentModel.countDocuments.mockResolvedValue(0);

      await service.getPayments({ status: "PAID" });

      expect(paymentModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: "PAID" }),
      );
    });

    it("날짜 범위 필터 적용", async () => {
      paymentModel.find.mockReturnValue(buildQueryMock([]));
      paymentModel.countDocuments.mockResolvedValue(0);

      await service.getPayments({
        from: "2024-01-01",
        to: "2024-01-31",
      });

      expect(paymentModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: {
            $gte: new Date("2024-01-01"),
            $lte: new Date("2024-01-31"),
          },
        }),
      );
    });

    it("페이지 2일 때 skip 계산 정확성", async () => {
      const query = buildQueryMock([]);
      paymentModel.find.mockReturnValue(query);
      paymentModel.countDocuments.mockResolvedValue(30);

      await service.getPayments({ page: 2, limit: 10 });

      expect(query.skip).toHaveBeenCalledWith(10);
      expect(query.limit).toHaveBeenCalledWith(10);
    });

    it("totalPages 올림 계산", async () => {
      paymentModel.find.mockReturnValue(buildQueryMock([]));
      paymentModel.countDocuments.mockResolvedValue(21);

      const result = await service.getPayments({ limit: 10 });

      expect(result.totalPages).toBe(3);
    });
  });

  // ── getPaymentStats ───────────────────────────────────────────────────────────

  describe("getPaymentStats", () => {
    it("byStatus, byCurrency 집계 반환", async () => {
      paymentModel.aggregate
        .mockResolvedValueOnce([
          { _id: "PAID", count: 4 },
          { _id: "PENDING", count: 1 },
        ])
        .mockResolvedValueOnce([{ _id: "XRP", count: 5 }])
        .mockResolvedValueOnce([]);

      const result = await service.getPaymentStats({});

      expect(result.byStatus).toEqual({ PAID: 4, PENDING: 1 });
      expect(result.byCurrency).toEqual({ XRP: 5 });
    });

    it("byCurrencyStatus 집계 반환", async () => {
      paymentModel.aggregate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { _id: { currency: "XRP", status: "PAID" }, count: 3 },
          { _id: { currency: "XRP", status: "PENDING" }, count: 1 },
          { _id: { currency: "USD", status: "PAID" }, count: 2 },
        ]);

      const result = await service.getPaymentStats({});

      expect(result.byCurrencyStatus).toEqual({
        XRP: { PAID: 3, PENDING: 1 },
        USD: { PAID: 2 },
      });
    });

    it("날짜 미전달 시 since/until이 ISO string으로 존재", async () => {
      paymentModel.aggregate.mockResolvedValue([]);

      const result = await service.getPaymentStats({});

      expect(typeof result.since).toBe("string");
      expect(typeof result.until).toBe("string");
    });

    it("명시적 날짜 범위 전달", async () => {
      paymentModel.aggregate.mockResolvedValue([]);

      const result = await service.getPaymentStats({
        from: "2024-01-01",
        to: "2024-01-31",
      });

      expect(result.since).toBe(new Date("2024-01-01").toISOString());
      expect(result.until).toBe(new Date("2024-01-31").toISOString());
    });
  });

  // ── exportPaymentsCsv ─────────────────────────────────────────────────────────

  describe("exportPaymentsCsv", () => {
    it("헤더 행이 첫 번째 줄로 포함됨", async () => {
      paymentModel.find.mockReturnValue(buildQueryMock([]));

      const csv = await service.exportPaymentsCsv({});

      expect(csv.split("\n")[0]).toBe(
        "_id,buyerId,companyId,amount,currency,status,provider,providerRef,createdAt",
      );
    });

    it("데이터 행이 큰따옴표로 감싸짐", async () => {
      const fakePayment = {
        _id: "p1",
        buyerId: "b1",
        companyId: "c1",
        amount: 10,
        currency: "XRP",
        status: "PAID",
        provider: "xrpl",
        providerRef: "ref-1",
        createdAt: new Date("2024-01-01"),
      };
      paymentModel.find.mockReturnValue(buildQueryMock([fakePayment]));

      const csv = await service.exportPaymentsCsv({});
      const lines = csv.trim().split("\n");

      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('"PAID"');
    });

    it("큰따옴표 포함 값 이스케이프 처리", async () => {
      const fakePayment = {
        _id: "p1",
        buyerId: "b1",
        companyId: "c1",
        amount: 10,
        currency: "XRP",
        status: 'NOTE: "special"',
        provider: "xrpl",
        providerRef: "ref",
        createdAt: new Date(),
      };
      paymentModel.find.mockReturnValue(buildQueryMock([fakePayment]));

      const csv = await service.exportPaymentsCsv({});

      expect(csv).toContain('"NOTE: ""special"""');
    });
  });

  // ── getMatchLogs ──────────────────────────────────────────────────────────────

  describe("getMatchLogs", () => {
    it("매칭 로그 페이징 반환", async () => {
      const fakeLogs = [{ _id: "log-1", buyerId: "b1" }];
      matchLogModel.find.mockReturnValue(buildQueryMock(fakeLogs));
      matchLogModel.countDocuments.mockResolvedValue(1);

      const result = await service.getMatchLogs({});

      expect(result.data).toEqual(fakeLogs);
      expect(result.total).toBe(1);
    });

    it("buyerId 필터 전달", async () => {
      matchLogModel.find.mockReturnValue(buildQueryMock([]));
      matchLogModel.countDocuments.mockResolvedValue(0);

      await service.getMatchLogs({
        buyerId: "507f1f77bcf86cd799439011",
      });

      expect(matchLogModel.find).toHaveBeenCalledWith({
        buyerId: "507f1f77bcf86cd799439011",
      });
    });
  });

  // ── getAuditLogs ──────────────────────────────────────────────────────────────

  describe("getAuditLogs", () => {
    it("entityType 기본값 Payment", async () => {
      auditLogModel.find = jest.fn().mockReturnValue(buildQueryMock([]));
      auditLogModel.countDocuments = jest.fn().mockResolvedValue(0);

      await service.getAuditLogs({ entityId: "p1" });

      expect(auditLogModel.find).toHaveBeenCalledWith({
        entityType: "Payment",
        entityId: "p1",
      });
    });

    it("커스텀 entityType 전달", async () => {
      auditLogModel.find = jest.fn().mockReturnValue(buildQueryMock([]));
      auditLogModel.countDocuments = jest.fn().mockResolvedValue(0);

      await service.getAuditLogs({
        entityType: "Company",
        entityId: "c1",
      });

      expect(auditLogModel.find).toHaveBeenCalledWith({
        entityType: "Company",
        entityId: "c1",
      });
    });

    it("감사 로그 데이터 반환", async () => {
      const fakeLogs = [
        { type: "CREATE", entityType: "Payment", entityId: "p1" },
      ];
      auditLogModel.find = jest.fn().mockReturnValue(buildQueryMock(fakeLogs));
      auditLogModel.countDocuments = jest.fn().mockResolvedValue(1);

      const result = await service.getAuditLogs({ entityId: "p1" });

      expect(result.data).toEqual(fakeLogs);
      expect(result.total).toBe(1);
    });
  });

  // ── getEmbeddingStatus ────────────────────────────────────────────────────────

  describe("getEmbeddingStatus", () => {
    afterEach(() => {
      delete process.env.EMBEDDINGS_PROVIDER;
      delete process.env.MATCH_USE_EMBEDDING;
      delete process.env.OPENAI_API_KEY;
      delete process.env.HF_API_TOKEN;
    });

    it("기본값: mock 프로바이더, configured=true", () => {
      const result = service.getEmbeddingStatus();

      expect(result.provider).toBe("mock");
      expect(result.configured).toBe(true);
      expect(result.matchUseEmbedding).toBe(false);
    });

    it("openai 프로바이더 + API 키 있음 → configured=true", () => {
      process.env.EMBEDDINGS_PROVIDER = "openai";
      process.env.OPENAI_API_KEY = "sk-test";

      const result = service.getEmbeddingStatus();

      expect(result.provider).toBe("openai");
      expect(result.configured).toBe(true);
    });

    it("openai 프로바이더 + API 키 없음 → configured=false", () => {
      process.env.EMBEDDINGS_PROVIDER = "openai";

      const result = service.getEmbeddingStatus();

      expect(result.provider).toBe("openai");
      expect(result.configured).toBe(false);
    });

    it("huggingface 프로바이더 + 토큰 있음 → configured=true", () => {
      process.env.EMBEDDINGS_PROVIDER = "huggingface";
      process.env.HF_API_TOKEN = "hf-test";

      const result = service.getEmbeddingStatus();

      expect(result.provider).toBe("huggingface");
      expect(result.configured).toBe(true);
    });

    it("MATCH_USE_EMBEDDING=true → matchUseEmbedding=true", () => {
      process.env.MATCH_USE_EMBEDDING = "true";

      const result = service.getEmbeddingStatus();

      expect(result.matchUseEmbedding).toBe(true);
    });
  });
});
