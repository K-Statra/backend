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
exports.ConsultantRequestSchema = exports.ConsultantRequest = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let ConsultantRequest = class ConsultantRequest {
    name;
    email;
    details;
    serviceType;
    locale;
    source;
    status;
    buyerId;
    buyerName;
    searchTerm;
    filters;
};
exports.ConsultantRequest = ConsultantRequest;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true, maxlength: 200 }),
    __metadata("design:type", String)
], ConsultantRequest.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true, lowercase: true, maxlength: 200 }),
    __metadata("design:type", String)
], ConsultantRequest.prototype, "email", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, maxlength: 4000 }),
    __metadata("design:type", String)
], ConsultantRequest.prototype, "details", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, default: 'matching-assistant', maxlength: 120 }),
    __metadata("design:type", String)
], ConsultantRequest.prototype, "serviceType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, maxlength: 12 }),
    __metadata("design:type", String)
], ConsultantRequest.prototype, "locale", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, maxlength: 60, default: 'partner-search' }),
    __metadata("design:type", String)
], ConsultantRequest.prototype, "source", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['NEW', 'IN_PROGRESS', 'CLOSED'], default: 'NEW' }),
    __metadata("design:type", String)
], ConsultantRequest.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Buyer' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ConsultantRequest.prototype, "buyerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, maxlength: 200 }),
    __metadata("design:type", String)
], ConsultantRequest.prototype, "buyerName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, maxlength: 200 }),
    __metadata("design:type", String)
], ConsultantRequest.prototype, "searchTerm", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], ConsultantRequest.prototype, "filters", void 0);
exports.ConsultantRequest = ConsultantRequest = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], ConsultantRequest);
exports.ConsultantRequestSchema = mongoose_1.SchemaFactory.createForClass(ConsultantRequest);
//# sourceMappingURL=consultant-request.schema.js.map