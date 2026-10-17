const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { runQuery, isNeo4jAvailable } = require('../config/neo4j');
const store = require('../data/store');
const { allowFallback } = require('../config/runtime');

// GET all nurses
router.get('/', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (n:Nurse)
          OPTIONAL MATCH (n)-[:WORKS_IN]->(dept:Department)
          RETURN n, dept
          ORDER BY n.name
        `);

        const nurses = records.map(record => {
          const nurse = record.get('n').properties;
          const dept = record.get('dept');
          return {
            ...nurse,
            department: dept ? dept.properties : null,
          };
        });

        return res.json(nurses);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j nurses query failed, serving from store');
      }
    }
    res.json(store.nurses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET nurse by ID
router.get('/:id', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (n:Nurse {staff_id: $id})
          OPTIONAL MATCH (n)-[:WORKS_IN]->(dept:Department)
          OPTIONAL MATCH (n)-[:ASSIGNED_TO]->(mr:MedicalRecord)
          RETURN n, dept, collect(mr) as records
        `, { id: req.params.id });

        if (records.length > 0) {
          const nurse = records[0].get('n').properties;
          const dept = records[0].get('dept');
          const medRecords = records[0].get('records').filter(Boolean).map(r => r.properties);
          return res.json({ ...nurse, department: dept ? dept.properties : null, medical_records: medRecords });
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j nurse lookup failed, serving from store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const nurse = store.nurses.find(n => n.staff_id === req.params.id);
    if (!nurse) return res.status(404).json({ error: 'Nurse not found' });
    res.json(nurse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create nurse
router.post('/', async (req, res) => {
  try {
    const { name, hire_date, salary, shift, dept_id } = req.body;
    const staff_id = 'NUR-' + uuidv4().slice(0, 8).toUpperCase();

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          CREATE (n:Nurse:Staff {
            staff_id: $staff_id,
            name: $name,
            hire_date: $hire_date,
            salary: $salary,
            shift: $shift
          })
          WITH n
          OPTIONAL MATCH (dept:Department {dept_id: $dept_id})
          FOREACH (_ IN CASE WHEN dept IS NOT NULL THEN [1] ELSE [] END |
            CREATE (n)-[:WORKS_IN]->(dept)
          )
          RETURN n, dept
        `, { staff_id, name, hire_date, salary: parseFloat(salary), shift, dept_id: dept_id || '' });

        const nurse = records[0].get('n').properties;
        const dept = records[0].get('dept');
        const created = { ...nurse, department: dept ? dept.properties : null };
        store.nurses.push(created);
        return res.status(201).json(created);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j create nurse failed, updating store');
      }
    }

    const dept = store.departments.find(d => d.dept_id === dept_id);
    const newNurse = {
      staff_id,
      name,
      hire_date,
      salary: parseFloat(salary),
      shift,
      department: dept ? { dept_id: dept.dept_id, dept_name: dept.dept_name } : null,
    };
    store.nurses.push(newNurse);
    res.status(201).json(newNurse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update nurse
router.put('/:id', async (req, res) => {
  try {
    const { name, hire_date, salary, shift, dept_id } = req.body;

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (n:Nurse {staff_id: $id})
          SET n.name = $name, n.hire_date = $hire_date, n.salary = $salary, n.shift = $shift
          WITH n
          OPTIONAL MATCH (n)-[r:WORKS_IN]->(:Department)
          DELETE r
          WITH n
          OPTIONAL MATCH (dept:Department {dept_id: $dept_id})
          FOREACH (_ IN CASE WHEN dept IS NOT NULL THEN [1] ELSE [] END |
            CREATE (n)-[:WORKS_IN]->(dept)
          )
          RETURN n, dept
        `, { id: req.params.id, name, hire_date, salary: parseFloat(salary), shift, dept_id: dept_id || '' });

        if (records.length > 0) {
          const nurse = records[0].get('n').properties;
          const dept = records[0].get('dept');
          const updated = { ...nurse, department: dept ? dept.properties : null };
          const idx = store.nurses.findIndex(n => n.staff_id === req.params.id);
          if (idx !== -1) store.nurses[idx] = updated;
          return res.json(updated);
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j update nurse failed, updating store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const idx = store.nurses.findIndex(n => n.staff_id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Nurse not found' });
    const dept = store.departments.find(d => d.dept_id === dept_id);
    store.nurses[idx] = {
      ...store.nurses[idx],
      name,
      hire_date,
      salary: parseFloat(salary),
      shift,
      department: dept ? { dept_id: dept.dept_id, dept_name: dept.dept_name } : store.nurses[idx].department,
    };
    res.json(store.nurses[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE nurse
router.delete('/:id', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        await runQuery(`
          MATCH (n:Nurse {staff_id: $id})
          DETACH DELETE n
        `, { id: req.params.id });
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j delete nurse failed, updating store');
      }
    }

    store.nurses = store.nurses.filter(n => n.staff_id !== req.params.id);
    res.json({ message: 'Nurse deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
