const store = {
  departments: [
    { dept_id: 'DEPT-001', dept_name: 'Cardiology', location: 'Building A, Floor 2', head_doctor: { staff_id: 'DOC-001', name: 'Dr. Anika Sharma' }, staff_count: 3 },
    { dept_id: 'DEPT-002', dept_name: 'Neurology', location: 'Building A, Floor 3', head_doctor: { staff_id: 'DOC-002', name: 'Dr. Rajesh Patel' }, staff_count: 2 },
    { dept_id: 'DEPT-003', dept_name: 'Orthopedics', location: 'Building B, Floor 1', head_doctor: { staff_id: 'DOC-003', name: 'Dr. Priya Reddy' }, staff_count: 2 },
    { dept_id: 'DEPT-004', dept_name: 'Pediatrics', location: 'Building B, Floor 2', head_doctor: { staff_id: 'DOC-004', name: 'Dr. Vikram Singh' }, staff_count: 2 },
    { dept_id: 'DEPT-005', dept_name: 'Emergency', location: 'Building A, Floor 1', head_doctor: { staff_id: 'DOC-005', name: 'Dr. Meera Joshi' }, staff_count: 3 },
  ],

  doctors: [
    { staff_id: 'DOC-001', name: 'Dr. Anika Sharma', hire_date: '2019-03-15', salary: 250000, specialization: 'Cardiologist', license_no: 'LIC-10234', department: { dept_id: 'DEPT-001', dept_name: 'Cardiology' } },
    { staff_id: 'DOC-002', name: 'Dr. Rajesh Patel', hire_date: '2018-07-01', salary: 280000, specialization: 'Neurologist', license_no: 'LIC-10567', department: { dept_id: 'DEPT-002', dept_name: 'Neurology' } },
    { staff_id: 'DOC-003', name: 'Dr. Priya Reddy', hire_date: '2020-01-10', salary: 240000, specialization: 'Orthopedic Surgeon', license_no: 'LIC-10890', department: { dept_id: 'DEPT-003', dept_name: 'Orthopedics' } },
    { staff_id: 'DOC-004', name: 'Dr. Vikram Singh', hire_date: '2017-11-20', salary: 260000, specialization: 'Pediatrician', license_no: 'LIC-11234', department: { dept_id: 'DEPT-004', dept_name: 'Pediatrics' } },
    { staff_id: 'DOC-005', name: 'Dr. Meera Joshi', hire_date: '2021-05-01', salary: 230000, specialization: 'Emergency Medicine', license_no: 'LIC-11567', department: { dept_id: 'DEPT-005', dept_name: 'Emergency' } },
    { staff_id: 'DOC-006', name: 'Dr. Arjun Nair', hire_date: '2016-08-12', salary: 290000, specialization: 'Cardiac Surgeon', license_no: 'LIC-11890', department: { dept_id: 'DEPT-001', dept_name: 'Cardiology' } },
  ],

  nurses: [
    { staff_id: 'NUR-001', name: 'Pooja Kulkarni', hire_date: '2020-02-01', salary: 85000, shift: 'Morning', department: { dept_id: 'DEPT-001', dept_name: 'Cardiology' } },
    { staff_id: 'NUR-002', name: 'Suresh Menon', hire_date: '2019-09-15', salary: 88000, shift: 'Evening', department: { dept_id: 'DEPT-002', dept_name: 'Neurology' } },
    { staff_id: 'NUR-003', name: 'Kavita Rao', hire_date: '2021-04-10', salary: 82000, shift: 'Night', department: { dept_id: 'DEPT-003', dept_name: 'Orthopedics' } },
    { staff_id: 'NUR-004', name: 'Deepak Verma', hire_date: '2018-11-05', salary: 92000, shift: 'Morning', department: { dept_id: 'DEPT-004', dept_name: 'Pediatrics' } },
    { staff_id: 'NUR-005', name: 'Sunita Deshmukh', hire_date: '2022-01-20', salary: 80000, shift: 'Night', department: { dept_id: 'DEPT-005', dept_name: 'Emergency' } },
    { staff_id: 'NUR-006', name: 'Rohan Gupta', hire_date: '2021-08-14', salary: 84000, shift: 'Evening', department: { dept_id: 'DEPT-005', dept_name: 'Emergency' } },
  ],

  patients: [
    {
      patient_id: 'PAT-001', name: 'Rahul Deshmukh', dob: '1985-06-12', phone: '+91-98201-11223', blood_group: 'B+',
      admissions: [{ room_no: '101', admit_date: '2026-10-10', discharge_date: null }],
    },
    {
      patient_id: 'PAT-002', name: 'Sunita Verma', dob: '1992-03-24', phone: '+91-98202-22334', blood_group: 'O+',
      admissions: [{ room_no: '201', admit_date: '2026-10-12', discharge_date: null }],
    },
    {
      patient_id: 'PAT-003', name: 'Amitabh Sen', dob: '1978-11-05', phone: '+91-98203-33445', blood_group: 'A+',
      admissions: [{ room_no: 'ICU-1', admit_date: '2026-10-14', discharge_date: null }],
    },
    {
      patient_id: 'PAT-004', name: 'Deepa Nair', dob: '2001-08-19', phone: '+91-98204-44556', blood_group: 'AB+',
      admissions: [{ room_no: '102', admit_date: '2026-09-01', discharge_date: '2026-09-07' }],
    },
    {
      patient_id: 'PAT-005', name: 'Vikramaditya Rao', dob: '1965-12-30', phone: '+91-98205-55667', blood_group: 'O-',
      admissions: [],
    },
    {
      patient_id: 'PAT-006', name: 'Meenakshi Iyer', dob: '1995-04-17', phone: '+91-98206-66778', blood_group: 'A-',
      admissions: [],
    },
  ],

  rooms: [
    {
      room_no: '101', floor: 1, room_type: 'General', is_occupied: true,
      current_patients: [{ patient_id: 'PAT-001', name: 'Rahul Deshmukh', admit_date: '2026-10-10' }],
      attending_doctors: [{ doctor_id: 'DOC-001', name: 'Dr. Anika Sharma' }],
    },
    {
      room_no: '102', floor: 1, room_type: 'General', is_occupied: false,
      current_patients: [],
      attending_doctors: [{ doctor_id: 'DOC-004', name: 'Dr. Vikram Singh' }],
    },
    {
      room_no: '201', floor: 2, room_type: 'Private', is_occupied: true,
      current_patients: [{ patient_id: 'PAT-002', name: 'Sunita Verma', admit_date: '2026-10-12' }],
      attending_doctors: [{ doctor_id: 'DOC-002', name: 'Dr. Rajesh Patel' }],
    },
    {
      room_no: '202', floor: 2, room_type: 'Private', is_occupied: false,
      current_patients: [],
      attending_doctors: [{ doctor_id: 'DOC-003', name: 'Dr. Priya Reddy' }],
    },
    {
      room_no: 'ICU-1', floor: 3, room_type: 'ICU', is_occupied: true,
      current_patients: [{ patient_id: 'PAT-003', name: 'Amitabh Sen', admit_date: '2026-10-14' }],
      attending_doctors: [{ doctor_id: 'DOC-001', name: 'Dr. Anika Sharma' }, { doctor_id: 'DOC-006', name: 'Dr. Arjun Nair' }],
    },
    {
      room_no: 'ICU-2', floor: 3, room_type: 'ICU', is_occupied: false,
      current_patients: [],
      attending_doctors: [{ doctor_id: 'DOC-005', name: 'Dr. Meera Joshi' }],
    },
  ],

  medicines: [
    { medicine_id: 'MED-001', medicine_name: 'Amoxicillin 500mg', unit_price: 12.50, stock_quantity: 120 },
    { medicine_id: 'MED-002', medicine_name: 'Metformin 850mg', unit_price: 8.00, stock_quantity: 200 },
    { medicine_id: 'MED-003', medicine_name: 'Atorvastatin 20mg', unit_price: 18.25, stock_quantity: 90 },
    { medicine_id: 'MED-004', medicine_name: 'Paracetamol 650mg', unit_price: 4.50, stock_quantity: 300 },
    { medicine_id: 'MED-005', medicine_name: 'Ceftriaxone 1g IV', unit_price: 35.00, stock_quantity: 40 },
    { medicine_id: 'MED-006', medicine_name: 'Ibuprofen 400mg', unit_price: 6.75, stock_quantity: 150 },
  ],

  medicalRecords: [
    {
      record_id: 'MR-001',
      date: '2026-10-10',
      diagnosis: 'Acute coronary syndrome, stable vitals post angiography',
      patient: { patient_id: 'PAT-001', name: 'Rahul Deshmukh' },
      doctor: { staff_id: 'DOC-001', name: 'Dr. Anika Sharma' },
      assigned_nurses: [{ staff_id: 'NUR-001', name: 'Pooja Kulkarni' }],
    },
    {
      record_id: 'MR-002',
      date: '2026-10-12',
      diagnosis: 'Migraine with aura, prescribed preventative prophylaxis',
      patient: { patient_id: 'PAT-002', name: 'Sunita Verma' },
      doctor: { staff_id: 'DOC-002', name: 'Dr. Rajesh Patel' },
      assigned_nurses: [{ staff_id: 'NUR-002', name: 'Suresh Menon' }],
    },
    {
      record_id: 'MR-003',
      date: '2026-10-14',
      diagnosis: 'Severe respiratory distress, placed on non-invasive ventilation',
      patient: { patient_id: 'PAT-003', name: 'Amitabh Sen' },
      doctor: { staff_id: 'DOC-001', name: 'Dr. Anika Sharma' },
      assigned_nurses: [{ staff_id: 'NUR-001', name: 'Pooja Kulkarni' }, { staff_id: 'NUR-005', name: 'Sunita Deshmukh' }],
    },
    {
      record_id: 'MR-004',
      date: '2026-09-01',
      diagnosis: 'Compound fracture right radius, open reduction internal fixation completed',
      patient: { patient_id: 'PAT-004', name: 'Deepa Nair' },
      doctor: { staff_id: 'DOC-003', name: 'Dr. Priya Reddy' },
      assigned_nurses: [{ staff_id: 'NUR-003', name: 'Kavita Rao' }],
    },
  ],

  prescriptions: [
    {
      prescription_id: 'PRX-001',
      date_issued: '2026-10-10',
      patient: { patient_id: 'PAT-001', name: 'Rahul Deshmukh' },
      doctor: { staff_id: 'DOC-001', name: 'Dr. Anika Sharma' },
      medicines: [
        { medicine_id: 'MED-003', medicine_name: 'Atorvastatin 20mg', unit_price: 18.25, dosage: '1 tablet nightly', quantity: 30 },
      ],
    },
    {
      prescription_id: 'PRX-002',
      date_issued: '2026-10-12',
      patient: { patient_id: 'PAT-002', name: 'Sunita Verma' },
      doctor: { staff_id: 'DOC-002', name: 'Dr. Rajesh Patel' },
      medicines: [
        { medicine_id: 'MED-004', medicine_name: 'Paracetamol 650mg', unit_price: 4.50, dosage: '1 tablet as needed', quantity: 15 },
        { medicine_id: 'MED-006', medicine_name: 'Ibuprofen 400mg', unit_price: 6.75, dosage: '1 tablet after meals', quantity: 10 },
      ],
    },
    {
      prescription_id: 'PRX-003',
      date_issued: '2026-10-14',
      patient: { patient_id: 'PAT-003', name: 'Amitabh Sen' },
      doctor: { staff_id: 'DOC-001', name: 'Dr. Anika Sharma' },
      medicines: [
        { medicine_id: 'MED-005', medicine_name: 'Ceftriaxone 1g IV', unit_price: 35.00, dosage: '1g IV once daily', quantity: 7 },
      ],
    },
  ],

  appointments: [
    {
      appointment_id: 'APT-001',
      date: new Date().toISOString().split('T')[0],
      time: '09:30',
      doctor_id: 'DOC-001',
      doctor_name: 'Dr. Anika Sharma',
      patient_id: 'PAT-001',
      patient_name: 'Rahul Deshmukh',
      status: 'Scheduled',
    },
    {
      appointment_id: 'APT-002',
      date: new Date().toISOString().split('T')[0],
      time: '11:00',
      doctor_id: 'DOC-002',
      doctor_name: 'Dr. Rajesh Patel',
      patient_id: 'PAT-002',
      patient_name: 'Sunita Verma',
      status: 'In-Progress',
    },
    {
      appointment_id: 'APT-003',
      date: new Date().toISOString().split('T')[0],
      time: '14:00',
      doctor_id: 'DOC-003',
      doctor_name: 'Dr. Priya Reddy',
      patient_id: 'PAT-004',
      patient_name: 'Deepa Nair',
      status: 'Completed',
    },
    {
      appointment_id: 'APT-004',
      date: new Date().toISOString().split('T')[0],
      time: '16:00',
      doctor_id: 'DOC-004',
      doctor_name: 'Dr. Vikram Singh',
      patient_id: 'PAT-005',
      patient_name: 'Vikramaditya Rao',
      status: 'Scheduled',
    },
    {
      appointment_id: 'APT-005',
      date: '2026-10-15',
      time: '10:00',
      doctor_id: 'DOC-005',
      doctor_name: 'Dr. Meera Joshi',
      patient_id: 'PAT-006',
      patient_name: 'Meenakshi Iyer',
      status: 'Completed',
    },
  ],

  bills: [
    {
      bill_id: 'BILL-001',
      patient_id: 'PAT-001',
      patient_name: 'Rahul Deshmukh',
      appointment_id: 'APT-001',
      amount: 450.00,
      payment_status: 'Paid',
      created_at: '2026-10-10T09:00:00.000Z',
    },
    {
      bill_id: 'BILL-002',
      patient_id: 'PAT-002',
      patient_name: 'Sunita Verma',
      appointment_id: 'APT-002',
      amount: 175.50,
      payment_status: 'Pending',
      created_at: '2026-10-12T11:30:00.000Z',
    },
    {
      bill_id: 'BILL-003',
      patient_id: 'PAT-003',
      patient_name: 'Amitabh Sen',
      appointment_id: 'APT-003',
      amount: 1200.00,
      payment_status: 'Pending',
      created_at: '2026-10-14T14:15:00.000Z',
    },
    {
      bill_id: 'BILL-004',
      patient_id: 'PAT-004',
      patient_name: 'Deepa Nair',
      appointment_id: 'APT-004',
      amount: 850.00,
      payment_status: 'Paid',
      created_at: '2026-09-07T16:00:00.000Z',
    },
  ],
};

module.exports = store;
