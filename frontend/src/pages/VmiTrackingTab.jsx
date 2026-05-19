import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import DataGrid from '../components/DataGrid';
import UploadEngine from '../components/UploadEngine';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API = 'http://localhost:5000/api';

const columns = [
  { field: 'supplier', headerName: 'Supplier', editable: true },
  { field: 'itemCode', headerName: 'Item Code', editable: true },
  { field: 'itemName', headerName: 'Item Name', editable: true },
  { field: 'buyer', headerName: 'Buyer', editable: true },
  { field: 'plannedVmi', headerName: 'Planned VMI', editable: true, type: 'numericColumn' },
  { field: 'actualVmi', headerName: 'Actual VMI', editable: true, type: 'numericColumn' },
  { field: 'gapQty', headerName: 'Gap Qty', editable: false, cellStyle: p => ({ fontWeight: 600, color: p.value > 0 ? '#ef4444' : '#10b981' }) },
  { field: 'vmiCompliance', headerName: 'VMI Compliance %', editable: false, cellStyle: p => ({ fontWeight: 600, color: p.value >= 90 ? '#10b981' : p.value >= 60 ? '#f59e0b' : '#ef4444' }) },
  { field: 'plant', headerName: 'Plant', editable: true },
  { field: 'commodity', headerName: 'Commodity', editable: true },
  { field: 'month', headerName: 'Month', editable: true },
  { field: 'year', headerName: 'Year', editable: true, type: 'numericColumn' },
];

export default function VmiTrackingTab() {
  const filters = useSelector(s => s.filters);
  const [data, setData] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (filters.buyer) params.buyer = filters.buyer;
      if (filters.supplier) params.supplier = filters.supplier;
      if (filters.month) params.month = filters.month;
      if (filters.year) params.year = filters.year;
      const res = await axios.get(`${API}/data/vmitracking`, { params });
      setData(res.data);
    } catch { setData([]); }
  }, [filters.buyer, filters.supplier, filters.month, filters.year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRowUpdate = async (row) => {
    try { const res = await axios.put(`${API}/data/vmitracking/${row._id}`, row); setData(res.data.data); } catch (e) { console.error(e); }
  };
  const onRowAdd = async () => {
    try { const res = await axios.post(`${API}/data/vmitracking`, { _id: uuidv4(), supplier: '', itemCode: '', plannedVmi: 0, actualVmi: 0, month: '', year: 2025 }); setData(res.data.data); } catch (e) { console.error(e); }
  };
  const onRowDelete = async (id) => {
    try { const res = await axios.delete(`${API}/data/vmitracking/${id}`); setData(res.data.data); } catch (e) { console.error(e); }
  };

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        ✅ VMI Tracking & Compliance
      </h2>
      <UploadEngine collection="vmitracking" onDataUpdate={setData} />
      <DataGrid rowData={data} columnDefs={columns} onRowUpdate={onRowUpdate} onRowAdd={onRowAdd} onRowDelete={onRowDelete} title="VMI Tracking Data" collection="vmitracking" />
    </div>
  );
}
