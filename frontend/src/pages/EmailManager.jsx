import React, { useState, useEffect } from 'react';
import { Mail, Edit3, Send, Plus, Trash2 } from 'lucide-react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API = 'http://localhost:5000/api';

export default function EmailManager() {
  const [emails, setEmails] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ recipient: '', recipientEmail: '', subject: '', body: '', type: 'Reminder', supplier: '', buyer: '' });

  const fetchEmails = async () => {
    try { const res = await axios.get(`${API}/emails`); setEmails(res.data); } catch { setEmails([]); }
  };

  useEffect(() => { fetchEmails(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/emails/${editing}`, form);
      } else {
        await axios.post(`${API}/emails`, { ...form, _id: uuidv4() });
      }
      setForm({ recipient: '', recipientEmail: '', subject: '', body: '', type: 'Reminder', supplier: '', buyer: '' });
      setEditing(null);
      fetchEmails();
    } catch (e) { console.error(e); }
  };

  const startEdit = (email) => {
    setEditing(email._id);
    setForm({ recipient: email.recipient || '', recipientEmail: email.recipientEmail || '', subject: email.subject || '', body: email.body || '', type: email.type || 'Reminder', supplier: email.supplier || '', buyer: email.buyer || '' });
  };

  const typeColors = { Reminder: '#6366f1', Escalation: '#ef4444', Urgency: '#f59e0b', VMI: '#06b6d4' };

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        ✉️ Email Automation Manager
      </h2>

      {/* Compose / Edit Form */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{editing ? '✏️ Edit Email Draft' : '📝 Compose New Email'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>Recipient Name</label>
            <input type="text" value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>Email</label>
            <input type="email" value={form.recipientEmail} onChange={e => setForm({ ...form, recipientEmail: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>Supplier</label>
            <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>Type</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ width: '100%' }}>
              <option>Reminder</option>
              <option>Escalation</option>
              <option>Urgency</option>
              <option>VMI</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>Subject</label>
          <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>Body</label>
          <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={5} style={{ width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Send size={14} /> {editing ? 'Update Draft' : 'Save Draft'}
          </button>
          {editing && <button className="btn-danger" onClick={() => { setEditing(null); setForm({ recipient: '', recipientEmail: '', subject: '', body: '', type: 'Reminder', supplier: '', buyer: '' }); }}>Cancel</button>}
        </div>
      </div>

      {/* Email List */}
      <div className="glass-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📬 Email Drafts & History ({emails.length})</h3>
        {emails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
            <Mail size={40} style={{ margin: '0 auto 12px', display: 'block' }} />
            <p>No email drafts yet. Compose one above or let AI generate drafts automatically.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {emails.map((e, i) => (
              <div key={e._id || i} style={{ padding: 14, borderRadius: 12, border: '1px solid var(--color-dark-border)', background: 'rgba(30,41,59,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: `${typeColors[e.type] || '#6366f1'}25`, color: typeColors[e.type] || '#6366f1' }}>{e.type}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: e.status === 'Sent' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: e.status === 'Sent' ? '#10b981' : '#f59e0b' }}>{e.status}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.subject || 'No Subject'}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>To: {e.recipient || 'N/A'} ({e.recipientEmail || 'N/A'})</div>
                </div>
                <button onClick={() => startEdit(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-light)' }}>
                  <Edit3 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
