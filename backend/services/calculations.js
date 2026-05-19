// Procurement Calculation Engine - Auto-recalculate on add/edit/delete

function calcSchedule(row) {
  const sq = Number(row.scheduleQty) || 0;
  const rq = Number(row.receivedQty) || 0;
  const dd = row.dueDate ? new Date(row.dueDate) : null;
  const rd = row.receiptDate ? new Date(row.receiptDate) : null;
  const now = new Date();
  const pendingQty = Math.max(0, sq - rq);
  let delayDays = 0;
  if (rd && dd) delayDays = Math.max(0, Math.ceil((rd - dd) / 86400000));
  else if (!rd && dd && now > dd) delayDays = Math.ceil((now - dd) / 86400000);
  const scheduleAdherence = sq > 0 ? Math.round((rq / sq) * 10000) / 100 : 0;
  let otd = 0;
  if (rd && dd) otd = rd <= dd ? 100 : 0;
  let supplierStatus = 'Green';
  if (scheduleAdherence < 60) supplierStatus = 'Red';
  else if (scheduleAdherence < 90) supplierStatus = 'Yellow';
  return { ...row, pendingQty, delayDays, scheduleAdherence, otd, supplierStatus };
}

function calcCostSaving(row) {
  const or = Number(row.oldRate) || 0, nr = Number(row.newRate) || 0;
  const l1 = Number(row.l1Rate) || 0, q = Number(row.qty) || 0;
  const rateDifference = Math.round((or - nr) * 100) / 100;
  const monthlySaving = Math.round(rateDifference * q * 100) / 100;
  const annualSaving = Math.round(rateDifference * q * 12 * 100) / 100;
  const l1Saving = Math.round((nr - l1) * q * 100) / 100;
  return { ...row, rateDifference, monthlySaving, annualSaving, l1Saving };
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
  return { ...row, requiredQty, shortageQty, excessQty, coverageDays, inventoryValue };
}

function calcVmiPlanning(row) {
  const lyc = Number(row.lastYearConsumption) || 0, cs = Number(row.currentSchedule) || 0;
  const sob = Number(row.sob) || 0, vd = Number(row.vmiDays) || 30;
  const sf = Number(row.seasonalityFactor) || 1;
  const movingAverage = Math.round(((lyc / 12) + cs) / 2 * 100) / 100;
  const forecastQty = Math.round(movingAverage * sf * 100) / 100;
  const supplierPlannedQty = Math.round(forecastQty * (sob / 100) * 100) / 100;
  const predictiveQty = Math.round(forecastQty * 1.05 * 100) / 100;
  const vmiQty = Math.round((forecastQty / 30) * vd * 100) / 100;
  return { ...row, movingAverage, forecastQty, supplierPlannedQty, predictiveQty, vmiQty };
}

function calcVmiTracking(row) {
  const pv = Number(row.plannedVmi) || 0, av = Number(row.actualVmi) || 0;
  const gapQty = Math.round((pv - av) * 100) / 100;
  const vmiCompliance = pv > 0 ? Math.round((av / pv) * 10000) / 100 : 0;
  return { ...row, gapQty, vmiCompliance };
}

function recalcCollection(name, data) {
  const map = { schedules: calcSchedule, costsavings: calcCostSaving, inventory: calcInventory, vmiplanning: calcVmiPlanning, vmitracking: calcVmiTracking };
  const fn = map[name.toLowerCase()];
  return fn ? data.map(fn) : data;
}

function calcDashboardKPIs(schedules, costSavings, inventory, vmiTracking) {
  const tSQ = schedules.reduce((s, r) => s + (Number(r.scheduleQty) || 0), 0);
  const tRQ = schedules.reduce((s, r) => s + (Number(r.receivedQty) || 0), 0);
  const tPQ = schedules.reduce((s, r) => s + (Number(r.pendingQty) || 0), 0);
  const otC = schedules.filter(r => r.otd === 100).length;
  const tS = schedules.filter(r => r.receiptDate).length;
  const otdP = tS > 0 ? Math.round((otC / tS) * 10000) / 100 : 0;
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

module.exports = { calcSchedule, calcCostSaving, calcInventory, calcVmiPlanning, calcVmiTracking, recalcCollection, calcDashboardKPIs };
