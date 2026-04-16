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
exports.AuditLogSchema = exports.AuditLog = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AuditLog = class AuditLog {
    type;
    actor;
    entityType;
    entityId;
    requestId;
    meta;
};
exports.AuditLog = AuditLog;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'system' }),
    __metadata("design:type", String)
], AuditLog.prototype, "actor", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "entityType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "entityId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AuditLog.prototype, "requestId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], AuditLog.prototype, "meta", void 0);
exports.AuditLog = AuditLog = __decorate([
    (0, mongoose_1.Schema)({ timestamps: { createdAt: true, updatedAt: false } })
], AuditLog);
exports.AuditLogSchema = mongoose_1.SchemaFactory.createForClass(AuditLog);
exports.AuditLogSchema.index({ createdAt: -1 });
exports.AuditLogSchema.index({ entityType: 1, entityId: 1 });
//# sourceMappingURL=audit-log.schema.js.map