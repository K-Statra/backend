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
exports.CreateBuyerDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
function trimDedupe(value) {
    if (!Array.isArray(value))
        return [];
    return [...new Set(value.map((s) => String(s).trim()).filter(Boolean))];
}
class CreateBuyerDto {
    name;
    country;
    industries;
    needs;
    tags;
    profileText;
}
exports.CreateBuyerDto = CreateBuyerDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Acme Corp' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateBuyerDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'US' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateBuyerDto.prototype, "country", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], example: ['Automotive', 'Electronics'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_transformer_1.Transform)(({ value }) => trimDedupe(value)),
    __metadata("design:type", Array)
], CreateBuyerDto.prototype, "industries", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], example: ['OEM parts', 'EV components'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_transformer_1.Transform)(({ value }) => trimDedupe(value)),
    __metadata("design:type", Array)
], CreateBuyerDto.prototype, "needs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], example: ['B2B', 'import'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_transformer_1.Transform)(({ value }) => trimDedupe(value)),
    __metadata("design:type", Array)
], CreateBuyerDto.prototype, "tags", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '미국 자동차 부품 바이어입니다.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateBuyerDto.prototype, "profileText", void 0);
//# sourceMappingURL=create-buyer.dto.js.map