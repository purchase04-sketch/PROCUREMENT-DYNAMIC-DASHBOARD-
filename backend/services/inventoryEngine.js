/**
 * Inventory Engine — Inventory levels, coverage, shortage, excess and MOQ calculations
 */

function calculateInventoryRow(row) {
  const cs = Number(row.currentStock) || 0;
  const con = Number(row.consumption) || 0;
  const lt = Number(row.leadTime) || 0;
  const moq = Number(row.moq) || 1;
  const ss = Number(row.safetyStock) || 0;
  const rate = Number(row.rate) || 0;

  // Daily Consumption
  const dc = con / 30;

  // Inventory Value
  const inventoryValue = Math.round(cs * rate * 100) / 100;

  // Coverage Days
  const coverageDays = dc > 0 ? Math.round((cs / dc) * 100) / 100 : 9999;

  // Reorder Level
  const rl = ss + (lt * dc);

  // Shortage Qty
  const shortageQty = Math.max(0, Math.round((rl - cs) * 100) / 100);

  // Excess Qty
  const excessQty = Math.max(0, Math.round((cs - (ss + 2 * lt * dc)) * 100) / 100);

  // Required Qty adjusted to MOQ
  let requiredQty = shortageQty;
  if (requiredQty > 0 && moq > 0) {
    requiredQty = Math.ceil(requiredQty / moq) * moq;
  }

  return {
    ...row,
    requiredQty,
    shortageQty,
    excessQty,
    coverageDays,
    inventoryValue,
  };
}

module.exports = {
  calculateInventoryRow,
};
