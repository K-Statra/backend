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
exports.SubmitFeedbackDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class SubmitFeedbackDto {
    rating;
    comments;
    locale;
    source;
}
exports.SubmitFeedbackDto = SubmitFeedbackDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '평점 (1~5)', minimum: 1, maximum: 5, example: 4 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], SubmitFeedbackDto.prototype, "rating", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '코멘트 (최대 2000자)', example: '좋은 파트너입니다.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], SubmitFeedbackDto.prototype, "comments", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '언어 코드', example: 'ko' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(12),
    __metadata("design:type", String)
], SubmitFeedbackDto.prototype, "locale", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '피드백 출처', example: 'partner-search' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], SubmitFeedbackDto.prototype, "source", void 0);
//# sourceMappingURL=submit-feedback.dto.js.map