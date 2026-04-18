const mongoose = require('mongoose')

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameEn: { type: String, default: '' },
  industry: String,
  stockCode: { type: String, default: '' },
  ksicCode: { type: String, default: '' },
  ksicName: { type: String, default: '' },
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
  // --- Layer 2: Product Layer ---
  products: {
    type: [
      new mongoose.Schema(
        {
          name: { type: String, required: true },
          description: String,
          imageUrl: String,
          catalogUrl: String,
        },
        { _id: true, id: false }
      ),
    ],
    default: [],
  },

  // --- Layer 3: Activity Layer ---
  activities: {
    type: [
      new mongoose.Schema(
        {
          type: { type: String, enum: ['export', 'award', 'exhibition', 'article', 'other'], required: true },
          description: String,
          date: Date,
          url: String,
        },
        { _id: true, id: false }
      ),
    ],
    default: [],
  },

  // --- Layer 4: Finance & Disclosure Layer (Open DART) ---
  dart: {
    corpCode: String, // DART unique code
    bizRegistrationNum: String,

    // Financials (IFRS)
    fiscalYear: String,
    reportDate: Date,
    reportType: String, // e.g., '11013': 1Q, '11012': Half, '11014': 3Q, '11011': Annual
    isIFRS: { type: Boolean, default: true },

    // Consolidated (연결)
    revenueConsolidated: Number,
    operatingProfitConsolidated: Number,
    netIncomeConsolidated: Number,

    // Separate (별도)
    revenueSeparate: Number,
    operatingProfitSeparate: Number,
    netIncomeSeparate: Number,

    source: { type: String, default: 'Financial Supervisory Service Open DART System' },
    lastUpdated: Date,
  },

  embedding: { type: [Number], default: [] },

  // --- Layer 5: Cultural Fit Layer ---
  culturalTraits: {
    innovationScore: { type: Number }, // 1-10
    hierarchyScore: { type: Number },  // 1-10 (High=Hierarchical)
    speedScore: { type: Number },      // 1-10 (High=Fast/Agile)
    keywords: { type: [String], default: [] },
    summary: { type: String, default: '' }
  },
  culturalEmbedding: { type: [Number], default: [] },

  updatedAt: { type: Date, default: Date.now },
})

companySchema.index({ updatedAt: -1 })
companySchema.index({ name: 'text', nameEn: 'text' })
companySchema.index({ tags: 1 })
companySchema.index({ industry: 1 })
companySchema.index({ 'location.country': 1 })
companySchema.index({ stockCode: 1 })
companySchema.index({ 'dart.corpCode': 1 })

const Company = mongoose.model('Company', companySchema)
module.exports = { Company }
