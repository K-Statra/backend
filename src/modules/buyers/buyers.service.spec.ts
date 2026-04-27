import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { NotFoundException } from "@nestjs/common";
import { BuyersService } from "./buyers.service";
import { Buyer } from "../users/schemas/buyer.schema";

function buildQueryMock(resolvedValue: any) {
  const mock: any = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolvedValue),
  };
  return mock;
}

const makeBuyerModel = (overrides = {}) => ({
  find: jest.fn().mockReturnValue(buildQueryMock([])),
  findById: jest
    .fn()
    .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
  countDocuments: jest.fn().mockResolvedValue(0),
  ...overrides,
});

const VALID_ID = "507f1f77bcf86cd799439011";

describe("BuyersService", () => {
  let service: BuyersService;
  let buyerModel: ReturnType<typeof makeBuyerModel>;

  beforeEach(async () => {
    buyerModel = makeBuyerModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuyersService,
        { provide: getModelToken(Buyer.name), useValue: buyerModel },
      ],
    }).compile();

    service = module.get<BuyersService>(BuyersService);
  });

  // ── findAll ───────────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("기본값으로 목록 반환", async () => {
      const items = [{ name: "Acme" }];
      buyerModel.find.mockReturnValue(buildQueryMock(items));
      buyerModel.countDocuments.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toEqual(items);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("q 검색 시 $or 필터 적용", async () => {
      buyerModel.find.mockReturnValue(buildQueryMock([]));
      buyerModel.countDocuments.mockResolvedValue(0);

      await service.findAll({ q: "acme" });

      expect(buyerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { name: { $regex: "acme", $options: "i" } },
            { profileText: { $regex: "acme", $options: "i" } },
          ],
        }),
      );
    });

    it("country, industry, tag 필터 적용", async () => {
      buyerModel.find.mockReturnValue(buildQueryMock([]));
      buyerModel.countDocuments.mockResolvedValue(0);

      await service.findAll({
        country: "US",
        industry: "Auto",
        tag: "B2B",
      });

      expect(buyerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          country: "US",
          industries: "Auto",
          tags: "B2B",
        }),
      );
    });

    it("페이지 2일 때 skip 계산", async () => {
      const qm = buildQueryMock([]);
      buyerModel.find.mockReturnValue(qm);
      buyerModel.countDocuments.mockResolvedValue(20);

      await service.findAll({ page: 2, limit: 10 });

      expect(qm.skip).toHaveBeenCalledWith(10);
    });

    it("totalPages 올림 계산", async () => {
      buyerModel.find.mockReturnValue(buildQueryMock([]));
      buyerModel.countDocuments.mockResolvedValue(11);

      const result = await service.findAll({ limit: 10 });

      expect(result.totalPages).toBe(2);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("존재하는 ID → 문서 반환", async () => {
      const buyer = { _id: VALID_ID, name: "Acme" };
      buyerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(buyer),
      });

      expect(await service.findById(VALID_ID)).toEqual(buyer);
    });

    it("없는 ID → NotFoundException", async () => {
      buyerModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findById(VALID_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
