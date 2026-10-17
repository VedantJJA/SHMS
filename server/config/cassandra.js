const cassandra = require('cassandra-driver');
require('dotenv').config();

let isConnected = false;
let client = null;

const contactPoints = (process.env.CASSANDRA_CONTACT_POINTS || '127.0.0.1').split(',');
const localDataCenter = process.env.CASSANDRA_LOCAL_DC || 'datacenter1';
const keyspace = process.env.CASSANDRA_KEYSPACE || 'shms';

try {
  client = new cassandra.Client({
    contactPoints,
    localDataCenter,
    keyspace,
  });
} catch (err) {
  console.log('[WARN] Cassandra client initialization:', err.message);
}

async function initCassandra() {
  const initClient = new cassandra.Client({
    contactPoints,
    localDataCenter,
  });

  try {
    await initClient.connect();
    console.log('[INFO] Cassandra connected successfully');

    await initClient.execute(`
      CREATE KEYSPACE IF NOT EXISTS ${keyspace}
      WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
    `);

    await initClient.shutdown();

    if (client) {
      await client.connect();
      await createTables();
      isConnected = true;
      console.log('[INFO] Cassandra tables initialized');
    }
    return true;
  } catch (err) {
    isConnected = false;
    console.log('[WARN] Cassandra not reachable on ' + contactPoints.join(',') + '. Database unavailable; preview requires ALLOW_IN_MEMORY_FALLBACK=true.');
    return false;
  }
}

async function createTables() {
  if (!client) throw new Error('Cassandra client is not initialized');
  const tables = [
    `CREATE TABLE IF NOT EXISTS appointments_by_doctor (
      doctor_id TEXT,
      date TEXT,
      time TEXT,
      appointment_id TEXT,
      patient_id TEXT,
      patient_name TEXT,
      doctor_name TEXT,
      status TEXT,
      PRIMARY KEY (doctor_id, date, time, appointment_id)
    ) WITH CLUSTERING ORDER BY (date DESC, time ASC, appointment_id ASC)`,

    `CREATE TABLE IF NOT EXISTS appointments_by_patient (
      patient_id TEXT,
      date TEXT,
      time TEXT,
      appointment_id TEXT,
      doctor_id TEXT,
      doctor_name TEXT,
      patient_name TEXT,
      status TEXT,
      PRIMARY KEY (patient_id, date, time, appointment_id)
    ) WITH CLUSTERING ORDER BY (date DESC, time ASC, appointment_id ASC)`,

    `CREATE TABLE IF NOT EXISTS appointments_by_date (
      date TEXT,
      time TEXT,
      appointment_id TEXT,
      doctor_id TEXT,
      doctor_name TEXT,
      patient_id TEXT,
      patient_name TEXT,
      status TEXT,
      PRIMARY KEY (date, time, appointment_id)
    ) WITH CLUSTERING ORDER BY (time ASC, appointment_id ASC)`,

    `CREATE TABLE IF NOT EXISTS appointments_by_id (
      appointment_id TEXT,
      date TEXT,
      time TEXT,
      doctor_id TEXT,
      doctor_name TEXT,
      patient_id TEXT,
      patient_name TEXT,
      status TEXT,
      PRIMARY KEY (appointment_id)
    )`,

    `CREATE TABLE IF NOT EXISTS bills_by_patient (
      patient_id TEXT,
      bill_id TEXT,
      patient_name TEXT,
      appointment_id TEXT,
      amount DECIMAL,
      payment_status TEXT,
      created_at TEXT,
      PRIMARY KEY (patient_id, bill_id)
    ) WITH CLUSTERING ORDER BY (bill_id DESC)`,

    `CREATE TABLE IF NOT EXISTS bills_by_id (
      bill_id TEXT,
      patient_id TEXT,
      patient_name TEXT,
      appointment_id TEXT,
      amount DECIMAL,
      payment_status TEXT,
      created_at TEXT,
      PRIMARY KEY (bill_id)
    )`,
  ];

  for (const t of tables) {
    await client.execute(t);
  }
}

async function checkConnection() {
  try {
    if (!client) return false;
    await client.execute('SELECT appointment_id FROM appointments_by_id LIMIT 1');
    await client.execute('SELECT bill_id FROM bills_by_id LIMIT 1');
    isConnected = true;
  } catch {
    isConnected = false;
  }
  return isConnected;
}

function getClient() {
  return client;
}

function isCassandraAvailable() {
  return isConnected;
}

async function closeClient() {
  if (client) {
    await client.shutdown();
  }
}

module.exports = {
  initCassandra,
  checkConnection,
  getClient,
  isCassandraAvailable,
  closeClient,
};
