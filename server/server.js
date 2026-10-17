const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { verifyConnection, initConstraints, checkConnection: checkNeo4j } = require('./config/neo4j');
const { initCassandra, checkConnection: checkCassandra } = require('./config/cassandra');
const { requireDatabases } = require('./middleware/databases');
const { allowFallback } = require('./config/runtime');

// Route imports
const patientRoutes = require('./routes/patients');
const doctorRoutes = require('./routes/doctors');
const nurseRoutes = require('./routes/nurses');
const departmentRoutes = require('./routes/departments');
const roomRoutes = require('./routes/rooms');
const appointmentRoutes = require('./routes/appointments');
const medicalRecordRoutes = require('./routes/medicalRecords');
const prescriptionRoutes = require('./routes/prescriptions');
const medicineRoutes = require('./routes/medicines');
const billRoutes = require('./routes/bills');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/patients', requireDatabases('neo4j'), patientRoutes);
app.use('/api/doctors', requireDatabases('neo4j'), doctorRoutes);
app.use('/api/nurses', requireDatabases('neo4j'), nurseRoutes);
app.use('/api/departments', requireDatabases('neo4j'), departmentRoutes);
app.use('/api/rooms', requireDatabases('neo4j'), roomRoutes);
app.use('/api/appointments', requireDatabases('cassandra'), appointmentRoutes);
app.use('/api/medical-records', requireDatabases('neo4j'), medicalRecordRoutes);
app.use('/api/prescriptions', requireDatabases('neo4j'), prescriptionRoutes);
app.use('/api/medicines', requireDatabases('neo4j'), medicineRoutes);
app.use('/api/bills', requireDatabases('cassandra'), billRoutes);
app.use('/api/dashboard', requireDatabases('neo4j', 'cassandra'), dashboardRoutes);

// Fixed read-only queries for explaining the database models.
app.use('/api/lab', require('./routes/lab'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database status check
app.get('/api/status', async (req, res) => {
  const [neo4j, cassandra] = await Promise.all([checkNeo4j(), checkCassandra()]);
  res.json({
    neo4j,
    cassandra,
    mode: neo4j && cassandra ? 'live' : allowFallback ? 'preview' : 'unavailable',
    fallback_enabled: allowFallback,
  });
});

// Initialize databases and start server
async function start() {
  try {
    await verifyConnection();
    await initConstraints();
    await initCassandra();
  } catch (err) {
    console.log('[WARN] Database initialization notice:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`[SERVER] SHMS API Server running on http://localhost:${PORT}`);
  });
}

start();
