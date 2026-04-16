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
exports.MatchesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const matches_service_1 = require("./matches.service");
const find_matches_dto_1 = require("./dto/find-matches.dto");
const submit_feedback_dto_1 = require("./dto/submit-feedback.dto");
class CompanyIdParam {
    companyId;
}
__decorate([
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], CompanyIdParam.prototype, "companyId", void 0);
let MatchesController = class MatchesController {
    matchesService;
    constructor(matchesService) {
        this.matchesService = matchesService;
    }
    findMatches(dto) {
        return this.matchesService.findMatches(dto.buyerId, dto.limit ?? 10);
    }
    submitFeedback(params, dto) {
        return this.matchesService.submitFeedback(params.companyId, dto);
    }
};
exports.MatchesController = MatchesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '바이어 기반 기업 매칭' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '스코어 순으로 정렬된 매칭 결과',
        schema: {
            example: {
                query: { buyerId: '6632a1f0e4b0a1c2d3e4f5a6', limit: 10 },
                count: 2,
                data: [
                    { company: { _id: '...', name: '...' }, score: 8.5, reasons: ['tags overlap x2', 'industry match'] },
                ],
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '유효성 검사 실패 (buyerId 누락 또는 형식 오류)' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '바이어 없음' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [find_matches_dto_1.FindMatchesDto]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "findMatches", null);
__decorate([
    (0, common_1.Post)(':companyId/feedback'),
    (0, swagger_1.ApiOperation)({ summary: '매칭 피드백 제출' }),
    (0, swagger_1.ApiParam)({ name: 'companyId', description: '기업 MongoDB ID (24자 hex)', example: '6632a1f0e4b0a1c2d3e4f5a6' }),
    (0, swagger_1.ApiBody)({ type: submit_feedback_dto_1.SubmitFeedbackDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '피드백 저장 성공', schema: { example: { message: 'Feedback saved', id: '6632a1f0e4b0a1c2d3e4f5a6' } } }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '유효성 검사 실패 (companyId 형식 오류 또는 rating 범위 초과)' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '기업 없음' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CompanyIdParam,
        submit_feedback_dto_1.SubmitFeedbackDto]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "submitFeedback", null);
exports.MatchesController = MatchesController = __decorate([
    (0, swagger_1.ApiTags)('Matches'),
    (0, common_1.Controller)('matches'),
    __metadata("design:paramtypes", [matches_service_1.MatchesService])
], MatchesController);
//# sourceMappingURL=matches.controller.js.map