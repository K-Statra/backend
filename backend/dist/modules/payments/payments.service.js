"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto = __importStar(require("crypto"));
const payment_schema_1 = require("./schemas/payment.schema");
const xrpl_service_1 = require("./xrpl.service");
const ALLOWED_TRANSITIONS = {
    CREATED: ['PENDING', 'CANCELLED'],
    PENDING: ['PAID', 'FAILED', 'CANCELLED'],
    PAID: [],
    FAILED: [],
    CANCELLED: [],
};
let PaymentsService = PaymentsService_1 = class PaymentsService {
    paymentModel;
    xrplService;
    logger = new common_1.Logger(PaymentsService_1.name);
    constructor(paymentModel, xrplService) {
        this.paymentModel = paymentModel;
        this.xrplService = xrplService;
    }
    computeRequestHash(body) {
        return crypto
            .createHash('sha256')
            .update(JSON.stringify(body))
            .digest('hex');
    }
    canTransition(from, to) {
        return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
    }
    async create(dto, idempotencyKey) {
        const requestHash = this.computeRequestHash(dto);
        const existing = await this.paymentModel.findOne({ idempotencyKey }).exec();
        if (existing) {
            if (existing.requestHash !== requestHash) {
                throw new common_1.ConflictException('Idempotency key conflict: different payload');
            }
            return existing;
        }
        if (dto.currency !== 'XRP') {
            throw new common_1.BadRequestException('Only XRP is supported at this time');
        }
        const payment = await this.paymentModel.create({
            buyerId: dto.buyerId,
            companyId: dto.companyId,
            amount: dto.amount,
            currency: dto.currency ?? 'XRP',
            memo: dto.memo ?? '',
            idempotencyKey,
            requestHash,
            provider: 'xrpl-testnet',
            status: 'CREATED',
            events: [{ type: 'CREATED', at: new Date(), meta: { source: 'api' } }],
        });
        const invoice = this.xrplService.createInvoice(payment._id.toString(), dto.amount);
        payment.providerRef = invoice.providerRef;
        payment.invoice = {
            qr: invoice.qr,
            deeplink: invoice.deeplink,
            expiresAt: invoice.expiresAt,
            destAddress: invoice.destAddress,
            destTag: invoice.destTag,
        };
        payment.status = 'PENDING';
        payment.events.push({ type: 'PENDING', at: new Date(), meta: { providerRef: invoice.providerRef } });
        await payment.save();
        return payment;
    }
    async findById(id) {
        const doc = await this.paymentModel.findById(id).exec();
        if (!doc)
            throw new common_1.NotFoundException('Payment not found');
        return doc;
    }
    async refreshStatus(id) {
        const payment = await this.findById(id);
        if (payment.status !== 'PENDING')
            return payment;
        if (!payment.invoice?.destTag) {
            throw new common_1.BadRequestException('No destination tag on invoice');
        }
        const result = await this.xrplService.checkPayment(payment.invoice.destTag, payment.amount);
        if (result.paid) {
            if (!this.canTransition(payment.status, 'PAID')) {
                throw new common_1.ConflictException(`Cannot transition from ${payment.status} to PAID`);
            }
            payment.status = 'PAID';
            payment.providerRef = result.txHash ?? payment.providerRef;
            payment.events.push({ type: 'PAID', at: new Date(), meta: { txHash: result.txHash, manual: true } });
            await payment.save();
        }
        return payment;
    }
    async getSummary() {
        const [result] = await this.paymentModel.aggregate([
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
                    paid: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] } },
                },
            },
        ]);
        return result ?? { totalAmount: 0, pending: 0, paid: 0 };
    }
    async getRecent(limit = 10) {
        return this.paymentModel
            .find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('amount currency status memo createdAt companyId')
            .populate('companyId', 'name')
            .lean();
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(payment_schema_1.Payment.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        xrpl_service_1.XrplService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map