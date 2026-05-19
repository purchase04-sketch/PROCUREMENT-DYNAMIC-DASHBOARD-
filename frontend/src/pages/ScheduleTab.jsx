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
  { field: 'scheduleQty', headerName: 'Schedule Qty', editable: true, type: 'numericColumn' },
  { field: 'receivedQty', headerName: 'Received Qty', editable: true, type: 'numericColumn' },
  { field: 'pendingQty', headerName: 'Pending Qty', editable: false, cellStyle: p => ({ color: p.value > 0 ? '#f59e0b' : '#10b981', fontWeight: 600 }) },
  { field: 'dueDate', headerName: 'Due Date', editable: true },
  { field: 'receiptDate', headerName: 'Receipt Date', editable: true },
  { field: 'delayDays', headerName: 'Delay Days', editable: false, cellStyle: p => ({ color: p.value > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }) },
  { field: 'scheduleAdherence', headerName: 'Adherence %', editable: false, cellStyle: p => ({ fontWeight: 600, color: p.value >= 90 ? '#10b981' : p.value >= 60 ? '#f59e0b' : '#ef4444' }) },
  { field: 'otd', headerName: 'OTD %', editable: false },
  { field: 'supplierStatus', headerName: 'Status', editable: false, cellRenderer: p => {
    const cls = p.value === 'Green' ? 'status-green' : p.value === 'Yellow' ? 'status-yellow' : 'status-red';
    return `<span class="${cls}">${p.value}</span>`;
  }},
  { field: 'month', headerName: 'Month', editable: true },
  { field: 'year', headerName: 'Year', editable: true, type: 'numericColumn' },
  { field: 'plant', headerName: 'Plant', editable: true },
  { field: 'commodity', headerName: 'Commodity', editable: true },
];

export default function ScheduleTab() {
  const filters = useSelector(s => s.filters);
  const [data, setData] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (filters.buyer) params.buyer = filters.buyer;
      if (filters.supplier) params.supplier = filters.supplier;
      if (filters.month) params.month = filters.month;
      if (filters.year) params.year = filters.year;
      const res = await axios.get(`${API}/data/schedules`, { params });
      setData(res.data);
    } catch { setData([]); }
  }, [filters.buyer, filters.supplier, filters.month, filters.year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRowUpdate = async (row) => {
    try {
      const res = await axios.put(`${API}/data/schedules/${row._id}`, row);
      setData(res.data.data);
    } catch (e) { console.error(e); }
  };

  const onRowAdd = async () => {
    const newRow = { _id: uuidv4(), buyer: '', supplier: '', itemCode: '', scheduleQty: 0, receivedQty: 0, dueDate: '', receiptDate: '', month: '', year: 2025 };
    try {
      const res = await axios.post(`${API}/data/schedules`, newRow);
      setData(res.data.data);
    } catch (e) { console.error(e); }
  };

  const onRowDelete = async (id) => {
    try {
      const res = await axios.delete(`${API}/data/schedules/${id}`);
      setData(res.data.data);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        📅 Schedule vs Supply & OTD Tracking
      </h2>
      <UploadEngine collection="schedules" onDataUpdate={setData} />
      <DataGrid rowData={data} columnDefs={columns} onRowUpdate={onRowUpdate} onRowAdd={onRowAdd} onRowDelete={onRowDelete} title="Schedule Data" collection="schedules" />
    </div>
  );
}
