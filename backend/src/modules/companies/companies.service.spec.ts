import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { Company } from './schemas/company.schema';

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

const makeCompanyModel = (overrides = {}) => ({
  find: jest.fn().mockReturnValue(buildQueryMock([])),
  findById: jest
    .fn()
    .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
  findByIdAndUpdate: jest
    .fn()
    .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
  findByIdAndDelete: jest
    .fn()
    .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
  countDocuments: jest.fn().mockResolvedValue(0),
  estimatedDocumentCount: jest.fn().mockResolvedValue(0),
  create: jest.fn(),
  ...overrides,
});

const VALID_ID = '507f1f77bcf86cd799439011';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let companyModel: ReturnType<typeof makeCompanyModel>;

  beforeEach(async () => {
    companyModel = makeCompanyModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: getModelToken(Company.name), useValue: companyModel },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  // ── findAll ───────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('필터 없을 때 estimatedDocumentCount 사용', async () => {
      companyModel.find.mockReturnValue(buildQueryMock([]));
      companyModel.estimatedDocumentCount.mockResolvedValue(50);

      const result = await service.findAll({} as any);

      expect(companyModel.estimatedDocumentCount).toHaveBeenCalled();
      expect(result.total).toBe(50);
    });

    it('필터 있을 때 countDocuments 사용', async () => {
      companyModel.find.mockReturnValue(buildQueryMock([]));
      companyModel.countDocuments.mockResolvedValue(5);

      const result = await service.findAll({ q: 'acme' } as any);

      expect(companyModel.countDocuments).toHaveBeenCalled();
      expect(result.total).toBe(5);
    });

    it('q 검색 시 $text 필터 적용', async () => {
      companyModel.find.mockReturnValue(buildQueryMock([]));

      await service.findAll({ q: 'acme' } as any);

      expect(companyModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ $text: { $search: 'acme' } }),
        expect.any(Object),
      );
    });

    it('nameNumeric 정렬 시 collation 적용', async () => {
      const qm = buildQueryMock([]);
      companyModel.find.mockReturnValue(qm);

      await service.findAll({ sortBy: 'nameNumeric' } as any);

      expect(qm.collation).toHaveBeenCalledWith({
        locale: 'en',
        numericOrdering: true,
      });
    });

    it('dart.corpCode 있으면 dartVerified=true로 변환', async () => {
      const raw = [
        { _id: VALID_ID, name: 'Acme', dart: { corpCode: 'ABC123' } },
      ];
      companyModel.find.mockReturnValue(buildQueryMock(raw));

      const result = await service.findAll({} as any);

      expect(result.data[0].dartVerified).toBe(true);
      expect((result.data[0] as any).dart).toBeUndefined();
    });

    it('dart 없으면 dartVerified=false', async () => {
      const raw = [{ _id: VALID_ID, name: 'Acme', dart: null }];
      companyModel.find.mockReturnValue(buildQueryMock(raw));

      const result = await service.findAll({} as any);

      expect(result.data[0].dartVerified).toBe(false);
    });

    it('totalPages 올림 계산', async () => {
      companyModel.find.mockReturnValue(buildQueryMock([]));
      companyModel.estimatedDocumentCount.mockResolvedValue(21);

      const result = await service.findAll({ limit: 10 } as any);

      expect(result.totalPages).toBe(3);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('존재하는 기업 반환', async () => {
      const company = { _id: VALID_ID, name: 'Acme' };
      companyModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(company),
      });

      expect(await service.findById(VALID_ID)).toEqual(company);
    });

    it('없으면 NotFoundException', async () => {
      companyModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findById(VALID_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ────────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('이미지 있으면 플레이스홀더 미삽입', async () => {
      const doc = {
        _id: VALID_ID,
        name: 'Acme',
        images: [{ url: 'http://img.com/a.jpg' }],
        save: jest.fn(),
      };
      companyModel.create.mockResolvedValue(doc);

      await service.create({ name: 'Acme' } as any);

      expect(doc.save).not.toHaveBeenCalled();
    });

    it('이미지 없으면 플레이스홀더 삽입 후 save', async () => {
      const doc = { _id: VALID_ID, name: 'Acme', images: [], save: jest.fn() };
      companyModel.create.mockResolvedValue(doc);

      await service.create({ name: 'Acme' } as any);

      expect(doc.images).toHaveLength(1);
      expect(doc.save).toHaveBeenCalled();
    });
  });

  // ── update ────────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('존재하는 기업 수정', async () => {
      const updated = { _id: VALID_ID, name: 'New Name' };
      companyModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      expect(
        await service.update(VALID_ID, { name: 'New Name' } as any),
      ).toEqual(updated);
    });

    it('없는 기업 → NotFoundException', async () => {
      companyModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.update(VALID_ID, { name: 'x' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('빈 dto → BadRequestException', async () => {
      await expect(service.update(VALID_ID, {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('존재하는 기업 삭제', async () => {
      companyModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: VALID_ID }),
      });

      await expect(service.remove(VALID_ID)).resolves.toBeUndefined();
    });

    it('없는 기업 → NotFoundException', async () => {
      companyModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove(VALID_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
