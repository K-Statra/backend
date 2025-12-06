require('dotenv').config()
const mongoose = require('mongoose')
const { Company } = require('../src/models/Company')
const OpenDart = require('opendart')


const { connectDB } = require('../src/config/db')

// Initialize Open DART client
const DART_API_KEY = process.env.OPENDART_API_KEY
// const dartClient = new OpenDart(DART_API_KEY) // OpenDart is not a constructor

// MongoDB Connection
// const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/k-statra'

// async function connectDB() { ... } // Removed manual definition

async function fetchCorpCode(companyName) {
    try {
        console.log(`[TODO] Need to implement corpCode lookup for: ${companyName}`)
        return null
    } catch (err) {
        console.error(`Error fetching corpCode for ${companyName}:`, err.message)
        return null
    }
}

async function fetchFinancials(corpCode, year, reportCode = '11011') {
    try {
        // Mocking the response for the structure if we can't call it yet (no API key).
        return null
    } catch (err) {
        console.error(`Error fetching financials for ${corpCode}:`, err.message)
        return null
    }
}

async function getMockData(corpCode) {
    return {
        corpCode: corpCode || '00126380', // Samsung Electronics example
        bizRegistrationNum: '123-45-67890',
        fiscalYear: '2023',
        reportDate: new Date('2024-03-31'),
        reportType: '11011', // Annual
        isIFRS: true,
        revenueConsolidated: 258935000000000, // ~258 Trillion KRW
        operatingProfitConsolidated: 6567000000000,
        netIncomeConsolidated: 15487000000000,
        revenueSeparate: 170000000000000,
        operatingProfitSeparate: -11000000000000, // Example loss
        netIncomeSeparate: 10000000000000,
        source: 'Financial Supervisory Service Open DART System (MOCK)',
        lastUpdated: new Date()
    }
}

async function updateCompanyData(company, useMock = false) {
    console.log(`Processing ${company.name}...`)

    let dartData = null

    if (useMock) {
        console.log(`  - Using MOCK data for ${company.name}`)
        dartData = await getMockData()
    } else {
        // 1. Get Corp Code
        const corpCode = await fetchCorpCode(company.name)
        if (!corpCode) {
            console.log(`  - Skipping: Corp Code not found`)
            return
        }
        // 2. Fetch Financials
        console.log(`  - Real API fetch not fully implemented yet.`)
        return
    }

    if (dartData) {
        // 3. Map to Schema
        company.dart = dartData

        // Also update Activity Layer as an example
        if (company.activities.length === 0) {
            company.activities.push({
                type: 'export',
                description: 'Exported $10M to USA',
                date: new Date('2023-12-01')
            })
        }

        await company.save()
        console.log(`  - Updated ${company.name} with DART data.`)
    }
}

async function main() {
    await connectDB()

    const useMock = !DART_API_KEY
    if (useMock) {
        console.warn('WARNING: OPENDART_API_KEY is not set. Running in MOCK mode.')
    }

    const companies = await Company.find({}).limit(5) // Limit to 5 for testing
    console.log(`Found ${companies.length} companies to process.`)

    for (const company of companies) {
        await updateCompanyData(company, useMock)
    }

    await mongoose.disconnect()
    console.log('Done.')
}

main()
