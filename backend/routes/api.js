const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const models = require('../models/schemas');

const { getFormulas, saveCustomFormula, deleteCustomFormula, resetFormulas } = require('../services/calculations');
const { getIsFallbackMode, getLocalCollection, saveLocalCollection } = require('../config/db');
const { onDataChange, fullRecalculation, exportRecalculatedData } = require('../services/recalculationService');
const { processExcel, processCSV, processPaste } = require('../services/fileProcessor');

// Multer Setup
const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

async function getData(collectionName) {
  const colKey = collectionName.toLowerCase();
  if (getIsFallbackMode()) {
    return getLocalCollection(colKey);
  }
  const modelMap = {
    schedules: models.Schedule,
    costsavings: models.CostSaving,
    inventory: models.Inventory,
    vmiplanning: models.VmiPlanning,
    vmitracking: models.VmiTracking,
    buyers: models.Buyer,
    suppliers: models.Supplier,
    items: models.Item,
    users: models.User,
    uploadedfiles: models.UploadedFile,
    emailhistory: models.EmailHistory,
    ailogs: models.AiLog,
    buyerprofiles: models.BuyerProfile,
    formulas: models.Formula,
    otdrecords: models.OTDRecord,
  };
  const Model = modelMap[colKey];
  if (!Model) return [];
  return await Model.find({}).lean();
}

async function saveData(collectionName, data) {
  const colKey = collectionName.toLowerCase();
  if (getIsFallbackMode()) {
    const col = getLocalCollection(colKey);
    col.length = 0;
    col.push(...data);
    saveLocalCollection(colKey);
    return;
  }
  const modelMap = {
    schedules: models.Schedule,
    costsavings: models.CostSaving,
    inventory: models.Inventory,
    vmiplanning: models.VmiPlanning,
    vmitracking: models.VmiTracking,
    buyers: models.Buyer,
    suppliers: models.Supplier,
    items: models.Item,
    emailhistory: models.EmailHistory,
    buyerprofiles: models.BuyerProfile,
    formulas: models.Formula,
    otdrecords: models.OTDRecord,
  };
  const Model = modelMap[colKey];
  if (!Model) return;
  await Model.deleteMany({});
  if (data.length > 0) {
    await Model.insertMany(data);
  }
}

// ============ AUTH ============
router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hash = await bcrypt.hash(password, 10);
    if (getIsFallbackMode()) {
      const users = getLocalCollection('users');
      if (users.find(u => u.email === email)) return res.status(400).json({ error: 'User exists' });
      users.push({ _id: uuidv4(), name, email, password: hash, role: role || 'Buyer' });
      saveLocalCollection('users');
    } else {
      const exists = await models.User.findOne({ email });
      if (exists) return res.status(400).json({ error: 'User exists' });
      await models.User.create({ name, email, password: hash, role: role || 'Buyer' });
    }
    res.json({ message: 'Registered successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user;
    if (getIsFallbackMode()) {
      user = getLocalCollection('users').find(u => u.email === email);
    } else {
      user = await models.User.findOne({ email }).lean();
    }
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET || 'jwt_secret_fallback', { expiresIn: '24h' });
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ BUYER PROFILES ============
router.post('/buyers/profile', async (req, res) => {
  try {
    const { buyerId, buyerName, department, unit, email, commodities } = req.body;
    const profile = { _id: uuidv4(), buyerId, buyerName, department, unit, email, commodities: commodities || [] };
    
    let profiles = await getData('buyerprofiles');
    profiles.push(profile);
    await saveData('buyerprofiles', profiles);
    
    res.json({ message: 'Buyer profile created successfully', data: profile });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/buyers/profile', async (req, res) => {
  try {
    const profiles = await getData('buyerprofiles');
    res.json(profiles);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/buyers/profile/:id', async (req, res) => {
  try {
    const profiles = await getData('buyerprofiles');
    const profile = profiles.find(p => p.buyerId === req.params.id || p._id === req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/buyers/profile/:id', async (req, res) => {
  try {
    const profiles = await getData('buyerprofiles');
    const idx = profiles.findIndex(p => p.buyerId === req.params.id || p._id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Profile not found' });
    
    profiles[idx] = { ...profiles[idx], ...req.body };
    await saveData('buyerprofiles', profiles);
    res.json({ message: 'Buyer profile updated', data: profiles[idx] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ DASHBOARD ============
router.get('/dashboard', async (req, res) => {
  try {
    const filters = req.query;
    let schedules = await getData('schedules');
    let costSavings = await getData('costsavings');
    let inventory = await getData('inventory');
    let vmiTracking = await getData('vmitracking');
    
    const applyF = (arr) => {
      let r = arr;
      if (filters.buyer) r = r.filter(x => x.buyer === filters.buyer || x.buyerId === filters.buyer);
      if (filters.supplier) r = r.filter(x => x.supplier === filters.supplier);
      if (filters.month) r = r.filter(x => x.month === filters.month);
      if (filters.year) r = r.filter(x => String(x.year) === String(filters.year));
      if (filters.plant) r = r.filter(x => x.plant === filters.plant);
      if (filters.commodity) r = r.filter(x => x.commodity === filters.commodity);
      if (filters.category) r = r.filter(x => x.category === filters.category);
      return r;
    };
    
    schedules = applyF(schedules);
    costSavings = applyF(costSavings);
    inventory = applyF(inventory);
    vmiTracking = applyF(vmiTracking);
    
    const { calcDashboardKPIs } = require('../services/calculations');
    const kpis = calcDashboardKPIs(schedules, costSavings, inventory, vmiTracking);
    
    const supplierMap = {};
    schedules.forEach(s => {
      if (!s.supplier) return;
      if (!supplierMap[s.supplier]) supplierMap[s.supplier] = { scheduled: 0, received: 0, onTime: 0, total: 0 };
      supplierMap[s.supplier].scheduled += Number(s.scheduleQty) || 0;
      supplierMap[s.supplier].received += Number(s.receivedQty) || 0;
      if (s.otd === 100) supplierMap[s.supplier].onTime++;
      if (s.receiptDate) supplierMap[s.supplier].total++;
    });
    
    const supplierHeatmap = Object.entries(supplierMap).map(([name, d]) => ({
      name, scheduled: d.scheduled, received: d.received,
      otd: d.total > 0 ? Math.round((d.onTime / d.total) * 100) : 0
    }));
    
    const monthMap = {};
    schedules.forEach(s => {
      const k = `${s.month}-${s.year}`;
      if (!monthMap[k]) monthMap[k] = { month: k, scheduled: 0, received: 0, pending: 0 };
      monthMap[k].scheduled += Number(s.scheduleQty) || 0;
      monthMap[k].received += Number(s.receivedQty) || 0;
      monthMap[k].pending += Number(s.pendingQty) || 0;
    });
    
    const commodityMap = {};
    costSavings.forEach(c => {
      if (!c.commodity) return;
      commodityMap[c.commodity] = (commodityMap[c.commodity] || 0) + (Number(c.monthlySaving) || 0);
    });
    
    res.json({
      kpis, supplierHeatmap,
      scheduleVsSupply: Object.values(monthMap),
      commoditySpend: Object.entries(commodityMap).map(([name, value]) => ({ name, value: Math.round(value) })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ FORMULAS ============
router.get('/formulas', (req, res) => { res.json(getFormulas()); });
router.post('/formulas', (req, res) => {
  const f = { ...req.body, id: req.body.id || uuidv4() };
  saveCustomFormula(f);
  res.json({ message: 'Formula saved', formula: f });
});
router.delete('/formulas/:id', (req, res) => {
  deleteCustomFormula(req.params.id);
  res.json({ message: 'Formula deleted' });
});
router.post('/formulas/reset', (req, res) => {
  resetFormulas();
  res.json({ message: 'Formulas reset to default' });
});

// ============ OTD RECORDS ============
router.get('/otd/supplier/:supplierId', async (req, res) => {
  try {
    const otds = await getData('otdrecords');
    const result = otds.filter(o => o.supplierId === req.params.supplierId);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/otd/monthly', async (req, res) => {
  try {
    const otds = await getData('otdrecords');
    res.json(otds);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ RECALCULATION TRIGGERS ============
router.post('/recalculate/all', async (req, res) => {
  try {
    const { buyerId } = req.body;
    await fullRecalculation(buyerId, req.app.io);
    res.json({ message: 'Full recalculation completed successfully across all collections' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/recalculate/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const { buyerId } = req.body;
    const data = await getData(collection);
    await onDataChange({ collection, data, buyerId }, req.app.io);
    res.json({ message: `Collection [${collection}] recalculated successfully` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ EXPORT DATA ============
router.get('/export/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const { buyerId } = req.query;
    
    const buffer = await exportRecalculatedData(buyerId, collection);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${collection}_recalculated.xlsx`);
    res.send(buffer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ GENERIC CRUD ============
router.get('/data/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    let data = await getData(collection);
    const f = req.query;
    if (f.buyer) data = data.filter(x => x.buyer === f.buyer || x.buyerId === f.buyer);
    if (f.supplier) data = data.filter(x => x.supplier === f.supplier);
    if (f.month) data = data.filter(x => x.month === f.month);
    if (f.year) data = data.filter(x => String(x.year) === String(f.year));
    if (f.plant) data = data.filter(x => x.plant === f.plant);
    if (f.commodity) data = data.filter(x => x.commodity === f.commodity);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/data/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const row = { ...req.body, _id: req.body._id || uuidv4() };
    
    let data = await getData(collection);
    data.push(row);
    
    await onDataChange({ collection, data, buyerId: row.buyerId || row.buyer }, req.app.io);
    res.json({ message: 'Row added & recalculated successfully', data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/data/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    let data = await getData(collection);
    const idx = data.findIndex(r => r._id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    
    const updatedRow = { ...data[idx], ...req.body, _id: id };
    data[idx] = updatedRow;
    
    await onDataChange({ collection, data, buyerId: updatedRow.buyerId || updatedRow.buyer }, req.app.io);
    res.json({ message: 'Updated & recalculated successfully', data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/data/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    let data = await getData(collection);
    const row = data.find(r => r._id === id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    
    data = data.filter(r => r._id !== id);
    
    await onDataChange({ collection, data, buyerId: row.buyerId || row.buyer }, req.app.io);
    res.json({ message: 'Deleted & recalculated successfully', data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/data/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const rows = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Expected array' });
    
    await onDataChange({ collection, data: rows, buyerId: rows[0]?.buyerId }, req.app.io);
    res.json({ message: 'Bulk updated & recalculated successfully', data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ UPLOAD ============
router.post('/upload/:collection', upload.single('file'), async (req, res) => {
  try {
    const { collection } = req.params;
    const { buyerId, buyerName, department, unit } = req.body;
    const buyerContext = buyerId ? { buyerId, buyerName, department, unit } : null;
    
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    let result;
    if (ext === '.csv') {
      result = processCSV(req.file.path, collection, buyerContext);
    } else {
      result = processExcel(req.file.path, collection, buyerContext);
    }
    
    let existing = await getData(collection);
    existing.push(...result.processedRows);
    
    await onDataChange({ collection, data: existing, buyerId }, req.app.io);
    
    if (getIsFallbackMode()) {
      const files = getLocalCollection('uploadedfiles');
      files.push({ _id: uuidv4(), filename: req.file.filename, originalName: req.file.originalname, rowCount: result.totalProcessed, targetCollection: collection, uploadedAt: new Date().toISOString() });
      saveLocalCollection('uploadedfiles');
    }
    
    fs.unlinkSync(req.file.path);
    res.json({ message: `Uploaded ${result.totalProcessed} rows & recalculated`, data: existing });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/data/:collection/bulk-paste', async (req, res) => {
  try {
    const { collection } = req.params;
    const { rows, buyerId, buyerName, department, unit } = req.body;
    const buyerContext = buyerId ? { buyerId, buyerName, department, unit } : null;
    
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Expected rows array' });
    
    const result = processPaste(rows, collection, buyerContext);
    let existing = await getData(collection);
    existing.push(...result.processedRows);
    
    await onDataChange({ collection, data: existing, buyerId }, req.app.io);
    res.json({ message: `Pasted ${result.totalProcessed} rows & recalculated`, data: existing });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/paste/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Expected rows array' });
    
    const result = processPaste(rows, collection, null);
    let existing = await getData(collection);
    existing.push(...result.processedRows);
    
    await onDataChange({ collection, data: existing }, req.app.io);
    res.json({ message: `Pasted ${result.totalProcessed} rows & recalculated`, data: existing });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ AI CHAT ============
router.post('/ai/chat', async (req, res) => {
  try {
    const { prompt, tabContext, gridData, filters } = req.body;
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const fString = filters ? JSON.stringify(filters) : '{}';
    const cFormulas = JSON.stringify(getFormulas());
    
    const systemMsg = `You are a world-class AI Procurement Analyst. Act exactly like ChatGPT but specialized in procurement.
You have access to the active user's view context:
Current Tab: ${tabContext || 'Dashboard'}
Active Filters: ${fString}
Custom Formulas Active: ${cFormulas}
Data Summary (Max 50 rows): ${JSON.stringify(gridData ? gridData.slice(0, 50) : []).substring(0, 4000)}

Capabilities:
- If the user asks about anomalies, use the data summary.
- If asked for formulas, write them mathematically. You can also suggest JavaScript expressions that they can save.
- Always use the current filters (buyer, month, financial year) when discussing data.
- Never use or hallucinate unrelated data.
- If they ask for emails, draft them clearly.
Respond dynamically and conversationally.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });
    const response = completion.choices[0].message.content;
    
    if (getIsFallbackMode()) {
      const logs = getLocalCollection('ailogs');
      logs.push({ _id: uuidv4(), prompt, response, tabContext, timestamp: new Date().toISOString() });
      saveLocalCollection('ailogs');
    }
    res.json({ response });
  } catch (e) {
    console.error('AI Error:', e.message);
    res.json({ response: `AI Analysis (Offline Mode):\n\nBased on your filters (${JSON.stringify(req.body.filters)}):\n• Review supplier performance metrics for anomalies\n• Evaluate current stock coverage\n\n_Note: Connect OpenAI API for detailed natural language chat._` });
  }
});

// ============ EMAIL ============
router.get('/emails', async (req, res) => {
  try { res.json(await getData('emailhistory')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/emails', async (req, res) => {
  try {
    const email = { ...req.body, _id: uuidv4(), status: 'Draft', createdAt: new Date().toISOString() };
    let data = await getData('emailhistory');
    data.push(email);
    await saveData('emailhistory', data);
    res.json({ message: 'Email draft created', data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/emails/:id', async (req, res) => {
  try {
    let data = await getData('emailhistory');
    const idx = data.findIndex(e => e._id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    data[idx] = { ...data[idx], ...req.body };
    await saveData('emailhistory', data);
    res.json({ message: 'Email updated', data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Filter options
router.get('/filters', async (req, res) => {
  try {
    const schedules = await getData('schedules');
    const costSavings = await getData('costsavings');
    const inventory = await getData('inventory');
    const all = [...schedules, ...costSavings, ...inventory];
    const unique = (key) => [...new Set(all.map(r => r[key]).filter(Boolean))].sort();
    res.json({
      buyers: unique('buyer'), suppliers: unique('supplier'),
      commodities: unique('commodity'), plants: unique('plant'),
      categories: unique('category'), months: unique('month'),
      years: unique('year'), items: unique('itemCode'),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
