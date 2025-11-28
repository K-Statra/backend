const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['XRP', 'USD', 'KRW'], default: 'XRP' },

    // Idempotency
    idempotencyKey: { type: String, required: true, index: true, unique: true },
    requestHash: { type: String, required: true },

    // Provider-side info (XRPL testnet or others)
    provider: { type: String, default: 'xrpl-testnet', index: true },
    providerRef: { type: String, default: '' },
    invoice: {
      qr: { type: String, default: '' },
      deeplink: { type: String, default: '' },
      expiresAt: { type: Date },
    },

    status: {
      type: String,
      enum: ['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED'],
      default: 'CREATED',
      index: true,
    },
    memo: { type: String, default: '' },
    quote: {
      baseCurrency: { type: String, default: '' },
      quoteCurrency: { type: String, default: '' },
      rate: { type: Number },
      amountQuote: { type: Number },
      expiresAt: { type: Date },
    },

    // audit
    events: [
      {
        type: { type: String },
        at: { type: Date, default: Date.now },
        meta: { type: Object, default: {} },
      },
    ],
  },
  { timestamps: true }
);

PaymentSchema.index({ createdAt: -1 });

const Payment = mongoose.model('Payment', PaymentSchema);
module.exports = { Payment };
