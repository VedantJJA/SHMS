import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Nurses from './pages/Nurses';
import Departments from './pages/Departments';
import Rooms from './pages/Rooms';
import Appointments from './pages/Appointments';
import MedicalRecords from './pages/MedicalRecords';
import Prescriptions from './pages/Prescriptions';
import Medicines from './pages/Medicines';
import Bills from './pages/Bills';
import DatabaseLab from './pages/DatabaseLab';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a2332',
            color: '#f1f5f9',
            border: '1px solid #1e2d3d',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#1a2332' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#1a2332' } },
        }}
      />
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Header />
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/doctors" element={<Doctors />} />
              <Route path="/nurses" element={<Nurses />} />
              <Route path="/departments" element={<Departments />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/medical-records" element={<MedicalRecords />} />
              <Route path="/prescriptions" element={<Prescriptions />} />
              <Route path="/medicines" element={<Medicines />} />
              <Route path="/bills" element={<Bills />} />
              <Route path="/database-lab" element={<DatabaseLab />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
