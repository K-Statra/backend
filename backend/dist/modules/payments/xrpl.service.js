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
var XrplService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.XrplService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const xrpl_1 = require("xrpl");
const crypto = __importStar(require("crypto"));
let XrplService = XrplService_1 = class XrplService {
    config;
    logger = new common_1.Logger(XrplService_1.name);
    client;
    wsUrl;
    destAddress;
    constructor(config) {
        this.config = config;
        this.wsUrl = this.config.get('xrpl.wsUrl');
        this.destAddress = this.config.get('xrpl.destAddress');
    }
    async onModuleInit() {
        await this.connect();
    }
    async onModuleDestroy() {
        await this.disconnect();
    }
    async connect() {
        try {
            this.client = new xrpl_1.Client(this.wsUrl);
            await this.client.connect();
            this.logger.log(`XRPL connected: ${this.wsUrl}`);
            this.client.on('disconnected', async (code) => {
                this.logger.warn(`XRPL disconnected (code: ${code}), reconnecting...`);
                await this.reconnect();
            });
        }
        catch (err) {
            this.logger.error('XRPL connection failed', err);
        }
    }
    async reconnect(retries = 5, delayMs = 3000) {
        for (let i = 0; i < retries; i++) {
            try {
                await new Promise((r) => setTimeout(r, delayMs));
                await this.client.connect();
                this.logger.log('XRPL reconnected');
                return;
            }
            catch {
                this.logger.warn(`Reconnect attempt ${i + 1}/${retries} failed`);
            }
        }
        this.logger.error('XRPL reconnection exhausted');
    }
    async disconnect() {
        try {
            if (this.client?.isConnected()) {
                await this.client.disconnect();
                this.logger.log('XRPL disconnected');
            }
        }
        catch (err) {
            this.logger.error('XRPL disconnect error', err);
        }
    }
    isConnected() {
        return this.client?.isConnected() ?? false;
    }
    deriveDestinationTag(paymentId) {
        const hex = crypto.createHash('sha256').update(paymentId).digest('hex');
        const val = parseInt(hex.slice(0, 8), 16) >>> 0;
        return val === 0 ? 1 : val;
    }
    createInvoice(paymentId, amount) {
        if (!this.destAddress) {
            throw new Error('XRPL_DEST_ADDRESS is not configured');
        }
        const destTag = this.deriveDestinationTag(paymentId);
        const deeplink = `ripple:${this.destAddress}?amount=${amount}&dt=${destTag}`;
        return {
            providerRef: `xrpl_${paymentId}`,
            deeplink,
            qr: deeplink,
            destAddress: this.destAddress,
            destTag,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        };
    }
    async checkPayment(destTag, expectedAmountXrp) {
        if (!this.client?.isConnected()) {
            throw new Error('XRPL client is not connected');
        }
        const expectedDrops = BigInt((0, xrpl_1.xrpToDrops)(expectedAmountXrp));
        const resp = await this.client.request({
            command: 'account_tx',
            account: this.destAddress,
            ledger_index_min: -1,
            ledger_index_max: -1,
            forward: false,
            limit: 200,
        });
        const matchedTx = (resp.result.transactions ?? []).find((t) => {
            const tx = t.tx ?? t.tx_json;
            const meta = t.meta;
            if (!tx || tx.TransactionType !== 'Payment')
                return false;
            if (tx.Destination !== this.destAddress)
                return false;
            if (tx.DestinationTag !== destTag)
                return false;
            if (!t.validated)
                return false;
            const delivered = meta?.delivered_amount;
            if (typeof delivered !== 'string')
                return false;
            return BigInt(delivered) >= expectedDrops;
        });
        if (matchedTx) {
            const tx = matchedTx.tx ?? matchedTx.tx_json;
            return { paid: true, txHash: tx?.hash };
        }
        return { paid: false };
    }
};
exports.XrplService = XrplService;
exports.XrplService = XrplService = XrplService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], XrplService);
//# sourceMappingURL=xrpl.service.js.map