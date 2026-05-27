/**
 * Legacy Calculations Interface
 * Delegates all calculation requests to the modular backend engines
 * to preserve absolute backwards-compatibility.
 */

const formulaEngine = require('./formulaEngine');
const otdEngine = require('./otdEngine');
const costSavingEngine = require('./costSavingEngine');
const inventoryEngine = require('./inventoryEngine');
const vmiEngine = require('./vmiEngine');
const fileProcessor = require('./fileProcessor');
const calculationEngine = require('./calculationEngine');
const dependencyEngine = require('./dependencyEngine');

function calcSchedule(row) {
  return otdEngine.calculateRowOTD(row);
}

function calcCostSaving(row) {
  return costSavingEngine.calculateCostSavingRow(row);
}

function calcInventory(row) {
  return inventoryEngine.calculateInventoryRow(row);
}

function calcVmiPlanning(row) {
  return vmiEngine.calculateVMIPlanningRow(row);
}

function calcVmiTracking(row) {
  return vmiEngine.calculateVMITrackingRow(row);
}

function recalcCollection(name, data) {
  return calculationEngine.recalculateCollection(name, data);
}

function recalcWithDependencies(collection, data) {
  // Synchronous legacy wrapper for backwards compatibility
  return calculationEngine.recalculateCollection(collection, data);
}

// Keeping local copy of calcDashboardKPIs for exact compatibility
function calcDashboardKPIs(schedules, costSavings, inventory, vmiTracking) {
  const tSQ = schedules.reduce((s, r) => s + (Number(r.scheduleQty) || 0), 0);
  const tRQ = schedules.reduce((s, r) => s + (Number(r.receivedQty) || 0), 0);
  const tPQ = schedules.reduce((s, r) => s + (Number(r.pendingQty) || 0), 0);
  const activeSch = schedules.filter(r => r.otd !== undefined);
  const otdSum = activeSch.reduce((s, r) => s + (Number(r.otd) || 0), 0);
  const otdP = activeSch.length > 0 ? Math.round((otdSum / activeSch.length) * 100) / 100 : 0;
  const saA = tSQ > 0 ? Math.round((tRQ / tSQ) * 10000) / 100 : 0;
  
  const tCS = costSavings.reduce((s, r) => s + (Number(r.monthlySaving) || 0), 0);
  const tIV = inventory.reduce((s, r) => s + (Number(r.inventoryValue) || 0), 0);
  const tPV = vmiTracking.reduce((s, r) => s + (Number(r.plannedVmi) || 0), 0);
  const tAV = vmiTracking.reduce((s, r) => s + (Number(r.actualVmi) || 0), 0);
  const vCA = tPV > 0 ? Math.round((tAV / tPV) * 10000) / 100 : 0;
  
  const rS = schedules.filter(r => r.supplierStatus === 'Red').length;
  const yS = schedules.filter(r => r.supplierStatus === 'Yellow').length;
  const uS = new Set(schedules.map(r => r.supplier).filter(Boolean)).size || 1;
  const sRS = Math.round(((rS * 2 + yS) / uS) * 5000) / 100;
  
  return {
    totalScheduleQty: tSQ,
    totalSupplyQty: tRQ,
    totalPendingQty: tPQ,
    scheduleAdherenceAvg: saA,
    otdPercent: otdP,
    totalCostSaving: Math.round(tCS * 100) / 100,
    totalInventoryValue: Math.round(tIV * 100) / 100,
    vmiComplianceAvg: vCA,
    supplierRiskScore: Math.min(100, sRS),
    forecastAccuracy: 87.5
  };
}

function validateRow(collection, row) {
  // Maps back to legacy response format
  const res = calculationEngine.validateAndAssign(collection, row);
  return {
    valid: res.valid,
    errors: res.missing.map(col => `Missing ${col}`),
    autoFilled: { financialYear: res.row.financialYear, month: res.row.month, year: res.row.year },
    row: res.row,
  };
}

function autoMapColumns(row) {
  return fileProcessor.autoMapColumns(row);
}

function saveCustomFormula(formula) {
  if (formula.id) {
    try {
      return formulaEngine.updateFormula(formula.id, formula);
    } catch (e) {
      return formulaEngine.createFormula(formula);
    }
  }
  return formulaEngine.createFormula(formula);
}

function deleteCustomFormula(id) {
  return formulaEngine.deleteFormula(id);
}

function getFormulas() {
  return formulaEngine.getFormulas();
}

function resetFormulas() {
  return formulaEngine.resetToDefaults();
}

module.exports = { 
  calcSchedule,
  calcCostSaving,
  calcInventory,
  calcVmiPlanning,
  calcVmiTracking, 
  recalcCollection,
  calcDashboardKPIs,
  recalcWithDependencies,
  validateRow,
  autoMapColumns,
  saveCustomFormula,
  deleteCustomFormula,
  getFormulas,
  resetFormulas
};
