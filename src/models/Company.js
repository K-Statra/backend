import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  industry: String,
  offerings: [String],
  needs: [String],
  tags: [String],
  profileText: String,
  embedding: { type: [Number], default: [] },
  updatedAt: { type: Date, default: Date.now }
});

companySchema.index({ name: 1 });

export const Company = mongoose.model('Company', companySchema);
