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
exports.CompaniesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const companies_service_1 = require("./companies.service");
const create_company_dto_1 = require("./dto/create-company.dto");
const update_company_dto_1 = require("./dto/update-company.dto");
const query_company_dto_1 = require("./dto/query-company.dto");
const parse_mongo_id_pipe_1 = require("../../common/pipes/parse-mongo-id.pipe");
let CompaniesController = class CompaniesController {
    companiesService;
    constructor(companiesService) {
        this.companiesService = companiesService;
    }
    findAll(query) {
        return this.companiesService.findAll(query);
    }
    findOne(id) {
        return this.companiesService.findById(id);
    }
    create(dto) {
        return this.companiesService.create(dto);
    }
    update(id, dto) {
        return this.companiesService.update(id, dto);
    }
    remove(id) {
        return this.companiesService.remove(id);
    }
};
exports.CompaniesController = CompaniesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '기업 목록 (검색/페이지네이션/정렬)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '기업 목록', schema: { example: { page: 1, limit: 10, total: 100, totalPages: 10, data: [] } } }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_company_dto_1.QueryCompanyDto]),
    __metadata("design:returntype", void 0)
], CompaniesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '기업 단건 조회' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'MongoDB ObjectId' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '기업 정보' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '유효하지 않은 ID' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '기업 없음' }),
    __param(0, (0, common_1.Param)('id', parse_mongo_id_pipe_1.ParseMongoIdPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompaniesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '기업 생성 (이미지 없으면 플레이스홀더 자동 삽입)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '생성된 기업' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '유효성 검사 실패' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_company_dto_1.CreateCompanyDto]),
    __metadata("design:returntype", void 0)
], CompaniesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '기업 수정 (부분 업데이트)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'MongoDB ObjectId' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '수정된 기업' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '유효하지 않은 ID 또는 빈 본문' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '기업 없음' }),
    __param(0, (0, common_1.Param)('id', parse_mongo_id_pipe_1.ParseMongoIdPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_company_dto_1.UpdateCompanyDto]),
    __metadata("design:returntype", void 0)
], CompaniesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(204),
    (0, swagger_1.ApiOperation)({ summary: '기업 삭제' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'MongoDB ObjectId' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: '삭제 성공' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '유효하지 않은 ID' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '기업 없음' }),
    __param(0, (0, common_1.Param)('id', parse_mongo_id_pipe_1.ParseMongoIdPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompaniesController.prototype, "remove", null);
exports.CompaniesController = CompaniesController = __decorate([
    (0, swagger_1.ApiTags)('Companies'),
    (0, common_1.Controller)('companies'),
    __metadata("design:paramtypes", [companies_service_1.CompaniesService])
], CompaniesController);
//# sourceMappingURL=companies.controller.js.map