const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { runQuery, isNeo4jAvailable } = require('../config/neo4j');
const store = require('../data/store');
const { allowFallback } = require('../config/runtime');

// GET all departments
router.get('/', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (dept:Department)
          OPTIONAL MATCH (d:Doctor)-[:HEADS]->(dept)
          OPTIONAL MATCH (s:Staff)-[:WORKS_IN]->(dept)
          RETURN dept, d as head_doctor, count(DISTINCT s) as staff_count
          ORDER BY dept.dept_name
        `);

        const departments = records.map(record => {
          const dept = record.get('dept').properties;
          const head = record.get('head_doctor');
          return {
            ...dept,
            head_doctor: head ? head.properties : null,
            staff_count: record.get('staff_count').low || record.get('staff_count'),
          };
        });

        return res.json(departments);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j departments query failed, serving from store');
      }
    }
    res.json(store.departments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET department by ID
router.get('/:id', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (dept:Department {dept_id: $id})
          OPTIONAL MATCH (d:Doctor)-[:HEADS]->(dept)
          OPTIONAL MATCH (s:Staff)-[:WORKS_IN]->(dept)
          RETURN dept, d as head_doctor, collect(DISTINCT s) as staff_members
        `, { id: req.params.id });

        if (records.length > 0) {
          const dept = records[0].get('dept').properties;
          const head = records[0].get('head_doctor');
          const staff = records[0].get('staff_members').filter(Boolean).map(s => ({
            ...s.properties,
            role: s.labels.includes('Doctor') ? 'Doctor' : s.labels.includes('Nurse') ? 'Nurse' : 'Staff',
          }));
          return res.json({ ...dept, head_doctor: head ? head.properties : null, staff_members: staff });
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j department lookup failed, serving from store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const dept = store.departments.find(d => d.dept_id === req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const staff = [
      ...store.doctors.filter(member => member.department?.dept_id === req.params.id).map(member => ({ ...member, role: 'Doctor' })),
      ...store.nurses.filter(member => member.department?.dept_id === req.params.id).map(member => ({ ...member, role: 'Nurse' })),
    ];
    res.json({ ...dept, staff_members: staff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create department
router.post('/', async (req, res) => {
  try {
    const { dept_name, location } = req.body;
    const dept_id = 'DEPT-' + uuidv4().slice(0, 8).toUpperCase();

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          CREATE (dept:Department {
            dept_id: $dept_id,
            dept_name: $dept_name,
            location: $location
          })
          RETURN dept
        `, { dept_id, dept_name, location });

        const created = records[0].get('dept').properties;
        store.departments.push({ ...created, head_doctor: null, staff_count: 0 });
        return res.status(201).json(created);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j create department failed, updating store');
      }
    }

    const newDept = { dept_id, dept_name, location, head_doctor: null, staff_count: 0 };
    store.departments.push(newDept);
    res.status(201).json(newDept);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update department
router.put('/:id', async (req, res) => {
  try {
    const { dept_name, location } = req.body;

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (dept:Department {dept_id: $id})
          SET dept.dept_name = $dept_name, dept.location = $location
          RETURN dept
        `, { id: req.params.id, dept_name, location });

        if (records.length > 0) {
          const updated = records[0].get('dept').properties;
          const idx = store.departments.findIndex(d => d.dept_id === req.params.id);
          if (idx !== -1) {
            store.departments[idx] = { ...store.departments[idx], dept_name, location };
          }
          return res.json(updated);
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j update department failed, updating store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const idx = store.departments.findIndex(d => d.dept_id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Department not found' });
    store.departments[idx] = { ...store.departments[idx], dept_name, location };
    res.json(store.departments[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE department
router.delete('/:id', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        await runQuery(`
          MATCH (dept:Department {dept_id: $id})
          DETACH DELETE dept
        `, { id: req.params.id });
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j delete department failed, updating store');
      }
    }

    store.departments = store.departments.filter(d => d.dept_id !== req.params.id);
    res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST set department head
router.post('/:id/set-head', async (req, res) => {
  try {
    const { doctor_id } = req.body;

    if (isNeo4jAvailable()) {
      try {
        await runQuery(`
          MATCH (d:Doctor)-[h:HEADS]->(dept:Department {dept_id: $id})
          DELETE h
        `, { id: req.params.id });

        await runQuery(`
          MATCH (d:Doctor {staff_id: $doctor_id}), (dept:Department {dept_id: $id})
          CREATE (d)-[:HEADS]->(dept)
        `, { id: req.params.id, doctor_id });
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j set head failed, updating store');
      }
    }

    const dept = store.departments.find(d => d.dept_id === req.params.id);
    const doc = store.doctors.find(d => d.staff_id === doctor_id);
    if (dept && doc) {
      dept.head_doctor = { staff_id: doc.staff_id, name: doc.name };
    }

    res.json({ message: 'Department head set successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
