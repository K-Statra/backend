require('dotenv').config()
const mongoose = require('mongoose')
const { Company } = require('../src/models/Company')
const { Buyer } = require('../src/models/Buyer')
const { syncCompanyToGraph, syncCompanyBatchToGraph, syncBuyerToGraph } = require('../src/services/graphSync')
const { verifyConnectivity, closeDriver } = require('../src/config/neo4j')

async function syncAll() {
  console.log('--- Starting Optimized Global Graph Sync ---')
  
  // 1. Connect MongoDB
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('[Mongo] Connected')
  } catch (err) {
    console.error('[Mongo] Connection failed:', err.message)
    process.exit(1)
  }

  // 2. Verify Neo4j
  const connected = await verifyConnectivity()
  if (!connected) {
    console.error('[Neo4j] Aborting sync due to connection failure.')
    process.exit(1)
  }

  const session = require('../src/config/neo4j').getSession()
  
  try {
    // 3. Sync Companies (Prioritizing Automotive Sector for PoC)
    const LIMIT = 15000
    const automotiveRegex = /자동차|부품|Automotive|Car parts|EV|Machinery|parts/i;
    const filter = {
      $or: [
        { industry: { $regex: automotiveRegex } },
        { tags: { $in: [automotiveRegex] } },
        { name: { $regex: automotiveRegex } },
        { profileText: { $regex: automotiveRegex } }
      ]
    };
    const projection = { _id: 1, name: 1, industry: 1, location: 1, tags: 1, sizeBucket: 1 }
    
    console.log(`[Sync] Starting sync for Automotive sector (streaming in batches of 50)...`)
    
    let count = 0
    let batch = []
    const BATCH_SIZE = 50
    const companyCursor = Company.find(filter).select(projection).limit(LIMIT).cursor()
    
    for (let company = await companyCursor.next(); company != null; company = await companyCursor.next()) {
      batch.push(company)
      
      if (batch.length >= BATCH_SIZE) {
        await syncCompanyBatchToGraph(batch, session)
        count += batch.length
        console.log(`[Sync] Progress: ${count}/${LIMIT} companies synced...`)
        batch = []
      }
    }
    
    // Final batch
    if (batch.length > 0) {
      await syncCompanyBatchToGraph(batch, session)
      count += batch.length
      console.log(`[Sync] Final batch synced: ${count} total.`)
    }
    
    console.log(`[Sync] ✅ ${count} companies synced.`)

    // 4. Sync Buyers
    const buyers = await Buyer.find({})
    console.log(`[Sync] Found ${buyers.length} buyers. Synchronizing...`)
    for (const buyer of buyers) {
      await syncBuyerToGraph(buyer, session)
    }
    console.log(`[Sync] ✅ ${buyers.length} buyers synced.`)

    console.log('--- Sync Completed Successfully ---')
  } catch (err) {
    console.error('[Sync] Error during sync:', err)
  } finally {
    if (session) await session.close()
    await mongoose.disconnect()
    await closeDriver()
    process.exit(0)
  }
}

syncAll()
