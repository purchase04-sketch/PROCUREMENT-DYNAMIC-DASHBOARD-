import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import DataGrid from '../components/DataGrid';
import UploadEngine from '../components/UploadEngine';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API = 'http://localhost:5000/api';

const columns = [
  { field: 'buyer', headerName: 'Buyer', editable: true },
  { field: 'supplier', headerName: 'Supplier', editable: true },
  { field: 'itemCode', headerName: 'Item Code', editable: true },
  { field: 'itemName', headerName: 'Item Name', editable: true },
  { field: 'oldRate', headerName: 'Old Rate', editable: true, type: 'numericColumn' },
  { field: 'newRate', headerName: 'New Rate', editable: true, type: 'numericColumn' },
  { field: 'l1Rate', headerName: 'L1 Rate', editable: true, type: 'numericColumn' },
  { field: 'qty', headerName: 'Qty', editable: true, type: 'numericColumn' },
  { field: 'commodity', headerName: 'Commodity', editable: true },
  { field: 'rateDifference', headerName: 'Rate Diff', editable: false, cellStyle: p => ({ color: p.value > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }) },
  { field: 'monthlySaving', headerName: 'Monthly Saving', editable: false, cellStyle: p => ({ color: p.value > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }) },
  { field: 'annualSaving', headerName: 'Annual Saving', editable: false, cellStyle: { fontWeight: 600, color: '#06b6d4' } },
  { field: 'l1Saving', headerName: 'L1 Saving', editable: false },
  { field: 'month', headerName: 'Month', editable: true },
  { field: 'year', headerName: 'Year', editable: true, type: 'numericColumn' },
];

export default function CostSavingTab() {
  const filters = useSelector(s => s.filters);
  const [data, setData] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (filters.buyer) params.buyer = filters.buyer;
      if (filters.supplier) params.supplier = filters.supplier;
      if (filters.month) params.month = filters.month;
      if (filters.year) params.year = filters.year;
      const res = await axios.get(`${API}/data/costsavings`, { params });
      setData(res.data);
    } catch { setData([]); }
  }, [filters.buyer, filters.supplier, filters.month, filters.year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRowUpdate = async (row) => {
    try {
      const res = await axios.put(`${API}/data/costsavings/${row._id}`, row);
      setData(res.data.data);
    } catch (e) { console.error(e); }
  };

  const onRowAdd = async () => {
    const newRow = { _id: uuidv4(), buyer: '', supplier: '', itemCode: '', oldRate: 0, newRate: 0, l1Rate: 0, qty: 0, commodity: '', month: '', year: 2025 };
    try {
      const res = await axios.post(`${API}/data/costsavings`, newRow);
      setData(res.data.data);
    } catch (e) { console.error(e); }
  };

  const onRowDelete = async (id) => {
    try {
      const res = await axios.delete(`${API}/data/costsavings/${id}`);
      setData(res.data.data);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        💰 Cost Saving Analysis
      </h2>
      <UploadEngine collection="costsavings" onDataUpdate={setData} />
      <DataGrid rowData={data} columnDefs={columns} onRowUpdate={onRowUpdate} onRowAdd={onRowAdd} onRowDelete={onRowDelete} title="Cost Saving Data" collection="costsavings" />
    </div>
  );
}
