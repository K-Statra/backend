import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { PartnersService } from "./partners.service";
import { EmbeddingsService } from "../embeddings/embeddings.service";
import { Seller } from "../sellers/schemas/seller.schema";
import { Buyer } from "../buyers/schemas/buyer.schema";
import { User } from "../users/schemas/user.schema";

const USER_ID = new Types.ObjectId().toString();

// Mongoose query는 exec() 없이 await 가능한 thenable → then/catch 추가
function buildQueryMock(resolvedValue: any) {
  const mock: any = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolvedValue),
    then: (resolve: any, reject: any) =>
      Promise.resolve(resolvedValue).then(resolve, reject),
    catch: (onRejected: any) =>
      Promise.resolve(resolvedValue).catch(onRejected),
  };
  return mock;
}

const makeSellerModel = () => ({
  find: jest.fn().mockReturnValue(buildQueryMock([])),
  aggregate: jest.fn().mockResolvedValue([]),
  countDocuments: jest.fn().mockResolvedValue(0),
});

const makeBuyerModel = () => ({
  find: jest.fn().mockReturnValue(buildQueryMock([])),
  aggregate: jest.fn().mockResolvedValue([]),
  countDocuments: jest.fn().mockResolvedValue(0),
});

const makeUserModel = () => ({
  findById: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(null),
  }),
});

const makeEmbeddingsService = () => ({
  embed: jest.fn().mockResolvedValue([]),
});

describe("PartnersService", () => {
  let service: PartnersService;
  let sellerModel: ReturnType<typeof makeSellerModel>;
  let buyerModel: ReturnType<typeof makeBuyerModel>;
  let userModel: ReturnType<typeof makeUserModel>;
  let embeddingsService: ReturnType<typeof makeEmbeddingsService>;

  beforeEach(async () => {
    sellerModel = makeSellerModel();
    buyerModel = makeBuyerModel();
    userModel = makeUserModel();
    embeddingsService = makeEmbeddingsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnersService,
        { provide: getModelToken(Seller.name), useValue: sellerModel },
        { provide: getModelToken(Buyer.name), useValue: buyerModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: EmbeddingsService, useValue: embeddingsService },
      ],
    }).compile();

    service = module.get<PartnersService>(PartnersService);
  });

  // ── show-all 모드 ─────────────────────────────────────────────────────────────

  describe("show-all 모드 (쿼리/필터 없음)", () => {
    it("find({}) 호출 후 score=1.0 부여", async () => {
      // AI 분석 모킹
      jest.spyOn(service as any, "generateHyDEAndKeywords").mockResolvedValue({
        profile: "",
        keywords: "",
      });

      sellerModel.find.mockReturnValue(
        buildQueryMock([{ _id: "c1", name: "Acme" }]),
      );

      const result = await service.search({ q: "" });

      expect(sellerModel.find).toHaveBeenCalled();
      expect(result.data[0].score).toBe(1.0);
      expect(result.provider).toBe("db");
    });
  });

  // ── browse 모드 ───────────────────────────────────────────────────────────────

  describe("browse 모드 (필터만, 쿼리 없음)", () => {
    it("industry 매핑 필터 적용 후 score=1.0", async () => {
      // AI 분석 모킹
      jest.spyOn(service as any, "generateHyDEAndKeywords").mockResolvedValue({
        profile: "",
        keywords: "",
      });

      sellerModel.find.mockReturnValue(
        buildQueryMock([{ _id: "c1", name: "Acme" }]),
      );

      const result = await service.search({
        q: "",
        industry: "IT / AI / SaaS",
      });

      expect(sellerModel.find).toHaveBeenCalled();
      expect(result.data[0].score).toBe(1.0);
    });

    it("country 필터 적용", async () => {
      sellerModel.find.mockReturnValue(buildQueryMock([]));

      await service.search({ q: "", country: "Korea" });

      expect(sellerModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ "location.country": "Korea" }),
        expect.any(Object),
      );
    });
  });

  // ── 벡터 검색 ─────────────────────────────────────────────────────────────────

  describe("벡터 검색 (쿼리 있음, 국내/비해외 인텐트)", () => {
    it("embed 호출 후 aggregate 실행", async () => {
      embeddingsService.embed.mockResolvedValue(new Array(64).fill(0.1));
      sellerModel.aggregate.mockResolvedValue([
        { _id: "c1", name: "Acme", score: 0.9 },
      ]);

      const result = await service.search({ q: "화장품 제조사" });

      expect(embeddingsService.embed).toHaveBeenCalled();
      expect(sellerModel.aggregate).toHaveBeenCalled();
      expect(result.provider).toBe("db");
    });

    it("embed 빈 벡터 → 텍스트 검색 폴백, 스코어 정규화 및 부스트", async () => {
      embeddingsService.embed.mockResolvedValue([]);
      sellerModel.find.mockReturnValue(
        buildQueryMock([
          {
            _id: "c1",
            name: "화장품 제조사",
            industry: "Beauty / Consumer Goods / Food",
            score: 12,
          },
        ]),
      );

      const result = await service.search({ q: "화장품" });

      expect(sellerModel.find).toHaveBeenCalled();
      // 계산: (min(1, 12/12) * 0.7) + 0.3(부스트) = 0.7 + 0.3 = 1.0
      expect(result.data[0].score).toBeCloseTo(1.0);
    });

    it("벡터 검색 결과 0건 → 텍스트 검색 폴백", async () => {
      embeddingsService.embed.mockResolvedValue(new Array(64).fill(0.1));
      sellerModel.aggregate.mockResolvedValue([]); // 벡터 결과 없음
      sellerModel.find.mockReturnValue(
        buildQueryMock([{ _id: "c2", name: "Beta", score: 3 }]),
      );

      const result = await service.search({ q: "식품" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Beta");
    });
  });

  // ── 바이어 검색 ───────────────────────────────────────────────────────────────

  describe("바이어 검색 (바이어 인텐트)", () => {
    it("바이어 키워드가 포함되면 buyerModel을 사용", async () => {
      buyerModel.find.mockReturnValue(
        buildQueryMock([
          { _id: "b1", name_kr: "라온바이어", country: "US", score: 10 },
        ]),
      );

      const result = await service.search({ q: "보안 솔루션 바이어" });

      expect(buyerModel.find).toHaveBeenCalled();
      expect(sellerModel.find).not.toHaveBeenCalled();
      expect(result.debug.intent).toBe("buyer");
      expect(result.data[0].name).toBe("라온바이어");
      expect(result.data[0].tags).toContain("Buyer");
    });
  });

  // ── 웹 검색 폴백 ──────────────────────────────────────────────────────────────

  describe("웹 검색 폴백 (해외 지역 + 바이어/셀러 인텐트)", () => {
    it("미국 + 수입업체 → forceWebSearch=true → searchWeb 호출", async () => {
      const webSpy = jest.spyOn(service as any, "searchWeb").mockResolvedValue({
        results: [
          {
            title: "US Importer",
            content: "imports parts",
            url: "http://example.com",
            score: 0.9,
          },
        ],
        answer: "Found importers",
      });

      const result = await service.search({ q: "미국 자동차부품 수입업체" });

      expect(webSpy).toHaveBeenCalled();
      expect(result.provider).toBe("tavily");
      expect(result.data[0].name).toBe("US Importer");
    });

    it("웹 검색 타임아웃 시 크래시 없이 결과 반환", async () => {
      jest
        .spyOn(service as any, "searchWeb")
        .mockRejectedValue(new Error("Tavily Timeout"));

      await expect(
        service.search({ q: "미국 수입업체" }),
      ).resolves.toBeDefined();
    });

    it("자동차 관련 없는 웹 결과 → score 감점", async () => {
      jest.spyOn(service as any, "searchWeb").mockResolvedValue({
        results: [
          {
            title: "Fashion Blog",
            content: "fashion tips",
            url: "http://fashion.com",
            score: 0.9,
          },
        ],
        answer: "",
      });

      const result = await service.search({ q: "미국 자동차부품 수입업체" });

      // 자동차 컨텍스트 없는 결과는 0.6 감점
      expect(result.data[0].score).toBeLessThan(0.5);
    });
  });

  // ── savedPartners 제외 필터 ───────────────────────────────────────────────────

  describe("savedPartners 제외 (로그인 사용자)", () => {
    it("show-all 모드: savedPartners ID가 $nin 필터로 전달됨", async () => {
      const savedId = new Types.ObjectId();
      userModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          savedPartners: [{ partnerId: savedId, partnerType: "seller" }],
        }),
      });
      sellerModel.find.mockReturnValue(buildQueryMock([]));

      await service.search({ q: "", userId: USER_ID });

      const [filterArg] = sellerModel.find.mock.calls[0];
      expect(filterArg._id.$nin[0].toString()).toBe(savedId.toString());
    });

    it("browse 모드(필터만): savedPartners ID가 $nin 필터로 전달됨", async () => {
      const savedId = new Types.ObjectId();
      userModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          savedPartners: [{ partnerId: savedId, partnerType: "seller" }],
        }),
      });
      sellerModel.find.mockReturnValue(
        buildQueryMock([{ _id: new Types.ObjectId(), name: "다른 기업" }]),
      );

      await service.search({
        q: "",
        industry: "IT / AI / SaaS",
        userId: USER_ID,
      });

      const [filterArg] = sellerModel.find.mock.calls[0];
      expect(filterArg._id.$nin[0].toString()).toBe(savedId.toString());
    });

    it("텍스트 검색 모드: savedPartners ID가 $nin 필터로 전달됨", async () => {
      const savedId = new Types.ObjectId();
      userModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          savedPartners: [{ partnerId: savedId, partnerType: "seller" }],
        }),
      });
      jest.spyOn(service as any, "generateHyDEAndKeywords").mockResolvedValue({
        profile: "test",
        keywords: "화장품",
      });
      embeddingsService.embed.mockResolvedValue([]);
      sellerModel.find.mockReturnValue(buildQueryMock([]));

      await service.search({ q: "화장품 제조사", userId: USER_ID });

      const [filterArg] = sellerModel.find.mock.calls[0];
      expect(filterArg._id.$nin[0].toString()).toBe(savedId.toString());
    });

    it("비로그인(userId 없음): userModel.findById 호출 안 함", async () => {
      sellerModel.find.mockReturnValue(buildQueryMock([]));

      await service.search({ q: "" });

      expect(userModel.findById).not.toHaveBeenCalled();
    });

    it("savedPartners 없는 로그인 사용자: $nin 필터 적용 안 됨", async () => {
      userModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ savedPartners: [] }),
      });
      sellerModel.find.mockReturnValue(buildQueryMock([]));

      await service.search({ q: "", userId: USER_ID });

      const [filterArg] = sellerModel.find.mock.calls[0];
      expect(filterArg._id).toBeUndefined();
    });
  });
});
