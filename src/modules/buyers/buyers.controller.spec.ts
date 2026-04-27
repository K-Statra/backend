import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { BuyersController } from "./buyers.controller";
import { BuyersService } from "./buyers.service";
import { ParseMongoIdPipe } from "../../common/pipes/parse-mongo-id.pipe";

const VALID_ID = "507f1f77bcf86cd799439011";

const mockBuyersService = {
  findAll: jest.fn(),
  findById: jest.fn(),
};

describe("BuyersController", () => {
  let controller: BuyersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BuyersController],
      providers: [
        { provide: BuyersService, useValue: mockBuyersService },
        ParseMongoIdPipe,
      ],
    }).compile();

    controller = module.get<BuyersController>(BuyersController);
  });

  // ── findAll ───────────────────────────────────────────────────────────────────

  describe("GET /buyers", () => {
    it("기본 목록 반환", async () => {
      const result = {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
        data: [{ name: "Acme" }],
      };
      mockBuyersService.findAll.mockResolvedValue(result);

      expect(await controller.findAll({} as any)).toEqual(result);
    });

    it("필터와 함께 서비스 호출", async () => {
      mockBuyersService.findAll.mockResolvedValue({ data: [] });
      const query = { q: "acme", country: "US", page: 2, limit: 5 } as any;

      await controller.findAll(query);

      expect(mockBuyersService.findAll).toHaveBeenCalledWith(query);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────────

  describe("GET /buyers/:id", () => {
    it("바이어 반환", async () => {
      const buyer = { _id: VALID_ID, name: "Acme" };
      mockBuyersService.findById.mockResolvedValue(buyer);

      expect(await controller.findOne(VALID_ID)).toEqual(buyer);
      expect(mockBuyersService.findById).toHaveBeenCalledWith(VALID_ID);
    });

    it("없는 ID → NotFoundException", async () => {
      mockBuyersService.findById.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(VALID_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
