const express = require('express')
const { Company } = require('../models/Company')
const { Payment } = require('../models/Payment')

const router = express.Router()

router.get('/dashboard', async (req, res, next) => {
  try {
    const [totalPartners, activeDeals, pendingPayments, completedDeals] = await Promise.all([
      Company.countDocuments(),
      Payment.countDocuments({ status: { $in: ['CREATED', 'PENDING'] } }),
      Payment.countDocuments({ status: 'PENDING' }),
      Payment.countDocuments({ status: 'PAID' }),
    ])
    res.json({ totalPartners, activeDeals, pendingPayments, completedDeals })
  } catch (err) {
    next(err)
  }
})

router.get('/industries/top', async (req, res, next) => {
  try {
    const docs = await Company.aggregate([
      { $match: { industry: { $exists: true, $ne: '' } } },
      { $group: { _id: '$industry', partners: { $sum: 1 }, revenue: { $sum: '$revenue' } } },
      { $sort: { partners: -1 } },
      { $limit: 5 },
    ])
    res.json(
      docs.map((doc) => ({
        name: doc._id,
        partners: doc.partners,
        revenue: doc.revenue,
      }))
    )
  } catch (err) {
    next(err)
  }
})

router.get('/transactions/recent', async (req, res, next) => {
  try {
    const docs = await Payment.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('amount currency status memo createdAt companyId')
      .populate('companyId', 'name')
      .lean()
    res.json(
      docs.map((doc) => ({
        id: doc._id,
        company: doc.companyId?.name || 'Unknown',
        amount: doc.amount,
        currency: doc.currency,
        status: doc.status,
        memo: doc.memo,
        createdAt: doc.createdAt,
      }))
    )
  } catch (err) {
    next(err)
  }
})

module.exports = router
