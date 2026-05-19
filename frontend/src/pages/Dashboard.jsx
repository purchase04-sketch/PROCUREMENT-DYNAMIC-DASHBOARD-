import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Package, Truck, AlertTriangle, DollarSign, ShieldCheck, Target, Download, FileText } from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:5000/api';
const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function Dashboard() {
  const filters = useSelector(s => s.filters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.buyer) params.buyer = filters.buyer;
      if (filters.supplier) params.supplier = filters.supplier;
      if (filters.month) params.month = filters.month;
      if (filters.year) params.year = filters.year;
      if (filters.plant) params.plant = filters.plant;
      if (filters.commodity) params.commodity = filters.commodity;
      const res = await axios.get(`${API}/dashboard`, { params });
      setData(res.data);
    } catch { setData(null); }
    setLoading(false);
  }, [filters.buyer, filters.supplier, filters.month, filters.year, filters.plant, filters.commodity]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpis = data?.kpis || {};

  const kpiCards = [
    { label: 'Schedule Qty', value: kpis.totalScheduleQty || 0, icon: Target, color: '#6366f1', format: 'num' },
    { label: 'Supply Qty', value: kpis.totalSupplyQty || 0, icon: Truck, color: '#06b6d4', format: 'num' },
    { label: 'Pending Qty', value: kpis.totalPendingQty || 0, icon: AlertTriangle, color: '#f59e0b', format: 'num' },
    { label: 'Schedule Adherence', value: kpis.scheduleAdherenceAvg || 0, icon: ShieldCheck, color: '#10b981', format: 'pct' },
    { label: 'OTD %', value: kpis.otdPercent || 0, icon: TrendingUp, color: '#8b5cf6', format: 'pct' },
    { label: 'Cost Saving', value: kpis.totalCostSaving || 0, icon: DollarSign, color: '#10b981', format: 'cur' },
    { label: 'Inventory Value', value: kpis.totalInventoryValue || 0, icon: Package, color: '#06b6d4', format: 'cur' },
    { label: 'VMI Compliance', value: kpis.vmiComplianceAvg || 0, icon: ShieldCheck, color: '#14b8a6', format: 'pct' },
    { label: 'Supplier Risk', value: kpis.supplierRiskScore || 0, icon: AlertTriangle, color: '#ef4444', format: 'score' },
    { label: 'Forecast Accuracy', value: kpis.forecastAccuracy || 0, icon: Target, color: '#8b5cf6', format: 'pct' },
  ];

  const fmt = (v, f) => {
    if (f === 'pct') return v.toFixed(1) + '%';
    if (f === 'cur') return '₹' + v.toLocaleString('en-IN');
    if (f === 'score') return v.toFixed(1) + '/100';
    return v.toLocaleString('en-IN');
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Procurement Command Center
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Download size={14} /> Export PDF
          </button>
          <button className="btn-accent" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <FileText size={14} /> Export Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        {kpiCards.map((k, i) => (
          <div key={i} className="kpi-card fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.6, marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{fmt(k.value, k.format)}</div>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${k.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <k.icon size={20} style={{ color: k.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 16 }}>
        {/* Schedule vs Supply Trend */}
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📊 Schedule vs Supply Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.scheduleVsSupply || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="scheduled" fill="#6366f1" radius={[4,4,0,0]} name="Scheduled" />
              <Bar dataKey="received" fill="#06b6d4" radius={[4,4,0,0]} name="Received" />
              <Bar dataKey="pending" fill="#f59e0b" radius={[4,4,0,0]} name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Supplier Heatmap */}
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>🔥 Supplier Performance</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={(data?.supplierHeatmap || []).slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={80} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }} />
              <Bar dataKey="otd" fill="#10b981" radius={[0,4,4,0]} name="OTD %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cost Saving Trend */}
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>💰 Cost Saving Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data?.scheduleVsSupply || []}>
              <defs>
                <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }} />
              <Area type="monotone" dataKey="received" stroke="#10b981" fill="url(#savGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Commodity Spend */}
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>🏷️ Commodity Spend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data?.commoditySpend || [{ name: 'No Data', value: 1 }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                {(data?.commoditySpend || [{ name: 'N/A', value: 1 }]).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
