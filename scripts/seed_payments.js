require('dotenv').config()
const crypto = require('crypto')
const mongoose = require('mongoose')
const { connectDB } = require('../src/config/db')
const { Company } = require('../src/models/Company')
const { Buyer } = require('../src/models/Buyer')
const { Payment } = require('../src/models/Payment')

const STATUSES = ['PENDING', 'PAID', 'FAILED']
const CURRENCIES = ['XRP', 'USD', 'KRW']

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildPayments(buyers, companies, n = 15) {
  const list = []
  for (let i = 0; i < n; i++) {
    const buyer = buyers[i % buyers.length]
    const company = companies[(i + 3) % companies.length]
    const status = pick(STATUSES)
    list.push({
      buyerId: buyer._id,
      companyId: company._id,
      amount: Math.floor(Math.random() * 100000) + 10000,
      currency: pick(CURRENCIES),
      idempotencyKey: crypto.randomUUID(),
      requestHash: crypto.randomUUID(),
      provider: process.env.PAYMENTS_PROVIDER || 'xrpl-testnet',
      status,
      memo: `Demo payment #${i + 1} for ${company.name}`,
      events: [
        { type: 'CREATED', meta: { by: 'demo_seed' } },
        ...(status === 'PAID'
          ? [{ type: 'PAID', meta: { by: 'demo_seed' } }]
          : status === 'FAILED'
          ? [{ type: 'FAILED', meta: { by: 'demo_seed' } }]
          : []),
      ],
    })
  }
  return list
}

;(async () => {
  try {
    console.log('[seed:payments] connecting DB...')
    await connectDB()
    const buyers = await Buyer.find().limit(10)
    const companies = await Company.find().limit(10)
    if (buyers.length === 0 || companies.length === 0) {
      throw new Error('Need buyers and companies before seeding payments')
    }
    console.log('[seed:payments] removing old demo data...')
    await Payment.deleteMany({ 'events.meta.by': 'demo_seed' })
    const docs = buildPayments(buyers, companies, 20)
    const result = await Payment.insertMany(docs, { ordered: false })
    console.log(`[seed:payments] inserted ${result.length}`)
  } catch (err) {
    console.error('[seed:payments] error:', err.message)
  } finally {
    await mongoose.disconnect()
    console.log('[seed:payments] done.')
    process.exit(0)
  }
})()
