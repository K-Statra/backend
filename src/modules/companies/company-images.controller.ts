import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { diskStorage } from "multer";
import { extname } from "path";
import { CompanyImagesService } from "./company-images.service";
import { UploadImageDto } from "./dto/upload-image.dto";
import { ParseMongoIdPipe } from "../../common/pipes/parse-mongo-id.pipe";

const multerOptions = {
  storage: diskStorage({
    destination: "./uploads",
    filename: (
      req: any,
      file: Express.Multer.File,
      cb: (err: Error | null, filename: string) => void,
    ) => {
      const ext = extname(file.originalname || "").toLowerCase() || ".jpg";
      const companyId = (req.params.companyId || "company").slice(0, 18);
      cb(null, `${companyId}-${Date.now()}${ext}`);
    },
  }),
  limits: {
    fileSize: Number(process.env.COMPANY_IMAGE_MAX_BYTES || 5 * 1024 * 1024),
  },
};

@ApiTags("Company Images")
@Controller("companies/:companyId/images")
export class CompanyImagesController {
  constructor(private readonly companyImagesService: CompanyImagesService) {}

  @Get()
  @ApiOperation({ summary: "기업 이미지 목록" })
  @ApiParam({ name: "companyId", description: "MongoDB ObjectId" })
  @ApiResponse({ status: 200, description: "이미지 배열" })
  @ApiResponse({ status: 404, description: "기업 없음" })
  getImages(@Param("companyId", ParseMongoIdPipe) companyId: string) {
    return this.companyImagesService.getImages(companyId);
  }

  @Post()
  @ApiOperation({ summary: "기업 이미지 추가 (파일 업로드 또는 URL)" })
  @ApiParam({ name: "companyId", description: "MongoDB ObjectId" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        image: {
          type: "string",
          format: "binary",
          description: "이미지 파일 (선택)",
        },
        url: { type: "string", description: "이미지 URL (파일 없을 때 사용)" },
        caption: { type: "string" },
        alt: { type: "string" },
        tags: { type: "string", description: "콤마 구분 태그" },
      },
    },
  })
  @ApiResponse({ status: 201, description: "추가된 이미지" })
  @ApiResponse({ status: 400, description: "파일 또는 URL 필요" })
  @ApiResponse({ status: 404, description: "기업 없음" })
  @UseInterceptors(FileInterceptor("image", multerOptions))
  async addImage(
    @Param("companyId", ParseMongoIdPipe) companyId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadImageDto,
  ) {
    const url = file ? `/uploads/${file.filename}` : body.url;
    if (!url)
      throw new BadRequestException("이미지 파일 또는 url이 필요합니다");
    return this.companyImagesService.addImage(companyId, {
      url,
      caption: body.caption,
      alt: body.alt,
      tags: body.tags,
    });
  }

  @Delete(":imageId")
  @HttpCode(204)
  @ApiOperation({ summary: "기업 이미지 삭제" })
  @ApiParam({ name: "companyId", description: "MongoDB ObjectId" })
  @ApiParam({ name: "imageId", description: "이미지 ObjectId" })
  @ApiResponse({ status: 204, description: "삭제 성공" })
  @ApiResponse({ status: 404, description: "기업 또는 이미지 없음" })
  removeImage(
    @Param("companyId", ParseMongoIdPipe) companyId: string,
    @Param("imageId") imageId: string,
  ) {
    return this.companyImagesService.removeImage(companyId, imageId);
  }
}
