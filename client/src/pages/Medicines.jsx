import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiPackage, FiDollarSign, FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { getMedicines, createMedicine, updateMedicine, deleteMedicine } from '../services/api';

export default function Medicines() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ medicine_name: '', unit_price: '', stock_quantity: '' });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await getMedicines();
      setMedicines(res.data);
    } catch (err) {
      toast.error('Failed to load medicines');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ medicine_name: '', unit_price: '', stock_quantity: '' });
    setShowModal(true);
  }

  function openEdit(med) {
    setEditing(med);
    setForm({ medicine_name: med.medicine_name, unit_price: med.unit_price, stock_quantity: med.stock_quantity ?? '' });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await updateMedicine(editing.medicine_id, form);
        toast.success('Medicine updated');
      } else {
        await createMedicine(form);
        toast.success('Medicine added to catalog');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this medicine?')) return;
    try {
      await deleteMedicine(id);
      toast.success('Medicine deleted');
      load();
    } catch (err) {
      toast.error('Failed to delete medicine');
    }
  }

  const filtered = medicines.filter((m) =>
    m.medicine_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.medicine_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="loading-spinner"><div className="spinner"></div></div>;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="db-badge neo4j">[Neo4j] Graph DB</span>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Entity (:Medicine {`{medicine_id, medicine_name, unit_price, stock_quantity}`})
          </span>
        </div>
        <div className="search-bar" style={{ width: '280px' }}>
          <FiSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search medicine catalog..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3 className="table-title">Medicine Catalog ({filtered.length})</h3>
          <button className="btn btn-primary" onClick={openCreate}>
            <FiPlus /> Add Medicine
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Medicine ID</th>
              <th>Medicine Name</th>
              <th>Unit Price</th>
              <th>Stock Quantity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  <FiPackage style={{ fontSize: 32 }} />
                  <p>No medicines found</p>
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.medicine_id}>
                  <td>
                    <code style={{ color: 'var(--accent-secondary)', fontSize: 12 }}>{m.medicine_id}</code>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {m.medicine_name}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontWeight: 600, color: 'var(--accent-success)' }}>
                      <FiDollarSign style={{ fontSize: 13 }} /> {parseFloat(m.unit_price).toFixed(2)}
                    </span>
                  </td>
                  <td>{m.stock_quantity == null ? 'Not recorded' : m.stock_quantity + ' units'}</td>
                  <td>
                    <span className={'badge ' + (m.stock_quantity == null ? 'badge-info' : m.stock_quantity > 0 ? 'badge-success' : 'badge-danger')}>
                      {m.stock_quantity == null ? 'Unknown' : m.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(m)} title="Edit">
                        <FiEdit2 />
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(m.medicine_id)} title="Delete">
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

      {/* Add / Edit Medicine Modal */}
      {showModal && (
        <Modal
          title={editing ? `Edit ${editing.medicine_name}` : 'Add New Medicine'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" type="submit" form="medicine-form">{editing ? 'Update' : 'Create'}</button>
            </>
          }
        >
          <form id="medicine-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Medicine Name</label>
              <input
                className="form-input"
                value={form.medicine_name}
                onChange={(e) => setForm({ ...form, medicine_name: e.target.value })}
                required
                placeholder="e.g. Amoxicillin 500mg, Paracetamol"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                required
                placeholder="e.g. 15.50"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="medicine-stock">Stock Quantity (units)</label>
              <input
                id="medicine-stock"
                type="number"
                min="0"
                step="1"
                className="form-input"
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                required
                placeholder="e.g. 120"
              />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
