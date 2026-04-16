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
exports.ConsultantsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const consultants_service_1 = require("./consultants.service");
const create_consultant_request_dto_1 = require("./dto/create-consultant-request.dto");
let ConsultantsController = class ConsultantsController {
    consultantsService;
    constructor(consultantsService) {
        this.consultantsService = consultantsService;
    }
    createRequest(dto) {
        return this.consultantsService.createRequest(dto);
    }
};
exports.ConsultantsController = ConsultantsController;
__decorate([
    (0, common_1.Post)('requests'),
    (0, common_1.HttpCode)(201),
    (0, swagger_1.ApiOperation)({ summary: '컨설턴트 상담 요청 접수' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '요청 접수 완료', schema: { example: { id: '507f1f77bcf86cd799439011', status: 'NEW', message: 'Request received' } } }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '유효성 검사 실패 (필수 필드 누락, 이메일 형식 오류 등)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_consultant_request_dto_1.CreateConsultantRequestDto]),
    __metadata("design:returntype", void 0)
], ConsultantsController.prototype, "createRequest", null);
exports.ConsultantsController = ConsultantsController = __decorate([
    (0, swagger_1.ApiTags)('Consultants'),
    (0, common_1.Controller)('consultants'),
    __metadata("design:paramtypes", [consultants_service_1.ConsultantsService])
], ConsultantsController);
//# sourceMappingURL=consultants.controller.js.map