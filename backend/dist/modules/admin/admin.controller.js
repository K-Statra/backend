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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const admin_service_1 = require("./admin.service");
const admin_token_guard_1 = require("./guards/admin-token.guard");
const list_payments_query_dto_1 = require("./dto/list-payments-query.dto");
const payment_stats_query_dto_1 = require("./dto/payment-stats-query.dto");
const match_logs_query_dto_1 = require("./dto/match-logs-query.dto");
const audit_logs_query_dto_1 = require("./dto/audit-logs-query.dto");
let AdminController = class AdminController {
    adminService;
    constructor(adminService) {
        this.adminService = adminService;
    }
    getStats() {
        return this.adminService.getStats();
    }
    getPayments(query) {
        return this.adminService.getPayments(query);
    }
    getPaymentStats(query) {
        return this.adminService.getPaymentStats(query);
    }
    async exportPayments(query, res) {
        const csv = await this.adminService.exportPaymentsCsv(query);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
        res.send(csv);
    }
    getMatchLogs(query) {
        return this.adminService.getMatchLogs(query);
    }
    getAuditLogs(query) {
        return this.adminService.getAuditLogs(query);
    }
    getEmbeddingStatus() {
        return this.adminService.getEmbeddingStatus();
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: '전체 통계 (회사/바이어/결제/매칭 카운트)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '통계 반환', schema: { example: { companies: 10, buyers: 5, payments: 3, matches: 2 } } }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('payments'),
    (0, swagger_1.ApiOperation)({ summary: '결제 목록 (페이징 + 필터)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '결제 목록', schema: { example: { page: 1, limit: 20, total: 100, totalPages: 5, data: [] } } }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_payments_query_dto_1.ListPaymentsQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getPayments", null);
__decorate([
    (0, common_1.Get)('payments/stats'),
    (0, swagger_1.ApiOperation)({ summary: '결제 통계 (상태별/통화별/통화+상태별)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '결제 통계', schema: { example: { since: '2024-01-01T00:00:00.000Z', until: '2024-01-07T00:00:00.000Z', byStatus: { PAID: 5 }, byCurrency: { XRP: 5 }, byCurrencyStatus: { XRP: { PAID: 5 } } } } }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_stats_query_dto_1.PaymentStatsQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getPaymentStats", null);
__decorate([
    (0, common_1.Get)('payments/export'),
    (0, swagger_1.ApiOperation)({ summary: '결제 CSV 내보내기 (최대 5000건)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'CSV 파일', content: { 'text/csv': {} } }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_payments_query_dto_1.ListPaymentsQueryDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "exportPayments", null);
__decorate([
    (0, common_1.Get)('matches'),
    (0, swagger_1.ApiOperation)({ summary: '매칭 로그 목록 (페이징)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '매칭 로그 목록', schema: { example: { page: 1, limit: 20, total: 50, totalPages: 3, data: [] } } }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [match_logs_query_dto_1.MatchLogsQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getMatchLogs", null);
__decorate([
    (0, common_1.Get)('audit'),
    (0, swagger_1.ApiOperation)({ summary: '감사 로그 조회 (entityId 필수)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '감사 로그', schema: { example: { page: 1, limit: 50, total: 3, totalPages: 1, data: [] } } }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [audit_logs_query_dto_1.AuditLogsQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getAuditLogs", null);
__decorate([
    (0, common_1.Get)('embedding'),
    (0, swagger_1.ApiOperation)({ summary: '임베딩 프로바이더 설정 상태 조회' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '임베딩 상태', schema: { example: { provider: 'openai', matchUseEmbedding: true, configured: true } } }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getEmbeddingStatus", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)('Admin'),
    (0, swagger_1.ApiHeader)({ name: 'x-admin-token', required: true, description: '관리자 인증 토큰' }),
    (0, common_1.UseGuards)(admin_token_guard_1.AdminTokenGuard),
    (0, common_1.Controller)('admin'),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map