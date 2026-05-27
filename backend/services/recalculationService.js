/**
 * Recalculation Service — Central orchestrator for data pipelines,
 * cascade triggers, and dashboard updates
 */

const { getIsFallbackMode, getLocalCollection, saveLocalCollection } = require('../config/db');
const models = require('../models/schemas');
const { recalculateCollection, calculateRow } = require('./calculationEngine');
const { cascadeRecalculation } = require('./dependencyEngine');
const { calculateWeeklyOTD } = require('./otdEngine');
const { calcDashboardKPIs } = require('./calculations');
const XLSX = require('xlsx');

// Database helpers
async function getCollectionData(collectionName) {
  if (getIsFallbackMode()) {
    return [...getLocalCollection(collectionName)];
  }
  const modelMap = {
    schedules: models.Schedule,
    costsavings: models.CostSaving,
    inventory: models.Inventory,
    vmiplanning: models.VmiPlanning,
    vmitracking: models.VmiTracking,
    buyers: models.Buyer,
    suppliers: models.Supplier,
    items: models.Item,
    otdrecords: models.OTDRecord,
  };
  const Model = modelMap[collectionName.toLowerCase()];
  if (!Model) return [];
  return await Model.find({}).lean();
}

async function saveCollectionData(collectionName, data) {
  if (getIsFallbackMode()) {
    const col = getLocalCollection(collectionName);
    col.length = 0;
    col.push(...data);
    saveLocalCollection(collectionName);
    return;
  }
  const modelMap = {
    schedules: models.Schedule,
    costsavings: models.CostSaving,
    inventory: models.Inventory,
    vmiplanning: models.VmiPlanning,
    vmitracking: models.VmiTracking,
    buyers: models.Buyer,
    suppliers: models.Supplier,
    items: models.Item,
    otdrecords: models.OTDRecord,
  };
  const Model = modelMap[collectionName.toLowerCase()];
  if (!Model) return;
  await Model.deleteMany({});
  if (data.length > 0) {
    await Model.insertMany(data);
  }
}

/**
 * Handle data change event and cascade recalculations
 */
async function onDataChange(event, io) {
  const { collection, data, buyerId } = event;
  console.log(`⚡ Data changed in [${collection}] for buyer [${buyerId || 'all'}]`);
  
  // 1. Recalculate collection first
  const recalculated = recalculateCollection(collection, data);
  
  // 2. Cascade changes through the dependency engine
  await cascadeRecalculation(collection, recalculated, io, buyerId);

  // 3. Trigger full OTD record updates if schedules changed
  if (collection.toLowerCase() === 'schedules') {
    await updateOTDRecords(buyerId);
  }

  // 4. Broadcast refreshed KPIs & charts
  await refreshDashboard(io, buyerId);
}

/**
 * Update OTD Records collection based on schedule data
 */
async function updateOTDRecords(buyerId) {
  let schedules = await getCollectionData('schedules');
  if (buyerId) {
    schedules = schedules.filter(s => s.buyerId === buyerId || s.buyer === buyerId);
  }

  const otdSummary = calculateWeeklyOTD(schedules);
  const records = otdSummary.map(row => ({
    supplierId: row.supplier || 'unknown',
    supplierName: row.supplier || 'Unknown Supplier',
    buyerId: row.buyerId || 'unknown',
    month: row.month || '',
    financialYear: row.year ? `FY${String(row.year).slice(-2)}` : '',
    week1Score: row.week1Score || 0,
    week2Score: row.week2Score || 0,
    week3Score: row.week3Score || 0,
    week4Score: row.week4Score || 0,
    monthlyOTD: row.monthlyOTD || 0,
    rating: row.rating || 'Average',
  }));

  await saveCollectionData('otdrecords', records);
  console.log(`📈 Updated ${records.length} OTD Records`);
}

/**
 * Runs a complete recalculation across all collections in the correct order
 */
async function fullRecalculation(buyerId, io) {
  console.log(`🔄 Performing full recalculation for buyer [${buyerId || 'all'}]`);
  
  const collections = ['inventory', 'vmiplanning', 'vmitracking', 'costsavings', 'schedules'];
  
  for (const col of collections) {
    let data = await getCollectionData(col);
    if (buyerId) {
      data = data.filter(r => r.buyerId === buyerId || r.buyer === buyerId);
    }
    const recalculated = recalculateCollection(col, data);
    await saveCollectionData(col, recalculated);
  }

  await updateOTDRecords(buyerId);
  await refreshDashboard(io, buyerId);
}

/**
 * Refresh KPIs, charts, filters and AI context via socket.io
 */
async function refreshDashboard(io, buyerId) {
  if (!io) return;
  
  try {
    let schedules = await getCollectionData('schedules');
    let costSavings = await getCollectionData('costsavings');
    let inventory = await getCollectionData('inventory');
    let vmiTracking = await getCollectionData('vmitracking');

    const filterByBuyer = (arr) => {
      if (!buyerId) return arr;
      return arr.filter(x => x.buyerId === buyerId || x.buyer === buyerId);
    };

    schedules = filterByBuyer(schedules);
    costSavings = filterByBuyer(costSavings);
    inventory = filterByBuyer(inventory);
    vmiTracking = filterByBuyer(vmiTracking);

    const kpis = calcDashboardKPIs(schedules, costSavings, inventory, vmiTracking);

    // Emit live dashboard state
    io.emit('kpiUpdate', { kpis, buyerId });
    io.emit('aiContextRefresh', { buyerId, timestamp: new Date().toISOString() });
    console.log(`📡 Broadcasted live dashboard updates for [${buyerId || 'all'}]`);
  } catch (e) {
    console.error('Error refreshing dashboard:', e.message);
  }
}

/**
 * Exports recalculated data as downloadable xlsx buffer
 */
async function exportRecalculatedData(buyerId, collection) {
  let data = await getCollectionData(collection);
  if (buyerId) {
    data = data.filter(r => r.buyerId === buyerId || r.buyer === buyerId);
  }

  // Recalculate to ensure absolute accuracy on export
  const recalculated = recalculateCollection(collection, data);

  // Clean data fields for export (remove MongoDB specific fields)
  const cleaned = recalculated.map(row => {
    const copy = { ...row };
    delete copy._id;
    delete copy.__v;
    delete copy.createdAt;
    delete copy.updatedAt;
    delete copy._aiCalculated;
    return copy;
  });

  const ws = XLSX.utils.json_to_sheet(cleaned);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, collection);
  
  // Write to a buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

module.exports = {
  onDataChange,
  fullRecalculation,
  refreshDashboard,
  exportRecalculatedData,
};
