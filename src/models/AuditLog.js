const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    actor: { type: String, default: 'system' },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    requestId: { type: String },
    meta: { type: Object, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
module.exports = { AuditLog };

