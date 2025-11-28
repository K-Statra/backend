const mongoose = require('mongoose');

const MatchLogSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', index: true, required: true },
    params: {
      limit: { type: Number, default: 10 },
    },
    results: [
      {
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
        score: { type: Number, default: 0 },
        reasons: { type: [String], default: [] },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MatchLogSchema.index({ createdAt: -1 });

const MatchLog = mongoose.model('MatchLog', MatchLogSchema);
module.exports = { MatchLog };

