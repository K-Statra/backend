const neo4j = require('neo4j-driver')

let driver = null

function getDriver() {
  if (!driver) {
    const uri = process.env.NEO4J_URI
    const user = process.env.NEO4J_USERNAME
    const password = process.env.NEO4J_PASSWORD

    if (!uri || !user || !password) {
      return null
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 10,
      connectionAcquisitionTimeout: 10000,
    })
  }
  return driver
}

function getSession() {
  const d = getDriver()
  if (!d) return null
  const database = process.env.NEO4J_DATABASE || undefined
  return d.session({ database })
}

async function verifyConnectivity() {
  const d = getDriver()
  if (!d) {
    console.log('[Neo4j] NEO4J_URI/USERNAME/PASSWORD not set — Graph features disabled.')
    return false
  }
  try {
    await d.verifyConnectivity()
    console.log('[Neo4j] ✅ Connected to AuraDB:', process.env.NEO4J_URI)
    return true
  } catch (err) {
    console.error('[Neo4j] ❌ Connection failed:', err.message)
    return false
  }
}

async function closeDriver() {
  if (driver) {
    await driver.close()
    driver = null
  }
}

module.exports = { getDriver, getSession, verifyConnectivity, closeDriver }
