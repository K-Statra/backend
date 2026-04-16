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
exports.PartnersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const partners_service_1 = require("./partners.service");
let PartnersController = class PartnersController {
    partnersService;
    constructor(partnersService) {
        this.partnersService = partnersService;
    }
    search(q, limit, industry, country, partnership, size, buyerId) {
        return this.partnersService.search({ q, limit, industry, country, partnership, size, buyerId });
    }
    debug() {
        return this.partnersService.getDebugInfo();
    }
};
exports.PartnersController = PartnersController;
__decorate([
    (0, common_1.Get)('search'),
    (0, swagger_1.ApiOperation)({ summary: '파트너 검색 (벡터 → 텍스트 폴백 → 웹검색 + LLM 인텐트)' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false, description: '자연어 검색어 (한국어/영어)' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: '결과 수 (기본 10)' }),
    (0, swagger_1.ApiQuery)({ name: 'industry', required: false, description: '산업 필터' }),
    (0, swagger_1.ApiQuery)({ name: 'country', required: false, description: '국가 필터' }),
    (0, swagger_1.ApiQuery)({ name: 'partnership', required: false, description: '파트너십 태그 필터' }),
    (0, swagger_1.ApiQuery)({ name: 'size', required: false, description: '기업 규모 (예: 1-10, 11-50, 51-200)' }),
    (0, swagger_1.ApiQuery)({ name: 'buyerId', required: false, description: '바이어 ID (Neo4j 그래프 재랭킹용)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '검색 결과', schema: { example: { data: [], aiResponse: '', provider: 'db', debug: {} } } }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(10), common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('industry')),
    __param(3, (0, common_1.Query)('country')),
    __param(4, (0, common_1.Query)('partnership')),
    __param(5, (0, common_1.Query)('size')),
    __param(6, (0, common_1.Query)('buyerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('debug'),
    (0, swagger_1.ApiOperation)({ summary: '파트너 서비스 디버그 정보 (DB 연결, 임베딩 상태, 샘플 데이터)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '디버그 정보', schema: { example: { status: 'ok', db: {}, embedding: {}, industryStats: [], embeddingCount: 0 } } }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "debug", null);
exports.PartnersController = PartnersController = __decorate([
    (0, swagger_1.ApiTags)('Partners'),
    (0, common_1.Controller)('partners'),
    __metadata("design:paramtypes", [partners_service_1.PartnersService])
], PartnersController);
//# sourceMappingURL=partners.controller.js.map