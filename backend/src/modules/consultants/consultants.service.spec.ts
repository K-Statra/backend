import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ConsultantsService } from './consultants.service';
import { ConsultantRequest } from './schemas/consultant-request.schema';

const makeModel = (overrides = {}) => ({
  create: jest.fn(),
  ...overrides,
});

const VALID_ID = '507f1f77bcf86cd799439011';

describe('ConsultantsService', () => {
  let service: ConsultantsService;
  let model: ReturnType<typeof makeModel>;

  beforeEach(async () => {
    model = makeModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsultantsService,
        { provide: getModelToken(ConsultantRequest.name), useValue: model },
      ],
    }).compile();

    service = module.get<ConsultantsService>(ConsultantsService);
  });

  // ── createRequest ─────────────────────────────────────────────────────────────

  describe('createRequest', () => {
    it('정상 요청 → id/status/message 반환', async () => {
      const created = { _id: VALID_ID, status: 'NEW' };
      model.create.mockResolvedValue(created);

      const result = await service.createRequest({
        name: '홍길동',
        email: 'hong@example.com',
      } as any);

      expect(result).toEqual({
        id: VALID_ID,
        status: 'NEW',
        message: 'Request received',
      });
    });

    it('buyerId 있으면 ObjectId로 변환', async () => {
      model.create.mockResolvedValue({ _id: VALID_ID, status: 'NEW' });

      await service.createRequest({
        name: '홍길동',
        email: 'hong@example.com',
        buyerId: VALID_ID,
      } as any);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ buyerId: expect.any(Types.ObjectId) }),
      );
    });

    it('유효하지 않은 buyerId → BadRequestException', async () => {
      await expect(
        service.createRequest({
          name: '홍길동',
          email: 'hong@example.com',
          buyerId: 'invalid-id',
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(model.create).not.toHaveBeenCalled();
    });

    it('buyerId 없으면 ObjectId 변환 없이 생성', async () => {
      model.create.mockResolvedValue({ _id: VALID_ID, status: 'NEW' });

      await service.createRequest({
        name: '홍길동',
        email: 'hong@example.com',
      } as any);

      const callArg = model.create.mock.calls[0][0];
      expect(callArg.buyerId).toBeUndefined();
    });

    it('serviceType 기본값 matching-assistant', async () => {
      model.create.mockResolvedValue({ _id: VALID_ID, status: 'NEW' });

      await service.createRequest({
        name: '홍길동',
        email: 'hong@example.com',
      } as any);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ serviceType: 'matching-assistant' }),
      );
    });

    it('source 기본값 partner-search', async () => {
      model.create.mockResolvedValue({ _id: VALID_ID, status: 'NEW' });

      await service.createRequest({
        name: '홍길동',
        email: 'hong@example.com',
      } as any);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'partner-search' }),
      );
    });

    it('filters 기본값 빈 객체', async () => {
      model.create.mockResolvedValue({ _id: VALID_ID, status: 'NEW' });

      await service.createRequest({
        name: '홍길동',
        email: 'hong@example.com',
      } as any);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ filters: {} }),
      );
    });
  });
});
