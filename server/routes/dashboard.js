const express = require('express');
const router = express.Router();
const { runQuery, isNeo4jAvailable } = require('../config/neo4j');
const { getClient, isCassandraAvailable } = require('../config/cassandra');
const store = require('../data/store');
const { allowFallback } = require('../config/runtime');

// GET dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    let patientCount = store.patients.length;
    let doctorCount = store.doctors.length;
    let nurseCount = store.nurses.length;
    let departmentCount = store.departments.length;
    let roomCount = store.rooms.length;
    let medicineCount = store.medicines.length;
    let occupiedRooms = store.rooms.filter(r => r.is_occupied).length;

    if (isNeo4jAvailable()) {
      try {
        const toNum = (records) => {
          const val = records[0]?.get('count');
          return val?.low !== undefined ? val.low : val;
        };

        const [pC, dC, nC, depC, rC, mC, occC] = await Promise.all([
          runQuery('MATCH (p:Patient) RETURN count(p) as count'),
          runQuery('MATCH (d:Doctor) RETURN count(d) as count'),
          runQuery('MATCH (n:Nurse) RETURN count(n) as count'),
          runQuery('MATCH (dept:Department) RETURN count(dept) as count'),
          runQuery('MATCH (r:Room) RETURN count(r) as count'),
          runQuery('MATCH (m:Medicine) RETURN count(m) as count'),
          runQuery('MATCH (p:Patient)-[a:ADMITTED_TO]->(r:Room) WHERE a.discharge_date IS NULL RETURN count(DISTINCT r) as count'),
        ]);

        patientCount = toNum(pC);
        doctorCount = toNum(dC);
        nurseCount = toNum(nC);
        departmentCount = toNum(depC);
        roomCount = toNum(rC);
        medicineCount = toNum(mC);
        occupiedRooms = toNum(occC);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j stats query failed, serving from store');
      }
    }

    const today = new Date().toISOString().split('T')[0];
    let todayAppointments = store.appointments.filter(a => a.date === today).length;
    let totalBills = store.bills.length;
    let pendingBills = store.bills.filter(b => b.payment_status === 'Pending').length;

    if (isCassandraAvailable()) {
      try {
        const cassClient = getClient();
        const aptResult = await cassClient.execute(
          'SELECT count(*) as count FROM appointments_by_date WHERE date = ?',
          [today],
          { prepare: true }
        );
        todayAppointments = aptResult.rows[0]?.count?.low || aptResult.rows[0]?.count || 0;

        const billResult = await cassClient.execute('SELECT bill_id, payment_status FROM bills_by_id');
        totalBills = billResult.rows.length;
        pendingBills = billResult.rows.filter(r => r.payment_status === 'Pending').length;
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra stats query failed, serving from store');
      }
    }

    res.json({
      patients: patientCount,
      doctors: doctorCount,
      nurses: nurseCount,
      departments: departmentCount,
      rooms: roomCount,
      occupied_rooms: occupiedRooms,
      medicines: medicineCount,
      today_appointments: todayAppointments,
      total_bills: totalBills,
      pending_bills: pendingBills,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET recent appointments
router.get('/recent-appointments', async (req, res) => {
  try {
    if (isCassandraAvailable()) {
      try {
        const cassClient = getClient();
        const result = await cassClient.execute('SELECT * FROM appointments_by_id LIMIT 10');
        return res.json(result.rows);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra query failed, serving from store');
      }
    }
    res.json(store.appointments.slice(0, 10));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET department-wise doctor count
router.get('/dept-doctors', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (dept:Department)
          OPTIONAL MATCH (d:Doctor)-[:WORKS_IN]->(dept)
          RETURN dept.dept_name as department, count(d) as doctor_count
          ORDER BY doctor_count DESC
        `);

        const data = records.map(r => ({
          department: r.get('department'),
          doctor_count: r.get('doctor_count').low || r.get('doctor_count'),
        }));
        return res.json(data);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j query failed, serving from store');
      }
    }

    const counts = {};
    store.departments.forEach(d => { counts[d.dept_name] = 0; });
    store.doctors.forEach(doc => {
      const dName = doc.department?.dept_name;
      if (dName && counts[dName] !== undefined) counts[dName]++;
    });
    const result = Object.entries(counts).map(([department, doctor_count]) => ({ department, doctor_count }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
