const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getClient, isCassandraAvailable } = require('../config/cassandra');
const { runQuery, isNeo4jAvailable } = require('../config/neo4j');
const store = require('../data/store');
const { allowFallback } = require('../config/runtime');
const { requireDatabases } = require('../middleware/databases');

// GET all appointments (by date - defaults to today)
router.get('/', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    if (isCassandraAvailable()) {
      try {
        const client = getClient();
        let query, params;

        if (req.query.doctor_id) {
          query = 'SELECT * FROM appointments_by_doctor WHERE doctor_id = ? AND date = ?';
          params = [req.query.doctor_id, date];
        } else if (req.query.patient_id) {
          query = 'SELECT * FROM appointments_by_patient WHERE patient_id = ? AND date = ?';
          params = [req.query.patient_id, date];
        } else {
          query = 'SELECT * FROM appointments_by_date WHERE date = ?';
          params = [date];
        }

        const result = await client.execute(query, params, { prepare: true });
        return res.json(result.rows);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra query failed, serving from store');
      }
    }

    let filtered = store.appointments.filter(a => a.date === date);
    if (req.query.doctor_id) filtered = filtered.filter(a => a.doctor_id === req.query.doctor_id);
    if (req.query.patient_id) filtered = filtered.filter(a => a.patient_id === req.query.patient_id);
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all appointments for listing
router.get('/all', async (req, res) => {
  try {
    if (isCassandraAvailable()) {
      try {
        const client = getClient();
        const result = await client.execute('SELECT * FROM appointments_by_id');
        return res.json(result.rows);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra query failed, serving from store');
      }
    }
    res.json(store.appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET appointment by ID
router.get('/:id', async (req, res) => {
  try {
    if (isCassandraAvailable()) {
      try {
        const client = getClient();
        const result = await client.execute(
          'SELECT * FROM appointments_by_id WHERE appointment_id = ?',
          [req.params.id],
          { prepare: true }
        );
        if (result.rows.length > 0) return res.json(result.rows[0]);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra lookup failed, serving from store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const apt = store.appointments.find(a => a.appointment_id === req.params.id);
    if (!apt) return res.status(404).json({ error: 'Appointment not found' });
    res.json(apt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create appointment
router.post('/', requireDatabases('neo4j'), async (req, res) => {
  try {
    const { date, time, doctor_id, patient_id, status } = req.body;
    if (!doctor_id || !patient_id || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) {
      return res.status(400).json({ error: 'Patient, doctor, date (YYYY-MM-DD) and time (HH:mm) are required' });
    }
    if (status && !['Scheduled', 'In-Progress', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid appointment status' });
    }
    const appointment_id = 'APT-' + uuidv4().slice(0, 8).toUpperCase();

    let doctor_name = 'Doctor';
    let patient_name = 'Patient';

    if (isNeo4jAvailable()) {
      try {
        const doctorRecords = await runQuery('MATCH (d:Doctor {staff_id: $id}) RETURN d.name as name', { id: doctor_id });
        const patientRecords = await runQuery('MATCH (p:Patient {patient_id: $id}) RETURN p.name as name', { id: patient_id });
        if (!doctorRecords.length || !patientRecords.length) return res.status(400).json({ error: 'Patient or doctor does not exist' });
        if (doctorRecords.length > 0) doctor_name = doctorRecords[0].get('name');
        if (patientRecords.length > 0) patient_name = patientRecords[0].get('name');
      } catch (err) {
        if (!allowFallback) throw err;
        // Fallback names from store
      }
    }

    const doc = store.doctors.find(d => d.staff_id === doctor_id);
    const pat = store.patients.find(p => p.patient_id === patient_id);
    if (!isNeo4jAvailable() && doc) doctor_name = doc.name;
    if (!isNeo4jAvailable() && pat) patient_name = pat.name;

    const newApt = {
      appointment_id,
      date,
      time,
      doctor_id,
      doctor_name,
      patient_id,
      patient_name,
      status: status || 'Scheduled',
    };

    if (isCassandraAvailable()) {
      try {
        const client = getClient();
        const queries = [
          {
            query: 'INSERT INTO appointments_by_doctor (doctor_id, date, time, appointment_id, patient_id, patient_name, doctor_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            params: [doctor_id, date, time, appointment_id, patient_id, patient_name, doctor_name, newApt.status],
          },
          {
            query: 'INSERT INTO appointments_by_patient (patient_id, date, time, appointment_id, doctor_id, doctor_name, patient_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            params: [patient_id, date, time, appointment_id, doctor_id, doctor_name, patient_name, newApt.status],
          },
          {
            query: 'INSERT INTO appointments_by_date (date, time, appointment_id, doctor_id, doctor_name, patient_id, patient_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            params: [date, time, appointment_id, doctor_id, doctor_name, patient_id, patient_name, newApt.status],
          },
          {
            query: 'INSERT INTO appointments_by_id (appointment_id, date, time, doctor_id, doctor_name, patient_id, patient_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            params: [appointment_id, date, time, doctor_id, doctor_name, patient_id, patient_name, newApt.status],
          },
        ];
        await client.batch(queries, { prepare: true });
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra write failed, updating store');
      }
    }

    store.appointments.unshift(newApt);
    res.status(201).json(newApt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update appointment status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Scheduled', 'In-Progress', 'Completed', 'Cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid appointment status' });

    if (isCassandraAvailable()) {
      try {
        const client = getClient();
        const existing = await client.execute(
          'SELECT * FROM appointments_by_id WHERE appointment_id = ?',
          [req.params.id],
          { prepare: true }
        );

        if (existing.rows.length > 0) {
          const apt = existing.rows[0];
          const queries = [
            {
              query: 'UPDATE appointments_by_doctor SET status = ? WHERE doctor_id = ? AND date = ? AND time = ? AND appointment_id = ?',
              params: [status, apt.doctor_id, apt.date, apt.time, apt.appointment_id],
            },
            {
              query: 'UPDATE appointments_by_patient SET status = ? WHERE patient_id = ? AND date = ? AND time = ? AND appointment_id = ?',
              params: [status, apt.patient_id, apt.date, apt.time, apt.appointment_id],
            },
            {
              query: 'UPDATE appointments_by_date SET status = ? WHERE date = ? AND time = ? AND appointment_id = ?',
              params: [status, apt.date, apt.time, apt.appointment_id],
            },
            {
              query: 'UPDATE appointments_by_id SET status = ? WHERE appointment_id = ?',
              params: [status, apt.appointment_id],
            },
          ];
          await client.batch(queries, { prepare: true });
          return res.json({ ...apt, status });
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra status update failed, updating store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const idx = store.appointments.findIndex(a => a.appointment_id === req.params.id);
    if (idx !== -1) {
      store.appointments[idx].status = status;
      return res.json(store.appointments[idx]);
    }

    res.json({ appointment_id: req.params.id, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE appointment
router.delete('/:id', async (req, res) => {
  try {
    if (isCassandraAvailable()) {
      try {
        const client = getClient();
        const existing = await client.execute(
          'SELECT * FROM appointments_by_id WHERE appointment_id = ?',
          [req.params.id],
          { prepare: true }
        );

        if (existing.rows.length > 0) {
          const apt = existing.rows[0];
          const queries = [
            {
              query: 'DELETE FROM appointments_by_doctor WHERE doctor_id = ? AND date = ? AND time = ? AND appointment_id = ?',
              params: [apt.doctor_id, apt.date, apt.time, apt.appointment_id],
            },
            {
              query: 'DELETE FROM appointments_by_patient WHERE patient_id = ? AND date = ? AND time = ? AND appointment_id = ?',
              params: [apt.patient_id, apt.date, apt.time, apt.appointment_id],
            },
            {
              query: 'DELETE FROM appointments_by_date WHERE date = ? AND time = ? AND appointment_id = ?',
              params: [apt.date, apt.time, apt.appointment_id],
            },
            {
              query: 'DELETE FROM appointments_by_id WHERE appointment_id = ?',
              params: [apt.appointment_id],
            },
          ];
          await client.batch(queries, { prepare: true });
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra delete failed, updating store');
      }
    }

    store.appointments = store.appointments.filter(a => a.appointment_id !== req.params.id);
    res.json({ message: 'Appointment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
