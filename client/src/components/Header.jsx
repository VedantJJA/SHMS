import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { getDbStatus } from '../services/api';

const pageTitles = {
  '/': 'Dashboard',
  '/database-lab': 'Database Lab',
  '/patients': 'Patient Management',
  '/doctors': 'Doctor Management',
  '/nurses': 'Nurse Management',
  '/departments': 'Department Management',
  '/rooms': 'Room Management',
  '/appointments': 'Appointments',
  '/medical-records': 'Medical Records',
  '/prescriptions': 'Prescriptions',
  '/medicines': 'Medicine Inventory',
  '/bills': 'Billing and Payments',
};

export default function Header() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'SHMS';
  const [dbStatus, setDbStatus] = useState({ neo4j: false, cassandra: false, mode: 'unavailable' });

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  async function checkStatus() {
    try {
      const res = await getDbStatus();
      setDbStatus(res.data);
    } catch (err) {
      setDbStatus({ neo4j: false, cassandra: false, mode: 'unavailable' });
    }
  }

  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>
      <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div
          className="header-badge"
          style={{
            fontSize: '11px',
            padding: '4px 10px',
            borderRadius: '6px',
            border: dbStatus.neo4j ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid rgba(100, 116, 139, 0.4)',
            color: dbStatus.neo4j ? '#38bdf8' : '#94a3b8',
            background: 'var(--bg-card)',
          }}
          title={dbStatus.neo4j ? 'Neo4j Graph Database Connected' : dbStatus.mode === 'preview' ? 'Sample data preview only' : 'Neo4j database unavailable'}
        >
          {dbStatus.neo4j ? <FiCheckCircle style={{ color: '#10b981', marginRight: 4 }} /> : <FiAlertCircle style={{ color: '#f59e0b', marginRight: 4 }} />}
          Neo4j: {dbStatus.neo4j ? 'Live' : dbStatus.mode === 'preview' ? 'Preview' : 'Offline'}
        </div>

        <div
          className="header-badge"
          style={{
            fontSize: '11px',
            padding: '4px 10px',
            borderRadius: '6px',
            border: dbStatus.cassandra ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(100, 116, 139, 0.4)',
            color: dbStatus.cassandra ? '#34d399' : '#94a3b8',
            background: 'var(--bg-card)',
          }}
          title={dbStatus.cassandra ? 'Apache Cassandra Connected' : dbStatus.mode === 'preview' ? 'Sample data preview only' : 'Cassandra database unavailable'}
        >
          {dbStatus.cassandra ? <FiCheckCircle style={{ color: '#10b981', marginRight: 4 }} /> : <FiAlertCircle style={{ color: '#f59e0b', marginRight: 4 }} />}
          Cassandra: {dbStatus.cassandra ? 'Live' : dbStatus.mode === 'preview' ? 'Preview' : 'Offline'}
        </div>
      </div>
    </header>
  );
}
