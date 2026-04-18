const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    buyerName: { type: String, trim: true },
    companyName: { type: String, trim: true },
    reqType: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'OFFLINE' },
    exhibitionName: { type: String, default: 'KOAA SHOW 2026' }, 
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true }, // e.g., '14:00 - 15:00'
    boothNumber: { type: String, trim: true },
    meetingLink: { type: String, trim: true }, // For online
    status: { type: String, enum: ['REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'PAYMENT_PENDING'], default: 'REQUESTED' },
    message: { type: String, trim: true, maxlength: 4000 },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' } // 연동될 XRPL 결제 객체 참조
  },
  { timestamps: true }
);

module.exports = {
  Consultation: mongoose.model('Consultation', consultationSchema),
};
