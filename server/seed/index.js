/**
 * Seed script for Smart Hospital Management System
 * Populates Neo4j with entities and relationships, and Cassandra with appointments and bills.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { runQuery, verifyConnection, initConstraints, closeDriver } = require('../config/neo4j');
const { initCassandra, getClient, closeClient } = require('../config/cassandra');

async function clearNeo4j() {
  console.log('[SEED] Clearing Neo4j database...');
  await runQuery('MATCH (n) DETACH DELETE n');
}

async function clearCassandra() {
  console.log('[SEED] Clearing Cassandra tables...');
  const client = getClient();
  const tables = [
    'appointments_by_doctor',
    'appointments_by_patient',
    'appointments_by_date',
    'appointments_by_id',
    'bills_by_patient',
    'bills_by_id',
  ];
  for (const table of tables) {
    try {
      await client.execute(`TRUNCATE ${table}`);
    } catch (e) {
      // Table may be empty
    }
  }
}

async function seedNeo4j() {
  console.log('[SEED] Seeding Neo4j entities and relationships...');

  // Departments
  const departments = [
    { dept_id: 'DEPT-001', dept_name: 'Cardiology', location: 'Building A, Floor 2' },
    { dept_id: 'DEPT-002', dept_name: 'Neurology', location: 'Building A, Floor 3' },
    { dept_id: 'DEPT-003', dept_name: 'Orthopedics', location: 'Building B, Floor 1' },
    { dept_id: 'DEPT-004', dept_name: 'Pediatrics', location: 'Building B, Floor 2' },
    { dept_id: 'DEPT-005', dept_name: 'Emergency', location: 'Building A, Floor 1' },
  ];

  for (const d of departments) {
    await runQuery(
      'CREATE (dept:Department {dept_id: $dept_id, dept_name: $dept_name, location: $location})',
      d
    );
  }
  console.log('  [+] Departments created');

  // Doctors
  const doctors = [
    { staff_id: 'DOC-001', name: 'Dr. Anika Sharma', hire_date: '2019-03-15', salary: 250000, specialization: 'Cardiologist', license_no: 'LIC-10234', dept_id: 'DEPT-001' },
    { staff_id: 'DOC-002', name: 'Dr. Rajesh Patel', hire_date: '2018-07-01', salary: 280000, specialization: 'Neurologist', license_no: 'LIC-10567', dept_id: 'DEPT-002' },
    { staff_id: 'DOC-003', name: 'Dr. Priya Reddy', hire_date: '2020-01-10', salary: 240000, specialization: 'Orthopedic Surgeon', license_no: 'LIC-10890', dept_id: 'DEPT-003' },
    { staff_id: 'DOC-004', name: 'Dr. Vikram Singh', hire_date: '2017-11-20', salary: 260000, specialization: 'Pediatrician', license_no: 'LIC-11234', dept_id: 'DEPT-004' },
    { staff_id: 'DOC-005', name: 'Dr. Meera Joshi', hire_date: '2021-05-01', salary: 230000, specialization: 'Emergency Medicine', license_no: 'LIC-11567', dept_id: 'DEPT-005' },
    { staff_id: 'DOC-006', name: 'Dr. Arjun Nair', hire_date: '2016-08-12', salary: 290000, specialization: 'Cardiac Surgeon', license_no: 'LIC-11890', dept_id: 'DEPT-001' },
  ];

  for (const d of doctors) {
    await runQuery(`
      CREATE (d:Doctor:Staff {
        staff_id: $staff_id, name: $name, hire_date: $hire_date,
        salary: $salary, specialization: $specialization, license_no: $license_no
      })
      WITH d
      MATCH (dept:Department {dept_id: $dept_id})
      CREATE (d)-[:WORKS_IN]->(dept)
    `, d);
  }

  // Set department heads
  await runQuery('MATCH (d:Doctor {staff_id: "DOC-001"}), (dept:Department {dept_id: "DEPT-001"}) CREATE (d)-[:HEADS]->(dept)');
  await runQuery('MATCH (d:Doctor {staff_id: "DOC-002"}), (dept:Department {dept_id: "DEPT-002"}) CREATE (d)-[:HEADS]->(dept)');
  await runQuery('MATCH (d:Doctor {staff_id: "DOC-003"}), (dept:Department {dept_id: "DEPT-003"}) CREATE (d)-[:HEADS]->(dept)');
  await runQuery('MATCH (d:Doctor {staff_id: "DOC-004"}), (dept:Department {dept_id: "DEPT-004"}) CREATE (d)-[:HEADS]->(dept)');
  await runQuery('MATCH (d:Doctor {staff_id: "DOC-005"}), (dept:Department {dept_id: "DEPT-005"}) CREATE (d)-[:HEADS]->(dept)');
  console.log('  [+] Doctors created with department assignments');

  // Nurses
  const nurses = [
    { staff_id: 'NUR-001', name: 'Pooja Kulkarni', hire_date: '2020-02-01', salary: 85000, shift: 'Morning', dept_id: 'DEPT-001' },
    { staff_id: 'NUR-002', name: 'Suresh Menon', hire_date: '2019-09-15', salary: 88000, shift: 'Evening', dept_id: 'DEPT-002' },
    { staff_id: 'NUR-003', name: 'Kavita Rao', hire_date: '2021-04-10', salary: 82000, shift: 'Night', dept_id: 'DEPT-003' },
    { staff_id: 'NUR-004', name: 'Deepak Verma', hire_date: '2018-11-05', salary: 92000, shift: 'Morning', dept_id: 'DEPT-004' },
    { staff_id: 'NUR-005', name: 'Sunita Deshmukh', hire_date: '2022-01-20', salary: 80000, shift: 'Night', dept_id: 'DEPT-005' },
    { staff_id: 'NUR-006', name: 'Rohan Gupta', hire_date: '2021-08-14', salary: 84000, shift: 'Evening', dept_id: 'DEPT-005' },
  ];

  for (const n of nurses) {
    await runQuery(`
      CREATE (n:Nurse:Staff {
        staff_id: $staff_id, name: $name, hire_date: $hire_date,
        salary: $salary, shift: $shift
      })
      WITH n
      MATCH (dept:Department {dept_id: $dept_id})
      CREATE (n)-[:WORKS_IN]->(dept)
    `, n);
  }
  console.log('  [+] Nurses created');

  // Rooms
  const rooms = [
    { room_no: '101', floor: 1, room_type: 'General', doctor_id: 'DOC-001' },
    { room_no: '102', floor: 1, room_type: 'General', doctor_id: 'DOC-004' },
    { room_no: '201', floor: 2, room_type: 'Private', doctor_id: 'DOC-002' },
    { room_no: '202', floor: 2, room_type: 'Private', doctor_id: 'DOC-003' },
    { room_no: 'ICU-1', floor: 3, room_type: 'ICU', doctor_id: 'DOC-001' },
    { room_no: 'ICU-2', floor: 3, room_type: 'ICU', doctor_id: 'DOC-005' },
  ];

  for (const r of rooms) {
    await runQuery(`
      CREATE (rm:Room {room_no: $room_no, floor: $floor, room_type: $room_type})
      WITH rm
      MATCH (d:Doctor {staff_id: $doctor_id})
      CREATE (d)-[:ATTENDS]->(rm)
    `, r);
  }
  console.log('  [+] Rooms created');

  // Patients
  const patients = [
    { patient_id: 'PAT-001', name: 'Rahul Deshmukh', dob: '1985-06-12', phone: '+91-98201-11223', blood_group: 'B+', room_no: '101', admit_date: '2026-10-10' },
    { patient_id: 'PAT-002', name: 'Sunita Verma', dob: '1992-03-24', phone: '+91-98202-22334', blood_group: 'O+', room_no: '201', admit_date: '2026-10-12' },
    { patient_id: 'PAT-003', name: 'Amitabh Sen', dob: '1978-11-05', phone: '+91-98203-33445', blood_group: 'A+', room_no: 'ICU-1', admit_date: '2026-10-14' },
    { patient_id: 'PAT-004', name: 'Deepa Nair', dob: '2001-08-19', phone: '+91-98204-44556', blood_group: 'AB+', room_no: '102', admit_date: '2026-09-01' },
    { patient_id: 'PAT-005', name: 'Vikramaditya Rao', dob: '1965-12-30', phone: '+91-98205-55667', blood_group: 'O-', room_no: null },
    { patient_id: 'PAT-006', name: 'Meenakshi Iyer', dob: '1995-04-17', phone: '+91-98206-66778', blood_group: 'A-', room_no: null },
  ];

  for (const p of patients) {
    await runQuery(`
      CREATE (pt:Patient {
        patient_id: $patient_id, name: $name, dob: $dob,
        phone: $phone, blood_group: $blood_group
      })
    `, p);

    if (p.room_no) {
      await runQuery(`
        MATCH (pt:Patient {patient_id: $patient_id}), (r:Room {room_no: $room_no})
        CREATE (pt)-[:ADMITTED_TO {admit_date: $admit_date, discharge_date: null}]->(r)
      `, p);
    }
  }
  console.log('  [+] Patients created with admissions');

  // Medicines
  const medicines = [
    { medicine_id: 'MED-001', medicine_name: 'Amoxicillin 500mg', unit_price: 12.50, stock_quantity: 120 },
    { medicine_id: 'MED-002', medicine_name: 'Metformin 850mg', unit_price: 8.00, stock_quantity: 200 },
    { medicine_id: 'MED-003', medicine_name: 'Atorvastatin 20mg', unit_price: 18.25, stock_quantity: 90 },
    { medicine_id: 'MED-004', medicine_name: 'Paracetamol 650mg', unit_price: 4.50, stock_quantity: 300 },
    { medicine_id: 'MED-005', medicine_name: 'Ceftriaxone 1g IV', unit_price: 35.00, stock_quantity: 40 },
    { medicine_id: 'MED-006', medicine_name: 'Ibuprofen 400mg', unit_price: 6.75, stock_quantity: 150 },
  ];

  for (const m of medicines) {
    await runQuery('CREATE (med:Medicine {medicine_id: $medicine_id, medicine_name: $medicine_name, unit_price: $unit_price, stock_quantity: toInteger($stock_quantity)})', m);
  }
  console.log('  [+] Medicines created');

  // Medical Records
  const medRecords = [
    { record_id: 'MR-001', diagnosis: 'Acute coronary syndrome, stable vitals post angiography', date: '2026-10-10', patient_id: 'PAT-001', doctor_id: 'DOC-001', nurse_id: 'NUR-001' },
    { record_id: 'MR-002', diagnosis: 'Migraine with aura, prescribed preventative prophylaxis', date: '2026-10-12', patient_id: 'PAT-002', doctor_id: 'DOC-002', nurse_id: 'NUR-002' },
    { record_id: 'MR-003', diagnosis: 'Severe respiratory distress, placed on non-invasive ventilation', date: '2026-10-14', patient_id: 'PAT-003', doctor_id: 'DOC-001', nurse_id: 'NUR-001' },
    { record_id: 'MR-004', diagnosis: 'Compound fracture right radius, open reduction internal fixation completed', date: '2026-09-01', patient_id: 'PAT-004', doctor_id: 'DOC-003', nurse_id: 'NUR-003' },
  ];

  for (const mr of medRecords) {
    await runQuery(`
      MATCH (p:Patient {patient_id: $patient_id}), (d:Doctor {staff_id: $doctor_id}), (n:Nurse {staff_id: $nurse_id})
      CREATE (rec:MedicalRecord {record_id: $record_id, diagnosis: $diagnosis, date: $date})
      CREATE (p)-[:HAS_RECORD]->(rec)
      CREATE (d)-[:CREATES]->(rec)
      CREATE (n)-[:ASSIGNED_TO]->(rec)
    `, mr);
  }
  console.log('  [+] Medical records created');

  // Prescriptions
  const prescriptions = [
    {
      prescription_id: 'PRX-001', date_issued: '2026-10-10', patient_id: 'PAT-001', doctor_id: 'DOC-001',
      items: [{ medicine_id: 'MED-003', dosage: '1 tablet nightly', quantity: 30 }],
    },
    {
      prescription_id: 'PRX-002', date_issued: '2026-10-12', patient_id: 'PAT-002', doctor_id: 'DOC-002',
      items: [
        { medicine_id: 'MED-004', dosage: '1 tablet as needed', quantity: 15 },
        { medicine_id: 'MED-006', dosage: '1 tablet after meals', quantity: 10 },
      ],
    },
    {
      prescription_id: 'PRX-003', date_issued: '2026-10-14', patient_id: 'PAT-003', doctor_id: 'DOC-001',
      items: [{ medicine_id: 'MED-005', dosage: '1g IV once daily', quantity: 7 }],
    },
  ];

  for (const pr of prescriptions) {
    await runQuery(`
      MATCH (p:Patient {patient_id: $patient_id}), (d:Doctor {staff_id: $doctor_id})
      CREATE (prx:Prescription {prescription_id: $prescription_id, date_issued: $date_issued})
      CREATE (p)-[:RECEIVES]->(prx)
      CREATE (d)-[:PRESCRIBES]->(prx)
    `, pr);

    for (const item of pr.items) {
      await runQuery(`
        MATCH (prx:Prescription {prescription_id: $prescription_id}), (m:Medicine {medicine_id: $medicine_id})
        CREATE (prx)-[:CONTAINS {dosage: $dosage, quantity: $quantity}]->(m)
      `, { prescription_id: pr.prescription_id, medicine_id: item.medicine_id, dosage: item.dosage, quantity: item.quantity });
    }
  }
  console.log('  [+] Prescriptions created with medicines');
}

async function seedCassandra() {
  console.log('[SEED] Seeding Cassandra tables...');
  const client = getClient();

  const appointments = [
    { appointment_id: 'APT-001', date: '2026-10-16', time: '09:00', doctor_id: 'DOC-001', doctor_name: 'Dr. Anika Sharma', patient_id: 'PAT-001', patient_name: 'Rahul Deshmukh', status: 'Completed' },
    { appointment_id: 'APT-002', date: '2026-10-16', time: '10:30', doctor_id: 'DOC-002', doctor_name: 'Dr. Rajesh Patel', patient_id: 'PAT-002', patient_name: 'Sunita Verma', status: 'Completed' },
    { appointment_id: 'APT-003', date: '2026-10-16', time: '14:00', doctor_id: 'DOC-003', doctor_name: 'Dr. Priya Reddy', patient_id: 'PAT-003', patient_name: 'Amitabh Sen', status: 'In-Progress' },
    { appointment_id: 'APT-004', date: '2026-10-17', time: '09:30', doctor_id: 'DOC-001', doctor_name: 'Dr. Anika Sharma', patient_id: 'PAT-004', patient_name: 'Deepa Nair', status: 'Scheduled' },
    { appointment_id: 'APT-005', date: '2026-10-17', time: '11:00', doctor_id: 'DOC-004', doctor_name: 'Dr. Vikram Singh', patient_id: 'PAT-005', patient_name: 'Vikramaditya Rao', status: 'Scheduled' },
    { appointment_id: 'APT-006', date: '2026-10-17', time: '15:00', doctor_id: 'DOC-005', doctor_name: 'Dr. Meera Joshi', patient_id: 'PAT-006', patient_name: 'Meenakshi Iyer', status: 'Scheduled' },
  ];

  appointments.push(
    { appointment_id: 'APT-007', date: '2026-10-20', time: '09:00', doctor_id: 'DOC-001', doctor_name: 'Dr. Anika Sharma', patient_id: 'PAT-001', patient_name: 'Rahul Deshmukh', status: 'Scheduled' },
    { appointment_id: 'APT-008', date: '2026-10-20', time: '10:00', doctor_id: 'DOC-002', doctor_name: 'Dr. Rajesh Patel', patient_id: 'PAT-002', patient_name: 'Sunita Verma', status: 'Scheduled' },
    { appointment_id: 'APT-009', date: '2026-10-20', time: '11:00', doctor_id: 'DOC-001', doctor_name: 'Dr. Anika Sharma', patient_id: 'PAT-003', patient_name: 'Amitabh Sen', status: 'Scheduled' }
  );

  for (const a of appointments) {
    const queries = [
      {
        query: 'INSERT INTO appointments_by_doctor (doctor_id, date, time, appointment_id, patient_id, patient_name, doctor_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        params: [a.doctor_id, a.date, a.time, a.appointment_id, a.patient_id, a.patient_name, a.doctor_name, a.status],
      },
      {
        query: 'INSERT INTO appointments_by_patient (patient_id, date, time, appointment_id, doctor_id, doctor_name, patient_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        params: [a.patient_id, a.date, a.time, a.appointment_id, a.doctor_id, a.doctor_name, a.patient_name, a.status],
      },
      {
        query: 'INSERT INTO appointments_by_date (date, time, appointment_id, doctor_id, doctor_name, patient_id, patient_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        params: [a.date, a.time, a.appointment_id, a.doctor_id, a.doctor_name, a.patient_id, a.patient_name, a.status],
      },
      {
        query: 'INSERT INTO appointments_by_id (appointment_id, date, time, doctor_id, doctor_name, patient_id, patient_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        params: [a.appointment_id, a.date, a.time, a.doctor_id, a.doctor_name, a.patient_id, a.patient_name, a.status],
      },
    ];
    await client.batch(queries, { prepare: true });
  }
  console.log('  [+] Appointments seeded');

  const bills = [
    { bill_id: 'BILL-001', patient_id: 'PAT-001', patient_name: 'Rahul Deshmukh', appointment_id: 'APT-001', amount: 450.00, payment_status: 'Paid', created_at: '2026-10-10T09:00:00.000Z' },
    { bill_id: 'BILL-002', patient_id: 'PAT-002', patient_name: 'Sunita Verma', appointment_id: 'APT-002', amount: 175.50, payment_status: 'Pending', created_at: '2026-10-12T11:30:00.000Z' },
    { bill_id: 'BILL-003', patient_id: 'PAT-003', patient_name: 'Amitabh Sen', appointment_id: 'APT-003', amount: 1200.00, payment_status: 'Pending', created_at: '2026-10-14T14:15:00.000Z' },
    { bill_id: 'BILL-004', patient_id: 'PAT-004', patient_name: 'Deepa Nair', appointment_id: 'APT-004', amount: 850.00, payment_status: 'Paid', created_at: '2026-09-07T16:00:00.000Z' },
  ];

  for (const b of bills) {
    const queries = [
      {
        query: 'INSERT INTO bills_by_patient (patient_id, bill_id, patient_name, appointment_id, amount, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [b.patient_id, b.bill_id, b.patient_name, b.appointment_id, b.amount, b.payment_status, b.created_at],
      },
      {
        query: 'INSERT INTO bills_by_id (bill_id, patient_id, patient_name, appointment_id, amount, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [b.bill_id, b.patient_id, b.patient_name, b.appointment_id, b.amount, b.payment_status, b.created_at],
      },
    ];
    await client.batch(queries, { prepare: true });
  }
  console.log('  [+] Bills seeded');
}

async function main() {
  console.log('\n[SEED] SHMS Database Seeding');
  console.log('========================================');

  try {
    const neoOk = await verifyConnection();
    const cassOk = await initCassandra();

    if (!neoOk && !cassOk) {
      console.log('[WARN] Both Neo4j and Cassandra are currently unreachable.');
      console.log('[INFO] Start Docker or local databases with "docker compose up -d" to seed.');
      throw new Error('Both database services must be running before importing the dataset');
    }
    if (!neoOk || !cassOk) throw new Error('Both database services must be running before importing the dataset');

    if (neoOk) {
      await initConstraints();
      await clearNeo4j();
      await seedNeo4j();
    }
    if (cassOk) {
      await clearCassandra();
      await seedCassandra();
    }

    console.log('\n[SUCCESS] Seed process completed successfully.\n');
  } catch (err) {
    console.error('\n[ERROR] Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await closeDriver();
    await closeClient();
  }
}

main();
