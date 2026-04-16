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
exports.MatchLogSchema = exports.MatchLog = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let MatchResult = class MatchResult {
    companyId;
    score;
    reasons;
};
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Company', index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], MatchResult.prototype, "companyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], MatchResult.prototype, "score", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], MatchResult.prototype, "reasons", void 0);
MatchResult = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], MatchResult);
let MatchLog = class MatchLog {
    buyerId;
    params;
    results;
};
exports.MatchLog = MatchLog;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Buyer', index: true, required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], MatchLog.prototype, "buyerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: { limit: Number }, default: { limit: 10 } }),
    __metadata("design:type", Object)
], MatchLog.prototype, "params", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [MatchResult], default: [] }),
    __metadata("design:type", Array)
], MatchLog.prototype, "results", void 0);
exports.MatchLog = MatchLog = __decorate([
    (0, mongoose_1.Schema)({ timestamps: { createdAt: true, updatedAt: false } })
], MatchLog);
exports.MatchLogSchema = mongoose_1.SchemaFactory.createForClass(MatchLog);
exports.MatchLogSchema.index({ createdAt: -1 });
//# sourceMappingURL=match-log.schema.js.map