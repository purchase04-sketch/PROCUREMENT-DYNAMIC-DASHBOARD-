const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// ============ USER ============
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Buyer', 'Supplier', 'Viewer'], default: 'Buyer' },
}, { timestamps: true });

// ============ BUYER ============
const buyerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: String,
  department: String,
  kpiTarget: { type: Number, default: 90 },
}, { timestamps: true });

// ============ SUPPLIER ============
const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: String,
  email: String,
  contactNumber: String,
  riskScore: { type: Number, default: 0 },
  otd: { type: Number, default: 0 },
  scheduleAdherence: { type: Number, default: 0 },
}, { timestamps: true });

// ============ ITEM ============
const itemSchema = new mongoose.Schema({
  itemCode: { type: String, required: true },
  name: { type: String, required: true },
  category: String,
  commodity: String,
  uom: String,
  baseRate: { type: Number, default: 0 },
}, { timestamps: true });

// ============ SCHEDULE ============
const scheduleSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  buyer: String,
  supplier: String,
  itemCode: String,
  itemName: String,
  scheduleQty: { type: Number, default: 0 },
  receivedQty: { type: Number, default: 0 },
  dueDate: Date,
  receiptDate: Date,
  month: String,
  year: Number,
  plant: String,
  commodity: String,
  category: String,
  // Auto-calculated fields
  pendingQty: { type: Number, default: 0 },
  delayDays: { type: Number, default: 0 },
  scheduleAdherence: { type: Number, default: 0 },
  otd: { type: Number, default: 0 },
  supplierStatus: { type: String, default: 'Green' },
}, { timestamps: true });

// ============ COST SAVING ============
const costSavingSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  buyer: String,
  supplier: String,
  itemCode: String,
  itemName: String,
  oldRate: { type: Number, default: 0 },
  newRate: { type: Number, default: 0 },
  l1Rate: { type: Number, default: 0 },
  qty: { type: Number, default: 0 },
  commodity: String,
  category: String,
  month: String,
  year: Number,
  // Auto-calculated
  rateDifference: { type: Number, default: 0 },
  monthlySaving: { type: Number, default: 0 },
  annualSaving: { type: Number, default: 0 },
  l1Saving: { type: Number, default: 0 },
}, { timestamps: true });

// ============ INVENTORY ============
const inventorySchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  itemCode: String,
  itemName: String,
  buyer: String,
  supplier: String,
  currentStock: { type: Number, default: 0 },
  consumption: { type: Number, default: 0 },
  leadTime: { type: Number, default: 0 },
  moq: { type: Number, default: 0 },
  safetyStock: { type: Number, default: 0 },
  sob: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  plant: String,
  commodity: String,
  category: String,
  month: String,
  year: Number,
  // Auto-calculated
  requiredQty: { type: Number, default: 0 },
  shortageQty: { type: Number, default: 0 },
  excessQty: { type: Number, default: 0 },
  coverageDays: { type: Number, default: 0 },
  inventoryValue: { type: Number, default: 0 },
}, { timestamps: true });

// ============ VMI PLANNING ============
const vmiPlanningSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  supplier: String,
  itemCode: String,
  itemName: String,
  buyer: String,
  lastYearConsumption: { type: Number, default: 0 },
  currentSchedule: { type: Number, default: 0 },
  sob: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  safetyStock: { type: Number, default: 0 },
  vmiDays: { type: Number, default: 30 },
  seasonalityFactor: { type: Number, default: 1 },
  plant: String,
  commodity: String,
  category: String,
  month: String,
  year: Number,
  // Auto-calculated
  movingAverage: { type: Number, default: 0 },
  forecastQty: { type: Number, default: 0 },
  supplierPlannedQty: { type: Number, default: 0 },
  predictiveQty: { type: Number, default: 0 },
  vmiQty: { type: Number, default: 0 },
}, { timestamps: true });

// ============ VMI TRACKING ============
const vmiTrackingSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  supplier: String,
  itemCode: String,
  itemName: String,
  buyer: String,
  plannedVmi: { type: Number, default: 0 },
  actualVmi: { type: Number, default: 0 },
  plant: String,
  commodity: String,
  category: String,
  month: String,
  year: Number,
  // Auto-calculated
  gapQty: { type: Number, default: 0 },
  vmiCompliance: { type: Number, default: 0 },
}, { timestamps: true });

// ============ UPLOADED FILE ============
const uploadedFileSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  uploadedBy: String,
  uploadedAt: { type: Date, default: Date.now },
  rowCount: { type: Number, default: 0 },
  targetCollection: String,
}, { timestamps: true });

// ============ EMAIL HISTORY ============
const emailHistorySchema = new mongoose.Schema({
  recipient: String,
  recipientEmail: String,
  subject: String,
  body: String,
  status: { type: String, enum: ['Draft', 'Sent', 'Failed'], default: 'Draft' },
  sentAt: Date,
  type: { type: String, enum: ['Reminder', 'Escalation', 'Urgency', 'VMI'], default: 'Reminder' },
  buyer: String,
  supplier: String,
}, { timestamps: true });

// ============ AI LOG ============
const aiLogSchema = new mongoose.Schema({
  prompt: String,
  response: String,
  user: String,
  tabContext: String,
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

// Export all models
const models = {
  User: mongoose.model('User', userSchema),
  Buyer: mongoose.model('Buyer', buyerSchema),
  Supplier: mongoose.model('Supplier', supplierSchema),
  Item: mongoose.model('Item', itemSchema),
  Schedule: mongoose.model('Schedule', scheduleSchema),
  CostSaving: mongoose.model('CostSaving', costSavingSchema),
  Inventory: mongoose.model('Inventory', inventorySchema),
  VmiPlanning: mongoose.model('VmiPlanning', vmiPlanningSchema),
  VmiTracking: mongoose.model('VmiTracking', vmiTrackingSchema),
  UploadedFile: mongoose.model('UploadedFile', uploadedFileSchema),
  EmailHistory: mongoose.model('EmailHistory', emailHistorySchema),
  AiLog: mongoose.model('AiLog', aiLogSchema),
};

module.exports = models;
