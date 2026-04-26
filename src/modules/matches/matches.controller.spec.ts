import { Test, TestingModule } from "@nestjs/testing";
import { MatchesController } from "./matches.controller";
import { MatchesService } from "./matches.service";

const mockMatchesService = {
  findMatches: jest.fn(),
  submitFeedback: jest.fn(),
};

const BUYER_ID = "507f1f77bcf86cd799439011";
const COMPANY_ID = "507f1f77bcf86cd799439012";

describe("MatchesController", () => {
  let controller: MatchesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [{ provide: MatchesService, useValue: mockMatchesService }],
    }).compile();

    controller = module.get<MatchesController>(MatchesController);
  });

  // ── GET /matches ──────────────────────────────────────────────────────────────

  describe("GET /matches", () => {
    it("서비스 결과 그대로 반환", async () => {
      const response = {
        query: { buyerId: BUYER_ID, limit: 10 },
        count: 1,
        data: [{}],
      };
      mockMatchesService.findMatches.mockResolvedValue(response);

      const result = await controller.findMatches({
        buyerId: BUYER_ID,
        limit: 10,
      });

      expect(result).toEqual(response);
      expect(mockMatchesService.findMatches).toHaveBeenCalledWith(BUYER_ID, 10);
    });

    it("limit 미전달 시 기본값 10 사용", async () => {
      mockMatchesService.findMatches.mockResolvedValue({ count: 0, data: [] });

      await controller.findMatches({ buyerId: BUYER_ID });

      expect(mockMatchesService.findMatches).toHaveBeenCalledWith(BUYER_ID, 10);
    });

    it("limit 전달 시 해당 값 사용", async () => {
      mockMatchesService.findMatches.mockResolvedValue({ count: 0, data: [] });

      await controller.findMatches({ buyerId: BUYER_ID, limit: 25 });

      expect(mockMatchesService.findMatches).toHaveBeenCalledWith(BUYER_ID, 25);
    });
  });

  // ── POST /matches/:companyId/feedback ─────────────────────────────────────────

  describe("POST /matches/:companyId/feedback", () => {
    it("서비스 결과 그대로 반환", async () => {
      const response = { message: "Feedback saved", id: "fb-1" };
      mockMatchesService.submitFeedback.mockResolvedValue(response);

      const result = await controller.submitFeedback(
        { companyId: COMPANY_ID },
        { rating: 4, comments: "좋습니다" },
      );

      expect(result).toEqual(response);
      expect(mockMatchesService.submitFeedback).toHaveBeenCalledWith(
        COMPANY_ID,
        { rating: 4, comments: "좋습니다" },
      );
    });

    it("rating만 전달해도 호출됨", async () => {
      mockMatchesService.submitFeedback.mockResolvedValue({
        message: "Feedback saved",
        id: "fb-2",
      });

      await controller.submitFeedback({ companyId: COMPANY_ID }, { rating: 5 });

      expect(mockMatchesService.submitFeedback).toHaveBeenCalledWith(
        COMPANY_ID,
        { rating: 5 },
      );
    });

    it("옵션 필드(locale, source) 포함 전달", async () => {
      mockMatchesService.submitFeedback.mockResolvedValue({
        message: "Feedback saved",
        id: "fb-3",
      });

      await controller.submitFeedback(
        { companyId: COMPANY_ID },
        {
          rating: 3,
          locale: "ko",
          source: "admin-panel",
        },
      );

      expect(mockMatchesService.submitFeedback).toHaveBeenCalledWith(
        COMPANY_ID,
        { rating: 3, locale: "ko", source: "admin-panel" },
      );
    });
  });
});
