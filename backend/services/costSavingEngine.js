/**
 * Cost Saving Engine — Rate difference, cost saving, annual saving, L1 saving
 * 
 * RateDifference = OldRate − NewRate
 * CostSaving = (OldRate − NewRate) × Qty
 * AnnualSaving = MonthlySaving × 12
 * L1Saving = (CurrentRate − L1Rate) × Qty
 */

// ---- RATE DIFFERENCE ----

function calculateRateDifference(oldRate, newRate) {
  const or = Number(oldRate) || 0;
  const nr = Number(newRate) || 0;
  return Math.round((or - nr) * 100) / 100;
}

// ---- COST SAVING ----

function calculateCostSaving(oldRate, newRate, qty) {
  const or = Number(oldRate) || 0;
  const nr = Number(newRate) || 0;
  const q = Number(qty) || 0;
  return Math.round((or - nr) * q * 100) / 100;
}

// ---- ANNUAL SAVING ----

function calculateAnnualSaving(monthlySaving) {
  const ms = Number(monthlySaving) || 0;
  return Math.round(ms * 12 * 100) / 100;
}

// ---- L1 SAVING ----

function calculateL1Saving(currentRate, l1Rate, qty) {
  const cr = Number(currentRate) || 0;
  const l1 = Number(l1Rate) || 0;
  const q = Number(qty) || 0;
  return Math.round((cr - l1) * q * 100) / 100;
}

// ---- FULL ROW CALCULATION ----

function calculateCostSavingRow(row) {
  // If user uploaded their own monthlySaving manually, respect it
  if (row.monthlySaving !== undefined && row.monthlySaving !== null && row.monthlySaving !== 0 && !row._aiCalculated) {
    return row;
  }

  const or = Number(row.oldRate) || 0;
  const nr = Number(row.newRate) || 0;
  const l1 = Number(row.l1Rate) || 0;
  const q = Number(row.qty) || 0;

  const rateDifference = calculateRateDifference(or, nr);
  const monthlySaving = calculateCostSaving(or, nr, q);
  const annualSaving = calculateAnnualSaving(monthlySaving);
  const l1Saving = calculateL1Saving(nr, l1, q);

  return {
    ...row,
    rateDifference,
    monthlySaving,
    annualSaving,
    l1Saving,
    _aiCalculated: true,
  };
}

// ---- AGGREGATION HELPERS ----

function calculateTotalSavings(costSavingRows) {
  let totalMonthlySaving = 0;
  let totalAnnualSaving = 0;
  let totalL1Saving = 0;

  for (const row of costSavingRows) {
    totalMonthlySaving += Number(row.monthlySaving) || 0;
    totalAnnualSaving += Number(row.annualSaving) || 0;
    totalL1Saving += Number(row.l1Saving) || 0;
  }

  return {
    totalMonthlySaving: Math.round(totalMonthlySaving * 100) / 100,
    totalAnnualSaving: Math.round(totalAnnualSaving * 100) / 100,
    totalL1Saving: Math.round(totalL1Saving * 100) / 100,
    itemCount: costSavingRows.length,
  };
}

function calculateCommodityWiseSavings(costSavingRows) {
  const commodityMap = {};
  for (const row of costSavingRows) {
    const commodity = row.commodity || 'Uncategorized';
    if (!commodityMap[commodity]) {
      commodityMap[commodity] = { commodity, monthlySaving: 0, annualSaving: 0, items: 0 };
    }
    commodityMap[commodity].monthlySaving += Number(row.monthlySaving) || 0;
    commodityMap[commodity].annualSaving += Number(row.annualSaving) || 0;
    commodityMap[commodity].items++;
  }

  return Object.values(commodityMap).map(c => ({
    ...c,
    monthlySaving: Math.round(c.monthlySaving * 100) / 100,
    annualSaving: Math.round(c.annualSaving * 100) / 100,
  }));
}

module.exports = {
  calculateRateDifference,
  calculateCostSaving,
  calculateAnnualSaving,
  calculateL1Saving,
  calculateCostSavingRow,
  calculateTotalSavings,
  calculateCommodityWiseSavings,
};
