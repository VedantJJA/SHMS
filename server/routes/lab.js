const express = require('express');
const { runQuery } = require('../config/neo4j');
const { getClient } = require('../config/cassandra');
const { requireDatabases } = require('../middleware/databases');
const router = express.Router();

const graphQuery = `MATCH path = (p:Patient {patient_id: $patient_id})-[:HAS_RECORD|RECEIVES|CONTAINS|ADMITTED_TO*1..2]->()
RETURN path
UNION
MATCH path = (:Patient {patient_id: $patient_id})-[:HAS_RECORD]->(:MedicalRecord)<-[:CREATES|ASSIGNED_TO]-()
RETURN path
UNION
MATCH path = (:Patient {patient_id: $patient_id})-[:HAS_RECORD]->(:MedicalRecord)<-[:CREATES]-(:Doctor)-[:WORKS_IN]->(:Department)
RETURN path
UNION
MATCH path = (:Patient {patient_id: $patient_id})-[:RECEIVES]->(:Prescription)<-[:PRESCRIBES]-(:Doctor)
RETURN path
LIMIT 80`;

router.get('/graph/:patient_id', requireDatabases('neo4j'), async (req, res) => {
  try {
    const records = await runQuery(graphQuery, { patient_id: req.params.patient_id });
    const nodes = new Map();
    const links = new Map();
    const addNode = node => nodes.set(node.elementId, { id: node.elementId, labels: node.labels, ...node.properties });
    for (const record of records) {
      const path = record.get('path');
      addNode(path.start);
      for (const segment of path.segments) {
        addNode(segment.start);
        addNode(segment.end);
        const relationship = segment.relationship;
        links.set(relationship.elementId, {
          id: relationship.elementId, source: relationship.startNodeElementId,
          target: relationship.endNodeElementId, type: relationship.type, properties: relationship.properties,
        });
      }
    }
    // A newly registered patient can have no relationships yet.
    if (!nodes.size) {
      const result = await runQuery('MATCH (p:Patient {patient_id: $patient_id}) RETURN p', { patient_id: req.params.patient_id });
      if (!result.length) return res.status(404).json({ error: 'Patient not found' });
      addNode(result[0].get('p'));
    }
    res.json({ database: 'Neo4j', query: graphQuery, parameters: { patient_id: req.params.patient_id }, nodes: [...nodes.values()], links: [...links.values()] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/calendar', requireDatabases('cassandra'), async (req, res) => {
  const { doctor_id, date } = req.query;
  if (!doctor_id || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'Doctor and date are required' });
  const query = 'SELECT * FROM appointments_by_doctor WHERE doctor_id = ? AND date = ?';
  try {
    const result = await getClient().execute(query, [doctor_id, date], { prepare: true });
    res.json({ database: 'Cassandra', query, parameters: [doctor_id, date], partition_key: 'doctor_id', clustering_columns: ['date', 'time', 'appointment_id'], rows: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ledger/:patient_id', requireDatabases('cassandra'), async (req, res) => {
  const query = 'SELECT * FROM bills_by_patient WHERE patient_id = ?';
  try {
    const result = await getClient().execute(query, [req.params.patient_id], { prepare: true });
    res.json({ database: 'Cassandra', query, parameters: [req.params.patient_id], partition_key: 'patient_id', clustering_columns: ['bill_id'], rows: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
