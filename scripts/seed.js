require('dotenv').config()
const mongoose = require('mongoose')
const { connectDB } = require('../src/config/db')
const { Company } = require('../src/models/Company')

const locations = [
  { city: 'Seoul', country: 'Korea' },
  { city: 'Busan', country: 'Korea' },
  { city: 'Tokyo', country: 'Japan' },
  { city: 'Singapore', country: 'Singapore' },
  { city: 'Berlin', country: 'Germany' },
  { city: 'Los Angeles', state: 'CA', country: 'USA' },
]

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function makeAnalysis(industry) {
  return [
    {
      label: `${industry} fit`,
      score: Math.floor(80 + Math.random() * 15),
      description: `${industry} strengths align with buyer priorities.`,
    },
    {
      label: 'Market presence',
      score: Math.floor(70 + Math.random() * 20),
      description: 'Established channels and recent activity show strong traction.',
    },
  ]
}

function makeCompanies(n = 20) {
  const industries = ['IT', 'Healthcare', 'Finance', 'Education', 'Retail']
  const offeringsPool = ['SaaS', 'Consulting', 'Platform', 'API', 'Mobile App', 'Data Service']
  const needsPool = ['Growth', 'Funding', 'Partnership', 'Hiring', 'Marketing']
  const tagsPool = ['b2b', 'ai', 'cloud', 'security', 'fintech', 'edtech']
  const sizes = ['1-10', '11-50', '51-200', '201-1000', '1000+']

  const list = []
  for (let i = 1; i <= n; i++) {
    const name = `SeedCo_${i}`
    const industry = pick(industries)
    const offerings = Array.from(new Set([pick(offeringsPool), pick(offeringsPool)])).slice(0, 2)
    const needs = Array.from(new Set([pick(needsPool), pick(needsPool)])).slice(0, 2)
    const tags = Array.from(new Set([pick(tagsPool), pick(tagsPool)])).slice(0, 2)
    const location = pick(locations)
    const accuracyScore = Math.floor(70 + Math.random() * 25)
    list.push({
      name,
      industry,
      offerings,
      needs,
      tags,
      profileText: `${name} operates in the ${industry} sector delivering ${offerings.join(', ')}.`,
      location,
      address: `${location.city || ''} HQ`,
      sizeBucket: pick(sizes),
      projectsCount: Math.floor(Math.random() * 5) + 1,
      revenue: Math.floor(Math.random() * 5_000_000) + 500_000,
      primaryContact: {
        name: `Contact ${i}`,
        email: `contact${i}@seedco.test`,
      },
      accuracyScore,
      matchAnalysis: makeAnalysis(industry),
      matchRecommendation: `${name} shows strong complementarity for cross-border deals.`,
      dataSource: 'demo_seed',
      extractedAt: new Date(),
      images: [
        {
          url: `https://picsum.photos/seed/seedco${i}/640/360`,
          caption: `${name} hero`,
        },
      ],
    })
  }
  return list
}

;(async () => {
  try {
    console.log('[seed] connecting DB...')
    await connectDB()
    console.log('[seed] inserting documents...')
    const docs = makeCompanies(20)
    await Company.deleteMany({ dataSource: 'demo_seed' })
    const result = await Company.insertMany(docs, { ordered: false })
    console.log(`[seed] inserted: ${result.length}`)
  } catch (err) {
    if (err && err.writeErrors) {
      console.error('[seed] partial insert, errors:', err.writeErrors.length)
    } else {
      console.error('[seed] error:', err.message)
    }
  } finally {
    await mongoose.disconnect()
    console.log('[seed] done.')
    process.exit(0)
  }
})()
