import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { Company } from '../companies/schemas/company.schema';
import { Buyer } from '../buyers/schemas/buyer.schema';
import { MatchLog } from './schemas/match-log.schema';
import { MatchFeedback } from './schemas/match-feedback.schema';

function buildQueryMock(resolvedValue: any) {
  const mock: any = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(resolvedValue),
    exec: jest.fn().mockResolvedValue(resolvedValue),
  };
  return mock;
}

const BUYER_ID = '507f1f77bcf86cd799439011';
const COMPANY_ID = '507f1f77bcf86cd799439012';

const makeBuyer = (overrides = {}) => ({
  _id: BUYER_ID,
  tags: ['전기차', '부품'],
  industries: ['자동차'],
  needs: ['공급망'],
  embedding: [],
  ...overrides,
});

const makeCompany = (overrides = {}) => ({
  _id: COMPANY_ID,
  tags: ['전기차'],
  industry: '자동차',
  offerings: ['공급망'],
  updatedAt: new Date(),
  dart: null,
  embedding: [],
  ...overrides,
});

describe('MatchesService', () => {
  let service: MatchesService;
  let buyerModel: any;
  let companyModel: any;
  let matchLogModel: any;
  let feedbackModel: any;

  beforeEach(async () => {
    buyerModel = {
      findById: jest.fn(),
    };
    companyModel = {
      findById: jest.fn(),
      find: jest.fn(),
      aggregate: jest.fn(),
    };
    matchLogModel = {
      create: jest.fn().mockResolvedValue({}),
    };
    feedbackModel = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: getModelToken(Company.name), useValue: companyModel },
        { provide: getModelToken(Buyer.name), useValue: buyerModel },
        { provide: getModelToken(MatchLog.name), useValue: matchLogModel },
        { provide: getModelToken(MatchFeedback.name), useValue: feedbackModel },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  afterEach(() => {
    delete process.env.MATCH_USE_ATLAS_VECTOR;
    delete process.env.MATCH_USE_EMBEDDING;
    delete process.env.ATLAS_VECTOR_INDEX;
  });

  // ── findMatches ───────────────────────────────────────────────────────────────

  describe('findMatches', () => {
    it('buyerId가 존재하지 않으면 NotFoundException', async () => {
      buyerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.findMatches(BUYER_ID, 10)).rejects.toThrow(NotFoundException);
    });

    it('표준 fallback: 최신순 200개 조회 후 스코어링하여 limit 만큼 반환', async () => {
      const buyer = makeBuyer();
      const companies = [makeCompany(), makeCompany({ _id: '507f1f77bcf86cd799439013', tags: [] })];
      buyerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(buyer) });
      companyModel.find.mockReturnValue(buildQueryMock(companies));

      const result = await service.findMatches(BUYER_ID, 10);

      expect(companyModel.find).toHaveBeenCalledWith({});
      expect(result.count).toBe(2);
      expect(result.data[0].score).toBeGreaterThanOrEqual(result.data[1].score);
    });

    it('limit 적용: 결과 수가 limit을 초과하지 않음', async () => {
      const buyer = makeBuyer();
      const companies = Array.from({ length: 10 }, (_, i) =>
        makeCompany({ _id: `507f1f77bcf86cd79943901${i}` }),
      );
      buyerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(buyer) });
      companyModel.find.mockReturnValue(buildQueryMock(companies));

      const result = await service.findMatches(BUYER_ID, 3);

      expect(result.count).toBe(3);
      expect(result.data).toHaveLength(3);
    });

    it('응답에 query 메타 포함', async () => {
      buyerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(makeBuyer()) });
      companyModel.find.mockReturnValue(buildQueryMock([]));

      const result = await service.findMatches(BUYER_ID, 5);

      expect(result.query).toEqual({ buyerId: BUYER_ID, limit: 5 });
    });

    it('매칭 후 MatchLog 저장', async () => {
      const buyer = makeBuyer();
      const company = makeCompany();
      buyerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(buyer) });
      companyModel.find.mockReturnValue(buildQueryMock([company]));

      await service.findMatches(BUYER_ID, 10);

      expect(matchLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ buyerId: BUYER_ID }),
      );
    });

    it('MatchLog 저장 실패해도 결과는 정상 반환', async () => {
      buyerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(makeBuyer()) });
      companyModel.find.mockReturnValue(buildQueryMock([makeCompany()]));
      matchLogModel.create.mockRejectedValue(new Error('DB error'));

      await expect(service.findMatches(BUYER_ID, 10)).resolves.toBeDefined();
    });

    it('MATCH_USE_ATLAS_VECTOR=true + embedding 있으면 aggregate 호출', async () => {
      process.env.MATCH_USE_ATLAS_VECTOR = 'true';
      const buyer = makeBuyer({ embedding: [0.1, 0.2, 0.3] });
      buyerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(buyer) });
      companyModel.aggregate.mockResolvedValue([makeCompany({ vectorScore: 0.9 })]);

      await service.findMatches(BUYER_ID, 10);

      expect(companyModel.aggregate).toHaveBeenCalled();
      expect(companyModel.find).not.toHaveBeenCalled();
    });

    it('atlas vector 검색 실패 시 표준 fallback으로 대체', async () => {
      process.env.MATCH_USE_ATLAS_VECTOR = 'true';
      const buyer = makeBuyer({ embedding: [0.1, 0.2] });
      buyerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(buyer) });
      companyModel.aggregate.mockRejectedValue(new Error('Atlas error'));
      companyModel.find.mockReturnValue(buildQueryMock([]));

      await expect(service.findMatches(BUYER_ID, 10)).resolves.toBeDefined();
      expect(companyModel.find).toHaveBeenCalled();
    });

    it('MATCH_USE_ATLAS_VECTOR=true이지만 embedding 없으면 표준 fallback', async () => {
      process.env.MATCH_USE_ATLAS_VECTOR = 'true';
      const buyer = makeBuyer({ embedding: [] });
      buyerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(buyer) });
      companyModel.find.mockReturnValue(buildQueryMock([]));

      await service.findMatches(BUYER_ID, 10);

      expect(companyModel.find).toHaveBeenCalled();
      expect(companyModel.aggregate).not.toHaveBeenCalled();
    });

    it('DART 인증 기업은 스코어 가산점', async () => {
      const buyer = makeBuyer({ tags: [], industries: [], needs: [] });
      const companyWithDart = makeCompany({ dart: { corpCode: 'A000001' }, tags: [], offerings: [], industry: '' });
      const companyWithoutDart = makeCompany({ _id: '507f1f77bcf86cd799439013', dart: null, tags: [], offerings: [], industry: '' });
      buyerModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(buyer) });
      companyModel.find.mockReturnValue(buildQueryMock([companyWithoutDart, companyWithDart]));

      const result = await service.findMatches(BUYER_ID, 10);

      const dartIdx = result.data.findIndex((r: any) => r.company.dart?.corpCode === 'A000001');
      const noDartIdx = result.data.findIndex((r: any) => !r.company.dart?.corpCode);
      expect(result.data[dartIdx].score).toBeGreaterThan(result.data[noDartIdx].score);
    });
  });

  // ── submitFeedback ────────────────────────────────────────────────────────────

  describe('submitFeedback', () => {
    it('companyId가 존재하지 않으면 NotFoundException', async () => {
      companyModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(
        service.submitFeedback(COMPANY_ID, { rating: 4 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('피드백 저장 후 id 반환', async () => {
      const company = makeCompany();
      const savedDoc = { _id: 'fb-1' };
      companyModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(company) });
      feedbackModel.create.mockResolvedValue(savedDoc);

      const result = await service.submitFeedback(COMPANY_ID, { rating: 5, comments: '좋아요' });

      expect(feedbackModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: company._id, rating: 5, comments: '좋아요' }),
      );
      expect(result).toEqual({ message: 'Feedback saved', id: 'fb-1' });
    });

    it('comments/locale/source 미전달 시 기본값 적용', async () => {
      const company = makeCompany();
      companyModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(company) });
      feedbackModel.create.mockResolvedValue({ _id: 'fb-2' });

      await service.submitFeedback(COMPANY_ID, { rating: 3 });

      expect(feedbackModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ comments: '', locale: '', source: 'partner-search' }),
      );
    });

    it('source 전달 시 그대로 저장', async () => {
      const company = makeCompany();
      companyModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(company) });
      feedbackModel.create.mockResolvedValue({ _id: 'fb-3' });

      await service.submitFeedback(COMPANY_ID, { rating: 2, source: 'admin-panel' });

      expect(feedbackModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'admin-panel' }),
      );
    });
  });
});
