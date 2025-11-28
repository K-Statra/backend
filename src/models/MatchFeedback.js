const mongoose = require('mongoose');

const matchFeedbackSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comments: { type: String, default: '' },
    locale: { type: String, default: '' },
    source: { type: String, default: '' },
  },
  { timestamps: true }
);

matchFeedbackSchema.index({ companyId: 1, createdAt: -1 });

const MatchFeedback = mongoose.model('MatchFeedback', matchFeedbackSchema);
module.exports = { MatchFeedback };
