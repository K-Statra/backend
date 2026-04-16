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
exports.InsightsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const insights_service_1 = require("./insights.service");
let InsightsController = class InsightsController {
    insightsService;
    constructor(insightsService) {
        this.insightsService = insightsService;
    }
    getDashboard() { return this.insightsService.getDashboard(); }
    getTopIndustries() { return this.insightsService.getTopIndustries(); }
    getRecentTransactions() { return this.insightsService.getRecentTransactions(); }
};
exports.InsightsController = InsightsController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, swagger_1.ApiOperation)({ summary: '대시보드 통계' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '파트너 수, 진행 중 딜, 대기 결제, 완료 딜 카운트',
        schema: {
            example: { totalPartners: 120, activeDeals: 8, pendingPayments: 3, completedDeals: 45 },
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('industries/top'),
    (0, swagger_1.ApiOperation)({ summary: '상위 5개 산업 통계' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '파트너 수 기준 상위 5개 산업',
        schema: {
            example: [{ name: '자동차', partners: 30, revenue: 5000000 }],
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "getTopIndustries", null);
__decorate([
    (0, common_1.Get)('transactions/recent'),
    (0, swagger_1.ApiOperation)({ summary: '최근 10건 거래 내역' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '최신순 결제 내역 10건',
        schema: {
            example: [
                {
                    id: '6632a1f0e4b0a1c2d3e4f5a6',
                    company: 'ABC Corp',
                    amount: 1000,
                    currency: 'XRP',
                    status: 'PAID',
                    memo: '계약금',
                    createdAt: '2024-01-15T10:00:00.000Z',
                },
            ],
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InsightsController.prototype, "getRecentTransactions", null);
exports.InsightsController = InsightsController = __decorate([
    (0, swagger_1.ApiTags)('Insights'),
    (0, common_1.Controller)('analytics'),
    __metadata("design:paramtypes", [insights_service_1.InsightsService])
], InsightsController);
//# sourceMappingURL=insights.controller.js.map