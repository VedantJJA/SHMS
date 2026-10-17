const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const { once } = require('node:events');

function load(file, overrides) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    module, exports: module.exports, process: { env: {} }, console: { log() {} },
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : require(name),
  }, { filename: file });
  return module.exports;
}

function route(file, { execute = async () => ({ rows: [] }), batch = async () => {}, query } = {}) {
  const store = { appointments: [{ appointment_id: 'APT-001', status: 'Scheduled' }], bills: [], patients: [{ patient_id: 'PAT-001', name: 'Old name' }], doctors: [] };
  const router = load('routes/' + file + '.js', {
    '../config/runtime': { allowFallback: false },
    '../middleware/databases': { requireDatabases: () => (_req, _res, next) => next() },
    '../config/cassandra': { getClient: () => ({ execute, batch }), isCassandraAvailable: () => true },
    '../config/neo4j': { isNeo4jAvailable: () => true, runQuery: query || (async () => [{ get: () => 'Current name' }]) },
    '../data/store': store,
  });
  return { router, store };
}

async function request(router, method, url, body) {
  const app = express(); app.use(express.json()); app.use(router);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + url, {
      method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  } finally { await new Promise(resolve => server.close(resolve)); }
}

const appointment = { patient_id: 'PAT-001', doctor_id: 'DOC-001', date: '2026-10-20', time: '09:00' };

test('fresh Cassandra initialization creates all six tables before reporting live', async () => {
  const queries = [];
  class Client { async connect() {} async shutdown() {} async execute(query) { queries.push(query); return { rows: [] }; } }
  const config = load('config/cassandra.js', { 'cassandra-driver': { Client }, dotenv: { config() {} } });
  assert.equal(await config.initCassandra(), true);
  assert.equal(queries.filter(query => query.includes('CREATE TABLE')).length, 6);
  assert.equal(config.isCassandraAvailable(), true);
});

test('Cassandra schema failure cannot report a live database', async () => {
  class Client { async connect() {} async shutdown() {} async execute(query) { if (query.includes('CREATE TABLE')) throw new Error('DDL failed'); } }
  const config = load('config/cassandra.js', { 'cassandra-driver': { Client }, dotenv: { config() {} } });
  assert.equal(await config.initCassandra(), false);
  assert.equal(config.isCassandraAvailable(), false);
});

test('strict middleware rejects offline databases rather than allowing fallback', () => {
  const guard = load('middleware/databases.js', {
    '../config/neo4j': { isNeo4jAvailable: () => false }, '../config/cassandra': { isCassandraAvailable: () => true }, '../config/runtime': { allowFallback: false },
  });
  const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
  guard.requireDatabases('neo4j')({}, res, () => assert.fail('must not call next'));
  assert.equal(res.code, 503); assert.equal(res.data.source, 'unavailable');
});

test('failed appointment persistence returns an error and does not mutate memory', async () => {
  const { router, store } = route('appointments', { batch: async () => { throw new Error('write failed'); } });
  const result = await request(router, 'POST', '/', appointment);
  assert.equal(result.status, 500); assert.equal(store.appointments.length, 1);
});

test('a live appointment lookup never resurrects a seed-only record', async () => {
  const { router } = route('appointments');
  assert.equal((await request(router, 'GET', '/APT-001')).status, 404);
});

test('appointment status update requires an existing persistent record', async () => {
  const { router } = route('appointments');
  assert.equal((await request(router, 'PUT', '/APT-001/status', { status: 'Completed' })).status, 404);
});

test('appointment status update writes all four copies and returns the database row', async () => {
  let updates = 0;
  const { router } = route('appointments', { execute: async () => ({ rows: [{ ...appointment, appointment_id: 'APT-live' }] }), batch: async queries => { updates = queries.length; } });
  const result = await request(router, 'PUT', '/APT-live/status', { status: 'Completed' });
  assert.equal(result.status, 200); assert.equal(updates, 4); assert.equal(result.data.status, 'Completed');
});

test('appointment names come from Neo4j instead of stale seeded names', async () => {
  const { router } = route('appointments');
  const result = await request(router, 'POST', '/', appointment);
  assert.equal(result.status, 201); assert.equal(result.data.patient_name, 'Current name');
});

test('invalid appointment time and unknown status are rejected', async () => {
  const { router } = route('appointments');
  assert.equal((await request(router, 'POST', '/', { ...appointment, time: '29:90' })).status, 400);
  assert.equal((await request(router, 'PUT', '/APT-001/status', { status: 'anything' })).status, 400);
});

test('billing rejects invalid amounts and mismatched appointment ownership', async () => {
  const { router } = route('bills', { execute: async () => ({ rows: [{ patient_id: 'someone-else' }] }) });
  assert.equal((await request(router, 'POST', '/', { patient_id: 'PAT-001', amount: -1 })).status, 400);
  assert.equal((await request(router, 'POST', '/', { patient_id: 'PAT-001', appointment_id: 'APT-001', amount: 100 })).status, 400);
});

test('billing status update persists both query tables', async () => {
  let writes = 0;
  const { router } = route('bills', { execute: async () => ({ rows: [{ bill_id: 'BILL-live', patient_id: 'PAT-001' }] }), batch: async queries => { writes = queries.length; } });
  const result = await request(router, 'PUT', '/BILL-live/status', { payment_status: 'Paid' });
  assert.equal(result.status, 200); assert.equal(writes, 2); assert.equal(result.data.payment_status, 'Paid');
});

test('prescription creation does not return success after a database failure', async () => {
  const { router } = route('prescriptions', { query: async () => { throw new Error('database failed'); } });
  const result = await request(router, 'POST', '/', { patient_id: 'PAT-001', doctor_id: 'DOC-001', date_issued: '2026-10-20', medicines: [{ medicine_id: 'MED-001', dosage: 'demo', quantity: 1 }] });
  assert.equal(result.status, 500);
});

test('a persisted discharge returns success instead of falling into a missing-record response', async () => {
  const { router } = route('patients', { query: async () => [{}] });
  const result = await request(router, 'PUT', '/PAT-live/discharge', { room_no: '202', discharge_date: '2026-10-20' });
  assert.equal(result.status, 200);
});

test('a missing admission cannot return a successful discharge', async () => {
  const { router } = route('patients', { query: async () => [] });
  const result = await request(router, 'PUT', '/PAT-live/discharge', { room_no: '202', discharge_date: '2026-10-20' });
  assert.equal(result.status, 404);
});

test('department details identify assigned doctors and nurses from Neo4j labels', async () => {
  let requestedId;
  const { router } = route('departments', { query: async (_query, params) => {
    requestedId = params.id;
    const fields = {
      dept: { properties: { dept_id: 'DEPT-test', dept_name: 'Test department' } },
      head_doctor: null,
      staff_members: [
        { labels: ['Staff', 'Doctor'], properties: { staff_id: 'DOC-test', name: 'Test doctor' } },
        { labels: ['Staff', 'Nurse'], properties: { staff_id: 'NUR-test', name: 'Test nurse', shift: 'Morning' } },
        null,
      ],
    };
    return [{ get: key => fields[key] }];
  } });
  const result = await request(router, 'GET', '/DEPT-test');
  assert.equal(result.status, 200);
  assert.equal(requestedId, 'DEPT-test');
  assert.equal(result.data.staff_members.length, 2);
  assert.equal(result.data.staff_members[0].name, 'Test doctor');
  assert.equal(result.data.staff_members[0].role, 'Doctor');
  assert.equal(result.data.staff_members[1].role, 'Nurse');
  assert.equal(result.data.staff_members[1].shift, 'Morning');
});

test('a department with no assigned staff returns an empty list', async () => {
  const { router } = route('departments', { query: async () => [{ get: key => ({
    dept: { properties: { dept_id: 'DEPT-empty' } }, head_doctor: null, staff_members: [],
  })[key] }] });
  const result = await request(router, 'GET', '/DEPT-empty');
  assert.equal(result.status, 200);
  assert.equal(result.data.staff_members.length, 0);
});

test('medicine creation saves a zero stock quantity instead of treating it as missing', async () => {
  const { router, store } = route('medicines', { query: async (_query, params) => [{ get: () => ({ properties: params }) }] });
  store.medicines = [];
  const result = await request(router, 'POST', '/', { medicine_name: 'Stock test', unit_price: 5, stock_quantity: 0 });
  assert.equal(result.status, 201);
  assert.equal(result.data.stock_quantity, 0);
});

test('medicine updates persist a whole-number stock quantity', async () => {
  let saved;
  const { router, store } = route('medicines', { query: async (_query, params) => {
    saved = params;
    return [{ get: () => ({ properties: { medicine_id: params.id, stock_quantity: params.stock_quantity } }) }];
  } });
  store.medicines = [];
  const result = await request(router, 'PUT', '/MED-stock', { medicine_name: 'Stock test', unit_price: 5, stock_quantity: '37' });
  assert.equal(result.status, 200);
  assert.equal(saved.id, 'MED-stock');
  assert.equal(saved.stock_quantity, 37);
  assert.equal(result.data.stock_quantity, 37);
});

test('medicine stock rejects missing, negative, fractional and nonnumeric values before writing', async () => {
  let writes = 0;
  const { router } = route('medicines', { query: async () => { writes++; return []; } });
  for (const quantity of [undefined, null, '', ' ', -1, 1.5, 'abc', true, Number.MAX_SAFE_INTEGER + 1]) {
    for (const [method, url] of [['POST', '/'], ['PUT', '/MED-stock']]) {
      const result = await request(router, method, url, { medicine_name: 'Stock test', unit_price: 5, stock_quantity: quantity });
      assert.equal(result.status, 400, String(quantity));
    }
  }
  assert.equal(writes, 0);
});
