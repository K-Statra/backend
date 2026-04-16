"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchesModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const matches_controller_1 = require("./matches.controller");
const matches_service_1 = require("./matches.service");
const match_log_schema_1 = require("./schemas/match-log.schema");
const match_feedback_schema_1 = require("./schemas/match-feedback.schema");
const companies_module_1 = require("../companies/companies.module");
const buyers_module_1 = require("../buyers/buyers.module");
let MatchesModule = class MatchesModule {
};
exports.MatchesModule = MatchesModule;
exports.MatchesModule = MatchesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: match_log_schema_1.MatchLog.name, schema: match_log_schema_1.MatchLogSchema },
                { name: match_feedback_schema_1.MatchFeedback.name, schema: match_feedback_schema_1.MatchFeedbackSchema },
            ]),
            companies_module_1.CompaniesModule,
            buyers_module_1.BuyersModule,
        ],
        controllers: [matches_controller_1.MatchesController],
        providers: [matches_service_1.MatchesService],
    })
], MatchesModule);
//# sourceMappingURL=matches.module.js.map