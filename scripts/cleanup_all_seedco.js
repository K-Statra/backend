require('dotenv').config()
const mongoose = require('mongoose')
const { connectDB } = require('../src/config/db')
const { Company } = require('../src/models/Company')

    ; (async () => {
        try {
            console.log('[cleanup-final] connecting DB...')
            await connectDB()

            console.log('[cleanup-final] deleting ALL companies named SeedCo*...')
            const result = await Company.deleteMany({ name: { $regex: /^SeedCo/ } })
            console.log(`[cleanup-final] deleted: ${result.deletedCount}`)

        } catch (err) {
            console.error('[cleanup-final] error:', err)
        } finally {
            await mongoose.disconnect()
            console.log('[cleanup-final] done.')
            process.exit(0)
        }
    })()
