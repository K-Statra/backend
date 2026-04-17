import { Test, TestingModule } from '@nestjs/testing';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

const mockPartnersService = {
  search: jest.fn(),
  getDebugInfo: jest.fn(),
};

describe('PartnersController', () => {
  let controller: PartnersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PartnersController],
      providers: [{ provide: PartnersService, useValue: mockPartnersService }],
    }).compile();

    controller = module.get<PartnersController>(PartnersController);
  });

  // ── search ────────────────────────────────────────────────────────────────────

  describe('GET /partners/search', () => {
    it('서비스 결과 그대로 반환', async () => {
      const result = {
        data: [{ name: 'Acme' }],
        aiResponse: '',
        provider: 'db',
        debug: {},
      };
      mockPartnersService.search.mockResolvedValue(result);

      expect(await controller.search('acme', 10)).toEqual(result);
    });

    it('모든 파라미터를 서비스에 전달', async () => {
      mockPartnersService.search.mockResolvedValue({ data: [] });

      await controller.search(
        'acme',
        5,
        'Automotive',
        'Korea',
        'OEM',
        '1-10',
        'buyer-id',
      );

      expect(mockPartnersService.search).toHaveBeenCalledWith({
        q: 'acme',
        limit: 5,
        industry: 'Automotive',
        country: 'Korea',
        partnership: 'OEM',
        size: '1-10',
        buyerId: 'buyer-id',
      });
    });

    it('파라미터 없이 호출 시 undefined 전달', async () => {
      mockPartnersService.search.mockResolvedValue({ data: [] });

      await controller.search(undefined, 10);

      expect(mockPartnersService.search).toHaveBeenCalledWith(
        expect.objectContaining({ q: undefined, limit: 10 }),
      );
    });
  });

  // ── debug ─────────────────────────────────────────────────────────────────────

  describe('GET /partners/debug', () => {
    it('디버그 정보 반환', async () => {
      const debugInfo = {
        status: 'ok',
        db: { companyCount: 100 },
        embedding: { status: 'Success' },
      };
      mockPartnersService.getDebugInfo.mockResolvedValue(debugInfo);

      expect(await controller.debug()).toEqual(debugInfo);
      expect(mockPartnersService.getDebugInfo).toHaveBeenCalledTimes(1);
    });
  });
});
