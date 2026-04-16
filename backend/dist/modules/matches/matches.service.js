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
var MatchesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const company_schema_1 = require("../companies/schemas/company.schema");
const buyer_schema_1 = require("../buyers/schemas/buyer.schema");
const match_log_schema_1 = require("./schemas/match-log.schema");
const match_feedback_schema_1 = require("./schemas/match-feedback.schema");
function toSet(arr) {
    return new Set((arr || []).map(s => s.toLowerCase().trim()).filter(Boolean));
}
function intersectCount(a, b) {
    let count = 0;
    for (const x of a)
        if (b.has(x))
            count++;
    return count;
}
function cosineSimilarity(a, b) {
    if (!a?.length || !b?.length)
        return 0;
    const n = Math.min(a.length, b.length);
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < n; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0)
        return 0;
    return Math.max(0, Math.min(1, dot / (Math.sqrt(na) * Math.sqrt(nb))));
}
function scoreCompany(buyer, company) {
    const buyerTags = toSet(buyer.tags);
    const buyerIndustries = toSet(buyer.industries);
    const buyerNeeds = toSet(buyer.needs);
    const companyTags = toSet(company.tags);
    const companyIndustry = String(company.industry || '').toLowerCase().trim();
    const companyOfferings = toSet(company.offerings);
    let score = 0;
    const reasons = [];
    const tagMatches = intersectCount(buyerTags, companyTags);
    if (tagMatches > 0) {
        score += tagMatches * 2;
        reasons.push(`tags overlap x${tagMatches}`);
    }
    if (companyIndustry && buyerIndustries.has(companyIndustry)) {
        score += 3;
        reasons.push('industry match');
    }
    const needMatches = intersectCount(buyerNeeds, companyOfferings);
    if (needMatches > 0) {
        score += needMatches * 2;
        reasons.push(`needs-offerings overlap x${needMatches}`);
    }
    const days = Math.max(0, (Date.now() - new Date(company.updatedAt || Date.now()).getTime()) / 86400000);
    const recency = Math.max(0, 30 - days) / 30;
    if (recency > 0) {
        score += recency;
        reasons.push('recently updated');
    }
    const autoRegex = /자동차|부품|Automotive|Car parts|EV|Machinery|parts/i;
    if (autoRegex.test(companyIndustry) || Array.from(companyTags).some(t => autoRegex.test(t))) {
        score += 2.0;
        reasons.push('Automotive sector priority');
    }
    if (company.dart?.corpCode) {
        score += 1.5;
        reasons.push('DART verified');
    }
    const useEmbedding = process.env.MATCH_USE_EMBEDDING === 'true';
    if (useEmbedding) {
        const weight = Number(process.env.MATCH_EMBEDDING_WEIGHT || 0.3);
        const sim = typeof company.vectorScore === 'number'
            ? company.vectorScore
            : cosineSimilarity(buyer.embedding, company.embedding);
        if (sim > 0 && weight > 0) {
            score += sim * 10 * Math.min(1, weight);
            reasons.push(`embedding sim ${sim.toFixed(2)}`);
        }
    }
    return { score, reasons };
}
let MatchesService = MatchesService_1 = class MatchesService {
    companyModel;
    buyerModel;
    matchLogModel;
    feedbackModel;
    logger = new common_1.Logger(MatchesService_1.name);
    constructor(companyModel, buyerModel, matchLogModel, feedbackModel) {
        this.companyModel = companyModel;
        this.buyerModel = buyerModel;
        this.matchLogModel = matchLogModel;
        this.feedbackModel = feedbackModel;
    }
    async findMatches(buyerId, limit = 10) {
        const buyer = await this.buyerModel.findById(buyerId).exec();
        if (!buyer)
            throw new common_1.NotFoundException('Buyer not found');
        let candidates;
        const useAtlasVector = process.env.MATCH_USE_ATLAS_VECTOR === 'true';
        if (useAtlasVector && buyer.embedding?.length) {
            try {
                candidates = await this.companyModel.aggregate([
                    { $vectorSearch: { index: process.env.ATLAS_VECTOR_INDEX || 'vector_index', path: 'embedding', queryVector: buyer.embedding, numCandidates: 100, limit: 50 } },
                    { $addFields: { vectorScore: { $meta: 'vectorSearchScore' } } },
                ]);
            }
            catch (err) {
                this.logger.warn('Vector search failed, falling back', err);
                candidates = await this.companyModel.find({}).sort({ updatedAt: -1 }).limit(200).lean();
            }
        }
        else {
            candidates = await this.companyModel.find({}).sort({ updatedAt: -1 }).limit(200).lean();
        }
        const scored = candidates
            .map(c => ({ company: c, ...scoreCompany(buyer, c) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        try {
            await this.matchLogModel.create({
                buyerId: buyer._id,
                params: { limit },
                results: scored.map(r => ({ companyId: r.company._id, score: r.score, reasons: r.reasons.slice(0, 5) })),
            });
        }
        catch (err) {
            this.logger.warn('Failed to save match log', err);
        }
        return { query: { buyerId, limit }, count: scored.length, data: scored };
    }
    async submitFeedback(companyId, dto) {
        const company = await this.companyModel.findById(companyId).exec();
        if (!company)
            throw new common_1.NotFoundException('Company not found');
        const doc = await this.feedbackModel.create({
            companyId: company._id,
            rating: dto.rating,
            comments: dto.comments || '',
            locale: dto.locale || '',
            source: dto.source || 'partner-search',
        });
        return { message: 'Feedback saved', id: doc._id };
    }
};
exports.MatchesService = MatchesService;
exports.MatchesService = MatchesService = MatchesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(company_schema_1.Company.name)),
    __param(1, (0, mongoose_1.InjectModel)(buyer_schema_1.Buyer.name)),
    __param(2, (0, mongoose_1.InjectModel)(match_log_schema_1.MatchLog.name)),
    __param(3, (0, mongoose_1.InjectModel)(match_feedback_schema_1.MatchFeedback.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], MatchesService);
//# sourceMappingURL=matches.service.js.map