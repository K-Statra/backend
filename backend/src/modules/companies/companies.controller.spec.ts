import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';

const VALID_ID = '507f1f77bcf86cd799439011';

const mockCompaniesService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('CompaniesController', () => {
  let controller: CompaniesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        { provide: CompaniesService, useValue: mockCompaniesService },
        ParseMongoIdPipe,
      ],
    }).compile();

    controller = module.get<CompaniesController>(CompaniesController);
  });

  // ── findAll ───────────────────────────────────────────────────────────────────

  describe('GET /companies', () => {
    it('목록 반환', async () => {
      const result = { page: 1, limit: 10, total: 2, totalPages: 1, data: [] };
      mockCompaniesService.findAll.mockResolvedValue(result);

      expect(await controller.findAll({} as any)).toEqual(result);
    });

    it('필터와 함께 서비스 호출', async () => {
      mockCompaniesService.findAll.mockResolvedValue({ data: [] });
      const query = { q: 'acme', industry: 'Auto', page: 2, limit: 5 } as any;

      await controller.findAll(query);

      expect(mockCompaniesService.findAll).toHaveBeenCalledWith(query);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────────

  describe('GET /companies/:id', () => {
    it('기업 반환', async () => {
      const company = { _id: VALID_ID, name: 'Acme' };
      mockCompaniesService.findById.mockResolvedValue(company);

      expect(await controller.findOne(VALID_ID)).toEqual(company);
      expect(mockCompaniesService.findById).toHaveBeenCalledWith(VALID_ID);
    });

    it('없는 ID → NotFoundException', async () => {
      mockCompaniesService.findById.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(VALID_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────────

  describe('POST /companies', () => {
    it('기업 생성 후 반환', async () => {
      const dto = { name: 'Acme Corp', industry: 'Auto' } as any;
      const created = { _id: VALID_ID, ...dto };
      mockCompaniesService.create.mockResolvedValue(created);

      expect(await controller.create(dto)).toEqual(created);
      expect(mockCompaniesService.create).toHaveBeenCalledWith(dto);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────────

  describe('PATCH /companies/:id', () => {
    it('기업 수정 후 반환', async () => {
      const dto = { name: 'Updated Corp' } as any;
      const updated = { _id: VALID_ID, name: 'Updated Corp' };
      mockCompaniesService.update.mockResolvedValue(updated);

      expect(await controller.update(VALID_ID, dto)).toEqual(updated);
      expect(mockCompaniesService.update).toHaveBeenCalledWith(VALID_ID, dto);
    });

    it('없는 기업 → NotFoundException', async () => {
      mockCompaniesService.update.mockRejectedValue(new NotFoundException());

      await expect(controller.update(VALID_ID, { name: 'x' } as any)).rejects.toThrow(NotFoundException);
    });

    it('빈 본문 → BadRequestException', async () => {
      mockCompaniesService.update.mockRejectedValue(new BadRequestException());

      await expect(controller.update(VALID_ID, {} as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────────

  describe('DELETE /companies/:id', () => {
    it('삭제 성공', async () => {
      mockCompaniesService.remove.mockResolvedValue(undefined);

      expect(await controller.remove(VALID_ID)).toBeUndefined();
      expect(mockCompaniesService.remove).toHaveBeenCalledWith(VALID_ID);
    });

    it('없는 기업 → NotFoundException', async () => {
      mockCompaniesService.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove(VALID_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
