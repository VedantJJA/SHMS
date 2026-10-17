const neo4j = require('neo4j-driver');
require('dotenv').config();

let isConnected = false;
let driver = null;

try {
  driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || 'password'
    ),
    { disableLosslessIntegers: true }
  );
} catch (err) {
  console.log('[WARN] Neo4j driver initialization:', err.message);
}

async function verifyConnection() {
  if (!driver) {
    isConnected = false;
    return false;
  }
  try {
    await driver.verifyConnectivity();
    isConnected = true;
    console.log('[INFO] Neo4j connected successfully');
    return true;
  } catch (err) {
    isConnected = false;
    console.log('[WARN] Neo4j not reachable on ' + (process.env.NEO4J_URI || 'bolt://localhost:7687') + '. Database unavailable; preview requires ALLOW_IN_MEMORY_FALLBACK=true.');
    return false;
  }
}

async function runQuery(cypher, params = {}) {
  if (!driver || !isConnected) {
    throw new Error('Neo4j is not connected');
  }
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

async function initConstraints() {
  if (!isConnected) return;
  const constraints = [
    'CREATE CONSTRAINT IF NOT EXISTS FOR (p:Patient) REQUIRE p.patient_id IS UNIQUE',
    'CREATE CONSTRAINT IF NOT EXISTS FOR (s:Staff) REQUIRE s.staff_id IS UNIQUE',
    'CREATE CONSTRAINT IF NOT EXISTS FOR (d:Department) REQUIRE d.dept_id IS UNIQUE',
    'CREATE CONSTRAINT IF NOT EXISTS FOR (r:Room) REQUIRE r.room_no IS UNIQUE',
    'CREATE CONSTRAINT IF NOT EXISTS FOR (m:MedicalRecord) REQUIRE m.record_id IS UNIQUE',
    'CREATE CONSTRAINT IF NOT EXISTS FOR (pr:Prescription) REQUIRE pr.prescription_id IS UNIQUE',
    'CREATE CONSTRAINT IF NOT EXISTS FOR (med:Medicine) REQUIRE med.medicine_id IS UNIQUE',
  ];

  for (const c of constraints) {
    await runQuery(c);
  }
  console.log('[INFO] Neo4j constraints verified');
}

function getDriver() {
  return driver;
}

async function checkConnection() {
  try {
    if (!driver) return false;
    await driver.verifyConnectivity();
    isConnected = true;
  } catch {
    isConnected = false;
  }
  return isConnected;
}

function isNeo4jAvailable() {
  return isConnected;
}

async function closeDriver() {
  if (driver) {
    await driver.close();
  }
}

module.exports = {
  runQuery,
  checkConnection,
  verifyConnection,
  initConstraints,
  getDriver,
  isNeo4jAvailable,
  closeDriver,
};
