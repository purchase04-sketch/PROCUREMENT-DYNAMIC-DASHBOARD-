import React, { useRef, useState } from 'react';
import { Upload, ClipboardPaste, FileSpreadsheet, X } from 'lucide-react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const API = 'http://localhost:5000/api';

export default function UploadEngine({ collection, onDataUpdate }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [status, setStatus] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setStatus('Uploading...');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axios.post(`${API}/upload/${collection}`, fd);
      setStatus(`✅ ${res.data.message}`);
      if (onDataUpdate) onDataUpdate(res.data.data);
    } catch (e) {
      setStatus('❌ Upload failed: ' + (e.response?.data?.error || e.message));
    }
  };

  const handlePaste = async () => {
    if (!pasteText.trim()) return;
    setStatus('Processing paste...');
    try {
      const wb = XLSX.read(pasteText, { type: 'string' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const res = await axios.post(`${API}/paste/${collection}`, { rows });
      setStatus(`✅ ${res.data.message}`);
      setPasteText('');
      setPasteMode(false);
      if (onDataUpdate) onDataUpdate(res.data.data);
    } catch (e) {
      setStatus('❌ Paste failed: ' + (e.response?.data?.error || e.message));
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* File Upload */}
        <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, cursor: 'pointer',
            border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-dark-border)'}`,
            background: dragging ? 'rgba(99,102,241,0.1)' : 'transparent', transition: 'all 0.2s' }}>
          <Upload size={16} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Upload Excel/CSV</span>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => handleFile(e.target.files[0])} hidden />
        </div>

        {/* Paste Toggle */}
        <button className="btn-accent" onClick={() => setPasteMode(!pasteMode)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ClipboardPaste size={14} /> Paste Data
        </button>

        {status && <span style={{ fontSize: 12, fontWeight: 500, color: status.includes('✅') ? 'var(--color-success)' : status.includes('❌') ? 'var(--color-danger)' : 'var(--color-warning)' }}>{status}</span>}
      </div>

      {/* Paste Area */}
      {pasteMode && (
        <div className="fade-in" style={{ marginTop: 12, position: 'relative' }}>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
            placeholder="Paste tab-separated data here (copy from Excel)..." rows={5}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn-primary" onClick={handlePaste}>Import Pasted Data</button>
            <button className="btn-danger" onClick={() => { setPasteMode(false); setPasteText(''); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
