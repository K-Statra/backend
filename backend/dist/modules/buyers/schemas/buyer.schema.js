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
exports.BuyerSchema = exports.Buyer = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let Buyer = class Buyer {
    name;
    country;
    industries;
    needs;
    tags;
    profileText;
    embedding;
    updatedAt;
};
exports.Buyer = Buyer;
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], Buyer.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Buyer.prototype, "country", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Buyer.prototype, "industries", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Buyer.prototype, "needs", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Buyer.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Buyer.prototype, "profileText", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Number], default: [] }),
    __metadata("design:type", Array)
], Buyer.prototype, "embedding", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Buyer.prototype, "updatedAt", void 0);
exports.Buyer = Buyer = __decorate([
    (0, mongoose_1.Schema)()
], Buyer);
exports.BuyerSchema = mongoose_1.SchemaFactory.createForClass(Buyer);
exports.BuyerSchema.index({ updatedAt: -1 });
exports.BuyerSchema.index({ tags: 1 });
exports.BuyerSchema.index({ industries: 1 });
//# sourceMappingURL=buyer.schema.js.map