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
exports.PaymentSchema = exports.Payment = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let PaymentEvent = class PaymentEvent {
    type;
    at;
    meta;
};
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], PaymentEvent.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: () => new Date() }),
    __metadata("design:type", Date)
], PaymentEvent.prototype, "at", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], PaymentEvent.prototype, "meta", void 0);
PaymentEvent = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], PaymentEvent);
let PaymentInvoice = class PaymentInvoice {
    qr;
    deeplink;
    expiresAt;
    destAddress;
    destTag;
};
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], PaymentInvoice.prototype, "qr", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], PaymentInvoice.prototype, "deeplink", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], PaymentInvoice.prototype, "expiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], PaymentInvoice.prototype, "destAddress", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], PaymentInvoice.prototype, "destTag", void 0);
PaymentInvoice = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], PaymentInvoice);
let PaymentQuote = class PaymentQuote {
    baseCurrency;
    quoteCurrency;
    rate;
    amountQuote;
    expiresAt;
};
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], PaymentQuote.prototype, "baseCurrency", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], PaymentQuote.prototype, "quoteCurrency", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], PaymentQuote.prototype, "rate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], PaymentQuote.prototype, "amountQuote", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], PaymentQuote.prototype, "expiresAt", void 0);
PaymentQuote = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], PaymentQuote);
let Payment = class Payment {
    buyerId;
    companyId;
    amount;
    currency;
    idempotencyKey;
    requestHash;
    provider;
    providerRef;
    invoice;
    quote;
    status;
    memo;
    events;
};
exports.Payment = Payment;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Buyer', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Payment.prototype, "buyerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Company', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Payment.prototype, "companyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], Payment.prototype, "amount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['XRP', 'USD', 'KRW'], default: 'XRP' }),
    __metadata("design:type", String)
], Payment.prototype, "currency", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, index: true }),
    __metadata("design:type", String)
], Payment.prototype, "idempotencyKey", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Payment.prototype, "requestHash", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'xrpl-testnet', index: true }),
    __metadata("design:type", String)
], Payment.prototype, "provider", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Payment.prototype, "providerRef", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: PaymentInvoice }),
    __metadata("design:type", PaymentInvoice)
], Payment.prototype, "invoice", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: PaymentQuote }),
    __metadata("design:type", PaymentQuote)
], Payment.prototype, "quote", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: ['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED'],
        default: 'CREATED',
        index: true,
    }),
    __metadata("design:type", String)
], Payment.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Payment.prototype, "memo", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [PaymentEvent], default: [] }),
    __metadata("design:type", Array)
], Payment.prototype, "events", void 0);
exports.Payment = Payment = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Payment);
exports.PaymentSchema = mongoose_1.SchemaFactory.createForClass(Payment);
exports.PaymentSchema.index({ createdAt: -1 });
//# sourceMappingURL=payment.schema.js.map