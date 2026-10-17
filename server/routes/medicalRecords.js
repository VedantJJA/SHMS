const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { runQuery, isNeo4jAvailable } = require('../config/neo4j');
const store = require('../data/store');
const { allowFallback } = require('../config/runtime');

// GET all medical records
router.get('/', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (mr:MedicalRecord)
          OPTIONAL MATCH (p:Patient)-[:HAS_RECORD]->(mr)
          OPTIONAL MATCH (d:Doctor)-[:CREATES]->(mr)
          OPTIONAL MATCH (n:Nurse)-[:ASSIGNED_TO]->(mr)
          RETURN mr, p, d,
            collect(DISTINCT {staff_id: n.staff_id, name: n.name}) as assigned_nurses
          ORDER BY mr.date DESC
        `);

        const medRecords = records.map(record => {
          const mr = record.get('mr').properties;
          const p = record.get('p');
          const d = record.get('d');
          const nurses = record.get('assigned_nurses').filter(n => n.staff_id);
          return {
            ...mr,
            patient: p ? { patient_id: p.properties.patient_id, name: p.properties.name } : null,
            doctor: d ? { staff_id: d.properties.staff_id, name: d.properties.name } : null,
            assigned_nurses: nurses,
          };
        });

        return res.json(medRecords);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j medical records query failed, serving from store');
      }
    }
    res.json(store.medicalRecords);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET medical record by ID
router.get('/:id', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (mr:MedicalRecord {record_id: $id})
          OPTIONAL MATCH (p:Patient)-[:HAS_RECORD]->(mr)
          OPTIONAL MATCH (d:Doctor)-[:CREATES]->(mr)
          OPTIONAL MATCH (n:Nurse)-[:ASSIGNED_TO]->(mr)
          RETURN mr, p, d, collect(DISTINCT n) as nurses
        `, { id: req.params.id });

        if (records.length > 0) {
          const mr = records[0].get('mr').properties;
          const p = records[0].get('p');
          const d = records[0].get('d');
          const nurses = records[0].get('nurses').filter(Boolean).map(n => n.properties);
          return res.json({
            ...mr,
            patient: p ? p.properties : null,
            doctor: d ? d.properties : null,
            assigned_nurses: nurses,
          });
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j record lookup failed, serving from store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const rec = store.medicalRecords.find(r => r.record_id === req.params.id);
    if (!rec) return res.status(404).json({ error: 'Medical record not found' });
    res.json(rec);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create medical record
router.post('/', async (req, res) => {
  try {
    const { diagnosis, date, patient_id, doctor_id } = req.body;
    const record_id = 'MR-' + uuidv4().slice(0, 8).toUpperCase();

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (p:Patient {patient_id: $patient_id}), (d:Doctor {staff_id: $doctor_id})
          CREATE (mr:MedicalRecord {
            record_id: $record_id,
            diagnosis: $diagnosis,
            date: $date
          })
          CREATE (p)-[:HAS_RECORD]->(mr)
          CREATE (d)-[:CREATES]->(mr)
          RETURN mr, p, d
        `, { record_id, diagnosis, date, patient_id, doctor_id });

        if (records.length > 0) {
          const mr = records[0].get('mr').properties;
          const p = records[0].get('p');
          const d = records[0].get('d');
          const created = {
            ...mr,
            patient: p ? { patient_id: p.properties.patient_id, name: p.properties.name } : null,
            doctor: d ? { staff_id: d.properties.staff_id, name: d.properties.name } : null,
            assigned_nurses: [],
          };
          store.medicalRecords.unshift(created);
          return res.status(201).json(created);
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j create record failed, updating store');
      }
    }

    if (!allowFallback) return res.status(400).json({ error: 'Patient or doctor does not exist' });
    const pat = store.patients.find(p => p.patient_id === patient_id);
    const doc = store.doctors.find(d => d.staff_id === doctor_id);
    const newRecord = {
      record_id,
      diagnosis,
      date,
      patient: pat ? { patient_id: pat.patient_id, name: pat.name } : null,
      doctor: doc ? { staff_id: doc.staff_id, name: doc.name } : null,
      assigned_nurses: [],
    };
    store.medicalRecords.unshift(newRecord);
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update medical record
router.put('/:id', async (req, res) => {
  try {
    const { diagnosis, date } = req.body;

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (mr:MedicalRecord {record_id: $id})
          SET mr.diagnosis = $diagnosis, mr.date = $date
          RETURN mr
        `, { id: req.params.id, diagnosis, date });

        if (records.length > 0) {
          const updated = records[0].get('mr').properties;
          const idx = store.medicalRecords.findIndex(r => r.record_id === req.params.id);
          if (idx !== -1) {
            store.medicalRecords[idx] = { ...store.medicalRecords[idx], diagnosis, date };
          }
          return res.json(updated);
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j update record failed, updating store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const idx = store.medicalRecords.findIndex(r => r.record_id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Medical record not found' });
    store.medicalRecords[idx] = { ...store.medicalRecords[idx], diagnosis, date };
    res.json(store.medicalRecords[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE medical record
router.delete('/:id', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        await runQuery(`
          MATCH (mr:MedicalRecord {record_id: $id})
          DETACH DELETE mr
        `, { id: req.params.id });
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j delete record failed, updating store');
      }
    }

    store.medicalRecords = store.medicalRecords.filter(r => r.record_id !== req.params.id);
    res.json({ message: 'Medical record deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
