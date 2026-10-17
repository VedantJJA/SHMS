const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { runQuery, isNeo4jAvailable } = require('../config/neo4j');
const store = require('../data/store');
const { allowFallback } = require('../config/runtime');

// GET all patients
router.get('/', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (p:Patient)
          OPTIONAL MATCH (p)-[a:ADMITTED_TO]->(r:Room)
          RETURN p, collect({room_no: r.room_no, admit_date: a.admit_date, discharge_date: a.discharge_date}) as admissions
          ORDER BY p.name
        `);

        const patients = records.map(record => {
          const p = record.get('p').properties;
          const admissions = record.get('admissions').filter(a => a.room_no);
          return { ...p, admissions };
        });

        return res.json(patients);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j patients query failed, serving from store');
      }
    }
    res.json(store.patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET patient by ID
router.get('/:id', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (p:Patient {patient_id: $id})
          OPTIONAL MATCH (p)-[a:ADMITTED_TO]->(r:Room)
          OPTIONAL MATCH (p)-[:HAS_RECORD]->(mr:MedicalRecord)
          OPTIONAL MATCH (p)-[:RECEIVES]->(pr:Prescription)
          RETURN p,
            collect(DISTINCT {room_no: r.room_no, admit_date: a.admit_date, discharge_date: a.discharge_date}) as admissions,
            collect(DISTINCT mr) as records,
            collect(DISTINCT pr) as prescriptions
        `, { id: req.params.id });

        if (records.length > 0) {
          const p = records[0].get('p').properties;
          const admissions = records[0].get('admissions').filter(a => a.room_no);
          const medRecords = records[0].get('records').filter(Boolean).map(r => r.properties);
          const prescriptions = records[0].get('prescriptions').filter(Boolean).map(pr => pr.properties);
          return res.json({ ...p, admissions, medical_records: medRecords, prescriptions });
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j patient lookup failed, serving from store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const patient = store.patients.find(p => p.patient_id === req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create patient
router.post('/', async (req, res) => {
  try {
    const { name, dob, phone, blood_group } = req.body;
    if (typeof name !== 'string' || !name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dob || '') || typeof phone !== 'string' || !phone.trim() || !['A+','A-','B+','B-','AB+','AB-','O+','O-'].includes(blood_group)) {
      return res.status(400).json({ error: 'Name, date of birth, phone and a valid blood group are required' });
    }
    const patient_id = 'PAT-' + uuidv4().slice(0, 8).toUpperCase();

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          CREATE (p:Patient {
            patient_id: $patient_id,
            name: $name,
            dob: $dob,
            phone: $phone,
            blood_group: $blood_group
          })
          RETURN p
        `, { patient_id, name, dob, phone, blood_group });

        const created = records[0].get('p').properties;
        store.patients.push({ ...created, admissions: [] });
        return res.status(201).json(created);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j create patient failed, updating store');
      }
    }

    const newPatient = { patient_id, name, dob, phone, blood_group, admissions: [] };
    store.patients.push(newPatient);
    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update patient
router.put('/:id', async (req, res) => {
  try {
    const { name, dob, phone, blood_group } = req.body;

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (p:Patient {patient_id: $id})
          SET p.name = $name, p.dob = $dob, p.phone = $phone, p.blood_group = $blood_group
          RETURN p
        `, { id: req.params.id, name, dob, phone, blood_group });

        if (records.length > 0) {
          const updated = records[0].get('p').properties;
          const idx = store.patients.findIndex(p => p.patient_id === req.params.id);
          if (idx !== -1) {
            store.patients[idx] = { ...store.patients[idx], ...updated };
          }
          return res.json(updated);
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j update patient failed, updating store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const idx = store.patients.findIndex(p => p.patient_id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Patient not found' });
    store.patients[idx] = { ...store.patients[idx], name, dob, phone, blood_group };
    res.json(store.patients[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE patient
router.delete('/:id', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        await runQuery(`
          MATCH (p:Patient {patient_id: $id})
          DETACH DELETE p
        `, { id: req.params.id });
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j delete patient failed, updating store');
      }
    }

    store.patients = store.patients.filter(p => p.patient_id !== req.params.id);
    res.json({ message: 'Patient deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST admit patient to room
router.post('/:id/admit', async (req, res) => {
  try {
    const { room_no, admit_date } = req.body;

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (p:Patient {patient_id: $id}), (r:Room {room_no: $room_no})
          CREATE (p)-[:ADMITTED_TO {admit_date: $admit_date, discharge_date: null}]->(r)
          RETURN p, r
        `, { id: req.params.id, room_no, admit_date });

        if (records.length > 0) {
          // Update store room and patient
          const p = store.patients.find(pt => pt.patient_id === req.params.id);
          if (p) {
            p.admissions.push({ room_no, admit_date, discharge_date: null });
          }
          const rm = store.rooms.find(r => r.room_no === room_no);
          if (rm) {
            rm.is_occupied = true;
            rm.current_patients.push({ patient_id: req.params.id, name: p?.name || 'Patient', admit_date });
          }
          return res.json({ message: 'Patient admitted successfully' });
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j admit failed, updating store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Patient or room not found' });
    const p = store.patients.find(pt => pt.patient_id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Patient not found' });
    p.admissions.push({ room_no, admit_date, discharge_date: null });

    const rm = store.rooms.find(r => r.room_no === room_no);
    if (rm) {
      rm.is_occupied = true;
      rm.current_patients = rm.current_patients || [];
      rm.current_patients.push({ patient_id: p.patient_id, name: p.name, admit_date });
    }

    res.json({ message: 'Patient admitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT discharge patient from room
router.put('/:id/discharge', async (req, res) => {
  try {
    const { room_no, discharge_date } = req.body;

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (p:Patient {patient_id: $id})-[a:ADMITTED_TO]->(r:Room {room_no: $room_no})
          WHERE a.discharge_date IS NULL
          SET a.discharge_date = $discharge_date
          RETURN p, r
        `, { id: req.params.id, room_no, discharge_date });
        if (records.length) return res.json({ message: 'Patient discharged successfully' });
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j discharge failed, updating store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const p = store.patients.find(pt => pt.patient_id === req.params.id);
    if (p) {
      const adm = p.admissions.find(a => a.room_no === room_no && !a.discharge_date);
      if (adm) adm.discharge_date = discharge_date;
    }

    const rm = store.rooms.find(r => r.room_no === room_no);
    if (rm) {
      rm.current_patients = rm.current_patients.filter(cp => cp.patient_id !== req.params.id);
      rm.is_occupied = rm.current_patients.length > 0;
    }

    res.json({ message: 'Patient discharged successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
