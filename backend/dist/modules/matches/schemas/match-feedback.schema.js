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
exports.MatchFeedbackSchema = exports.MatchFeedback = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let MatchFeedback = class MatchFeedback {
    companyId;
    rating;
    comments;
    locale;
    source;
};
exports.MatchFeedback = MatchFeedback;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Company', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], MatchFeedback.prototype, "companyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1, max: 5 }),
    __metadata("design:type", Number)
], MatchFeedback.prototype, "rating", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], MatchFeedback.prototype, "comments", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], MatchFeedback.prototype, "locale", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], MatchFeedback.prototype, "source", void 0);
exports.MatchFeedback = MatchFeedback = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], MatchFeedback);
exports.MatchFeedbackSchema = mongoose_1.SchemaFactory.createForClass(MatchFeedback);
exports.MatchFeedbackSchema.index({ companyId: 1, createdAt: -1 });
//# sourceMappingURL=match-feedback.schema.js.map