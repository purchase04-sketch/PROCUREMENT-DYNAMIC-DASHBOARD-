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
  { field: 'lastYearConsumption', headerName: 'Last Yr Consumption', editable: true, type: 'numericColumn' },
  { field: 'currentSchedule', headerName: 'Current Schedule', editable: true, type: 'numericColumn' },
  { field: 'sob', headerName: 'SOB %', editable: true, type: 'numericColumn' },
  { field: 'rate', headerName: 'Rate', editable: true, type: 'numericColumn' },
  { field: 'stock', headerName: 'Stock', editable: true, type: 'numericColumn' },
  { field: 'safetyStock', headerName: 'Safety Stock', editable: true, type: 'numericColumn' },
  { field: 'vmiDays', headerName: 'VMI Days', editable: true, type: 'numericColumn' },
  { field: 'seasonalityFactor', headerName: 'Seasonality', editable: true, type: 'numericColumn' },
  { field: 'movingAverage', headerName: 'Moving Avg', editable: false, cellStyle: { fontWeight: 600, color: '#6366f1' } },
  { field: 'forecastQty', headerName: 'Forecast Qty', editable: false, cellStyle: { fontWeight: 600, color: '#06b6d4' } },
  { field: 'supplierPlannedQty', headerName: 'Supplier Planned', editable: false, cellStyle: { fontWeight: 600, color: '#8b5cf6' } },
  { field: 'predictiveQty', headerName: 'Predictive Qty', editable: false, cellStyle: { fontWeight: 600, color: '#10b981' } },
  { field: 'vmiQty', headerName: 'VMI Qty', editable: false, cellStyle: { fontWeight: 600, color: '#f59e0b' } },
  { field: 'month', headerName: 'Month', editable: true },
  { field: 'year', headerName: 'Year', editable: true, type: 'numericColumn' },
];

export default function VmiPlanningTab() {
  const filters = useSelector(s => s.filters);
  const [data, setData] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (filters.buyer) params.buyer = filters.buyer;
      if (filters.supplier) params.supplier = filters.supplier;
      if (filters.month) params.month = filters.month;
      if (filters.year) params.year = filters.year;
      const res = await axios.get(`${API}/data/vmiplanning`, { params });
      setData(res.data);
    } catch { setData([]); }
  }, [filters.buyer, filters.supplier, filters.month, filters.year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRowUpdate = async (row) => {
    try { const res = await axios.put(`${API}/data/vmiplanning/${row._id}`, row); setData(res.data.data); } catch (e) { console.error(e); }
  };
  const onRowAdd = async () => {
    try { const res = await axios.post(`${API}/data/vmiplanning`, { _id: uuidv4(), supplier: '', itemCode: '', lastYearConsumption: 0, currentSchedule: 0, sob: 0, rate: 0, stock: 0, safetyStock: 0, vmiDays: 30, seasonalityFactor: 1, month: '', year: 2025 }); setData(res.data.data); } catch (e) { console.error(e); }
  };
  const onRowDelete = async (id) => {
    try { const res = await axios.delete(`${API}/data/vmiplanning/${id}`); setData(res.data.data); } catch (e) { console.error(e); }
  };

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        📈 VMI & Predictive Planning
      </h2>
      <UploadEngine collection="vmiplanning" onDataUpdate={setData} />
      <DataGrid rowData={data} columnDefs={columns} onRowUpdate={onRowUpdate} onRowAdd={onRowAdd} onRowDelete={onRowDelete} title="VMI Planning Data" collection="vmiplanning" />
    </div>
  );
}
