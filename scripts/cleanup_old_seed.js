require('dotenv').config()
const mongoose = require('mongoose')
const { connectDB } = require('../src/config/db')
const { Company } = require('../src/models/Company')

    ; (async () => {
        try {
            console.log('[cleanup] connecting DB...')
            await connectDB()
            console.log('[cleanup] deleting old demo_seed data...')
            const result = await Company.deleteMany({ dataSource: 'demo_seed' })
            console.log(`[cleanup] deleted: ${result.deletedCount}`)
        } catch (err) {
            console.error('[cleanup] error:', err)
        } finally {
            await mongoose.disconnect()
            console.log('[cleanup] done.')
            process.exit(0)
        }
    })()
