import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CompanyImagesController } from "./company-images.controller";
import { CompanyImagesService } from "./company-images.service";
import { ParseMongoIdPipe } from "../../common/pipes/parse-mongo-id.pipe";

const COMPANY_ID = "507f1f77bcf86cd799439011";
const IMAGE_ID = "507f1f77bcf86cd799439012";

const mockService = {
  getImages: jest.fn(),
  addImage: jest.fn(),
  removeImage: jest.fn(),
};

describe("CompanyImagesController", () => {
  let controller: CompanyImagesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyImagesController],
      providers: [
        { provide: CompanyImagesService, useValue: mockService },
        ParseMongoIdPipe,
      ],
    }).compile();

    controller = module.get<CompanyImagesController>(CompanyImagesController);
  });

  // ── getImages ─────────────────────────────────────────────────────────────────

  describe("GET /companies/:companyId/images", () => {
    it("이미지 목록 반환", async () => {
      const images = [{ url: "http://img.com/a.jpg" }];
      mockService.getImages.mockResolvedValue(images);

      expect(await controller.getImages(COMPANY_ID)).toEqual(images);
      expect(mockService.getImages).toHaveBeenCalledWith(COMPANY_ID);
    });

    it("없는 기업 → NotFoundException", async () => {
      mockService.getImages.mockRejectedValue(new NotFoundException());

      await expect(controller.getImages(COMPANY_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── addImage ──────────────────────────────────────────────────────────────────

  describe("POST /companies/:companyId/images", () => {
    it("파일 업로드 시 /uploads/{filename} URL 사용", async () => {
      const file = { filename: "abc.jpg" } as Express.Multer.File;
      const saved = { url: "/uploads/abc.jpg" };
      mockService.addImage.mockResolvedValue(saved);

      const result = await controller.addImage(COMPANY_ID, file, {});

      expect(result).toEqual(saved);
      expect(mockService.addImage).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({ url: "/uploads/abc.jpg" }),
      );
    });

    it("URL 전달 시 해당 URL 사용", async () => {
      const body = {
        url: "https://cdn.example.com/img.jpg",
        caption: "제품 사진",
      } as any;
      const saved = { url: body.url };
      mockService.addImage.mockResolvedValue(saved);

      const result = await controller.addImage(COMPANY_ID, undefined, body);

      expect(mockService.addImage).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({
          url: "https://cdn.example.com/img.jpg",
          caption: "제품 사진",
        }),
      );
      expect(result).toEqual(saved);
    });

    it("파일도 URL도 없으면 BadRequestException", async () => {
      await expect(
        controller.addImage(COMPANY_ID, undefined, {} as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── removeImage ───────────────────────────────────────────────────────────────

  describe("DELETE /companies/:companyId/images/:imageId", () => {
    it("이미지 삭제 성공", async () => {
      mockService.removeImage.mockResolvedValue(undefined);

      await expect(
        controller.removeImage(COMPANY_ID, IMAGE_ID),
      ).resolves.toBeUndefined();
      expect(mockService.removeImage).toHaveBeenCalledWith(
        COMPANY_ID,
        IMAGE_ID,
      );
    });

    it("없는 이미지 → NotFoundException", async () => {
      mockService.removeImage.mockRejectedValue(new NotFoundException());

      await expect(
        controller.removeImage(COMPANY_ID, IMAGE_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
