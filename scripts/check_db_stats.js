require('dotenv').config()
const mongoose = require('mongoose')
const { connectDB } = require('../src/config/db')
const { Company } = require('../src/models/Company')

    ; (async () => {
        try {
            console.log('[stats] connecting DB...')
            await connectDB()

            const stats = await Company.aggregate([
                { $group: { _id: "$dataSource", count: { $sum: 1 } } }
            ])

            console.log('[stats] Company counts by dataSource:')
            console.table(stats)

            // Also check for any companies with name starting with "SeedCo"
            const seedCos = await Company.countDocuments({ name: { $regex: /^SeedCo/ } })
            console.log(`[stats] Companies named 'SeedCo*': ${seedCos}`)

        } catch (err) {
            console.error('[stats] error:', err)
        } finally {
            await mongoose.disconnect()
            console.log('[stats] done.')
            process.exit(0)
        }
    })()
