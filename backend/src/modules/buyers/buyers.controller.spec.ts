import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BuyersController } from './buyers.controller';
import { BuyersService } from './buyers.service';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';

const VALID_ID = '507f1f77bcf86cd799439011';

const mockBuyersService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('BuyersController', () => {
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

  describe('GET /buyers', () => {
    it('기본 목록 반환', async () => {
      const result = { page: 1, limit: 10, total: 2, totalPages: 1, data: [{ name: 'Acme' }] };
      mockBuyersService.findAll.mockResolvedValue(result);

      expect(await controller.findAll({} as any)).toEqual(result);
    });

    it('필터와 함께 서비스 호출', async () => {
      mockBuyersService.findAll.mockResolvedValue({ data: [] });
      const query = { q: 'acme', country: 'US', page: 2, limit: 5 } as any;

      await controller.findAll(query);

      expect(mockBuyersService.findAll).toHaveBeenCalledWith(query);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────────

  describe('GET /buyers/:id', () => {
    it('바이어 반환', async () => {
      const buyer = { _id: VALID_ID, name: 'Acme' };
      mockBuyersService.findById.mockResolvedValue(buyer);

      expect(await controller.findOne(VALID_ID)).toEqual(buyer);
      expect(mockBuyersService.findById).toHaveBeenCalledWith(VALID_ID);
    });

    it('없는 ID → NotFoundException', async () => {
      mockBuyersService.findById.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(VALID_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────────

  describe('POST /buyers', () => {
    it('바이어 생성 후 반환', async () => {
      const dto = { name: 'Acme Corp', country: 'US' } as any;
      const created = { _id: VALID_ID, ...dto };
      mockBuyersService.create.mockResolvedValue(created);

      expect(await controller.create(dto)).toEqual(created);
      expect(mockBuyersService.create).toHaveBeenCalledWith(dto);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────────

  describe('PATCH /buyers/:id', () => {
    it('바이어 수정 후 반환', async () => {
      const dto = { name: 'Updated Corp' } as any;
      const updated = { _id: VALID_ID, name: 'Updated Corp' };
      mockBuyersService.update.mockResolvedValue(updated);

      expect(await controller.update(VALID_ID, dto)).toEqual(updated);
      expect(mockBuyersService.update).toHaveBeenCalledWith(VALID_ID, dto);
    });

    it('없는 ID → NotFoundException', async () => {
      mockBuyersService.update.mockRejectedValue(new NotFoundException());

      await expect(controller.update(VALID_ID, { name: 'x' } as any)).rejects.toThrow(NotFoundException);
    });

    it('빈 본문 → BadRequestException', async () => {
      mockBuyersService.update.mockRejectedValue(new BadRequestException());

      await expect(controller.update(VALID_ID, {} as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────────

  describe('DELETE /buyers/:id', () => {
    it('삭제 성공 → undefined 반환', async () => {
      mockBuyersService.remove.mockResolvedValue(undefined);

      expect(await controller.remove(VALID_ID)).toBeUndefined();
      expect(mockBuyersService.remove).toHaveBeenCalledWith(VALID_ID);
    });

    it('없는 ID → NotFoundException', async () => {
      mockBuyersService.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove(VALID_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
