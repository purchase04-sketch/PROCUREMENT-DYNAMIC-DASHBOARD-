import React, { useRef, useCallback, useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Plus, Trash2, Download, Undo, Redo, ClipboardPaste } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { setTabData } from '../store';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function DataGrid({ rowData, columnDefs, onRowUpdate, onRowAdd, onRowDelete, onBulkPaste, title, collection }) {
  const gridRef = useRef(null);
  const dispatch = useDispatch();
  
  // Edit history tracking for Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [toastMessage, setToastMessage] = useState('');

  // Sync data to Redux for AI context
  useEffect(() => {
    if (collection) dispatch(setTabData({ collection, data: rowData }));
  }, [rowData, collection, dispatch]);

  const defaultColDef = {
    flex: 1, minWidth: 100, sortable: true, filter: true, resizable: true,
    editable: true, cellStyle: { fontSize: '13px' }, enableRowGroup: true,
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2000);
  };

  const saveHistory = (oldData, newData) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ old: { ...oldData }, new: { ...newData } });
    if (newHistory.length > 20) newHistory.shift(); // Keep last 20 edits
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex < 0) return;
    const action = history[historyIndex];
    if (onRowUpdate) onRowUpdate(action.old);
    setHistoryIndex(historyIndex - 1);
    showToast('Undo successful');
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const action = history[historyIndex + 1];
    if (onRowUpdate) onRowUpdate(action.new);
    setHistoryIndex(historyIndex + 1);
    showToast('Redo successful');
  };

  const onCellValueChanged = useCallback((e) => {
    if (e.oldValue !== e.newValue) {
      saveHistory(
        { ...e.data, [e.colDef.field]: e.oldValue }, 
        { ...e.data, [e.colDef.field]: e.newValue }
      );
      if (onRowUpdate) onRowUpdate(e.data);
      showToast('Saved ✓');
    }
  }, [onRowUpdate, history, historyIndex]);

  const addRow = () => {
    if (onRowAdd) onRowAdd();
  };

  const deleteSelected = () => {
    const sel = gridRef.current?.api?.getSelectedRows();
    if (sel && sel.length > 0 && onRowDelete) {
      sel.forEach(r => onRowDelete(r._id));
      showToast(`Deleted ${sel.length} rows`);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split('\n').filter(r => r.trim());
      if (rows.length > 0 && onBulkPaste) {
        // Simple TSV parser for clipboard data
        const keys = columnDefs.map(c => c.field).filter(f => f && f !== '_id');
        const pastedData = rows.map(rowStr => {
          const vals = rowStr.split('\t');
          const rowObj = { _id: uuidv4() };
          keys.forEach((k, i) => { if (vals[i]) rowObj[k] = vals[i].trim(); });
          return rowObj;
        });
        onBulkPaste(pastedData);
        showToast(`Pasted ${pastedData.length} rows`);
      }
    } catch (e) {
      console.error('Clipboard paste failed:', e);
      showToast('Paste failed (check permissions)');
    }
  };

  const exportExcel = () => {
    const rows = [];
    gridRef.current?.api?.forEachNode(n => rows.push(n.data));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title || 'Data');
    XLSX.writeFile(wb, `${title || collection || 'export'}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>📋 {title || 'Data Grid'}</h3>
          {toastMessage && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 10 }}>{toastMessage}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={undo} disabled={historyIndex < 0} style={{ padding: '6px', opacity: historyIndex < 0 ? 0.5 : 1 }} title="Undo (Ctrl+Z)">
            <Undo size={14} />
          </button>
          <button className="btn-secondary" onClick={redo} disabled={historyIndex >= history.length - 1} style={{ padding: '6px', opacity: historyIndex >= history.length - 1 ? 0.5 : 1 }} title="Redo (Ctrl+Y)">
            <Redo size={14} />
          </button>
          <button className="btn-secondary" onClick={handlePaste} style={{ padding: '6px' }} title="Paste from Clipboard">
            <ClipboardPaste size={14} />
          </button>
          <div style={{ width: 1, background: 'var(--color-dark-border)', margin: '0 4px' }}></div>
          <button className="btn-primary" onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: 12 }}>
            <Plus size={14} /> Add Row
          </button>
          <button className="btn-danger" onClick={deleteSelected} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Trash2 size={13} /> Delete
          </button>
          <button className="btn-accent" onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: 12 }}>
            <Download size={14} /> Excel
          </button>
        </div>
      </div>
      <div className="ag-theme-alpine-dark" style={{ height: 'calc(100vh - 280px)', minHeight: 400, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          rowSelection="multiple"
          animateRows={true}
          getRowId={p => p.data._id}
          suppressClickEdit={false}
          enableRangeSelection={true}
          enableFillHandle={true}
          fillHandleDirection="y"
          undoRedoCellEditing={true}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--color-dark-muted)' }}>
        <span>Total Rows: {rowData?.length || 0}</span>
        <span>Advanced OEM Grid Engine</span>
      </div>
    </div>
  );
}
