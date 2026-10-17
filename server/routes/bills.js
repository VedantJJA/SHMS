const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getClient, isCassandraAvailable } = require('../config/cassandra');
const { runQuery, isNeo4jAvailable } = require('../config/neo4j');
const store = require('../data/store');
const { allowFallback } = require('../config/runtime');
const { requireDatabases } = require('../middleware/databases');

// GET all bills
router.get('/', async (req, res) => {
  try {
    if (isCassandraAvailable()) {
      try {
        const client = getClient();
        let result;
        if (req.query.patient_id) {
          result = await client.execute(
            'SELECT * FROM bills_by_patient WHERE patient_id = ?',
            [req.query.patient_id],
            { prepare: true }
          );
        } else {
          result = await client.execute('SELECT * FROM bills_by_id');
        }
        return res.json(result.rows);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra bills query failed, serving from store');
      }
    }

    if (req.query.patient_id) {
      return res.json(store.bills.filter(b => b.patient_id === req.query.patient_id));
    }
    res.json(store.bills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET bill by ID
router.get('/:id', async (req, res) => {
  try {
    if (isCassandraAvailable()) {
      try {
        const client = getClient();
        const result = await client.execute(
          'SELECT * FROM bills_by_id WHERE bill_id = ?',
          [req.params.id],
          { prepare: true }
        );
        if (result.rows.length > 0) return res.json(result.rows[0]);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra bill lookup failed, serving from store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const bill = store.bills.find(b => b.bill_id === req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    res.json(bill);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create bill
router.post('/', requireDatabases('neo4j'), async (req, res) => {
  try {
    const { patient_id, appointment_id, amount, payment_status } = req.body;
    if (!patient_id || amount === '' || amount == null || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ error: 'A patient and a positive bill amount are required' });
    if (payment_status && !['Pending', 'Paid'].includes(payment_status)) return res.status(400).json({ error: 'Invalid payment status' });
    const bill_id = 'BILL-' + uuidv4().slice(0, 8).toUpperCase();
    const created_at = new Date().toISOString();

    let patient_name = 'Patient';
    if (isNeo4jAvailable()) {
      try {
        const patientRecords = await runQuery(
          'MATCH (p:Patient {patient_id: $id}) RETURN p.name as name',
          { id: patient_id }
        );
        if (!patientRecords.length) return res.status(400).json({ error: 'Patient does not exist' });
        if (patientRecords.length > 0) patient_name = patientRecords[0].get('name');
      } catch (err) {
        if (!allowFallback) throw err;
        // Fallback to store
      }
    }

    const pat = store.patients.find(p => p.patient_id === patient_id);
    if (!isNeo4jAvailable() && pat) patient_name = pat.name;
    if (appointment_id && isCassandraAvailable()) {
      const result = await getClient().execute('SELECT patient_id FROM appointments_by_id WHERE appointment_id = ?', [appointment_id], { prepare: true });
      if (!result.rows.length || result.rows[0].patient_id !== patient_id) return res.status(400).json({ error: 'Appointment does not belong to this patient' });
    }

    const newBill = {
      bill_id,
      patient_id,
      patient_name,
      appointment_id: appointment_id || '',
      amount: parseFloat(amount),
      payment_status: payment_status || 'Pending',
      created_at,
    };

    if (isCassandraAvailable()) {
      try {
        const client = getClient();
        const queries = [
          {
            query: 'INSERT INTO bills_by_patient (patient_id, bill_id, patient_name, appointment_id, amount, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            params: [patient_id, bill_id, patient_name, newBill.appointment_id, newBill.amount, newBill.payment_status, created_at],
          },
          {
            query: 'INSERT INTO bills_by_id (bill_id, patient_id, patient_name, appointment_id, amount, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            params: [bill_id, patient_id, patient_name, newBill.appointment_id, newBill.amount, newBill.payment_status, created_at],
          },
        ];
        await client.batch(queries, { prepare: true });
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra create bill failed, updating store');
      }
    }

    store.bills.unshift(newBill);
    res.status(201).json(newBill);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update bill payment status
router.put('/:id/status', async (req, res) => {
  try {
    const { payment_status } = req.body;
    if (!['Pending', 'Paid'].includes(payment_status)) return res.status(400).json({ error: 'Invalid payment status' });

    if (isCassandraAvailable()) {
      try {
        const client = getClient();
        const existing = await client.execute(
          'SELECT * FROM bills_by_id WHERE bill_id = ?',
          [req.params.id],
          { prepare: true }
        );

        if (existing.rows.length > 0) {
          const bill = existing.rows[0];
          const queries = [
            {
              query: 'UPDATE bills_by_patient SET payment_status = ? WHERE patient_id = ? AND bill_id = ?',
              params: [payment_status, bill.patient_id, bill.bill_id],
            },
            {
              query: 'UPDATE bills_by_id SET payment_status = ? WHERE bill_id = ?',
              params: [payment_status, bill.bill_id],
            },
          ];
          await client.batch(queries, { prepare: true });
          return res.json({ ...bill, payment_status });
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra update bill failed, updating store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const idx = store.bills.findIndex(b => b.bill_id === req.params.id);
    if (idx !== -1) {
      store.bills[idx].payment_status = payment_status;
      return res.json(store.bills[idx]);
    }

    res.json({ bill_id: req.params.id, payment_status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE bill
router.delete('/:id', async (req, res) => {
  try {
    if (isCassandraAvailable()) {
      try {
        const client = getClient();
        const existing = await client.execute(
          'SELECT * FROM bills_by_id WHERE bill_id = ?',
          [req.params.id],
          { prepare: true }
        );

        if (existing.rows.length > 0) {
          const bill = existing.rows[0];
          const queries = [
            {
              query: 'DELETE FROM bills_by_patient WHERE patient_id = ? AND bill_id = ?',
              params: [bill.patient_id, bill.bill_id],
            },
            {
              query: 'DELETE FROM bills_by_id WHERE bill_id = ?',
              params: [bill.bill_id],
            },
          ];
          await client.batch(queries, { prepare: true });
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Cassandra delete bill failed, updating store');
      }
    }

    store.bills = store.bills.filter(b => b.bill_id !== req.params.id);
    res.json({ message: 'Bill deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
