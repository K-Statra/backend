import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PartnersService } from './partners.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { Company } from '../companies/schemas/company.schema';

// Mongoose query는 exec() 없이 await 가능한 thenable → then/catch 추가
function buildQueryMock(resolvedValue: any) {
  const mock: any = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolvedValue),
    then: (resolve: any, reject: any) => Promise.resolve(resolvedValue).then(resolve, reject),
    catch: (onRejected: any) => Promise.resolve(resolvedValue).catch(onRejected),
  };
  return mock;
}

const makeCompanyModel = () => ({
  find: jest.fn().mockReturnValue(buildQueryMock([])),
  aggregate: jest.fn().mockResolvedValue([]),
  countDocuments: jest.fn().mockResolvedValue(0),
});

const makeEmbeddingsService = () => ({
  embed: jest.fn().mockResolvedValue([]),
});

describe('PartnersService', () => {
  let service: PartnersService;
  let companyModel: ReturnType<typeof makeCompanyModel>;
  let embeddingsService: ReturnType<typeof makeEmbeddingsService>;

  beforeEach(async () => {
    companyModel = makeCompanyModel();
    embeddingsService = makeEmbeddingsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnersService,
        { provide: getModelToken(Company.name), useValue: companyModel },
        { provide: EmbeddingsService, useValue: embeddingsService },
      ],
    }).compile();

    service = module.get<PartnersService>(PartnersService);
  });

  // ── show-all 모드 ─────────────────────────────────────────────────────────────

  describe('show-all 모드 (쿼리/필터 없음)', () => {
    it('find({}) 호출 후 score=1.0 부여', async () => {
      companyModel.find.mockReturnValue(buildQueryMock([{ _id: 'c1', name: 'Acme' }]));

      const result = await service.search({});

      expect(companyModel.find).toHaveBeenCalledWith({}, expect.any(Object));
      expect(result.data[0].score).toBe(1.0);
      expect(result.provider).toBe('db');
    });
  });

  // ── browse 모드 ───────────────────────────────────────────────────────────────

  describe('browse 모드 (필터만, 쿼리 없음)', () => {
    it('industry 매핑 필터 적용 후 score=1.0', async () => {
      companyModel.find.mockReturnValue(buildQueryMock([{ _id: 'c1', name: 'Acme' }]));

      const result = await service.search({ industry: 'IT / AI / SaaS' });

      expect(companyModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ industry: expect.objectContaining({ $in: expect.any(Array) }) }),
        expect.any(Object),
      );
      expect(result.data[0].score).toBe(1.0);
    });

    it('country 필터 적용', async () => {
      companyModel.find.mockReturnValue(buildQueryMock([]));

      await service.search({ country: 'Korea' });

      expect(companyModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ 'location.country': 'Korea' }),
        expect.any(Object),
      );
    });
  });

  // ── 벡터 검색 ─────────────────────────────────────────────────────────────────

  describe('벡터 검색 (쿼리 있음, 국내/비해외 인텐트)', () => {
    it('embed 호출 후 aggregate 실행', async () => {
      embeddingsService.embed.mockResolvedValue(new Array(64).fill(0.1));
      companyModel.aggregate.mockResolvedValue([{ _id: 'c1', name: 'Acme', score: 0.9 }]);

      const result = await service.search({ q: '화장품 제조사' });

      expect(embeddingsService.embed).toHaveBeenCalled();
      expect(companyModel.aggregate).toHaveBeenCalled();
      expect(result.provider).toBe('db');
    });

    it('embed 빈 벡터 → 텍스트 검색 폴백, 스코어 정규화', async () => {
      embeddingsService.embed.mockResolvedValue([]);
      companyModel.find.mockReturnValue(buildQueryMock([{ _id: 'c1', name: 'Acme', score: 5 }]));

      const result = await service.search({ q: '화장품' });

      expect(companyModel.find).toHaveBeenCalled();
      // 정규화: 0.5 + 5/10 = 1.0
      expect(result.data[0].score).toBeCloseTo(1.0);
    });

    it('벡터 검색 결과 0건 → 텍스트 검색 폴백', async () => {
      embeddingsService.embed.mockResolvedValue(new Array(64).fill(0.1));
      companyModel.aggregate.mockResolvedValue([]); // 벡터 결과 없음
      companyModel.find.mockReturnValue(buildQueryMock([{ _id: 'c2', name: 'Beta', score: 3 }]));

      const result = await service.search({ q: '식품' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Beta');
    });
  });

  // ── 웹 검색 폴백 ──────────────────────────────────────────────────────────────

  describe('웹 검색 폴백 (해외 지역 + 바이어/셀러 인텐트)', () => {
    it('미국 + 수입업체 → forceWebSearch=true → searchWeb 호출', async () => {
      const webSpy = jest.spyOn(service as any, 'searchWeb').mockResolvedValue({
        results: [{ title: 'US Importer', content: 'imports parts', url: 'http://example.com', score: 0.9 }],
        answer: 'Found importers',
      });

      const result = await service.search({ q: '미국 자동차부품 수입업체' });

      expect(webSpy).toHaveBeenCalled();
      expect(result.provider).toBe('tavily');
      expect(result.data[0].name).toBe('US Importer');
    });

    it('웹 검색 타임아웃 시 크래시 없이 결과 반환', async () => {
      jest.spyOn(service as any, 'searchWeb').mockRejectedValue(new Error('Tavily Timeout'));

      await expect(service.search({ q: '미국 수입업체' })).resolves.toBeDefined();
    });

    it('자동차 관련 없는 웹 결과 → score 감점', async () => {
      jest.spyOn(service as any, 'searchWeb').mockResolvedValue({
        results: [{ title: 'Fashion Blog', content: 'fashion tips', url: 'http://fashion.com', score: 0.9 }],
        answer: '',
      });

      const result = await service.search({ q: '미국 자동차부품 수입업체' });

      // 자동차 컨텍스트 없는 결과는 0.6 감점
      expect(result.data[0].score).toBeLessThan(0.5);
    });
  });

  // ── 인텐트 감지 ───────────────────────────────────────────────────────────────

  describe('인텐트 감지', () => {
    it('바이어 키워드 → debug.intent=buyer', async () => {
      jest.spyOn(service as any, 'searchWeb').mockResolvedValue({ results: [], answer: '' });

      const result = await service.search({ q: '베트남 바이어 찾기' });

      expect(result.debug.intent).toBe('buyer');
    });

    it('셀러 키워드 → debug.intent=seller', async () => {
      jest.spyOn(service as any, 'searchWeb').mockResolvedValue({ results: [], answer: '' });

      const result = await service.search({ q: '독일 수출업체 파트너' });

      expect(result.debug.intent).toBe('seller');
    });

    it('인텐트 키워드 없음 → debug.intent=company', async () => {
      companyModel.find.mockReturnValue(buildQueryMock([]));

      const result = await service.search({ q: '화장품' });

      expect(result.debug.intent).toBe('company');
    });
  });

  // ── INDUSTRY_MAPPING ──────────────────────────────────────────────────────────

  describe('INDUSTRY_MAPPING', () => {
    it('매핑된 산업 → $in 필터', async () => {
      embeddingsService.embed.mockResolvedValue([]);
      companyModel.find.mockReturnValue(buildQueryMock([]));

      await service.search({ q: '자동차', industry: 'Automotive / EV Parts' });

      expect(companyModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          industry: expect.objectContaining({ $in: expect.arrayContaining(['Automotive']) }),
        }),
      );
    });

    it('미매핑 산업 → 직접 문자열 매칭', async () => {
      embeddingsService.embed.mockResolvedValue([]);
      companyModel.find.mockReturnValue(buildQueryMock([]));

      await service.search({ q: '아무거나', industry: 'Custom Industry' });

      expect(companyModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ industry: 'Custom Industry' }),
      );
    });
  });

  // ── getDebugInfo ──────────────────────────────────────────────────────────────

  describe('getDebugInfo', () => {
    it('DB 카운트와 임베딩 상태 반환', async () => {
      companyModel.countDocuments
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80);
      companyModel.aggregate.mockResolvedValue([{ _id: 'Automotive', count: 50 }]);
      companyModel.find.mockReturnValue(buildQueryMock([{ name: 'Sample' }]));
      embeddingsService.embed.mockResolvedValue(new Array(64).fill(0));

      const result = await service.getDebugInfo();

      expect(result.status).toBe('ok');
      expect(result.db.companyCount).toBe(100);
      expect(result.embeddingCount).toBe(80);
      expect(result.embedding.status).toContain('Success');
    });

    it('임베딩 실패 시 status=Failed', async () => {
      companyModel.countDocuments.mockResolvedValue(0);
      companyModel.aggregate.mockResolvedValue([]);
      companyModel.find.mockReturnValue(buildQueryMock([]));
      embeddingsService.embed.mockRejectedValue(new Error('embed error'));

      const result = await service.getDebugInfo();

      expect(result.embedding.status).toBe('Failed');
      expect(result.embedding.error).toBe('embed error');
    });
  });
});
