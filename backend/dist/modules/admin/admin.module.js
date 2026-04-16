"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const admin_controller_1 = require("./admin.controller");
const admin_service_1 = require("./admin.service");
const admin_token_guard_1 = require("./guards/admin-token.guard");
const audit_log_schema_1 = require("./schemas/audit-log.schema");
const companies_module_1 = require("../companies/companies.module");
const buyers_module_1 = require("../buyers/buyers.module");
const payments_module_1 = require("../payments/payments.module");
const match_log_schema_1 = require("../matches/schemas/match-log.schema");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: audit_log_schema_1.AuditLog.name, schema: audit_log_schema_1.AuditLogSchema },
                { name: match_log_schema_1.MatchLog.name, schema: match_log_schema_1.MatchLogSchema },
            ]),
            companies_module_1.CompaniesModule,
            buyers_module_1.BuyersModule,
            payments_module_1.PaymentsModule,
        ],
        controllers: [admin_controller_1.AdminController],
        providers: [admin_service_1.AdminService, admin_token_guard_1.AdminTokenGuard],
        exports: [admin_service_1.AdminService],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map