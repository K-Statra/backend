const { getSession } = require('../config/neo4j')

/**
 * Syncs a batch of Company documents from MongoDB to Neo4j using UNWIND.
 */
async function syncCompanyBatchToGraph(companies, existingSession = null) {
  const session = existingSession || getSession()
  if (!session) return

  const companyData = companies.map(c => ({
    mongoId: c._id.toString(),
    name: c.name,
    industry: c.industry || 'Unspecified',
    sizeBucket: c.sizeBucket || '1-10',
    country: c.location?.country || 'Unknown',
    tags: Array.isArray(c.tags) ? c.tags : []
  }))

  try {
    await session.executeWrite(async (tx) => {
      // 1. Batch Upsert Company Nodes
      await tx.run(
        `UNWIND $batch AS data
         MERGE (c:Company {mongoId: data.mongoId})
         SET c.name = data.name, 
             c.industry = data.industry, 
             c.sizeBucket = data.sizeBucket, 
             c.updatedAt = datetime()`,
        { batch: companyData }
      )

      // 2. Batch Relationships (Industry, Country, Tags)
      await tx.run(
        `UNWIND $batch AS data
         MATCH (c:Company {mongoId: data.mongoId})
         
         // Industry
         MERGE (i:Industry {name: data.industry})
         MERGE (c)-[:IN_INDUSTRY]->(i)
         
         // Country
         MERGE (co:Country {name: data.country})
         MERGE (c)-[:LOCATED_IN]->(co)`,
        { batch: companyData }
      )

      // 3. Batch Tags (Double Unwind)
      await tx.run(
        `UNWIND $batch AS data
         MATCH (c:Company {mongoId: data.mongoId})
         UNWIND data.tags AS tag
         MERGE (t:Tag {name: tag})
         MERGE (c)-[:HAS_TAG]->(t)`,
        { batch: companyData }
      )
    })
  } catch (err) {
    console.error('[Neo4jSync] Batch sync failed:', err.message)
  } finally {
    if (!existingSession) await session.close()
  }
}

async function syncCompanyToGraph(company, existingSession = null) {
  return syncCompanyBatchToGraph([company], existingSession)
}

/**
 * Syncs a Buyer document from MongoDB to Neo4j.
 */
async function syncBuyerToGraph(buyer, existingSession = null) {
  const session = existingSession || getSession()
  if (!session) return

  try {
    const { _id, name, country, industries, tags } = buyer
    const mongoId = _id.toString()

    await session.executeWrite(async (tx) => {
      // 1. Upsert Buyer Node
      await tx.run(
        `MERGE (b:Buyer {mongoId: $mongoId})
         SET b.name = $name, b.updatedAt = datetime()`,
        { mongoId, name }
      )

      // 2. Relationship to Country
      if (country) {
        await tx.run(
          `MERGE (co:Country {name: $country})
           WITH co
           MATCH (b:Buyer {mongoId: $mongoId})
           MERGE (b)-[:LOCATED_IN]->(co)`,
          { country, mongoId }
        )
      }

      // 3. Relationships to Industries (Interests)
      if (Array.isArray(industries) && industries.length > 0) {
        for (const ind of industries) {
          await tx.run(
            `MERGE (i:Industry {name: $ind})
             WITH i
             MATCH (b:Buyer {mongoId: $mongoId})
             MERGE (b)-[:INTERESTED_IN]->(i)`,
            { ind, mongoId }
          )
        }
      }

      // 4. Relationships to Tags (Needs)
      if (Array.isArray(tags) && tags.length > 0) {
        for (const tag of tags) {
          await tx.run(
            `MERGE (t:Tag {name: $tag})
             WITH t
             MATCH (b:Buyer {mongoId: $mongoId})
             MERGE (b)-[:NEEDS_TAG]->(t)`,
            { tag, mongoId }
          )
        }
      }
    })
    // console.log(`[Neo4jSync] Buyer synced: ${name}`)
  } catch (err) {
    console.error('[Neo4jSync] Buyer sync failed:', err.message)
  } finally {
    if (!existingSession) await session.close()
  }
}

/**
 * Removes a Company or Buyer from the graph.
 */
async function removeFromGraph(mongoId) {
  const session = getSession()
  if (!session) return

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `MATCH (n {mongoId: $mongoId}) DETACH DELETE n`,
        { mongoId }
      )
    })
  } catch (err) {
    console.error('[Neo4jSync] Removal failed:', err.message)
  } finally {
    await session.close()
  }
}

module.exports = { syncCompanyToGraph, syncCompanyBatchToGraph, syncBuyerToGraph, removeFromGraph }
