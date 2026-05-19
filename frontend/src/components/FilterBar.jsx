import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setFilter, resetFilters } from '../store';
import { Filter, RotateCcw } from 'lucide-react';

export default function FilterBar() {
  const dispatch = useDispatch();
  const filters = useSelector(s => s.filters);
  const opts = filters.options || {};

  const handleChange = (key, value) => dispatch(setFilter({ key, value }));

  const renderSelect = (key, label, options) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.6 }}>{label}</label>
      <select value={filters[key] || ''} onChange={e => handleChange(key, e.target.value)} style={{ minWidth: 110, fontSize: 12, padding: '5px 8px' }}>
        <option value="">All</option>
        {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="filter-bar" style={{ padding: '10px 20px', display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8, paddingBottom: 2 }}>
        <Filter size={16} style={{ color: 'var(--color-primary)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-light)' }}>Filters</span>
      </div>
      {renderSelect('buyer', 'Buyer', opts.buyers)}
      {renderSelect('supplier', 'Supplier', opts.suppliers)}
      {renderSelect('commodity', 'Commodity', opts.commodities)}
      {renderSelect('plant', 'Plant', opts.plants)}
      {renderSelect('category', 'Category', opts.categories)}
      {renderSelect('month', 'Month', opts.months || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])}
      {renderSelect('year', 'Year', opts.years || [2024, 2025, 2026])}
      <button className="btn-primary" onClick={() => dispatch(resetFilters())} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', marginBottom: 0 }}>
        <RotateCcw size={13} /> Reset
      </button>
    </div>
  );
}
