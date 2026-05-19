import React, { useEffect } from 'react';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { store, setFilterOptions } from './store';
import Sidebar from './components/Sidebar';
import FilterBar from './components/FilterBar';
import AiAssistant from './components/AiAssistant';
import Dashboard from './pages/Dashboard';
import ScheduleTab from './pages/ScheduleTab';
import CostSavingTab from './pages/CostSavingTab';
import InventoryTab from './pages/InventoryTab';
import VmiPlanningTab from './pages/VmiPlanningTab';
import VmiTrackingTab from './pages/VmiTrackingTab';
import EmailManager from './pages/EmailManager';
import axios from 'axios';

const API = 'http://localhost:5000/api';

function AppContent() {
  const dispatch = useDispatch();
  const { darkMode, activeTab, aiPanelOpen, sidebarOpen } = useSelector(s => s.ui);

  useEffect(() => {
    document.body.className = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  useEffect(() => {
    axios.get(`${API}/filters`).then(r => dispatch(setFilterOptions(r.data))).catch(() => {});
  }, [dispatch]);

  const tabs = {
    dashboard: <Dashboard />,
    schedule: <ScheduleTab />,
    costsaving: <CostSavingTab />,
    inventory: <InventoryTab />,
    vmiplanning: <VmiPlanningTab />,
    vmitracking: <VmiTrackingTab />,
    email: <EmailManager />,
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginLeft: sidebarOpen ? 240 : 64, transition: 'margin-left 0.3s' }}>
        <FilterBar />
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {tabs[activeTab] || <Dashboard />}
        </div>
      </div>
      {aiPanelOpen && <AiAssistant />}
    </div>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}
