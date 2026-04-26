import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ConsultantsController } from "./consultants.controller";
import { ConsultantsService } from "./consultants.service";

const mockConsultantsService = {
  createRequest: jest.fn(),
};

describe("ConsultantsController", () => {
  let controller: ConsultantsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsultantsController],
      providers: [
        { provide: ConsultantsService, useValue: mockConsultantsService },
      ],
    }).compile();

    controller = module.get<ConsultantsController>(ConsultantsController);
  });

  describe("POST /consultants/requests", () => {
    it("요청 접수 후 id/status/message 반환", async () => {
      const dto = { name: "홍길동", email: "hong@example.com" } as any;
      const result = {
        id: "507f1f77bcf86cd799439011",
        status: "NEW",
        message: "Request received",
      };
      mockConsultantsService.createRequest.mockResolvedValue(result);

      expect(await controller.createRequest(dto)).toEqual(result);
      expect(mockConsultantsService.createRequest).toHaveBeenCalledWith(dto);
    });

    it("유효하지 않은 buyerId → BadRequestException", async () => {
      const dto = {
        name: "홍길동",
        email: "hong@example.com",
        buyerId: "invalid",
      } as any;
      mockConsultantsService.createRequest.mockRejectedValue(
        new BadRequestException("Invalid buyerId"),
      );

      await expect(controller.createRequest(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("모든 옵셔널 필드 전달 시 서비스에 그대로 전달", async () => {
      const dto = {
        name: "홍길동",
        email: "hong@example.com",
        details: "상세 내용",
        serviceType: "custom-service",
        locale: "ko",
        source: "web",
        buyerId: "507f1f77bcf86cd799439011",
        buyerName: "Acme Corp",
        searchTerm: "EV battery",
        filters: { industry: "Automotive" },
      } as any;
      mockConsultantsService.createRequest.mockResolvedValue({
        id: "x",
        status: "NEW",
        message: "Request received",
      });

      await controller.createRequest(dto);

      expect(mockConsultantsService.createRequest).toHaveBeenCalledWith(dto);
    });
  });
});
