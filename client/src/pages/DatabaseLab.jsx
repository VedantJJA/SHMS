import { useEffect, useState } from 'react';
import api, { getPatients, getDoctors } from '../services/api';
import './DatabaseLab.css';

const nodeName = node => node?.name || node?.medicine_name || node?.dept_name || node?.record_id || node?.prescription_id || node?.room_no || node?.patient_id || node?.staff_id || '';
const nodeType = node => node.labels.find(label => label !== 'Staff') || 'Entity';
const colors = { Patient: '#38bdf8', MedicalRecord: '#a78bfa', Prescription: '#fbbf24', Room: '#fb923c', Doctor: '#34d399', Nurse: '#f472b6', Medicine: '#c4b5fd', Department: '#2dd4bf' };

function CareGraph({ graph }) {
  const columns = [[], [], [], []];
  for (const node of graph.nodes) {
    const type = nodeType(node);
    const column = type === 'Patient' ? 0 : ['MedicalRecord', 'Prescription', 'Room'].includes(type) ? 1 : type === 'Department' ? 3 : 2;
    columns[column].push(node);
  }
  const order = { Patient: 0, MedicalRecord: 1, Prescription: 2, Room: 3, Nurse: 4, Doctor: 5, Medicine: 6, Department: 7 };
  columns.forEach(column => column.sort((a, b) => order[nodeType(a)] - order[nodeType(b)]));
  const height = Math.max(330, ...columns.map(column => column.length * 90 + 60));
  const positions = new Map();
  columns.forEach((column, c) => column.forEach((node, i) => positions.set(node.id, { x: 115 + c * 255, y: (height / (column.length + 1)) * (i + 1) })));
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  return <>
    <div className="lab-graph-scroll">
      <svg viewBox={'0 0 1000 ' + height} className="lab-graph" role="img" aria-label="Patient care graph from Neo4j showing directed relationships">
        <defs><marker id="lab-arrow" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="#94a3b8" /></marker></defs>
        {graph.links.map(link => {
          const source = positions.get(link.source), target = positions.get(link.target);
          if (!source || !target) return null;
          const direction = target.x >= source.x ? 1 : -1;
          const x1 = source.x + direction * 90, x2 = target.x - direction * 94;
          return <g key={link.id}><line x1={x1} y1={source.y} x2={x2} y2={target.y} stroke="#64748b" markerEnd="url(#lab-arrow)" /><text x={(x1 + x2) / 2} y={(source.y + target.y) / 2 - 7} textAnchor="middle" fill="#cbd5e1" fontSize="9">{link.type}</text></g>;
        })}
        {graph.nodes.map(node => {
          const position = positions.get(node.id), type = nodeType(node);
          return <g key={node.id} transform={'translate(' + (position.x - 90) + ',' + (position.y - 27) + ')'}>
            <title>{type}: {nodeName(node)}</title>
            <rect width="180" height="54" rx="9" fill="#172337" stroke={colors[type] || '#94a3b8'} />
            <text x="90" y="18" textAnchor="middle" fill={colors[type] || '#94a3b8'} fontSize="10">{type}</text>
            <text x="90" y="38" textAnchor="middle" fill="#f1f5f9" fontSize="11">{nodeName(node).slice(0, 26)}</text>
          </g>;
        })}
      </svg>
    </div>
    <details className="lab-details"><summary>Read the relationships as a table ({graph.links.length})</summary>
      <div className="lab-table-scroll"><table className="data-table"><thead><tr><th>From</th><th>Relationship</th><th>To</th></tr></thead><tbody>{graph.links.map(link => <tr key={link.id}><td>{nodeName(nodes.get(link.source))}</td><td><code>{link.type}</code></td><td>{nodeName(nodes.get(link.target))}</td></tr>)}</tbody></table></div>
    </details>
  </>;
}

export default function DatabaseLab() {
  const [patients, setPatients] = useState([]), [doctors, setDoctors] = useState([]);
  const [patientId, setPatientId] = useState('PAT-001'), [doctorId, setDoctorId] = useState('DOC-001');
  const [date, setDate] = useState('2026-10-20');
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([getPatients(), getDoctors()]).then(([p, d]) => {
      if (active) { setPatients(p.data); setDoctors(d.data); }
    }).catch(error => { if (active) setError(error.response?.data?.error || 'Could not load database entities'); });
    return () => { active = false; };
  }, []);

  async function runQueries(event) {
    event.preventDefault();
    setBusy(true); setError(''); setResult(null);
    try {
      const [graph, calendar, ledger] = await Promise.all([
        api.get('/lab/graph/' + encodeURIComponent(patientId)),
        api.get('/lab/calendar', { params: { doctor_id: doctorId, date } }),
        api.get('/lab/ledger/' + encodeURIComponent(patientId)),
      ]);
      setResult({ graph: graph.data, calendar: calendar.data, ledger: ledger.data });
    } catch (error) {
      setError(error.response?.data?.error || 'Query failed. Check that both database services are running.');
    } finally { setBusy(false); }
  }

  return <div className="lab">
    <div className="lab-intro"><span className="db-badge neo4j">NEO4J</span> <span className="db-badge cassandra">CASSANDRA</span>
      <h2>Follow the data</h2><p>Explore a patient's care connections and run partition-based queries against the live databases.</p>
    </div>
    <div className="lab-pipeline" aria-label="Application data pipeline"><span>React interface</span><b>→</b><span>Express API</span><b>→</b><span>Cypher → Neo4j<br />CQL → Cassandra</span><b>→</b><span>Persistent records</span></div>
    <form className="lab-controls" onSubmit={runQueries}>
      <label>Patient<select className="form-select" value={patientId} onChange={event => setPatientId(event.target.value)} disabled={busy} required>{patients.map(patient => <option key={patient.patient_id} value={patient.patient_id}>{patient.name} ({patient.patient_id})</option>)}</select></label>
      <label>Doctor<select className="form-select" value={doctorId} onChange={event => setDoctorId(event.target.value)} disabled={busy} required>{doctors.map(doctor => <option key={doctor.staff_id} value={doctor.staff_id}>{doctor.name}</option>)}</select></label>
      <label>Appointment date<input className="form-input" type="date" value={date} onChange={event => setDate(event.target.value)} disabled={busy} required /></label>
      <button className="btn btn-primary" disabled={busy || !patients.length || !doctors.length}>{busy ? 'Running queries…' : 'Run live queries'}</button>
    </form>
    {error && <p role="alert" className="lab-error">{error}</p>}
    {!result && !error && <div className="lab-empty">Choose a patient and doctor, then run the queries to inspect actual database results.</div>}
    {result && <>
      <section className="table-container lab-section"><div className="table-header"><h3 className="table-title">Patient care graph</h3><span className="db-badge neo4j">{result.graph.nodes.length} NODES · {result.graph.links.length} RELATIONSHIPS</span></div>
        <p className="lab-description">Neo4j stores care relationships directly. Follow the arrows from the patient to records, prescriptions, staff and departments.</p>
        <CareGraph graph={result.graph} />
        <details className="lab-details"><summary>Cypher query and parameters</summary><pre>{result.graph.query}</pre><pre>{JSON.stringify(result.graph.parameters, null, 2)}</pre></details>
      </section>
      <section className="table-container lab-section"><div className="table-header"><h3 className="table-title">Doctor calendar</h3><span className="db-badge cassandra">LIVE CQL RESULT</span></div>
        <p className="lab-description">Partition key: <code>doctor_id</code>. Clustering columns: <code>date, time, appointment_id</code>. The query selects a doctor's partition and the requested date.</p>
        <pre>{result.calendar.query}</pre><p className="lab-description">Parameters: {JSON.stringify(result.calendar.parameters)}</p>
        <div className="lab-table-scroll"><table className="data-table"><thead><tr><th>Appointment</th><th>Patient</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>{result.calendar.rows.length ? result.calendar.rows.map(row => <tr key={row.appointment_id}><td>{row.appointment_id}</td><td>{row.patient_name}</td><td>{row.date}</td><td>{row.time}</td><td>{row.status}</td></tr>) : <tr><td colSpan="5">No appointments match this doctor and date.</td></tr>}</tbody></table></div>
      </section>
      <section className="table-container lab-section"><div className="table-header"><h3 className="table-title">Patient billing ledger</h3><span className="db-badge cassandra">LIVE CQL RESULT</span></div>
        <p className="lab-description">Partition key: <code>patient_id</code>. Each bill is stored by patient and separately by bill ID. The API maintains both copies.</p>
        <pre>{result.ledger.query}</pre><p className="lab-description">Parameters: {JSON.stringify(result.ledger.parameters)}</p>
        <div className="lab-table-scroll"><table className="data-table"><thead><tr><th>Bill</th><th>Appointment</th><th>Amount</th><th>Payment</th></tr></thead><tbody>{result.ledger.rows.length ? result.ledger.rows.map(row => <tr key={row.bill_id}><td>{row.bill_id}</td><td>{row.appointment_id}</td><td>₹{Number(row.amount).toFixed(2)}</td><td>{row.payment_status}</td></tr>) : <tr><td colSpan="4">No bills for this patient.</td></tr>}</tbody></table></div>
      </section>
      <div className="lab-note"><strong>How the hybrid model connects</strong><p>Patient and doctor IDs link Neo4j entities to Cassandra appointments. The API coordinates these operations. There is no automatic synchronization or transaction across the two databases; copied names are snapshots taken when an appointment or bill is created.</p></div>
    </>}
  </div>;
}
