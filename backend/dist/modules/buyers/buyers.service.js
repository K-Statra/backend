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
exports.BuyersService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const buyer_schema_1 = require("./schemas/buyer.schema");
let BuyersService = class BuyersService {
    buyerModel;
    constructor(buyerModel) {
        this.buyerModel = buyerModel;
    }
    async findAll(query) {
        const { q, country, industry, tag, page = 1, limit = 10, sortBy = 'updatedAt', order = 'desc' } = query;
        const filter = {};
        if (q)
            filter.$or = [{ name: { $regex: q, $options: 'i' } }, { profileText: { $regex: q, $options: 'i' } }];
        if (country)
            filter.country = country;
        if (industry)
            filter.industries = industry;
        if (tag)
            filter.tags = tag;
        const sort = { [sortBy]: order === 'asc' ? 1 : -1 };
        const [items, total] = await Promise.all([
            this.buyerModel.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).exec(),
            this.buyerModel.countDocuments(filter),
        ]);
        return { page, limit, total, totalPages: Math.ceil(total / limit), data: items };
    }
    async findById(id) {
        const doc = await this.buyerModel.findById(id).exec();
        if (!doc)
            throw new common_1.NotFoundException('Buyer not found');
        return doc;
    }
    async create(dto) {
        return this.buyerModel.create(dto);
    }
    async update(id, dto) {
        const fields = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
        if (Object.keys(fields).length === 0) {
            throw new common_1.BadRequestException('수정할 필드를 하나 이상 제공해야 합니다');
        }
        const doc = await this.buyerModel
            .findByIdAndUpdate(id, { ...fields, updatedAt: new Date() }, { new: true, runValidators: true })
            .exec();
        if (!doc)
            throw new common_1.NotFoundException('Buyer not found');
        return doc;
    }
    async remove(id) {
        const doc = await this.buyerModel.findByIdAndDelete(id).exec();
        if (!doc)
            throw new common_1.NotFoundException('Buyer not found');
    }
};
exports.BuyersService = BuyersService;
exports.BuyersService = BuyersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(buyer_schema_1.Buyer.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], BuyersService);
//# sourceMappingURL=buyers.service.js.map