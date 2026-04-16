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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateConsultantRequestDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
class CreateConsultantRequestDto {
    name;
    email;
    details;
    serviceType = 'matching-assistant';
    locale;
    source = 'partner-search';
    buyerId;
    buyerName;
    searchTerm;
    filters = {};
}
exports.CreateConsultantRequestDto = CreateConsultantRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '홍길동' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(200),
    (0, class_transformer_1.Transform)(({ value }) => value?.trim()),
    __metadata("design:type", String)
], CreateConsultantRequestDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'hong@example.com' }),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(200),
    (0, class_transformer_1.Transform)(({ value }) => value?.trim()),
    __metadata("design:type", String)
], CreateConsultantRequestDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '자동차 부품 수출 관련 상담을 원합니다.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateConsultantRequestDto.prototype, "details", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'matching-assistant', default: 'matching-assistant' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    (0, class_transformer_1.Transform)(({ value }) => value?.trim()),
    __metadata("design:type", String)
], CreateConsultantRequestDto.prototype, "serviceType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'ko' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(12),
    __metadata("design:type", String)
], CreateConsultantRequestDto.prototype, "locale", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'partner-search', default: 'partner-search' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], CreateConsultantRequestDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '507f1f77bcf86cd799439011' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(24),
    __metadata("design:type", String)
], CreateConsultantRequestDto.prototype, "buyerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Acme Corp' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateConsultantRequestDto.prototype, "buyerName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'EV battery parts' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateConsultantRequestDto.prototype, "searchTerm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: { industry: 'Automotive', country: 'US' } }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateConsultantRequestDto.prototype, "filters", void 0);
//# sourceMappingURL=create-consultant-request.dto.js.map