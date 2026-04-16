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
exports.ConsultantsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const consultant_request_schema_1 = require("./schemas/consultant-request.schema");
let ConsultantsService = class ConsultantsService {
    consultantRequestModel;
    constructor(consultantRequestModel) {
        this.consultantRequestModel = consultantRequestModel;
    }
    async createRequest(dto) {
        const doc = {
            name: dto.name,
            email: dto.email,
            details: dto.details,
            serviceType: dto.serviceType ?? 'matching-assistant',
            locale: dto.locale,
            source: dto.source ?? 'partner-search',
            buyerName: dto.buyerName,
            searchTerm: dto.searchTerm,
            filters: dto.filters ?? {},
        };
        if (dto.buyerId) {
            if (!mongoose_2.Types.ObjectId.isValid(dto.buyerId)) {
                throw new common_1.BadRequestException('Invalid buyerId');
            }
            doc.buyerId = new mongoose_2.Types.ObjectId(dto.buyerId);
        }
        const created = await this.consultantRequestModel.create(doc);
        return { id: created._id, status: created.status, message: 'Request received' };
    }
};
exports.ConsultantsService = ConsultantsService;
exports.ConsultantsService = ConsultantsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(consultant_request_schema_1.ConsultantRequest.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ConsultantsService);
//# sourceMappingURL=consultants.service.js.map