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
exports.InsightsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const company_schema_1 = require("../companies/schemas/company.schema");
const payment_schema_1 = require("../payments/schemas/payment.schema");
let InsightsService = class InsightsService {
    companyModel;
    paymentModel;
    constructor(companyModel, paymentModel) {
        this.companyModel = companyModel;
        this.paymentModel = paymentModel;
    }
    async getDashboard() {
        const [totalPartners, activeDeals, pendingPayments, completedDeals] = await Promise.all([
            this.companyModel.countDocuments(),
            this.paymentModel.countDocuments({ status: { $in: ['CREATED', 'PENDING'] } }),
            this.paymentModel.countDocuments({ status: 'PENDING' }),
            this.paymentModel.countDocuments({ status: 'PAID' }),
        ]);
        return { totalPartners, activeDeals, pendingPayments, completedDeals };
    }
    async getTopIndustries() {
        const docs = await this.companyModel.aggregate([
            { $match: { industry: { $exists: true, $ne: '' } } },
            { $group: { _id: '$industry', partners: { $sum: 1 }, revenue: { $sum: '$revenue' } } },
            { $sort: { partners: -1 } },
            { $limit: 5 },
        ]);
        return docs.map(d => ({ name: d._id, partners: d.partners, revenue: d.revenue }));
    }
    async getRecentTransactions() {
        const docs = await this.paymentModel
            .find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('amount currency status memo createdAt companyId')
            .populate('companyId', 'name')
            .lean();
        return docs.map((d) => ({
            id: d._id,
            company: d.companyId?.name || 'Unknown',
            amount: d.amount,
            currency: d.currency,
            status: d.status,
            memo: d.memo,
            createdAt: d.createdAt,
        }));
    }
};
exports.InsightsService = InsightsService;
exports.InsightsService = InsightsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(company_schema_1.Company.name)),
    __param(1, (0, mongoose_1.InjectModel)(payment_schema_1.Payment.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], InsightsService);
//# sourceMappingURL=insights.service.js.map