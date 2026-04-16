"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnersModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const partners_controller_1 = require("./partners.controller");
const partners_service_1 = require("./partners.service");
const company_schema_1 = require("../companies/schemas/company.schema");
const embeddings_module_1 = require("../embeddings/embeddings.module");
let PartnersModule = class PartnersModule {
};
exports.PartnersModule = PartnersModule;
exports.PartnersModule = PartnersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: company_schema_1.Company.name, schema: company_schema_1.CompanySchema }]),
            embeddings_module_1.EmbeddingsModule,
        ],
        controllers: [partners_controller_1.PartnersController],
        providers: [partners_service_1.PartnersService],
        exports: [partners_service_1.PartnersService],
    })
], PartnersModule);
//# sourceMappingURL=partners.module.js.map