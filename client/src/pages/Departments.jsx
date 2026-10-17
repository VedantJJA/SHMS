import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiActivity, FiUserCheck, FiMapPin, FiUsers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { getDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment, setDeptHead, getDoctors } from '../services/api';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create / Edit department modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ dept_name: '', location: '' });

  // Head doctor modal
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [headDoctorId, setHeadDoctorId] = useState('');
  const [staffDepartment, setStaffDepartment] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');

  useEffect(() => {
    if (!staffDepartment) return;
    let active = true;
    getDepartment(staffDepartment.dept_id).then(response => {
      if (active) setStaffMembers(response.data.staff_members || []);
    }).catch(error => {
      if (active) setStaffError(error.response?.data?.error || 'Failed to load department staff');
    }).finally(() => {
      if (active) setStaffLoading(false);
    });
    return () => { active = false; };
  }, [staffDepartment]);

  function openStaff(department) {
    setStaffMembers([]);
    setStaffError('');
    setStaffLoading(true);
    setStaffDepartment(department);
  }

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [deptRes, docRes] = await Promise.all([getDepartments(), getDoctors()]);
      setDepartments(deptRes.data);
      setDoctors(docRes.data);
    } catch (err) {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ dept_name: '', location: '' });
    setShowModal(true);
  }

  function openEdit(dept) {
    setEditing(dept);
    setForm({ dept_name: dept.dept_name, location: dept.location });
    setShowModal(true);
  }

  function openHeadModal(dept) {
    setSelectedDept(dept);
    setHeadDoctorId(dept.head_doctor?.staff_id || '');
    setShowHeadModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await updateDepartment(editing.dept_id, form);
        toast.success('Department updated');
      } else {
        await createDepartment(form);
        toast.success('Department created');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    }
  }

  async function handleSetHead(e) {
    e.preventDefault();
    if (!headDoctorId) {
      toast.error('Please select a doctor');
      return;
    }
    try {
      await setDeptHead(selectedDept.dept_id, { doctor_id: headDoctorId });
      toast.success('Department head updated');
      setShowHeadModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to set head doctor');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      await deleteDepartment(id);
      toast.success('Department deleted');
      load();
    } catch (err) {
      toast.error('Failed to delete department');
    }
  }

  if (loading) {
    return <div className="loading-spinner"><div className="spinner"></div></div>;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="db-badge neo4j">[Neo4j] Graph DB</span>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Entities (:Department) and (:Staff)-[:WORKS_IN], (:Doctor)-[:HEADS]
          </span>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3 className="table-title">Departments ({departments.length})</h3>
          <button className="btn btn-primary" onClick={openCreate}>
            <FiPlus /> Add Department
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Department Name</th>
              <th>Location</th>
              <th>Head Doctor (Graph Rel)</th>
              <th>Staff Members</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  <FiActivity style={{ fontSize: 32 }} />
                  <p>No departments found</p>
                </td>
              </tr>
            ) : (
              departments.map((d) => (
                <tr key={d.dept_id}>
                  <td>
                    <code style={{ color: 'var(--accent-secondary)', fontSize: 12 }}>{d.dept_id}</code>
                  </td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {d.dept_name}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <FiMapPin style={{ color: 'var(--accent-secondary)' }} /> {d.location}
                    </span>
                  </td>
                  <td>
                    {d.head_doctor ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="badge badge-purple">
                          <FiUserCheck style={{ marginRight: 4 }} />
                          {d.head_doctor.name}
                        </span>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '2px 6px' }}
                          onClick={() => openHeadModal(d)}
                          title="Change Head Doctor"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => openHeadModal(d)}
                      >
                        + Assign Head
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openStaff(d)}
                      aria-label={'View staff in ' + d.dept_name}
                    >
                      <FiUsers style={{ marginRight: 4 }} />
                      {d.staff_count ?? 0} Staff · View
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(d)} title="Edit">
                        <FiEdit2 />
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(d.dept_id)} title="Delete">
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {staffDepartment && (
        <Modal
          title={'Staff in ' + staffDepartment.dept_name}
          onClose={() => setStaffDepartment(null)}
          footer={<button className="btn btn-secondary" onClick={() => setStaffDepartment(null)}>Close</button>}
        >
          {staffLoading ? <p role="status">Loading department staff...</p> : staffError ? (
            <p role="alert">{staffError}</p>
          ) : staffMembers.length === 0 ? <p>No staff assigned to this department.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" aria-label={'Staff in ' + staffDepartment.dept_name}>
                <thead><tr><th>Staff ID</th><th>Name</th><th>Role</th><th>Specialization / Shift</th></tr></thead>
                <tbody>{staffMembers.map(member => (
                  <tr key={member.staff_id}>
                    <td>{member.staff_id}</td>
                    <td>{member.name}</td>
                    <td>{member.role}</td>
                    <td>{member.specialization || (member.shift ? member.shift + ' shift' : '—')}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {/* Create / Edit Department Modal */}
      {showModal && (
        <Modal
          title={editing ? 'Edit Department' : 'Add New Department'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Update' : 'Create'}</button>
            </>
          }
        >
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Department Name</label>
              <input
                className="form-input"
                value={form.dept_name}
                onChange={(e) => setForm({ ...form, dept_name: e.target.value })}
                required
                placeholder="e.g. Cardiology, Neurology, Pediatrics"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Location / Floor / Wing</label>
              <input
                className="form-input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
                placeholder="e.g. Building A - 3rd Floor"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Set Head Doctor Modal */}
      {showHeadModal && (
        <Modal
          title={`Assign Head for ${selectedDept?.dept_name}`}
          onClose={() => setShowHeadModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowHeadModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSetHead}>Save Head Doctor</button>
            </>
          }
        >
          <form onSubmit={handleSetHead}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Select a doctor to appoint as head of the department. This creates a <code>[:HEADS]</code> relationship in Neo4j.
            </p>
            <div className="form-group">
              <label className="form-label">Select Doctor</label>
              <select
                className="form-select"
                value={headDoctorId}
                onChange={(e) => setHeadDoctorId(e.target.value)}
                required
              >
                <option value="">-- Choose Doctor --</option>
                {doctors.map((doc) => (
                  <option key={doc.staff_id} value={doc.staff_id}>
                    {doc.name} - {doc.specialization} ({doc.staff_id})
                  </option>
                ))}
              </select>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
