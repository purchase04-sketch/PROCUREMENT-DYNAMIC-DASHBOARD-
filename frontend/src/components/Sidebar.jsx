import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setActiveTab, toggleSidebar, toggleDarkMode, toggleAiPanel } from '../store';
import { LayoutDashboard, CalendarCheck, DollarSign, Package, TrendingUp, ClipboardCheck, Mail, Bot, Sun, Moon, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'schedule', label: 'Schedule & OTD', icon: CalendarCheck },
  { id: 'costsaving', label: 'Cost Saving', icon: DollarSign },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'vmiplanning', label: 'VMI Planning', icon: TrendingUp },
  { id: 'vmitracking', label: 'VMI Tracking', icon: ClipboardCheck },
  { id: 'email', label: 'Email Manager', icon: Mail },
];

export default function Sidebar() {
  const dispatch = useDispatch();
  const { activeTab, sidebarOpen, darkMode } = useSelector(s => s.ui);

  return (
    <div className="sidebar" style={{ width: sidebarOpen ? 240 : 64, position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--color-dark-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Activity size={18} color="white" />
        </div>
        {sidebarOpen && <span style={{ fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ProCure AI</span>}
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
        {tabs.map(tab => (
          <div key={tab.id} className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => dispatch(setActiveTab(tab.id))}
            title={tab.label}>
            <tab.icon size={20} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span style={{ fontSize: 13, fontWeight: 500 }}>{tab.label}</span>}
          </div>
        ))}
      </div>

      {/* Bottom controls */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--color-dark-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="sidebar-item" onClick={() => dispatch(toggleAiPanel())} title="AI Assistant">
          <Bot size={20} style={{ flexShrink: 0 }} />
          {sidebarOpen && <span style={{ fontSize: 13, fontWeight: 500 }}>AI Assistant</span>}
        </div>
        <div className="sidebar-item" onClick={() => dispatch(toggleDarkMode())} title="Toggle Theme">
          {darkMode ? <Sun size={20} style={{ flexShrink: 0 }} /> : <Moon size={20} style={{ flexShrink: 0 }} />}
          {sidebarOpen && <span style={{ fontSize: 13, fontWeight: 500 }}>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
        </div>
        <div className="sidebar-item" onClick={() => dispatch(toggleSidebar())} title="Toggle Sidebar">
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          {sidebarOpen && <span style={{ fontSize: 13, fontWeight: 500 }}>Collapse</span>}
        </div>
      </div>
    </div>
  );
}
