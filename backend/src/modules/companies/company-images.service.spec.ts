import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { CompanyImagesService } from './company-images.service';
import { Company } from './schemas/company.schema';

const COMPANY_ID = '507f1f77bcf86cd799439011';
const IMAGE_ID = '507f1f77bcf86cd799439012';

const makeCompanyModel = (overrides = {}) => ({
  findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null), select: jest.fn().mockReturnThis() }),
  ...overrides,
});

describe('CompanyImagesService', () => {
  let service: CompanyImagesService;
  let companyModel: ReturnType<typeof makeCompanyModel>;

  beforeEach(async () => {
    companyModel = makeCompanyModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyImagesService,
        { provide: getModelToken(Company.name), useValue: companyModel },
      ],
    }).compile();

    service = module.get<CompanyImagesService>(CompanyImagesService);
  });

  // ── getImages ─────────────────────────────────────────────────────────────────

  describe('getImages', () => {
    it('이미지 배열 반환', async () => {
      const images = [{ url: 'http://img.com/a.jpg' }];
      const selectMock = { exec: jest.fn().mockResolvedValue({ images }) };
      companyModel.findById.mockReturnValue({ select: jest.fn().mockReturnValue(selectMock) });

      expect(await service.getImages(COMPANY_ID)).toEqual(images);
    });

    it('없는 기업 → NotFoundException', async () => {
      companyModel.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) });

      await expect(service.getImages(COMPANY_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── addImage ──────────────────────────────────────────────────────────────────

  describe('addImage', () => {
    it('이미지 추가 후 저장된 이미지 반환', async () => {
      const savedImage = { _id: IMAGE_ID, url: '/uploads/test.jpg', caption: '', alt: 'Acme', tags: [], clipEmbedding: [] };
      const company = {
        _id: COMPANY_ID,
        name: 'Acme',
        images: [],
        save: jest.fn().mockImplementation(function (this: any) {
          this.images.push(savedImage);
          return Promise.resolve();
        }),
      };
      // push를 직접 제어하기 위해 실제 push 사용
      company.images = [] as any;
      companyModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(company) });

      await service.addImage(COMPANY_ID, { url: '/uploads/test.jpg' });

      expect(company.save).toHaveBeenCalled();
    });

    it('alt 미전달 시 company.name으로 대체', async () => {
      const company: any = {
        name: 'Acme Corp',
        images: { push: jest.fn(), length: 1, '0': {}, [Symbol.iterator]: [][Symbol.iterator] },
        save: jest.fn().mockResolvedValue(undefined),
      };
      // 배열처럼 동작하도록 구성
      const imagesArr: any[] = [];
      company.images = imagesArr;
      companyModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(company) });

      await service.addImage(COMPANY_ID, { url: 'http://img.com/a.jpg' });

      expect(imagesArr[0].alt).toBe('Acme Corp');
    });

    it('없는 기업 → NotFoundException', async () => {
      companyModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.addImage(COMPANY_ID, { url: 'http://img.com/a.jpg' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── removeImage ───────────────────────────────────────────────────────────────

  describe('removeImage', () => {
    it('이미지 삭제 성공', async () => {
      const company: any = {
        images: [{ _id: { toString: () => IMAGE_ID } }],
        save: jest.fn().mockResolvedValue(undefined),
      };
      companyModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(company) });

      await expect(service.removeImage(COMPANY_ID, IMAGE_ID)).resolves.toBeUndefined();
      expect(company.images).toHaveLength(0);
      expect(company.save).toHaveBeenCalled();
    });

    it('없는 이미지 ID → NotFoundException', async () => {
      const company: any = {
        images: [{ _id: { toString: () => 'other-id' } }],
        save: jest.fn(),
      };
      companyModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(company) });

      await expect(service.removeImage(COMPANY_ID, IMAGE_ID)).rejects.toThrow(NotFoundException);
    });

    it('없는 기업 → NotFoundException', async () => {
      companyModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.removeImage(COMPANY_ID, IMAGE_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
