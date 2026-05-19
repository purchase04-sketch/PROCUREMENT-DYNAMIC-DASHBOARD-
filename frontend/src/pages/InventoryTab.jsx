import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import DataGrid from '../components/DataGrid';
import UploadEngine from '../components/UploadEngine';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API = 'http://localhost:5000/api';

const columns = [
  { field: 'itemCode', headerName: 'Item Code', editable: true },
  { field: 'itemName', headerName: 'Item Name', editable: true },
  { field: 'buyer', headerName: 'Buyer', editable: true },
  { field: 'supplier', headerName: 'Supplier', editable: true },
  { field: 'currentStock', headerName: 'Current Stock', editable: true, type: 'numericColumn' },
  { field: 'consumption', headerName: 'Consumption/Mo', editable: true, type: 'numericColumn' },
  { field: 'leadTime', headerName: 'Lead Time (days)', editable: true, type: 'numericColumn' },
  { field: 'moq', headerName: 'MOQ', editable: true, type: 'numericColumn' },
  { field: 'safetyStock', headerName: 'Safety Stock', editable: true, type: 'numericColumn' },
  { field: 'sob', headerName: 'SOB %', editable: true, type: 'numericColumn' },
  { field: 'rate', headerName: 'Rate', editable: true, type: 'numericColumn' },
  { field: 'requiredQty', headerName: 'Required Qty', editable: false, cellStyle: { fontWeight: 600, color: '#6366f1' } },
  { field: 'shortageQty', headerName: 'Shortage Qty', editable: false, cellStyle: p => ({ fontWeight: 600, color: p.value > 0 ? '#ef4444' : '#10b981' }) },
  { field: 'excessQty', headerName: 'Excess Qty', editable: false, cellStyle: p => ({ fontWeight: 600, color: p.value > 0 ? '#f59e0b' : '#10b981' }) },
  { field: 'coverageDays', headerName: 'Coverage Days', editable: false, cellStyle: p => ({ fontWeight: 600, color: p.value < 15 ? '#ef4444' : '#10b981' }) },
  { field: 'inventoryValue', headerName: 'Inventory Value', editable: false, cellStyle: { fontWeight: 600, color: '#06b6d4' } },
  { field: 'plant', headerName: 'Plant', editable: true },
  { field: 'commodity', headerName: 'Commodity', editable: true },
  { field: 'month', headerName: 'Month', editable: true },
  { field: 'year', headerName: 'Year', editable: true, type: 'numericColumn' },
];

export default function InventoryTab() {
  const filters = useSelector(s => s.filters);
  const [data, setData] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (filters.buyer) params.buyer = filters.buyer;
      if (filters.supplier) params.supplier = filters.supplier;
      if (filters.month) params.month = filters.month;
      if (filters.year) params.year = filters.year;
      const res = await axios.get(`${API}/data/inventory`, { params });
      setData(res.data);
    } catch { setData([]); }
  }, [filters.buyer, filters.supplier, filters.month, filters.year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRowUpdate = async (row) => {
    try { const res = await axios.put(`${API}/data/inventory/${row._id}`, row); setData(res.data.data); } catch (e) { console.error(e); }
  };
  const onRowAdd = async () => {
    try { const res = await axios.post(`${API}/data/inventory`, { _id: uuidv4(), itemCode: '', currentStock: 0, consumption: 0, leadTime: 0, moq: 1, safetyStock: 0, sob: 0, rate: 0, month: '', year: 2025 }); setData(res.data.data); } catch (e) { console.error(e); }
  };
  const onRowDelete = async (id) => {
    try { const res = await axios.delete(`${API}/data/inventory/${id}`); setData(res.data.data); } catch (e) { console.error(e); }
  };

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        📦 Inventory Planning & Risk
      </h2>
      <UploadEngine collection="inventory" onDataUpdate={setData} />
      <DataGrid rowData={data} columnDefs={columns} onRowUpdate={onRowUpdate} onRowAdd={onRowAdd} onRowDelete={onRowDelete} title="Inventory Data" collection="inventory" />
    </div>
  );
}
