const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const neo4j = require('../config/neo4j');
const cassandra = require('../config/cassandra');
const base = process.env.SHMS_API_URL || 'http://127.0.0.1:5000/api';
const stateFile = path.join(__dirname, '../../.runtime/persistence-check.json');

async function api(method, route, body, expected = 200) {
  const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  assert.equal(response.status, expected, method + ' ' + route + ': ' + JSON.stringify(data));
  return data;
}
async function verify(ids) {
  const patient = await api('GET', '/patients/' + ids.patient_id);
  assert.equal(patient.name, 'Persistence Demo Patient');
  assert.equal((await api('GET', '/appointments/' + ids.appointment_id)).status, 'Completed');
  assert.equal((await api('GET', '/bills/' + ids.bill_id)).payment_status, 'Paid');
  assert.equal((await api('GET', '/medical-records/' + ids.record_id)).patient.patient_id, ids.patient_id);
  assert.equal((await api('GET', '/prescriptions/' + ids.prescription_id)).patient.patient_id, ids.patient_id);
  const graph = await api('GET', '/lab/graph/' + ids.patient_id);
  assert.ok(graph.links.some(link => link.type === 'HAS_RECORD'));
  assert.ok(graph.links.some(link => link.type === 'CONTAINS'));
  const client = cassandra.getClient();
  for (const [table, where, params] of [
    ['appointments_by_id', 'appointment_id = ?', [ids.appointment_id]],
    ['appointments_by_doctor', 'doctor_id = ? AND date = ? AND time = ? AND appointment_id = ?', ['DOC-001', '2026-10-20', '16:45', ids.appointment_id]],
    ['appointments_by_patient', 'patient_id = ? AND date = ? AND time = ? AND appointment_id = ?', [ids.patient_id, '2026-10-20', '16:45', ids.appointment_id]],
    ['appointments_by_date', 'date = ? AND time = ? AND appointment_id = ?', ['2026-10-20', '16:45', ids.appointment_id]],
  ]) {
    const result = await client.execute('SELECT * FROM ' + table + ' WHERE ' + where, params, { prepare: true });
    assert.equal(result.rows.length, 1, table); assert.equal(result.rows[0].status, 'Completed', table);
  }
  for (const [table, where, params] of [
    ['bills_by_id', 'bill_id = ?', [ids.bill_id]],
    ['bills_by_patient', 'patient_id = ? AND bill_id = ?', [ids.patient_id, ids.bill_id]],
  ]) {
    const result = await client.execute('SELECT * FROM ' + table + ' WHERE ' + where, params, { prepare: true });
    assert.equal(result.rows[0].payment_status, 'Paid', table);
  }
  console.log('PASS: graph, API records, four appointment copies and two bill copies agree');
}
async function cleanup(ids) {
  for (const [field, route] of [['bill_id', 'bills'], ['appointment_id', 'appointments'], ['prescription_id', 'prescriptions'], ['record_id', 'medical-records'], ['patient_id', 'patients']]) {
    if (ids[field]) await api('DELETE', '/' + route + '/' + ids[field]);
  }
  if (ids.patient_id) await api('GET', '/patients/' + ids.patient_id, undefined, 404);
  console.log('PASS: temporary demonstration records removed');
}

async function main() {
  const status = await api('GET', '/status');
  assert.equal(status.mode, 'live'); assert.equal(status.fallback_enabled, false);
  assert.ok(await neo4j.verifyConnection()); assert.ok(await cassandra.initCassandra());
  if (process.argv.includes('--verify-and-cleanup')) {
    const ids = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    await verify(ids); await cleanup(ids); fs.unlinkSync(stateFile);
    console.log('PASS: the records persisted across API restart');
    return;
  }
  const ids = {};
  try {
    const patient = await api('POST', '/patients', { name: 'Persistence Demo Patient', dob: '2000-01-01', phone: '0000000000', blood_group: 'O+' }, 201);
    ids.patient_id = patient.patient_id;
    await api('POST', '/patients/' + ids.patient_id + '/admit', { room_no: '202', admit_date: '2026-10-20' });
    await api('PUT', '/patients/' + ids.patient_id + '/discharge', { room_no: '202', discharge_date: '2026-10-20' });
    const discharged = await api('GET', '/patients/' + ids.patient_id);
    assert.ok(discharged.admissions.some(admission => admission.room_no === '202' && admission.discharge_date === '2026-10-20'));
    const appointment = await api('POST', '/appointments', { patient_id: ids.patient_id, doctor_id: 'DOC-001', date: '2026-10-20', time: '16:45' }, 201);
    ids.appointment_id = appointment.appointment_id;
    assert.equal(appointment.patient_name, 'Persistence Demo Patient');
    await api('PUT', '/appointments/' + ids.appointment_id + '/status', { status: 'Completed' });
    const record = await api('POST', '/medical-records', { patient_id: ids.patient_id, doctor_id: 'DOC-001', date: '2026-10-20', diagnosis: 'Synthetic lab demonstration only' }, 201);
    ids.record_id = record.record_id;
    await api('POST', '/prescriptions', { patient_id: ids.patient_id, doctor_id: 'DOC-001', date_issued: '2026-10-20', medicines: [{ medicine_id: 'MISSING', dosage: 'Demo only', quantity: 1 }] }, 400);
    const prescription = await api('POST', '/prescriptions', { patient_id: ids.patient_id, doctor_id: 'DOC-001', date_issued: '2026-10-20', medicines: [{ medicine_id: 'MED-004', dosage: 'Demonstration entry', quantity: 2 }] }, 201);
    ids.prescription_id = prescription.prescription_id;
    assert.equal(prescription.patient.name, 'Persistence Demo Patient');
    const bill = await api('POST', '/bills', { patient_id: ids.patient_id, appointment_id: ids.appointment_id, amount: 250, payment_status: 'Pending' }, 201);
    ids.bill_id = bill.bill_id;
    await api('PUT', '/bills/' + ids.bill_id + '/status', { payment_status: 'Paid' });
    await verify(ids);
    if (process.argv.includes('--keep')) {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(ids, null, 2));
      console.log('Restart the API, then run: npm run test:live -- --verify-and-cleanup');
    } else { await cleanup(ids); }
  } catch (error) {
    await cleanup(ids).catch(cleanupError => console.error('Cleanup requires attention:', cleanupError.message));
    throw error;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await neo4j.closeDriver(); await cassandra.closeClient(); });
