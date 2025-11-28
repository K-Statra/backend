const mongoose = require('mongoose')

const consultantRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    details: { type: String, trim: true, maxlength: 4000 },
    serviceType: { type: String, trim: true, default: 'matching-assistant', maxlength: 120 },
    locale: { type: String, trim: true, maxlength: 12 },
    source: { type: String, trim: true, maxlength: 60, default: 'partner-search' },
    status: { type: String, enum: ['NEW', 'IN_PROGRESS', 'CLOSED'], default: 'NEW' },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer' },
    buyerName: { type: String, trim: true, maxlength: 200 },
    searchTerm: { type: String, trim: true, maxlength: 200 },
    filters: { type: Object, default: {} },
  },
  { timestamps: true }
)

module.exports = {
  ConsultantRequest: mongoose.model('ConsultantRequest', consultantRequestSchema),
}
