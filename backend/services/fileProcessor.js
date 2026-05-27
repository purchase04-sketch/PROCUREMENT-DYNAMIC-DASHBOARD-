/**
 * File Processor — Unified file upload, CSV/Excel parsing, column mapping
 * Handles upload, re-upload, copy-paste, and bulk operations
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ---- EXPANDED COLUMN MAPPING ----

const COLUMN_ALIASES = {
  // Item identification
  'item code': 'itemCode', 'part number': 'itemCode', 'part no': 'itemCode',
  'part no.': 'itemCode', 'material code': 'itemCode', 'material no': 'itemCode',
  'sku': 'itemCode', 'product code': 'itemCode', 'component code': 'itemCode',

  // Item name
  'item name': 'itemName', 'description': 'itemName', 'item description': 'itemName',
  'part name': 'itemName', 'material name': 'itemName', 'material description': 'itemName',
  'product name': 'itemName', 'component name': 'itemName',

  // Quantities
  'schedule quantity': 'scheduleQty', 'scheduled qty': 'scheduleQty', 'req qty': 'scheduleQty',
  'required qty': 'scheduleQty', 'order qty': 'scheduleQty', 'po qty': 'scheduleQty',
  'demand qty': 'scheduleQty', 'planned qty': 'scheduleQty',
  'received quantity': 'receivedQty', 'grn qty': 'receivedQty', 'receipt qty': 'receivedQty',
  'supplied qty': 'receivedQty', 'actual qty': 'receivedQty', 'delivered qty': 'receivedQty',
  'pending qty': 'pendingQty', 'balance qty': 'pendingQty', 'remaining qty': 'pendingQty',

  // Dates
  'due date': 'dueDate', 'delivery date': 'dueDate', 'expected date': 'dueDate',
  'schedule date': 'dueDate', 'planned date': 'dueDate', 'target date': 'dueDate',
  'receipt date': 'receiptDate', 'received date': 'receiptDate', 'grn date': 'receiptDate',
  'actual date': 'receiptDate', 'supply date': 'receiptDate',

  // Supplier
  'supplier': 'supplier', 'supplier name': 'supplier', 'vendor': 'supplier',
  'vendor name': 'supplier', 'supplier code': 'supplierCode',

  // Buyer
  'buyer': 'buyer', 'buyer name': 'buyer', 'purchaser': 'buyer',
  'buyer id': 'buyerId',

  // Rates
  'old rate': 'oldRate', 'previous rate': 'oldRate', 'last rate': 'oldRate',
  'new rate': 'newRate', 'current rate': 'newRate', 'latest rate': 'newRate',
  'l1 rate': 'l1Rate', 'lowest rate': 'l1Rate',
  'rate': 'rate', 'unit price': 'rate', 'price': 'rate',

  // Inventory
  'current stock': 'currentStock', 'stock': 'currentStock', 'on hand': 'currentStock',
  'closing stock': 'currentStock', 'available stock': 'currentStock',
  'consumption': 'consumption', 'usage': 'consumption', 'monthly consumption': 'consumption',
  'lead time': 'leadTime', 'lt': 'leadTime', 'delivery lead time': 'leadTime',
  'moq': 'moq', 'min order qty': 'moq', 'minimum order quantity': 'moq',
  'safety stock': 'safetyStock', 'buffer stock': 'safetyStock',

  // VMI
  'sob': 'sob', 'sob %': 'sob', 'share of business': 'sob',
  'vmi days': 'vmiDays', 'vmi period': 'vmiDays',
  'last year consumption': 'lastYearConsumption', 'lyc': 'lastYearConsumption',
  'current schedule': 'currentSchedule',
  'seasonality factor': 'seasonalityFactor', 'seasonality': 'seasonalityFactor',
  'planned vmi': 'plannedVmi', 'actual vmi': 'actualVmi',

  // Meta
  'plant': 'plant', 'location': 'plant', 'factory': 'plant',
  'commodity': 'commodity', 'category': 'category', 'group': 'category',
  'department': 'department', 'dept': 'department',
  'unit': 'unit', 'uom': 'uom', 'unit of measure': 'uom',
  'month': 'month', 'year': 'year', 'financial year': 'financialYear', 'fy': 'financialYear',
  'qty': 'qty', 'quantity': 'qty',
};

// ---- REQUIRED COLUMNS PER COLLECTION ----

const REQUIRED_COLUMNS = {
  schedules: ['itemCode', 'scheduleQty'],
  costsavings: ['oldRate', 'newRate', 'qty'],
  inventory: ['itemCode', 'currentStock'],
  vmiplanning: ['itemCode'],
  vmitracking: ['itemCode'],
};

// ---- COLUMN MAPPING ----

function autoMapColumns(row) {
  const mapped = {};
  for (const key in row) {
    const cleanKey = key.trim().toLowerCase().replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ');
    const mappedKey = COLUMN_ALIASES[cleanKey] || key.trim();
    mapped[mappedKey] = row[key];
  }
  return mapped;
}

// ---- COLUMN VALIDATION ----

function validateColumns(collection, row) {
  const required = REQUIRED_COLUMNS[collection.toLowerCase()] || [];
  const missing = [];
  const present = [];

  for (const col of required) {
    if (row[col] === undefined || row[col] === null || row[col] === '') {
      missing.push(col);
    } else {
      present.push(col);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    present,
    totalColumns: Object.keys(row).length,
  };
}

// ---- DETECT MISSING COLUMNS ----

function detectMissingColumns(collection, rows) {
  if (!rows || rows.length === 0) return { missing: [], suggestions: [] };

  const sampleRow = rows[0];
  const required = REQUIRED_COLUMNS[collection.toLowerCase()] || [];
  const missing = required.filter(col => !(col in sampleRow));

  // Suggest possible mappings
  const suggestions = missing.map(col => {
    const possibleMatches = Object.keys(sampleRow).filter(k => {
      const clean = k.toLowerCase().replace(/[_\-\.]/g, ' ');
      return clean.includes(col.toLowerCase()) || col.toLowerCase().includes(clean);
    });
    return { field: col, possibleMatches };
  });

  return { missing, suggestions };
}

// ---- METADATA ASSIGNMENT ----

function assignMetadata(row, buyerContext) {
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Assign buyer info
  if (buyerContext) {
    if (!row.buyerId) row.buyerId = buyerContext.buyerId || '';
    if (!row.buyer) row.buyer = buyerContext.buyerName || buyerContext.buyer || '';
    if (!row.department) row.department = buyerContext.department || '';
    if (!row.unit) row.unit = buyerContext.unit || '';
  }

  // Determine date for month/year/FY assignment
  let d = new Date();
  if (row.month && row.year) {
    const mIdx = MONTH_NAMES.findIndex(m => String(row.month).toLowerCase().startsWith(m.toLowerCase()));
    if (mIdx !== -1) {
      d = new Date(Number(row.year), mIdx, 1);
    }
  } else if (row.dueDate) {
    d = new Date(row.dueDate);
  }

  const m = d.getMonth(); // 0-indexed
  const y = d.getFullYear();

  // Auto-assign month
  if (!row.month) row.month = MONTH_NAMES[m];
  // Auto-assign year
  if (!row.year) row.year = y;

  // Auto-assign financial year (Apr-Mar)
  // Apr 2025 → Mar 2026 = FY25-26
  let fyStart, fyEnd;
  if (m >= 3) {
    // Apr to Dec → FY starts this year
    fyStart = y;
    fyEnd = y + 1;
  } else {
    // Jan to Mar → FY started last year
    fyStart = y - 1;
    fyEnd = y;
  }
  row.financialYear = `FY${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;

  return row;
}

// ---- FILE TYPE DETECTION ----

function detectFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return 'csv';
  if (ext === '.xlsx' || ext === '.xls') return 'excel';
  return 'unknown';
}

// ---- EXCEL PROCESSING ----

function processExcel(filePath, collection, buyerContext) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws);

  return processRows(rawRows, collection, buyerContext);
}

// ---- CSV PROCESSING ----

function processCSV(filePath, collection, buyerContext) {
  // Use XLSX to parse CSV as well (it handles CSV natively)
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws);

  return processRows(rawRows, collection, buyerContext);
}

// ---- PASTE PROCESSING ----

function processPaste(rows, collection, buyerContext) {
  if (!Array.isArray(rows)) return { processedRows: [], errors: [], warnings: [] };
  return processRows(rows, collection, buyerContext);
}

// ---- CORE ROW PROCESSING ----

function processRows(rawRows, collection, buyerContext) {
  const processedRows = [];
  const errors = [];
  const warnings = [];
  const columnReport = detectMissingColumns(collection, rawRows.map(autoMapColumns));

  if (columnReport.missing.length > 0) {
    warnings.push({
      type: 'MISSING_COLUMNS',
      message: `Missing columns: ${columnReport.missing.join(', ')}`,
      suggestions: columnReport.suggestions,
    });
  }

  for (let i = 0; i < rawRows.length; i++) {
    try {
      // Step 1: Auto-map columns
      let row = autoMapColumns(rawRows[i]);

      // Step 2: Assign unique ID
      row._id = row._id || uuidv4();

      // Step 3: Assign metadata (buyer, month, FY)
      row = assignMetadata(row, buyerContext);

      // Step 4: Validate columns
      const validation = validateColumns(collection, row);
      if (!validation.valid) {
        warnings.push({
          type: 'ROW_VALIDATION',
          rowIndex: i,
          message: `Row ${i + 1}: Missing ${validation.missing.join(', ')}`,
        });
      }

      // Step 5: Type coercion for numeric fields
      const numericFields = [
        'scheduleQty', 'receivedQty', 'pendingQty', 'oldRate', 'newRate', 'l1Rate', 'qty',
        'currentStock', 'consumption', 'leadTime', 'moq', 'safetyStock', 'rate', 'sob',
        'lastYearConsumption', 'currentSchedule', 'vmiDays', 'seasonalityFactor',
        'plannedVmi', 'actualVmi',
      ];
      for (const field of numericFields) {
        if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
          row[field] = Number(row[field]) || 0;
        }
      }

      processedRows.push(row);
    } catch (e) {
      errors.push({ rowIndex: i, message: e.message });
    }
  }

  return {
    processedRows,
    errors,
    warnings,
    totalRaw: rawRows.length,
    totalProcessed: processedRows.length,
    columnReport,
  };
}

// ---- CLEANUP TEMP FILE ----

function cleanupFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.warn('Failed to cleanup temp file:', e.message);
  }
}

module.exports = {
  autoMapColumns,
  validateColumns,
  detectMissingColumns,
  assignMetadata,
  detectFileType,
  processExcel,
  processCSV,
  processPaste,
  processRows,
  cleanupFile,
  COLUMN_ALIASES,
  REQUIRED_COLUMNS,
};
