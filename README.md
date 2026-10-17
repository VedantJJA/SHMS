# Smart Hospital Management System (SHMS)

A full-stack Hospital Management System built with React, Node.js, Express, and a dual Non-SQL database architecture combining Neo4j (Graph Database) and Apache Cassandra (Wide-Column Database).

---

## Why Neo4j and Cassandra (No SQL / No Mongo)?

| Database | Model | Role in SHMS | Why it is optimal |
| :--- | :--- | :--- | :--- |
| Neo4j | Graph Database | Entities and Complex Relationships (Doctors, Patients, Nurses, Departments, Rooms, Medical Records, Prescriptions, Medicines) | Highly connected data with arbitrary relationships ([:HEADS], [:WORKS_IN], [:ADMITTED_TO], [:CREATES], [:CONTAINS]). Graph patterns express patient care paths directly. Equivalent relational queries use joins; performance depends on the workload and indexes. |
| Apache Cassandra | Wide-Column Store | Query-oriented appointment schedules and patient billing lookups | Query-specific partitioned tables support known access patterns without joins. Duplication requires coordinated writes; this single-node demonstration does not establish distributed scalability or constant-time queries. |

---

## Architecture and Database Split

```
                              +---------------------------+
                              |      React Frontend       |
                              |     (Vite + Dark UI)      |
                              +-------------+-------------+
                                            | HTTP / REST
                                            v
                              +---------------------------+
                              |    Node.js Express API    |
                              |        (Port 5000)        |
                              +------+-------------+------+
                                     |             |
                Cypher (Bolt Protocol)             CQL (Native Protocol)
                                     |             |
                                     v             v
                           +--------------+   +-----------------------+
                           |    Neo4j     |   |   Apache Cassandra    |
                           |   Graph DB   |   |      Wide-Column      |
                           | (Port 7687)  |   |      (Port 9042)      |
                           +--------------+   +-----------------------+
```

### Neo4j Graph Model
- (:Doctor:Staff)-[:WORKS_IN]->(:Department)
- (:Doctor)-[:HEADS]->(:Department)
- (:Nurse:Staff)-[:WORKS_IN]->(:Department)
- (:Nurse)-[:ASSIGNED_TO]->(:MedicalRecord)
- (:Patient)-[:HAS_RECORD]->(:MedicalRecord)
- (:Doctor)-[:CREATES]->(:MedicalRecord)
- (:Doctor)-[:ATTENDS]->(:Room)
- (:Patient)-[:ADMITTED_TO {admit_date, discharge_date}]->(:Room)
- (:Patient)-[:RECEIVES]->(:Prescription)
- (:Doctor)-[:PRESCRIBES]->(:Prescription)
- (:Prescription)-[:CONTAINS {dosage, quantity}]->(:Medicine)

### Cassandra Partitioning Schemes
- appointments_by_date (PRIMARY KEY (date, time, appointment_id)) - Fast daily schedule lookup
- appointments_by_doctor (PRIMARY KEY (doctor_id, date, time, appointment_id)) - Doctor calendar
- appointments_by_patient (PRIMARY KEY (patient_id, date, time, appointment_id)) - Patient appointment history
- appointments_by_id (PRIMARY KEY (appointment_id)) - Direct lookup and status updates
- bills_by_patient (PRIMARY KEY (patient_id, bill_id)) - Patient billing ledger
- bills_by_id (PRIMARY KEY (bill_id)) - Invoice processing

---

## Quick Start Guide

### 1. Prerequisites
- Node.js 24 LTS (used for local validation)
- Docker Desktop for the portable database setup, or the configured WSL runtime. Persistent databases are required by default.

---

### 2. Start Databases with Docker Compose

Run the following in the project root:

```bash
docker compose up -d
```

- Neo4j Browser UI: http://localhost:7474 (User: neo4j, Password: password)
- Cassandra CQL: localhost:9042

---

### 3. Setup and Start Backend

```bash
cd server
npm install
npm run seed     # Seeds Neo4j and Cassandra if online
npm run dev      # Starts server on http://localhost:5000
```

---

### 4. Setup and Start Frontend

In a separate terminal:

```bash
cd client
npm install
npm run dev      # Starts Vite React app on http://localhost:3000
```

Open your browser at http://localhost:3000 to explore the Hospital Management System.

---

## Application Features and Pages

1. Dashboard: Live metrics, department distribution, today appointments, occupied room capacity, and active database status indicators.
2. Patients: Patient directory, medical history, blood group indicators, and admission statuses.
3. Doctors: Doctors catalog with specialization, license number, and assigned department.
4. Nurses: Nurse staffing, work shifts, and department assignments.
5. Departments: Hospital departments, staff count, and appointing head doctors.
6. Rooms and Beds: Real-time room occupancy, admission and discharge management with floor filters.
7. Appointments: Cassandra-powered scheduling, daily calendar filtering, and one-click billing generation.
8. Medical Records: Diagnoses, doctor creation relationships, and assigned nurses.
9. Prescriptions: Multi-medicine prescription builder with dosage, quantity, and unit prices.
10. Medicines Catalog: Drug inventory and unit prices in Neo4j.
11. Billing and Invoices: Cassandra-backed billing ledger, total invoiced/collected summaries, and payment status updates.

---

## REST API Reference

| Method | Endpoint | Database | Description |
| :--- | :--- | :--- | :--- |
| GET | /api/status | System | Live database connectivity status |
| GET | /api/dashboard/stats | Neo4j + Cassandra | Overview metrics |
| GET | /api/patients | Neo4j | List all patients with admissions |
| POST | /api/patients | Neo4j | Create patient |
| POST | /api/patients/:id/admit | Neo4j | Admit patient to room |
| PUT | /api/patients/:id/discharge | Neo4j | Discharge patient from room |
| GET | /api/doctors | Neo4j | List all doctors with departments |
| POST | /api/doctors | Neo4j | Add doctor and associate with department |
| GET | /api/departments | Neo4j | List departments and head doctors |
| POST | /api/departments/:id/set-head | Neo4j | Appoint doctor as head |
| GET | /api/rooms | Neo4j | List rooms and occupied patients |
| GET | /api/appointments | Cassandra | Query appointments by date/doctor/patient |
| POST | /api/appointments | Cassandra | Schedule appointment (denormalized write) |
| PUT | /api/appointments/:id/status | Cassandra | Update appointment status |
| GET | /api/medical-records | Neo4j | Get records with patient, doctor and nurses |
| POST | /api/prescriptions | Neo4j | Create prescription with medicines |
| GET | /api/medicines | Neo4j | Medicines catalog |
| GET | /api/bills | Cassandra | Get all invoices or filter by patient |
| POST | /api/bills | Cassandra | Create billing record |
| PUT | /api/bills/:id/status | Cassandra | Update payment status |

## Windows lab machine

The configured machine has a dedicated database runtime in the WSL user directory `~/.local/share/shms-lab-runtime`. The locally verified versions are Neo4j 5.26.0, Cassandra 5.0.6, Java 17 for Cassandra, and Node 24. The existing Docker Compose configuration is an alternative for another machine and uses Neo4j 5.14 and Cassandra 4.1; that container configuration was not exercised in this local run.

From PowerShell in the project directory:

```powershell
.\scripts\start-lab.ps1
```

The launcher uses the installed `kali-linux` WSL distribution, refreshes the private Cassandra broadcast address, and starts missing services in hidden processes. It does not reset hospital data. Logs and process IDs go to ignored `.runtime/`. This launcher requires the already installed SHMS WSL runtime and Node dependencies; it is not an installer for a new computer. Resolve conflicts if another application occupies ports 3000 or 5000.

Open `http://127.0.0.1:3000/database-lab`, select PAT-001 and DOC-001, choose 2026-10-20, and click **Run live queries**. The page shows the actual Neo4j graph, Cypher parameters, Cassandra calendar and billing rows, partition keys and clustering columns.

## Data ownership and pipeline

Neo4j owns patients, staff, departments, rooms, medical records, prescriptions and medicines. Cassandra owns appointments and bills. Shared patient and doctor IDs connect the stores in application code. There is no automatic cross-database synchronization, foreign key, or distributed transaction.

Appointment creation looks up patient and doctor names in Neo4j and writes four Cassandra query tables in a logged batch. Status changes update all four copies. Bills use two copies, by patient and by bill ID. Copied names are snapshots taken at creation time. Prescription creation, including medicine relationships, runs as one Neo4j statement so it cannot leave a partially created prescription when that statement fails.

The graph model and Cassandra schema are implemented in `server/seed/index.js` and `server/config/cassandra.js`. The synthetic initial dataset contains 6 patients, 6 doctors, 6 nurses, 5 departments, 6 rooms, 6 medicines, 4 medical records, 3 prescriptions, 9 appointments and 4 bills. Three appointments are scheduled for October 20.

`npm run seed` in `server` resets the dedicated SHMS graph and Cassandra tables before importing the dataset. Run it only when a reset is intended, with both services running and the environment pointing to this project. Import errors return a failing exit code.

## Persistent mode and verification

Persistent databases are required by default. Database errors propagate to the caller; failed operations cannot silently become successful writes to sample data. `/api/status` probes live Neo4j connectivity and Cassandra table access. `ALLOW_IN_MEMORY_FALLBACK=true` explicitly enables the legacy preview store. Preview data is not persistence evidence. The header distinguishes Live, Offline and Preview.

```powershell
npm --prefix server test
npm --prefix client run build
```

The regression tests use the built-in Node test runner and mocked failure paths. For independent live checks, set the connection environment to the running databases and execute:

```powershell
npm --prefix server run test:live
```

This creates synthetic temporary records, verifies graph relationships and all denormalized copies, then removes only those records. To verify persistence across an API restart:

```powershell
npm --prefix server run test:live -- --keep
# Restart only the SHMS API, leaving both databases running.
npm --prefix server run test:live -- --verify-and-cleanup
```

## Comparative analysis and implementation limits

Neo4j suits connected care-history questions because nodes and typed relationships map directly to the domain, and Cypher expresses multi-hop paths. Relational databases can answer equivalent questions using joins. Cassandra illustrates query-driven modeling and partition-based access at the cost of denormalized copies. Billing and strict appointment reservation are not automatically improved by moving away from relational transactions.

This mini-project does not enforce concurrent double-booking prevention, propagate name changes to historical snapshots, or coordinate deletions across both databases. Doctor and patient partitions span all dates; a larger deployment would need time buckets. General list and dashboard queries scan tables and are suitable only for the small demonstration dataset. Authentication, clinical decision support, production deployment and multi-node performance are outside this lab implementation.

References: [Neo4j property graph model](https://neo4j.com/docs/getting-started/graph-database/) and [Cassandra query-driven modeling](https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/intro.html).
