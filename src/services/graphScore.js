const { getSession } = require('../config/neo4j')

/**
 * Calculates graph-based similarity scores for a list of companies relative to a specific buyer.
 * 
 * Score logic:
 * - Match Industry: +3.0
 * - Match Tag (each): +1.0
 * - Match Country: +1.0
 * 
 * @param {string} buyerMongoId 
 * @param {string[]} companyMongoIds 
 * @returns {Promise<Object>} Map of mongoId -> score
 */
async function getGraphScores(buyerMongoId, companyMongoIds) {
  const session = getSession()
  if (!session) return {}

  const scores = {}
  // Initialize with 0
  companyMongoIds.forEach(id => { scores[id] = 0 })

  try {
    const result = await session.executeRead(async (tx) => {
      return await tx.run(
        `MATCH (b:Buyer {mongoId: $buyerMongoId})
         MATCH (c:Company) WHERE c.mongoId IN $companyMongoIds
         
         OPTIONAL MATCH (b)-[:INTERESTED_IN]->(i:Industry)<-[:IN_INDUSTRY]-(c)
         OPTIONAL MATCH (b)-[:LOCATED_IN]->(co:Country)<-[:LOCATED_IN]-(c)
         OPTIONAL MATCH (b)-[:NEEDS_TAG]->(t:Tag)<-[:HAS_TAG]-(c)
         
         RETURN c.mongoId AS mongoId,
                COUNT(DISTINCT i) * 3.0 AS industryScore,
                COUNT(DISTINCT co) * 1.0 AS countryScore,
                COUNT(DISTINCT t) * 1.0 AS tagScore`,
        { buyerMongoId, companyMongoIds }
      )
    })

    result.records.forEach(record => {
      const id = record.get('mongoId')
      const total = record.get('industryScore').toNumber() + 
                    record.get('countryScore').toNumber() + 
                    record.get('tagScore').toNumber()
      scores[id] = total
    })

    return scores
  } catch (err) {
    console.error('[Neo4jScore] Failed to get graph scores:', err.message)
    return scores
  } finally {
    await session.close()
  }
}

module.exports = { getGraphScores }
