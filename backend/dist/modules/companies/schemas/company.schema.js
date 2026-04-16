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
exports.CompanySchema = exports.Company = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let MatchAnalysisItem = class MatchAnalysisItem {
    label;
    score;
    description;
};
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], MatchAnalysisItem.prototype, "label", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], MatchAnalysisItem.prototype, "score", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], MatchAnalysisItem.prototype, "description", void 0);
MatchAnalysisItem = __decorate([
    (0, mongoose_1.Schema)({ _id: true, id: false })
], MatchAnalysisItem);
let CompanyImage = class CompanyImage {
    url;
    caption;
    alt;
    tags;
    clipEmbedding;
};
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CompanyImage.prototype, "url", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], CompanyImage.prototype, "caption", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], CompanyImage.prototype, "alt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], CompanyImage.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Number], default: [] }),
    __metadata("design:type", Array)
], CompanyImage.prototype, "clipEmbedding", void 0);
CompanyImage = __decorate([
    (0, mongoose_1.Schema)({ _id: true, id: false })
], CompanyImage);
let Product = class Product {
    name;
    description;
    imageUrl;
    catalogUrl;
};
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Product.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Product.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Product.prototype, "imageUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Product.prototype, "catalogUrl", void 0);
Product = __decorate([
    (0, mongoose_1.Schema)({ _id: true, id: false })
], Product);
let Activity = class Activity {
    type;
    description;
    date;
    url;
};
__decorate([
    (0, mongoose_1.Prop)({ enum: ['export', 'award', 'exhibition', 'article', 'other'], required: true }),
    __metadata("design:type", String)
], Activity.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Activity.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Activity.prototype, "date", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Activity.prototype, "url", void 0);
Activity = __decorate([
    (0, mongoose_1.Schema)({ _id: true, id: false })
], Activity);
let DartInfo = class DartInfo {
    corpCode;
    bizRegistrationNum;
    fiscalYear;
    reportDate;
    reportType;
    isIFRS;
    revenueConsolidated;
    operatingProfitConsolidated;
    netIncomeConsolidated;
    revenueSeparate;
    operatingProfitSeparate;
    netIncomeSeparate;
    source;
    lastUpdated;
};
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DartInfo.prototype, "corpCode", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DartInfo.prototype, "bizRegistrationNum", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DartInfo.prototype, "fiscalYear", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], DartInfo.prototype, "reportDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DartInfo.prototype, "reportType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], DartInfo.prototype, "isIFRS", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], DartInfo.prototype, "revenueConsolidated", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], DartInfo.prototype, "operatingProfitConsolidated", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], DartInfo.prototype, "netIncomeConsolidated", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], DartInfo.prototype, "revenueSeparate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], DartInfo.prototype, "operatingProfitSeparate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], DartInfo.prototype, "netIncomeSeparate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'Financial Supervisory Service Open DART System' }),
    __metadata("design:type", String)
], DartInfo.prototype, "source", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], DartInfo.prototype, "lastUpdated", void 0);
DartInfo = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], DartInfo);
let Company = class Company {
    name;
    industry;
    offerings;
    needs;
    tags;
    profileText;
    videoUrl;
    location;
    address;
    sizeBucket;
    projectsCount;
    revenue;
    primaryContact;
    accuracyScore;
    matchAnalysis;
    matchRecommendation;
    dataSource;
    extractedAt;
    images;
    products;
    activities;
    dart;
    embedding;
    updatedAt;
};
exports.Company = Company;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Company.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Company.prototype, "industry", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Company.prototype, "offerings", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Company.prototype, "needs", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Company.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Company.prototype, "profileText", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Company.prototype, "videoUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: { city: String, state: String, country: String }, default: {} }),
    __metadata("design:type", Object)
], Company.prototype, "location", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Company.prototype, "address", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
        default: '1-10',
    }),
    __metadata("design:type", String)
], Company.prototype, "sizeBucket", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Company.prototype, "projectsCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Company.prototype, "revenue", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: { name: String, email: String }, default: {} }),
    __metadata("design:type", Object)
], Company.prototype, "primaryContact", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: null }),
    __metadata("design:type", Number)
], Company.prototype, "accuracyScore", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [MatchAnalysisItem], default: [] }),
    __metadata("design:type", Array)
], Company.prototype, "matchAnalysis", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Company.prototype, "matchRecommendation", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Company.prototype, "dataSource", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Company.prototype, "extractedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [CompanyImage], default: [] }),
    __metadata("design:type", Array)
], Company.prototype, "images", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Product], default: [] }),
    __metadata("design:type", Array)
], Company.prototype, "products", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Activity], default: [] }),
    __metadata("design:type", Array)
], Company.prototype, "activities", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: DartInfo }),
    __metadata("design:type", DartInfo)
], Company.prototype, "dart", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Number], default: [] }),
    __metadata("design:type", Array)
], Company.prototype, "embedding", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Company.prototype, "updatedAt", void 0);
exports.Company = Company = __decorate([
    (0, mongoose_1.Schema)()
], Company);
exports.CompanySchema = mongoose_1.SchemaFactory.createForClass(Company);
exports.CompanySchema.index({ updatedAt: -1 });
exports.CompanySchema.index({ name: 1 });
exports.CompanySchema.index({ tags: 1 });
exports.CompanySchema.index({ industry: 1 });
exports.CompanySchema.index({ 'location.country': 1 });
exports.CompanySchema.index({ name: 'text', profileText: 'text' }, { weights: { name: 10, profileText: 1 } });
//# sourceMappingURL=company.schema.js.map