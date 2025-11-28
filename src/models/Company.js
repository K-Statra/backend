const mongoose = require('mongoose')

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  industry: String,
  offerings: { type: [String], default: [] },
  needs: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  profileText: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  location: {
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
  },
  address: { type: String, default: '' },
  sizeBucket: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
    default: '1-10',
  },
  projectsCount: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  primaryContact: {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  accuracyScore: { type: Number, default: null },
  matchAnalysis: {
    type: [
      new mongoose.Schema(
        {
          label: String,
          score: Number,
          description: String,
        },
        { _id: true, id: false }
      ),
    ],
    default: [],
  },
  matchRecommendation: { type: String, default: '' },
  dataSource: { type: String, default: '' },
  extractedAt: { type: Date },
  images: {
    type: [
      new mongoose.Schema(
        {
          url: { type: String, required: true },
          caption: { type: String, default: '' },
          alt: { type: String, default: '' },
          tags: { type: [String], default: [] },
          clipEmbedding: { type: [Number], default: [] },
        },
        { _id: true, id: false }
      ),
    ],
    default: [],
  },
  embedding: { type: [Number], default: [] },
  updatedAt: { type: Date, default: Date.now },
})

companySchema.index({ updatedAt: -1 })
companySchema.index({ name: 1 })
companySchema.index({ tags: 1 })
companySchema.index({ industry: 1 })
companySchema.index({ 'location.country': 1 })

const Company = mongoose.model('Company', companySchema)
module.exports = { Company }
