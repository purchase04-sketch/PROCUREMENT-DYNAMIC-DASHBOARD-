/**
 * VMI Engine — Vendor Managed Inventory calculations
 * 
 * VMIQty = (MovingAverage × VMIDays / 30 × SOB%) + SafetyStock
 */

// ---- VMI QTY ----

function calculateVMIQty(movingAverage, vmiDays, sob, safetyStock) {
  const ma = Number(movingAverage) || 0;
  const vd = Number(vmiDays) || 30;
  const sobPct = Number(sob) || 0;
  const ss = Number(safetyStock) || 0;
  // VMIQty = (MovingAverage × VMIDays / 30 × SOB%) + SafetyStock
  return Math.round(((ma * vd / 30) * (sobPct / 100)) + ss * 100) / 100;
}

// ---- VMI COMPLIANCE ----

function calculateVMICompliance(planned, actual) {
  const pv = Number(planned) || 0;
  const av = Number(actual) || 0;
  if (pv === 0) return av === 0 ? 100 : 0;
  return Math.round((av / pv) * 10000) / 100;
}

// ---- VMI GAP ----

function calculateVMIGap(planned, actual) {
  const pv = Number(planned) || 0;
  const av = Number(actual) || 0;
  return Math.round((pv - av) * 100) / 100;
}

// ---- VMI PLANNING ROW ----

function calculateVMIPlanningRow(row) {
  const lyc = Number(row.lastYearConsumption) || 0;
  const cs = Number(row.currentSchedule) || 0;
  const sob = Number(row.sob) || 0;
  const vd = Number(row.vmiDays) || 30;
  const sf = Number(row.seasonalityFactor) || 1;
  const ss = Number(row.safetyStock) || 0;
  const stock = Number(row.stock) || Number(row.currentStock) || 0;

  // Moving average
  const movingAverage = Math.round(((lyc / 12) + cs) / 2 * 100) / 100;

  // Forecast qty = MovingAverage × SeasonalityFactor
  const forecastQty = Math.round(movingAverage * sf * 100) / 100;

  // VMI Qty = (MovingAverage × VMIDays / 30 × SOB%) + SafetyStock
  const vmiQty = Math.round(((movingAverage * vd / 30) * (sob / 100)) + ss * 100) / 100;

  // Supplier planned qty
  const supplierPlannedQty = Math.round(forecastQty * (sob / 100) * 100) / 100;

  // Predictive qty = ForecastQty + SafetyStock − CurrentStock
  const predictiveQty = Math.round((forecastQty + ss - stock) * 100) / 100;

  return {
    ...row,
    movingAverage,
    forecastQty,
    vmiQty,
    supplierPlannedQty,
    predictiveQty,
  };
}

// ---- VMI TRACKING ROW ----

function calculateVMITrackingRow(row) {
  const pv = Number(row.plannedVmi) || 0;
  const av = Number(row.actualVmi) || 0;

  const gapQty = calculateVMIGap(pv, av);
  const vmiCompliance = calculateVMICompliance(pv, av);

  return {
    ...row,
    gapQty,
    vmiCompliance,
  };
}

// ---- VMI HEALTH CHECK ----

function getVMIStatus(compliance) {
  const c = Number(compliance) || 0;
  if (c >= 95) return { status: 'Excellent', color: 'Green' };
  if (c >= 80) return { status: 'Good', color: 'LightGreen' };
  if (c >= 60) return { status: 'Average', color: 'Yellow' };
  return { status: 'Poor', color: 'Red' };
}

module.exports = {
  calculateVMIQty,
  calculateVMICompliance,
  calculateVMIGap,
  calculateVMIPlanningRow,
  calculateVMITrackingRow,
  getVMIStatus,
};
