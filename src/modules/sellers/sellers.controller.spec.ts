import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SellersController } from "./sellers.controller";
import { SellersService } from "./sellers.service";
import { ParseMongoIdPipe } from "../../common/pipes/parse-mongo-id.pipe";

const VALID_ID = "507f1f77bcf86cd799439011";

const mockSellersService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe("SellersController", () => {
  let controller: SellersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SellersController],
      providers: [
        { provide: SellersService, useValue: mockSellersService },
        ParseMongoIdPipe,
      ],
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

  // ── findOne ───────────────────────────────────────────────────────────────────

  describe("GET /sellers/:id", () => {
    it("기업 반환", async () => {
      const seller = { _id: VALID_ID, name: "Acme" };
      mockSellersService.findById.mockResolvedValue(seller);

      expect(await controller.findOne(VALID_ID)).toEqual(seller);
      expect(mockSellersService.findById).toHaveBeenCalledWith(VALID_ID);
    });

    it("없는 ID → NotFoundException", async () => {
      mockSellersService.findById.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(VALID_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ────────────────────────────────────────────────────────────────────

  describe("POST /sellers", () => {
    it("기업 생성 후 반환", async () => {
      const dto = { name: "Acme Corp", industry: "Auto" } as any;
      const created = { _id: VALID_ID, ...dto };
      mockSellersService.create.mockResolvedValue(created);

      expect(await controller.create(dto)).toEqual(created);
      expect(mockSellersService.create).toHaveBeenCalledWith(dto);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────────

  describe("PATCH /sellers/:id", () => {
    it("기업 수정 후 반환", async () => {
      const dto = { name: "Updated Corp" } as any;
      const updated = { _id: VALID_ID, name: "Updated Corp" };
      mockSellersService.update.mockResolvedValue(updated);

      expect(await controller.update(VALID_ID, dto)).toEqual(updated);
      expect(mockSellersService.update).toHaveBeenCalledWith(VALID_ID, dto);
    });

    it("없는 기업 → NotFoundException", async () => {
      mockSellersService.update.mockRejectedValue(new NotFoundException());

      await expect(
        controller.update(VALID_ID, { name: "x" } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("빈 본문 → BadRequestException", async () => {
      mockSellersService.update.mockRejectedValue(new BadRequestException());

      await expect(controller.update(VALID_ID, {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────────

  describe("DELETE /sellers/:id", () => {
    it("삭제 성공", async () => {
      mockSellersService.remove.mockResolvedValue(undefined);

      expect(await controller.remove(VALID_ID)).toBeUndefined();
      expect(mockSellersService.remove).toHaveBeenCalledWith(VALID_ID);
    });

    it("없는 기업 → NotFoundException", async () => {
      mockSellersService.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove(VALID_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
