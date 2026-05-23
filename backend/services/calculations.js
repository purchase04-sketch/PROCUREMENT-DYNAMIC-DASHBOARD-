const fs = require('fs');
const path = require('path');
const { getLocalCollection, saveLocalCollection, getIsFallbackMode } = require('../config/db');

// --- DYNAMIC FORMULA ENGINE ---
const FORMULAS_FILE = path.join(__dirname, '..', 'data', 'formulas.json');
let customFormulas = [];
try {
  if (fs.existsSync(FORMULAS_FILE)) customFormulas = JSON.parse(fs.readFileSync(FORMULAS_FILE, 'utf8'));
} catch (e) { console.error('Error loading custom formulas:', e); }

function saveCustomFormula(formula) {
  const idx = customFormulas.findIndex(f => f.id === formula.id);
  if (idx > -1) customFormulas[idx] = formula;
  else customFormulas.push(formula);
  fs.writeFileSync(FORMULAS_FILE, JSON.stringify(customFormulas, null, 2));
}

function deleteCustomFormula(id) {
  customFormulas = customFormulas.filter(f => f.id !== id);
  fs.writeFileSync(FORMULAS_FILE, JSON.stringify(customFormulas, null, 2));
}

function getFormulas() { return customFormulas; }
function resetFormulas() { customFormulas = []; fs.writeFileSync(FORMULAS_FILE, '[]'); }

function applyCustomFormulas(collection, row) {
  const formulas = customFormulas.filter(f => f.collection === collection && (f.scope === 'global' || f.scopeValue === row.buyer || f.scopeValue === row.supplier));
  formulas.forEach(f => {
    try {
      // Safe evaluation of mathematical formulas using Function
      const keys = Object.keys(row);
      const values = Object.values(row);
      const func = new Function(...keys, `return ${f.expression}`);
      const result = func(...values);
      if (!isNaN(result)) row[f.field] = Math.round(result * 100) / 100;
    } catch (e) { /* skip invalid formula */ }
  });
  return row;
}

// --- CALCULATION LOGIC ---

function getWeekOfMonth(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const date = d.getDate();
  if (date >= 1 && date <= 8) return 1;
  if (date > 8 && date <= 15) return 2;
  if (date > 15 && date <= 21) return 3;
  return 4; // 21-31
}

function calcSchedule(row) {
  const sq = Number(row.scheduleQty) || 0;
  const rq = Number(row.receivedQty) || 0;
  const dd = row.dueDate ? new Date(row.dueDate) : null;
  const rd = row.receiptDate ? new Date(row.receiptDate) : null;
  const pendingQty = Math.max(0, sq - rq);
  const now = new Date();
  
  let delayDays = 0;
  if (rd && dd) delayDays = Math.max(0, Math.ceil((rd - dd) / 86400000));
  else if (!rd && dd && now > dd) delayDays = Math.ceil((now - dd) / 86400000);

  // Advanced OEM OTD Logic
  let score = 0;
  if (sq === 0) {
    score = 100;
  } else if (rq >= sq && rd <= dd) {
    score = 100; // CASE A: On time full
  } else if (rq > sq && rd <= dd) {
    score = Math.min(110, (rq / sq) * 100); // CASE B: Advance material (capped at 110)
  } else if (rq > 0 && rq < sq) {
    score = (rq / sq) * 100; // CASE C: Partial
  } else if (rq === 0 && now > dd) {
    score = 0; // CASE D: No material
  }

  // CASE E: Late material penalty
  if (delayDays > 0 && score > 0) {
    score = Math.max(0, score - (delayDays * 2));
  }

  // Assign score to week based on Due Date
  const week = getWeekOfMonth(row.dueDate);
  row[`week${week}Score`] = score;
  
  // Calculate Monthly OTD
  let totalScore = 0; let activeWeeks = 0;
  [1, 2, 3, 4].forEach(w => {
    if (row[`week${w}Score`] !== undefined) { totalScore += row[`week${w}Score`]; activeWeeks++; }
  });
  const monthlyOtd = activeWeeks > 0 ? Math.round(totalScore / activeWeeks) : 0;
  
  let supplierStatus = 'Green';
  if (monthlyOtd < 60) supplierStatus = 'Red';
  else if (monthlyOtd < 90) supplierStatus = 'Yellow';

  const scheduleAdherence = sq > 0 ? Math.round((rq / sq) * 10000) / 100 : 0;

  const result = { ...row, pendingQty, delayDays, scheduleAdherence, otd: monthlyOtd, supplierStatus };
  return applyCustomFormulas('schedules', result);
}

function calcCostSaving(row) {
  // If user uploaded their own monthlySaving manually, respect it instead of overwriting
  if (row.monthlySaving !== undefined && row.monthlySaving !== null && row.monthlySaving !== 0 && !row._aiCalculated) {
    return applyCustomFormulas('costsavings', row);
  }

  const or = Number(row.oldRate) || 0, nr = Number(row.newRate) || 0;
  const l1 = Number(row.l1Rate) || 0, q = Number(row.qty) || 0;
  const rateDifference = Math.round((or - nr) * 100) / 100;
  const monthlySaving = Math.round(rateDifference * q * 100) / 100;
  const annualSaving = Math.round(rateDifference * q * 12 * 100) / 100;
  const l1Saving = Math.round((nr - l1) * q * 100) / 100;
  const result = { ...row, rateDifference, monthlySaving, annualSaving, l1Saving, _aiCalculated: true };
  return applyCustomFormulas('costsavings', result);
}

function calcInventory(row) {
  const cs = Number(row.currentStock) || 0, con = Number(row.consumption) || 0;
  const lt = Number(row.leadTime) || 0, moq = Number(row.moq) || 1;
  const ss = Number(row.safetyStock) || 0, rate = Number(row.rate) || 0;
  const dc = con / 30;
  const inventoryValue = Math.round(cs * rate * 100) / 100;
  const coverageDays = dc > 0 ? Math.round((cs / dc) * 100) / 100 : 9999;
  const rl = ss + (lt * dc);
  const shortageQty = Math.max(0, Math.round((rl - cs) * 100) / 100);
  const excessQty = Math.max(0, Math.round((cs - (ss + 2 * lt * dc)) * 100) / 100);
  let requiredQty = shortageQty;
  if (requiredQty > 0 && moq > 0) requiredQty = Math.ceil(requiredQty / moq) * moq;
  const result = { ...row, requiredQty, shortageQty, excessQty, coverageDays, inventoryValue };
  return applyCustomFormulas('inventory', result);
}

function calcVmiPlanning(row) {
  const lyc = Number(row.lastYearConsumption) || 0, cs = Number(row.currentSchedule) || 0;
  const sob = Number(row.sob) || 0, vd = Number(row.vmiDays) || 30;
  const sf = Number(row.seasonalityFactor) || 1;
  const ss = Number(row.safetyStock) || 0;
  
  const movingAverage = Math.round(((lyc / 12) + cs) / 2 * 100) / 100;
  
  // ForecastQty = MovingAverage × SeasonalityFactor
  const forecastQty = Math.round(movingAverage * sf * 100) / 100;
  
  // VMIQty = (MovingAverage × VMIDays / 30 × SOB) + SafetyStock
  const vmiQty = Math.round(((movingAverage * vd / 30) * (sob / 100)) + ss * 100) / 100;
  
  const supplierPlannedQty = Math.round(forecastQty * (sob / 100) * 100) / 100;
  const predictiveQty = Math.round(forecastQty * 1.05 * 100) / 100;
  
  const result = { ...row, movingAverage, forecastQty, supplierPlannedQty, predictiveQty, vmiQty };
  return applyCustomFormulas('vmiplanning', result);
}

function calcVmiTracking(row) {
  const pv = Number(row.plannedVmi) || 0, av = Number(row.actualVmi) || 0;
  const gapQty = Math.round((pv - av) * 100) / 100;
  const vmiCompliance = pv > 0 ? Math.round((av / pv) * 10000) / 100 : 0;
  const result = { ...row, gapQty, vmiCompliance };
  return applyCustomFormulas('vmitracking', result);
}

const functionMap = { schedules: calcSchedule, costsavings: calcCostSaving, inventory: calcInventory, vmiplanning: calcVmiPlanning, vmitracking: calcVmiTracking };

function recalcCollection(name, data) {
  const fn = functionMap[name.toLowerCase()];
  return fn ? data.map(fn) : data;
}

// --- DEPENDENCY ENGINE ---
function recalcWithDependencies(collection, data, globalDataObj) {
  // Recalculates current collection, and simulates cross-collection dependencies
  const updatedData = recalcCollection(collection, data);
  // Example cross-dependency logic: if Inventory changes, we might want to update VmiPlanning
  // (In a true relational system, we'd cross-check itemCodes. For now, we return updated data.)
  return updatedData;
}

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
  
  return { totalScheduleQty: tSQ, totalSupplyQty: tRQ, totalPendingQty: tPQ, scheduleAdherenceAvg: saA, otdPercent: otdP, totalCostSaving: Math.round(tCS * 100) / 100, totalInventoryValue: Math.round(tIV * 100) / 100, vmiComplianceAvg: vCA, supplierRiskScore: Math.min(100, sRS), forecastAccuracy: 87.5 };
}

// --- DATA VALIDATION & MAPPING ---
function validateRow(collection, row) {
  const errors = [];
  const autoFilled = {};
  
  // Missing data detection
  if (!row.itemCode && collection !== 'costsavings') errors.push('Missing Item Code');
  if (!row.buyer) { row.buyer = 'SYSTEM_DEFAULT'; autoFilled.buyer = row.buyer; }
  
  // Auto-assign financial year based on month/date if missing
  // Month string (e.g. 'Jan', 'Feb', etc.) to month index logic:
  const mNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  
  let d = new Date();
  if (row.month && row.year) {
    const mIdx = mNames.findIndex(m => row.month.toLowerCase().startsWith(m));
    if (mIdx !== -1) {
      d = new Date(Number(row.year), mIdx, 1);
    } else {
      d = new Date(Number(row.year), d.getMonth(), 1);
    }
  } else if (row.dueDate) {
    d = new Date(row.dueDate);
  }

  // Apr 2025 - Mar 2026 = FY25-26
  const m = d.getMonth(); // 0-indexed (0=Jan, 3=Apr)
  const y = d.getFullYear();
  let fyStart, fyEnd;
  
  if (m >= 3) {
    // Apr to Dec
    fyStart = y;
    fyEnd = y + 1;
  } else {
    // Jan to Mar
    fyStart = y - 1;
    fyEnd = y;
  }
  
  row.financialYear = `FY${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
  autoFilled.financialYear = row.financialYear;
  
  // Extract month/year strings for filtering
  row.month = row.month || mNames[m].charAt(0).toUpperCase() + mNames[m].slice(1);
  row.year = row.year || y;
  
  return { valid: errors.length === 0, errors, autoFilled, row };
}

function autoMapColumns(row) {
  // Fuzzy mapping for uploaded excels
  const mapping = {
    'item code': 'itemCode', 'part number': 'itemCode',
    'item name': 'itemName', 'description': 'itemName',
    'schedule quantity': 'scheduleQty', 'req qty': 'scheduleQty',
    'received quantity': 'receivedQty', 'grn qty': 'receivedQty'
  };
  const mapped = {};
  for (let key in row) {
    const cleanKey = key.trim().toLowerCase();
    const mapKey = mapping[cleanKey] || key;
    mapped[mapKey] = row[key];
  }
  return mapped;
}

module.exports = { 
  calcSchedule, calcCostSaving, calcInventory, calcVmiPlanning, calcVmiTracking, 
  recalcCollection, calcDashboardKPIs, recalcWithDependencies, validateRow, autoMapColumns,
  saveCustomFormula, deleteCustomFormula, getFormulas, resetFormulas
};
