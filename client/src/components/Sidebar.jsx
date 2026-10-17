import { NavLink } from 'react-router-dom';
import {
  FiGrid, FiUsers, FiUserCheck, FiActivity, FiCalendar,
  FiFileText, FiClipboard, FiPackage, FiHome, FiDollarSign
} from 'react-icons/fi';
import { FaUserNurse } from 'react-icons/fa';

const navItems = [
  { section: 'Overview' },
  { path: '/', label: 'Dashboard', icon: <FiGrid /> },

  { path: '/database-lab', label: 'Database Lab', icon: <FiActivity /> },

  { section: 'People' },
  { path: '/patients', label: 'Patients', icon: <FiUsers /> },
  { path: '/doctors', label: 'Doctors', icon: <FiUserCheck /> },
  { path: '/nurses', label: 'Nurses', icon: <FaUserNurse /> },

  { section: 'Hospital' },
  { path: '/departments', label: 'Departments', icon: <FiActivity /> },
  { path: '/rooms', label: 'Rooms', icon: <FiHome /> },

  { section: 'Clinical' },
  { path: '/appointments', label: 'Appointments', icon: <FiCalendar /> },
  { path: '/medical-records', label: 'Medical Records', icon: <FiFileText /> },
  { path: '/prescriptions', label: 'Prescriptions', icon: <FiClipboard /> },
  { path: '/medicines', label: 'Medicines', icon: <FiPackage /> },

  { section: 'Finance' },
  { path: '/bills', label: 'Billing', icon: <FiDollarSign /> },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <FiActivity style={{ color: '#ffffff', fontSize: 20 }} />
        </div>
        <div>
          <div className="sidebar-title">SHMS</div>
          <div className="sidebar-subtitle">Smart Hospital</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          if (item.section) {
            return <div key={i} className="nav-section-label">{item.section}</div>;
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              end={item.path === '/'}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
