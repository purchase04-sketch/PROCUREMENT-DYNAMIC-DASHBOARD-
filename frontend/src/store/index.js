import { configureStore, createSlice } from '@reduxjs/toolkit';

const filtersSlice = createSlice({
  name: 'filters',
  initialState: { buyer: '', supplier: '', commodity: '', plant: '', month: '', year: '', category: '', item: '', options: {} },
  reducers: {
    setFilter: (state, action) => { state[action.payload.key] = action.payload.value; },
    setFilterOptions: (state, action) => { state.options = action.payload; },
    resetFilters: (state) => { state.buyer = ''; state.supplier = ''; state.commodity = ''; state.plant = ''; state.month = ''; state.year = ''; state.category = ''; state.item = ''; },
  },
});

const uiSlice = createSlice({
  name: 'ui',
  initialState: { darkMode: true, sidebarOpen: true, activeTab: 'dashboard', aiPanelOpen: false, notifications: [] },
  reducers: {
    toggleDarkMode: (state) => { state.darkMode = !state.darkMode; },
    toggleSidebar: (state) => { state.sidebarOpen = !state.sidebarOpen; },
    setActiveTab: (state, action) => { state.activeTab = action.payload; },
    toggleAiPanel: (state) => { state.aiPanelOpen = !state.aiPanelOpen; },
    addNotification: (state, action) => { state.notifications.unshift(action.payload); },
  },
});

export const { setFilter, setFilterOptions, resetFilters } = filtersSlice.actions;
export const { toggleDarkMode, toggleSidebar, setActiveTab, toggleAiPanel, addNotification } = uiSlice.actions;

export const store = configureStore({
  reducer: { filters: filtersSlice.reducer, ui: uiSlice.reducer },
});
