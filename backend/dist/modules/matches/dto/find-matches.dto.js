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
exports.FindMatchesDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class FindMatchesDto {
    buyerId;
    limit = 10;
}
exports.FindMatchesDto = FindMatchesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '바이어 MongoDB ID (24자 hex)', example: '6632a1f0e4b0a1c2d3e4f5a6' }),
    (0, class_validator_1.IsMongoId)(),
    __metadata("design:type", String)
], FindMatchesDto.prototype, "buyerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '결과 수 (기본 10)', example: 10 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], FindMatchesDto.prototype, "limit", void 0);
//# sourceMappingURL=find-matches.dto.js.map