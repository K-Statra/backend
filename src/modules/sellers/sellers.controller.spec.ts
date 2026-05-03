import { Test, TestingModule } from "@nestjs/testing";
import { SellersController } from "./sellers.controller";
import { SellersService } from "./sellers.service";

const mockSellersService = {
  findAll: jest.fn(),
};

describe("SellersController", () => {
  let controller: SellersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SellersController],
      providers: [{ provide: SellersService, useValue: mockSellersService }],
    }).compile();

    controller = module.get<SellersController>(SellersController);
  });

  // ── findAll ───────────────────────────────────────────────────────────────────

  describe("GET /sellers", () => {
    it("목록 반환", async () => {
      const result = { page: 1, limit: 10, total: 2, totalPages: 1, data: [] };
      mockSellersService.findAll.mockResolvedValue(result);

      expect(await controller.findAll({} as any)).toEqual(result);
    });

    it("필터와 함께 서비스 호출", async () => {
      mockSellersService.findAll.mockResolvedValue({ data: [] });
      const query = { q: "acme", industry: "Auto", page: 2, limit: 5 } as any;

      await controller.findAll(query);

      expect(mockSellersService.findAll).toHaveBeenCalledWith(query);
    });
  });
});
