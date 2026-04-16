import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BuyersService } from './buyers.service';
import { Buyer } from './schemas/buyer.schema';

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
  findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
  findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
  findByIdAndDelete: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
  countDocuments: jest.fn().mockResolvedValue(0),
  create: jest.fn(),
  ...overrides,
});

const VALID_ID = '507f1f77bcf86cd799439011';

describe('BuyersService', () => {
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

  describe('findAll', () => {
    it('기본값으로 목록 반환', async () => {
      const items = [{ name: 'Acme' }];
      buyerModel.find.mockReturnValue(buildQueryMock(items));
      buyerModel.countDocuments.mockResolvedValue(1);

      const result = await service.findAll({} as any);

      expect(result.data).toEqual(items);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('q 검색 시 $or 필터 적용', async () => {
      buyerModel.find.mockReturnValue(buildQueryMock([]));
      buyerModel.countDocuments.mockResolvedValue(0);

      await service.findAll({ q: 'acme' } as any);

      expect(buyerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { name: { $regex: 'acme', $options: 'i' } },
            { profileText: { $regex: 'acme', $options: 'i' } },
          ],
        }),
      );
    });

    it('country, industry, tag 필터 적용', async () => {
      buyerModel.find.mockReturnValue(buildQueryMock([]));
      buyerModel.countDocuments.mockResolvedValue(0);

      await service.findAll({ country: 'US', industry: 'Auto', tag: 'B2B' } as any);

      expect(buyerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'US', industries: 'Auto', tags: 'B2B' }),
      );
    });

    it('페이지 2일 때 skip 계산', async () => {
      const qm = buildQueryMock([]);
      buyerModel.find.mockReturnValue(qm);
      buyerModel.countDocuments.mockResolvedValue(20);

      await service.findAll({ page: 2, limit: 10 } as any);

      expect(qm.skip).toHaveBeenCalledWith(10);
    });

    it('totalPages 올림 계산', async () => {
      buyerModel.find.mockReturnValue(buildQueryMock([]));
      buyerModel.countDocuments.mockResolvedValue(11);

      const result = await service.findAll({ limit: 10 } as any);

      expect(result.totalPages).toBe(2);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('존재하는 ID → 문서 반환', async () => {
      const buyer = { _id: VALID_ID, name: 'Acme' };
      buyerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(buyer) });

      expect(await service.findById(VALID_ID)).toEqual(buyer);
    });

    it('없는 ID → NotFoundException', async () => {
      buyerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.findById(VALID_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('바이어 생성 후 반환', async () => {
      const dto = { name: 'Acme Corp', country: 'US' } as any;
      const created = { _id: VALID_ID, ...dto };
      buyerModel.create.mockResolvedValue(created);

      expect(await service.create(dto)).toEqual(created);
      expect(buyerModel.create).toHaveBeenCalledWith(dto);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('존재하는 ID → 수정된 문서 반환', async () => {
      const updated = { _id: VALID_ID, name: 'New Name' };
      buyerModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      expect(await service.update(VALID_ID, { name: 'New Name' } as any)).toEqual(updated);
    });

    it('없는 ID → NotFoundException', async () => {
      buyerModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.update(VALID_ID, { name: 'x' } as any)).rejects.toThrow(NotFoundException);
    });

    it('빈 dto → BadRequestException', async () => {
      await expect(service.update(VALID_ID, {} as any)).rejects.toThrow(BadRequestException);
    });

    it('updatedAt이 자동 설정됨', async () => {
      const updated = { _id: VALID_ID, name: 'x' };
      buyerModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      await service.update(VALID_ID, { name: 'x' } as any);

      expect(buyerModel.findByIdAndUpdate).toHaveBeenCalledWith(
        VALID_ID,
        expect.objectContaining({ updatedAt: expect.any(Date) }),
        expect.any(Object),
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('존재하는 ID → 삭제 성공 (void)', async () => {
      buyerModel.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: VALID_ID }) });

      await expect(service.remove(VALID_ID)).resolves.toBeUndefined();
    });

    it('없는 ID → NotFoundException', async () => {
      buyerModel.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.remove(VALID_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
