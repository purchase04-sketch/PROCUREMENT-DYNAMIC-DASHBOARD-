/**
 * Formula Engine — Dynamic, editable formula system
 * Uses mathjs for safe mathematical expression evaluation
 */

const fs = require('fs');
const path = require('path');
let math;
try {
  math = require('mathjs');
} catch (e) {
  console.warn('mathjs not installed, using basic eval fallback');
  math = null;
}

const FORMULAS_FILE = path.join(__dirname, '..', 'data', 'formulas.json');
const DEFAULTS_FILE = path.join(__dirname, '..', 'data', 'default_formulas.json');

// Default formulas that ship with the system
const BUILT_IN_FORMULAS = [
  {
    id: 'default_pending_qty',
    name: 'Pending Quantity',
    collection: 'schedules',
    field: 'pendingQty',
    expression: 'max(0, scheduleQty - receivedQty)',
    scope: 'global',
    scopeValue: '',
    isDefault: true,
    description: 'Calculates remaining quantity to be received',
    createdBy: 'system',
  },
  {
    id: 'default_schedule_adherence',
    name: 'Schedule Adherence %',
    collection: 'schedules',
    field: 'scheduleAdherence',
    expression: 'scheduleQty > 0 ? (receivedQty / scheduleQty) * 100 : 0',
    scope: 'global',
    scopeValue: '',
    isDefault: true,
    description: 'Percentage of scheduled quantity received',
    createdBy: 'system',
  },
  {
    id: 'default_rate_difference',
    name: 'Rate Difference',
    collection: 'costsavings',
    field: 'rateDifference',
    expression: 'oldRate - newRate',
    scope: 'global',
    scopeValue: '',
    isDefault: true,
    description: 'Difference between old and new rate',
    createdBy: 'system',
  },
  {
    id: 'default_monthly_saving',
    name: 'Monthly Saving',
    collection: 'costsavings',
    field: 'monthlySaving',
    expression: '(oldRate - newRate) * qty',
    scope: 'global',
    scopeValue: '',
    isDefault: true,
    description: 'Monthly cost saving amount',
    createdBy: 'system',
  },
  {
    id: 'default_annual_saving',
    name: 'Annual Saving',
    collection: 'costsavings',
    field: 'annualSaving',
    expression: '(oldRate - newRate) * qty * 12',
    scope: 'global',
    scopeValue: '',
    isDefault: true,
    description: 'Annual cost saving projection',
    createdBy: 'system',
  },
  {
    id: 'default_l1_saving',
    name: 'L1 Saving',
    collection: 'costsavings',
    field: 'l1Saving',
    expression: '(newRate - l1Rate) * qty',
    scope: 'global',
    scopeValue: '',
    isDefault: true,
    description: 'Savings compared to L1 rate',
    createdBy: 'system',
  },
  {
    id: 'default_inventory_value',
    name: 'Inventory Value',
    collection: 'inventory',
    field: 'inventoryValue',
    expression: 'currentStock * rate',
    scope: 'global',
    scopeValue: '',
    isDefault: true,
    description: 'Current stock monetary value',
    createdBy: 'system',
  },
  {
    id: 'default_coverage_days',
    name: 'Coverage Days',
    collection: 'inventory',
    field: 'coverageDays',
    expression: 'consumption > 0 ? (currentStock / (consumption / 30)) : 9999',
    scope: 'global',
    scopeValue: '',
    isDefault: true,
    description: 'Days of stock coverage remaining',
    createdBy: 'system',
  },
  {
    id: 'default_forecast_qty',
    name: 'Forecast Quantity',
    collection: 'vmiplanning',
    field: 'forecastQty',
    expression: '((lastYearConsumption / 12 + currentSchedule) / 2) * seasonalityFactor',
    scope: 'global',
    scopeValue: '',
    isDefault: true,
    description: 'Forecasted quantity based on moving average and seasonality',
    createdBy: 'system',
  },
  {
    id: 'default_vmi_qty',
    name: 'VMI Quantity',
    collection: 'vmiplanning',
    field: 'vmiQty',
    expression: '(((lastYearConsumption / 12 + currentSchedule) / 2) * vmiDays / 30 * (sob / 100)) + safetyStock',
    scope: 'global',
    scopeValue: '',
    isDefault: true,
    description: 'Vendor Managed Inventory quantity',
    createdBy: 'system',
  },
];

let customFormulas = [];

// ---- PERSISTENCE ----

function ensureDataDir() {
  const dir = path.dirname(FORMULAS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadFormulas() {
  ensureDataDir();
  try {
    if (fs.existsSync(FORMULAS_FILE)) {
      customFormulas = JSON.parse(fs.readFileSync(FORMULAS_FILE, 'utf8'));
    } else {
      customFormulas = [...BUILT_IN_FORMULAS];
      saveFormulasToFile();
    }
  } catch (e) {
    console.error('Error loading formulas:', e.message);
    customFormulas = [...BUILT_IN_FORMULAS];
  }
}

function saveFormulasToFile() {
  ensureDataDir();
  fs.writeFileSync(FORMULAS_FILE, JSON.stringify(customFormulas, null, 2));
}

// Initialize on load
loadFormulas();

// ---- SAFE EVALUATION ----

function evaluateFormula(expression, variables) {
  try {
    if (math) {
      // Use mathjs for safe, sandboxed evaluation
      const scope = {};
      for (const [key, val] of Object.entries(variables)) {
        scope[key] = Number(val) || 0;
      }
      const result = math.evaluate(expression, scope);
      return typeof result === 'number' && isFinite(result) ? Math.round(result * 100) / 100 : null;
    } else {
      // Fallback: Function-based evaluation
      const keys = Object.keys(variables);
      const values = keys.map(k => Number(variables[k]) || 0);
      const func = new Function(...keys, `return ${expression}`);
      const result = func(...values);
      return typeof result === 'number' && isFinite(result) ? Math.round(result * 100) / 100 : null;
    }
  } catch (e) {
    return null;
  }
}

function validateExpression(expression) {
  try {
    if (math) {
      math.parse(expression);
      return { valid: true };
    }
    // Basic validation for fallback
    new Function('x', `return ${expression.replace(/[a-zA-Z_]\w*/g, '0')}`);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ---- CRUD ----

function createFormula(formula) {
  const id = formula.id || `formula_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newFormula = {
    id,
    name: formula.name || 'Unnamed Formula',
    collection: formula.collection,
    field: formula.field,
    expression: formula.expression,
    scope: formula.scope || 'global',
    scopeValue: formula.scopeValue || '',
    isDefault: false,
    description: formula.description || '',
    createdBy: formula.createdBy || 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validation = validateExpression(newFormula.expression);
  if (!validation.valid) {
    throw new Error(`Invalid formula expression: ${validation.error}`);
  }

  customFormulas.push(newFormula);
  saveFormulasToFile();
  return newFormula;
}

function updateFormula(id, updates) {
  const idx = customFormulas.findIndex(f => f.id === id);
  if (idx === -1) throw new Error(`Formula ${id} not found`);

  if (updates.expression) {
    const validation = validateExpression(updates.expression);
    if (!validation.valid) {
      throw new Error(`Invalid formula expression: ${validation.error}`);
    }
  }

  customFormulas[idx] = {
    ...customFormulas[idx],
    ...updates,
    id, // preserve ID
    updatedAt: new Date().toISOString(),
  };
  saveFormulasToFile();
  return customFormulas[idx];
}

function deleteFormula(id) {
  const before = customFormulas.length;
  customFormulas = customFormulas.filter(f => f.id !== id);
  if (customFormulas.length === before) throw new Error(`Formula ${id} not found`);
  saveFormulasToFile();
  return { deleted: true };
}

function getFormulas(filters = {}) {
  let result = [...customFormulas];
  if (filters.collection) result = result.filter(f => f.collection === filters.collection);
  if (filters.scope) result = result.filter(f => f.scope === filters.scope);
  if (filters.field) result = result.filter(f => f.field === filters.field);
  return result;
}

function resetToDefaults() {
  customFormulas = [...BUILT_IN_FORMULAS];
  saveFormulasToFile();
  return customFormulas;
}

// ---- APPLICATION ----

function applyFormulas(collection, row, buyerId, supplierId) {
  // Get all formulas applicable to this collection
  const matching = customFormulas.filter(f => {
    if (f.collection !== collection) return false;
    if (f.scope === 'global') return true;
    if (f.scope === 'buyer' && f.scopeValue === buyerId) return true;
    if (f.scope === 'buyer' && f.scopeValue === row.buyer) return true;
    if (f.scope === 'supplier' && f.scopeValue === supplierId) return true;
    if (f.scope === 'supplier' && f.scopeValue === row.supplier) return true;
    return false;
  });

  // Sort: global first, then buyer, then supplier (most specific wins)
  matching.sort((a, b) => {
    const order = { global: 0, buyer: 1, supplier: 2 };
    return (order[a.scope] || 0) - (order[b.scope] || 0);
  });

  // Build variables from the row
  const variables = {};
  for (const [key, val] of Object.entries(row)) {
    if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)) && val !== '')) {
      variables[key] = Number(val);
    }
  }

  // Apply each formula
  for (const formula of matching) {
    const result = evaluateFormula(formula.expression, variables);
    if (result !== null) {
      row[formula.field] = result;
      variables[formula.field] = result; // Make available for chained formulas
    }
  }

  return row;
}

module.exports = {
  createFormula,
  updateFormula,
  deleteFormula,
  getFormulas,
  resetToDefaults,
  evaluateFormula,
  validateExpression,
  applyFormulas,
  BUILT_IN_FORMULAS,
  loadFormulas,
};
