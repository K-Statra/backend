"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyImagesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const multer_1 = require("multer");
const path_1 = require("path");
const company_images_service_1 = require("./company-images.service");
const upload_image_dto_1 = require("./dto/upload-image.dto");
const parse_mongo_id_pipe_1 = require("../../common/pipes/parse-mongo-id.pipe");
const multerOptions = {
    storage: (0, multer_1.diskStorage)({
        destination: './uploads',
        filename: (req, file, cb) => {
            const ext = (0, path_1.extname)(file.originalname || '').toLowerCase() || '.jpg';
            const companyId = (req.params.companyId || 'company').slice(0, 18);
            cb(null, `${companyId}-${Date.now()}${ext}`);
        },
    }),
    limits: { fileSize: Number(process.env.COMPANY_IMAGE_MAX_BYTES || 5 * 1024 * 1024) },
};
let CompanyImagesController = class CompanyImagesController {
    companyImagesService;
    constructor(companyImagesService) {
        this.companyImagesService = companyImagesService;
    }
    getImages(companyId) {
        return this.companyImagesService.getImages(companyId);
    }
    async addImage(companyId, file, body) {
        const url = file ? `/uploads/${file.filename}` : body.url;
        if (!url)
            throw new common_1.BadRequestException('이미지 파일 또는 url이 필요합니다');
        return this.companyImagesService.addImage(companyId, {
            url,
            caption: body.caption,
            alt: body.alt,
            tags: body.tags,
        });
    }
    removeImage(companyId, imageId) {
        return this.companyImagesService.removeImage(companyId, imageId);
    }
};
exports.CompanyImagesController = CompanyImagesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '기업 이미지 목록' }),
    (0, swagger_1.ApiParam)({ name: 'companyId', description: 'MongoDB ObjectId' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '이미지 배열' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '기업 없음' }),
    __param(0, (0, common_1.Param)('companyId', parse_mongo_id_pipe_1.ParseMongoIdPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyImagesController.prototype, "getImages", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '기업 이미지 추가 (파일 업로드 또는 URL)' }),
    (0, swagger_1.ApiParam)({ name: 'companyId', description: 'MongoDB ObjectId' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                image: { type: 'string', format: 'binary', description: '이미지 파일 (선택)' },
                url: { type: 'string', description: '이미지 URL (파일 없을 때 사용)' },
                caption: { type: 'string' },
                alt: { type: 'string' },
                tags: { type: 'string', description: '콤마 구분 태그' },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '추가된 이미지' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '파일 또는 URL 필요' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '기업 없음' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('image', multerOptions)),
    __param(0, (0, common_1.Param)('companyId', parse_mongo_id_pipe_1.ParseMongoIdPipe)),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, upload_image_dto_1.UploadImageDto]),
    __metadata("design:returntype", Promise)
], CompanyImagesController.prototype, "addImage", null);
__decorate([
    (0, common_1.Delete)(':imageId'),
    (0, common_1.HttpCode)(204),
    (0, swagger_1.ApiOperation)({ summary: '기업 이미지 삭제' }),
    (0, swagger_1.ApiParam)({ name: 'companyId', description: 'MongoDB ObjectId' }),
    (0, swagger_1.ApiParam)({ name: 'imageId', description: '이미지 ObjectId' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: '삭제 성공' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '기업 또는 이미지 없음' }),
    __param(0, (0, common_1.Param)('companyId', parse_mongo_id_pipe_1.ParseMongoIdPipe)),
    __param(1, (0, common_1.Param)('imageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CompanyImagesController.prototype, "removeImage", null);
exports.CompanyImagesController = CompanyImagesController = __decorate([
    (0, swagger_1.ApiTags)('Company Images'),
    (0, common_1.Controller)('companies/:companyId/images'),
    __metadata("design:paramtypes", [company_images_service_1.CompanyImagesService])
], CompanyImagesController);
//# sourceMappingURL=company-images.controller.js.map