const express = require('express');
const router = express.Router();
const { runQuery, isNeo4jAvailable } = require('../config/neo4j');
const store = require('../data/store');
const { allowFallback } = require('../config/runtime');

// GET all rooms
router.get('/', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (r:Room)
          OPTIONAL MATCH (p:Patient)-[a:ADMITTED_TO]->(r)
          WHERE a.discharge_date IS NULL
          OPTIONAL MATCH (d:Doctor)-[:ATTENDS]->(r)
          RETURN r,
            collect(DISTINCT {patient_id: p.patient_id, name: p.name, admit_date: a.admit_date}) as current_patients,
            collect(DISTINCT {doctor_id: d.staff_id, name: d.name}) as attending_doctors
          ORDER BY r.floor, r.room_no
        `);

        const rooms = records.map(record => {
          const r = record.get('r').properties;
          const patients = record.get('current_patients').filter(cp => cp.patient_id);
          const doctors = record.get('attending_doctors').filter(ad => ad.doctor_id);
          return { ...r, current_patients: patients, attending_doctors: doctors, is_occupied: patients.length > 0 };
        });

        return res.json(rooms);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j rooms query failed, serving from store');
      }
    }
    res.json(store.rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET room by room_no
router.get('/:room_no', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (r:Room {room_no: $room_no})
          OPTIONAL MATCH (p:Patient)-[a:ADMITTED_TO]->(r)
          OPTIONAL MATCH (d:Doctor)-[:ATTENDS]->(r)
          RETURN r,
            collect(DISTINCT {patient_id: p.patient_id, name: p.name, admit_date: a.admit_date, discharge_date: a.discharge_date}) as admissions,
            collect(DISTINCT d) as doctors
        `, { room_no: req.params.room_no });

        if (records.length > 0) {
          const r = records[0].get('r').properties;
          const admissions = records[0].get('admissions').filter(a => a.patient_id);
          const doctors = records[0].get('doctors').filter(Boolean).map(d => d.properties);
          return res.json({ ...r, admissions, doctors });
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j room lookup failed, serving from store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const room = store.rooms.find(r => r.room_no === req.params.room_no);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create room
router.post('/', async (req, res) => {
  try {
    const { room_no, floor, room_type } = req.body;

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          CREATE (r:Room {
            room_no: $room_no,
            floor: $floor,
            room_type: $room_type
          })
          RETURN r
        `, { room_no, floor: parseInt(floor), room_type });

        const created = records[0].get('r').properties;
        store.rooms.push({ ...created, is_occupied: false, current_patients: [], attending_doctors: [] });
        return res.status(201).json(created);
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j create room failed, updating store');
      }
    }

    const newRoom = {
      room_no,
      floor: parseInt(floor),
      room_type,
      is_occupied: false,
      current_patients: [],
      attending_doctors: [],
    };
    store.rooms.push(newRoom);
    res.status(201).json(newRoom);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update room
router.put('/:room_no', async (req, res) => {
  try {
    const { floor, room_type } = req.body;

    if (isNeo4jAvailable()) {
      try {
        const records = await runQuery(`
          MATCH (r:Room {room_no: $room_no})
          SET r.floor = $floor, r.room_type = $room_type
          RETURN r
        `, { room_no: req.params.room_no, floor: parseInt(floor), room_type });

        if (records.length > 0) {
          const updated = records[0].get('r').properties;
          const idx = store.rooms.findIndex(r => r.room_no === req.params.room_no);
          if (idx !== -1) {
            store.rooms[idx] = { ...store.rooms[idx], floor: parseInt(floor), room_type };
          }
          return res.json(updated);
        }
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j update room failed, updating store');
      }
    }

    if (!allowFallback) return res.status(404).json({ error: 'Record not found' });
    const idx = store.rooms.findIndex(r => r.room_no === req.params.room_no);
    if (idx === -1) return res.status(404).json({ error: 'Room not found' });
    store.rooms[idx] = { ...store.rooms[idx], floor: parseInt(floor), room_type };
    res.json(store.rooms[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE room
router.delete('/:room_no', async (req, res) => {
  try {
    if (isNeo4jAvailable()) {
      try {
        await runQuery(`
          MATCH (r:Room {room_no: $room_no})
          DETACH DELETE r
        `, { room_no: req.params.room_no });
      } catch (err) {
        if (!allowFallback) throw err;
        console.log('[WARN] Neo4j delete room failed, updating store');
      }
    }

    store.rooms = store.rooms.filter(r => r.room_no !== req.params.room_no);
    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
