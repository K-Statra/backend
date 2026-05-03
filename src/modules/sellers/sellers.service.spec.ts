import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { SellersService } from "./sellers.service";
import { Seller } from "../sellers/schemas/seller.schema";

function buildQueryMock(resolvedValue: any) {
  const mock: any = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    collation: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolvedValue),
  };
  return mock;
}

const makeSellerModel = (overrides = {}) => ({
  find: jest.fn().mockReturnValue(buildQueryMock([])),
  countDocuments: jest.fn().mockResolvedValue(0),
  estimatedDocumentCount: jest.fn().mockResolvedValue(0),
  ...overrides,
});

describe("SellersService", () => {
  let service: SellersService;
  let sellerModel: ReturnType<typeof makeSellerModel>;

  beforeEach(async () => {
    sellerModel = makeSellerModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SellersService,
        { provide: getModelToken(Seller.name), useValue: sellerModel },
      ],
    }).compile();

    service = module.get<SellersService>(SellersService);
  });

  // ── findAll ───────────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("필터 없을 때 estimatedDocumentCount 사용", async () => {
      sellerModel.find.mockReturnValue(buildQueryMock([]));
      sellerModel.estimatedDocumentCount.mockResolvedValue(50);

      const result = await service.findAll({});

      expect(sellerModel.estimatedDocumentCount).toHaveBeenCalled();
      expect(result.total).toBe(50);
    });

    it("필터 있을 때 countDocuments 사용", async () => {
      sellerModel.find.mockReturnValue(buildQueryMock([]));
      sellerModel.countDocuments.mockResolvedValue(5);

      const result = await service.findAll({ q: "acme" });

      expect(sellerModel.countDocuments).toHaveBeenCalled();
      expect(result.total).toBe(5);
    });

    it("q 검색 시 $text 필터 적용", async () => {
      sellerModel.find.mockReturnValue(buildQueryMock([]));

      await service.findAll({ q: "acme" });

      expect(sellerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ $text: { $search: "acme" } }),
        expect.any(Object),
      );
    });

    it("nameNumeric 정렬 시 collation 적용", async () => {
      const qm = buildQueryMock([]);
      sellerModel.find.mockReturnValue(qm);

      await service.findAll({ sortBy: "nameNumeric" });

      expect(qm.collation).toHaveBeenCalledWith({
        locale: "en",
        numericOrdering: true,
      });
    });

    it("totalPages 올림 계산", async () => {
      sellerModel.find.mockReturnValue(buildQueryMock([]));
      sellerModel.estimatedDocumentCount.mockResolvedValue(21);

      const result = await service.findAll({ limit: 10 });

      expect(result.totalPages).toBe(3);
    });
  });
});
