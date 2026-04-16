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
var CompaniesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompaniesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const company_schema_1 = require("./schemas/company.schema");
const DEFAULT_IMAGE_URL = process.env.DEFAULT_COMPANY_IMAGE_URL || 'https://placehold.co/320x160?text=K-Statra';
let CompaniesService = class CompaniesService {
    static { CompaniesService_1 = this; }
    companyModel;
    constructor(companyModel) {
        this.companyModel = companyModel;
    }
    static LIST_PROJECTION = {
        name: 1,
        industry: 1,
        tags: 1,
        location: 1,
        sizeBucket: 1,
        profileText: 1,
        dataSource: 1,
        matchRecommendation: 1,
        updatedAt: 1,
        'dart.corpCode': 1,
        'primaryContact.name': 1,
        'primaryContact.email': 1,
        'images.url': 1,
        'images.caption': 1,
        'images.alt': 1,
    };
    async findAll(query) {
        const { q, industry, tag, country, size, partnership, page = 1, limit = 10, sortBy = 'updatedAt', order = 'desc' } = query;
        const filter = {};
        if (q)
            filter.$text = { $search: q };
        if (industry)
            filter.industry = industry;
        if (tag)
            filter.tags = tag;
        if (country)
            filter['location.country'] = country;
        if (size)
            filter.sizeBucket = size;
        if (partnership)
            filter.tags = partnership;
        const hasFilter = Object.keys(filter).length > 0;
        const sortField = sortBy === 'nameNumeric' ? 'name' : sortBy;
        const sort = { [sortField]: order === 'asc' ? 1 : -1 };
        const skip = (page - 1) * limit;
        let findQuery = this.companyModel
            .find(filter, CompaniesService_1.LIST_PROJECTION)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();
        if (sortBy === 'nameNumeric') {
            findQuery = findQuery.collation({ locale: 'en', numericOrdering: true });
        }
        const countQuery = hasFilter
            ? this.companyModel.countDocuments(filter)
            : this.companyModel.estimatedDocumentCount();
        const [raw, total] = await Promise.all([findQuery.exec(), countQuery]);
        const items = raw.map(({ dart, ...rest }) => ({
            ...rest,
            dartVerified: !!dart?.corpCode,
        }));
        return { page, limit, total, totalPages: Math.ceil(total / limit), data: items };
    }
    async findById(id) {
        const doc = await this.companyModel.findById(id).exec();
        if (!doc)
            throw new common_1.NotFoundException('Company not found');
        return doc;
    }
    async create(dto) {
        const doc = await this.companyModel.create(dto);
        if (!doc.images || doc.images.length === 0) {
            doc.images = [{ url: DEFAULT_IMAGE_URL, caption: 'Default image', alt: doc.name, tags: [], clipEmbedding: [] }];
            await doc.save();
        }
        return doc;
    }
    async update(id, dto) {
        const fields = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
        if (Object.keys(fields).length === 0) {
            throw new common_1.BadRequestException('수정할 필드를 하나 이상 제공해야 합니다');
        }
        const doc = await this.companyModel
            .findByIdAndUpdate(id, { ...fields, updatedAt: new Date() }, { new: true, runValidators: true })
            .exec();
        if (!doc)
            throw new common_1.NotFoundException('Company not found');
        return doc;
    }
    async remove(id) {
        const doc = await this.companyModel.findByIdAndDelete(id).exec();
        if (!doc)
            throw new common_1.NotFoundException('Company not found');
    }
};
exports.CompaniesService = CompaniesService;
exports.CompaniesService = CompaniesService = CompaniesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(company_schema_1.Company.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], CompaniesService);
//# sourceMappingURL=companies.service.js.map