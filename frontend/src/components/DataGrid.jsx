import React, { useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Plus, Trash2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function DataGrid({ rowData, columnDefs, onRowUpdate, onRowAdd, onRowDelete, title, collection }) {
  const gridRef = useRef(null);

  const defaultColDef = {
    flex: 1, minWidth: 100, sortable: true, filter: true, resizable: true,
    editable: true, cellStyle: { fontSize: '13px' },
  };

  const onCellValueChanged = useCallback((e) => {
    if (onRowUpdate) onRowUpdate(e.data);
  }, [onRowUpdate]);

  const addRow = () => {
    if (onRowAdd) onRowAdd();
  };

  const deleteSelected = () => {
    const sel = gridRef.current?.api?.getSelectedRows();
    if (sel && sel.length > 0 && onRowDelete) {
      sel.forEach(r => onRowDelete(r._id));
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
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>📋 {title || 'Data Grid'}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
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
      <div className="ag-theme-alpine-dark" style={{ height: 450, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
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
        />
      </div>
    </div>
  );
}
