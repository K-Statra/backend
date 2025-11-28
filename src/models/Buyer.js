const mongoose = require('mongoose');

const BuyerSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  country: { type: String, default: '' },
  industries: { type: [String], default: [] }, // 관심 산업
  needs: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  profileText: { type: String, default: '' },
  embedding: { type: [Number], default: [] }, // 이후 텍스트 임베딩용
  updatedAt: { type: Date, default: Date.now }
});

BuyerSchema.index({ updatedAt: -1 });
BuyerSchema.index({ tags: 1 });
BuyerSchema.index({ industries: 1 });

const Buyer = mongoose.model('Buyer', BuyerSchema);
module.exports = { Buyer };