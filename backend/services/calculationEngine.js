/**
 * Calculation Engine — Master orchestrator routing to modular sub-engines
 * Preserves buyer-wise logic and defaults
 */

const { applyFormulas } = require('./formulaEngine');
const { calculateRowOTD } = require('./otdEngine');
const { calculateCostSavingRow } = require('./costSavingEngine');
const { calculateInventoryRow } = require('./inventoryEngine');
const { calculateForecastRow } = require('./forecastEngine');
const { calculateVMIPlanningRow, calculateVMITrackingRow } = require('./vmiEngine');
const { autoMapColumns, validateColumns, assignMetadata } = require('./fileProcessor');

/**
 * Calculates a single row for a given collection
 */
function calculateRow(collection, row) {
  const colName = collection.toLowerCase();
  
  // 1. Apply any custom formulas first so calculations use updated values
  let calculated = applyFormulas(collection, row, row.buyerId, row.supplierId);
  
  // 2. Delegate to collection-specific engines
  switch (colName) {
    case 'schedules':
      return calculateRowOTD(calculated);
    case 'costsavings':
      return calculateCostSavingRow(calculated);
    case 'inventory':
      return calculateInventoryRow(calculated);
    case 'vmiplanning':
      return calculateVMIPlanningRow(calculated);
    case 'vmitracking':
      return calculateVMITrackingRow(calculated);
    default:
      return calculated;
  }
}

/**
 * Recalculates an entire collection
 */
function recalculateCollection(collection, data) {
  if (!Array.isArray(data)) return [];
  return data.map(row => calculateRow(collection, row));
}

/**
 * Validates, maps, and assigns metadata to a single row
 */
function validateAndAssign(collection, row, buyerContext) {
  const mapped = autoMapColumns(row);
  const withMeta = assignMetadata(mapped, buyerContext);
  const validation = validateColumns(collection, withMeta);
  return {
    row: withMeta,
    valid: validation.valid,
    missing: validation.missing,
    present: validation.present,
  };
}

module.exports = {
  calculateRow,
  recalculateCollection,
  validateAndAssign,
};
