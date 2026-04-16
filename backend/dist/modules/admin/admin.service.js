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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const payment_schema_1 = require("../payments/schemas/payment.schema");
const company_schema_1 = require("../companies/schemas/company.schema");
const buyer_schema_1 = require("../buyers/schemas/buyer.schema");
const match_log_schema_1 = require("../matches/schemas/match-log.schema");
const audit_log_schema_1 = require("./schemas/audit-log.schema");
let AdminService = class AdminService {
    paymentModel;
    companyModel;
    buyerModel;
    matchLogModel;
    auditLogModel;
    constructor(paymentModel, companyModel, buyerModel, matchLogModel, auditLogModel) {
        this.paymentModel = paymentModel;
        this.companyModel = companyModel;
        this.buyerModel = buyerModel;
        this.matchLogModel = matchLogModel;
        this.auditLogModel = auditLogModel;
    }
    async getStats() {
        const [companies, buyers, payments, matches] = await Promise.all([
            this.companyModel.countDocuments(),
            this.buyerModel.countDocuments(),
            this.paymentModel.countDocuments(),
            this.matchLogModel.countDocuments(),
        ]);
        return { companies, buyers, payments, matches };
    }
    async getPayments(query) {
        const { status, buyerId, companyId, from, to, page = 1, limit = 20 } = query;
        const filter = {};
        if (status)
            filter.status = status;
        if (buyerId)
            filter.buyerId = buyerId;
        if (companyId)
            filter.companyId = companyId;
        if (from || to) {
            filter.createdAt = {};
            if (from)
                filter.createdAt.$gte = new Date(from);
            if (to)
                filter.createdAt.$lte = new Date(to);
        }
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.paymentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
            this.paymentModel.countDocuments(filter),
        ]);
        return { page, limit, total, totalPages: Math.ceil(total / limit), data: items };
    }
    async getPaymentStats(query) {
        const { buyerId, companyId } = query;
        const from = query.from ? new Date(query.from) : new Date(Date.now() - 7 * 86400000);
        const to = query.to ? new Date(query.to) : new Date();
        const match = { createdAt: { $gte: from, $lte: to } };
        if (buyerId)
            match.buyerId = new mongoose_2.Types.ObjectId(buyerId);
        if (companyId)
            match.companyId = new mongoose_2.Types.ObjectId(companyId);
        const [byStatusAgg, byCurrencyAgg, byCurrencyStatusAgg] = await Promise.all([
            this.paymentModel.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
            this.paymentModel.aggregate([{ $match: match }, { $group: { _id: '$currency', count: { $sum: 1 } } }]),
            this.paymentModel.aggregate([{ $match: match }, { $group: { _id: { currency: '$currency', status: '$status' }, count: { $sum: 1 } } }]),
        ]);
        const byStatus = byStatusAgg.reduce((a, x) => ({ ...a, [String(x._id || 'UNKNOWN').toUpperCase()]: x.count }), {});
        const byCurrency = byCurrencyAgg.reduce((a, x) => ({ ...a, [String(x._id || 'UNKNOWN').toUpperCase()]: x.count }), {});
        const byCurrencyStatus = {};
        for (const row of byCurrencyStatusAgg) {
            const cur = String(row._id?.currency || 'UNKNOWN').toUpperCase();
            const st = String(row._id?.status || 'UNKNOWN').toUpperCase();
            byCurrencyStatus[cur] = byCurrencyStatus[cur] ?? {};
            byCurrencyStatus[cur][st] = (byCurrencyStatus[cur][st] ?? 0) + row.count;
        }
        return { since: from.toISOString(), until: to.toISOString(), byStatus, byCurrency, byCurrencyStatus };
    }
    async exportPaymentsCsv(query) {
        const filter = {};
        if (query.status)
            filter.status = query.status;
        if (query.buyerId)
            filter.buyerId = query.buyerId;
        if (query.companyId)
            filter.companyId = query.companyId;
        if (query.from || query.to) {
            filter.createdAt = {};
            if (query.from)
                filter.createdAt.$gte = new Date(query.from);
            if (query.to)
                filter.createdAt.$lte = new Date(query.to);
        }
        const items = await this.paymentModel.find(filter).sort({ createdAt: -1 }).limit(5000).exec();
        const header = ['_id', 'buyerId', 'companyId', 'amount', 'currency', 'status', 'provider', 'providerRef', 'createdAt'];
        const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
        const lines = [
            header.join(','),
            ...items.map((p) => [p._id, p.buyerId, p.companyId, p.amount, p.currency, p.status, p.provider, p.providerRef,
                p['createdAt'] ? new Date(p['createdAt']).toISOString() : '',
            ].map((v) => esc(String(v ?? ''))).join(',')),
        ];
        return lines.join('\n') + '\n';
    }
    async getMatchLogs(query) {
        const { buyerId, page = 1, limit = 20 } = query;
        const filter = {};
        if (buyerId)
            filter.buyerId = buyerId;
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.matchLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('buyerId', 'name').exec(),
            this.matchLogModel.countDocuments(filter),
        ]);
        return { page, limit, total, totalPages: Math.ceil(total / limit), data: items };
    }
    async getAuditLogs(query) {
        const { entityType = 'Payment', entityId, page = 1, limit = 50 } = query;
        const skip = (page - 1) * limit;
        const filter = { entityType, entityId };
        const [items, total] = await Promise.all([
            this.auditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
            this.auditLogModel.countDocuments(filter),
        ]);
        return { page, limit, total, totalPages: Math.ceil(total / limit), data: items };
    }
    getEmbeddingStatus() {
        const provider = (process.env.EMBEDDINGS_PROVIDER || 'mock').toLowerCase();
        const matchUseEmbedding = (process.env.MATCH_USE_EMBEDDING || 'false').toLowerCase().trim() === 'true';
        const configured = provider === 'openai' ? Boolean(process.env.OPENAI_API_KEY) :
            provider === 'huggingface' ? Boolean(process.env.HF_API_TOKEN) :
                true;
        return { provider, matchUseEmbedding, configured };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(payment_schema_1.Payment.name)),
    __param(1, (0, mongoose_1.InjectModel)(company_schema_1.Company.name)),
    __param(2, (0, mongoose_1.InjectModel)(buyer_schema_1.Buyer.name)),
    __param(3, (0, mongoose_1.InjectModel)(match_log_schema_1.MatchLog.name)),
    __param(4, (0, mongoose_1.InjectModel)(audit_log_schema_1.AuditLog.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], AdminService);
//# sourceMappingURL=admin.service.js.map