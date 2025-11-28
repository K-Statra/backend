const mongoose = require('mongoose');

const WebhookNonceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL: expire after 10 minutes
WebhookNonceSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

const WebhookNonce = mongoose.model('WebhookNonce', WebhookNonceSchema);
module.exports = { WebhookNonce };

