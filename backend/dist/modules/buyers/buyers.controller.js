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
exports.BuyersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const buyers_service_1 = require("./buyers.service");
const create_buyer_dto_1 = require("./dto/create-buyer.dto");
const update_buyer_dto_1 = require("./dto/update-buyer.dto");
const query_buyer_dto_1 = require("./dto/query-buyer.dto");
const parse_mongo_id_pipe_1 = require("../../common/pipes/parse-mongo-id.pipe");
let BuyersController = class BuyersController {
    buyersService;
    constructor(buyersService) {
        this.buyersService = buyersService;
    }
    findAll(query) {
        return this.buyersService.findAll(query);
    }
    findOne(id) {
        return this.buyersService.findById(id);
    }
    create(dto) {
        return this.buyersService.create(dto);
    }
    update(id, dto) {
        return this.buyersService.update(id, dto);
    }
    remove(id) {
        return this.buyersService.remove(id);
    }
};
exports.BuyersController = BuyersController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '바이어 목록 (페이징 + 필터)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '바이어 목록', schema: { example: { page: 1, limit: 10, total: 50, totalPages: 5, data: [] } } }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_buyer_dto_1.QueryBuyerDto]),
    __metadata("design:returntype", void 0)
], BuyersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '바이어 단건 조회' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'MongoDB ObjectId' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '바이어 정보' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '유효하지 않은 ID' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '바이어 없음' }),
    __param(0, (0, common_1.Param)('id', parse_mongo_id_pipe_1.ParseMongoIdPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BuyersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '바이어 생성' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '생성된 바이어' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '유효성 검사 실패' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_buyer_dto_1.CreateBuyerDto]),
    __metadata("design:returntype", void 0)
], BuyersController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '바이어 수정 (부분 업데이트)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'MongoDB ObjectId' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '수정된 바이어' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '유효하지 않은 ID 또는 빈 본문' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '바이어 없음' }),
    __param(0, (0, common_1.Param)('id', parse_mongo_id_pipe_1.ParseMongoIdPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_buyer_dto_1.UpdateBuyerDto]),
    __metadata("design:returntype", void 0)
], BuyersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(204),
    (0, swagger_1.ApiOperation)({ summary: '바이어 삭제' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'MongoDB ObjectId' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: '삭제 성공' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '유효하지 않은 ID' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '바이어 없음' }),
    __param(0, (0, common_1.Param)('id', parse_mongo_id_pipe_1.ParseMongoIdPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BuyersController.prototype, "remove", null);
exports.BuyersController = BuyersController = __decorate([
    (0, swagger_1.ApiTags)('Buyers'),
    (0, common_1.Controller)('buyers'),
    __metadata("design:paramtypes", [buyers_service_1.BuyersService])
], BuyersController);
//# sourceMappingURL=buyers.controller.js.map