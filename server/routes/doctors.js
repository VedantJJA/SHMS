const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { runQuery, isNeo4jAvailable } = require('../config/neo4j');
const store = require('../data/store');
const { allowFallback } = require('../config/runtime');

// GET all doctors
router.get('/', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (d:Doctor)
          OPTIONAL MATCH (d)-[:WORKS_IN]->(dept:Department)
          OPTIONAL MATCH (d)-[:HEADS]->(hDept:Department)
          RETURN d, dept, hDept
          ORDER BY d.name
        `);

        const doctors = records.map(record => {
          const doc = record.get('d').properties;
          const dept = record.get('dept');
          const hDept = record.get('hDept');
          return {
            ...doc,
            department: dept ? dept.properties : null,
            heads_department: hDept ? hDept.properties : null,
          };
        });

        return res.json(doctors);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j doctors query failed, serving from store');
      }
    }
    res.json(store.doctors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET doctor by ID
router.get('/:id', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (d:Doctor {staff_id: $id})
          OPTIONAL MATCH (d)-[:WORKS_IN]->(dept:Department)
          OPTIONAL MATCH (d)-[:CREATES]->(mr:MedicalRecord)
          OPTIONAL MATCH (d)-[:ATTENDS]->(r:Room)
          RETURN d, dept, collect(DISTINCT mr) as records, collect(DISTINCT r) as rooms
        `, { id: req.params.id });

        if (records.length > 0) {
          const doc = records[0].get('d').properties;
          const dept = records[0].get('dept');
          const medRecords = records[0].get('records').filter(Boolean).map(r => r.properties);
          const rooms = records[0].get('rooms').filter(Boolean).map(r => r.properties);
          return res.json({ ...doc, department: dept ? dept.properties : null, medical_records: medRecords, rooms });
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j doctor lookup failed, serving from store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const doc = store.doctors.find(d => d.staff_id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create doctor
router.post('/', async (req, res) => {
  try {
    const { name, hire_date, salary, specialization, license_no, dept_id } = req.body;
    const staff_id = 'DOC-' + uuidv4().slice(0, 8).toUpperCase();

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          CREATE (d:Doctor:Staff {
            staff_id: $staff_id,
            name: $name,
            hire_date: $hire_date,
            salary: $salary,
            specialization: $specialization,
            license_no: $license_no
          })
          WITH d
          OPTIONAL MATCH (dept:Department {dept_id: $dept_id})
          FOREACH (_ IN CASE WHEN dept IS NOT NULL THEN [1] ELSE [] END |
            CREATE (d)-[:WORKS_IN]->(dept)
          )
          RETURN d, dept
        `, { staff_id, name, hire_date, salary: parseFloat(salary), specialization, license_no, dept_id: dept_id || '' });

        const doc = records[0].get('d').properties;
        const dept = records[0].get('dept');
        const created = { ...doc, department: dept ? dept.properties : null };
        store.doctors.push(created);
        return res.status(201).json(created);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j create doctor failed, updating store');
      }
    }

    const dept = store.departments.find(d => d.dept_id === dept_id);
    const newDoc = {
      staff_id,
      name,
      hire_date,
      salary: parseFloat(salary),
      specialization,
      license_no,
      department: dept ? { dept_id: dept.dept_id, dept_name: dept.dept_name } : null,
    };
    store.doctors.push(newDoc);
    res.status(201).json(newDoc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update doctor
router.put('/:id', async (req, res) => {
  try {
    const { name, hire_date, salary, specialization, license_no, dept_id } = req.body;

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (d:Doctor {staff_id: $id})
          SET d.name = $name, d.hire_date = $hire_date, d.salary = $salary,
              d.specialization = $specialization, d.license_no = $license_no
          WITH d
          OPTIONAL MATCH (d)-[r:WORKS_IN]->(:Department)
          DELETE r
          WITH d
          OPTIONAL MATCH (dept:Department {dept_id: $dept_id})
          FOREACH (_ IN CASE WHEN dept IS NOT NULL THEN [1] ELSE [] END |
            CREATE (d)-[:WORKS_IN]->(dept)
          )
          RETURN d, dept
        `, { id: req.params.id, name, hire_date, salary: parseFloat(salary), specialization, license_no, dept_id: dept_id || '' });

        if (records.length > 0) {
          const doc = records[0].get('d').properties;
          const dept = records[0].get('dept');
          const updated = { ...doc, department: dept ? dept.properties : null };
          const idx = store.doctors.findIndex(d => d.staff_id === req.params.id);
          if (idx !== -1) store.doctors[idx] = updated;
          return res.json(updated);
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j update doctor failed, updating store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const idx = store.doctors.findIndex(d => d.staff_id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Doctor not found' });
    const dept = store.departments.find(d => d.dept_id === dept_id);
    store.doctors[idx] = {
      ...store.doctors[idx],
      name,
      hire_date,
      salary: parseFloat(salary),
      specialization,
      license_no,
      department: dept ? { dept_id: dept.dept_id, dept_name: dept.dept_name } : store.doctors[idx].department,
    };
    res.json(store.doctors[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE doctor
router.delete('/:id', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        await runQuery(`
          MATCH (d:Doctor {staff_id: $id})
          DETACH DELETE d
        `, { id: req.params.id });
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j delete doctor failed, updating store');
      }
    }

    store.doctors = store.doctors.filter(d => d.staff_id !== req.params.id);
    res.json({ message: 'Doctor deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
