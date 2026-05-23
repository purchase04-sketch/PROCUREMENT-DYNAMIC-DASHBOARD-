const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const models = require('../models/schemas');
const { recalcCollection, calcDashboardKPIs, recalcWithDependencies, validateRow, autoMapColumns, getFormulas, saveCustomFormula, deleteCustomFormula, resetFormulas } = require('../services/calculations');
const { getIsFallbackMode, getLocalCollection, saveLocalCollection } = require('../config/db');

const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

async function getData(collectionName) {
  if (getIsFallbackMode()) {
    return getLocalCollection(collectionName);
  }
  const modelMap = {
    schedules: models.Schedule, costsavings: models.CostSaving,
    inventory: models.Inventory, vmiplanning: models.VmiPlanning,
    vmitracking: models.VmiTracking, buyers: models.Buyer,
    suppliers: models.Supplier, items: models.Item,
    users: models.User, uploadedfiles: models.UploadedFile,
    emailhistory: models.EmailHistory, ailogs: models.AiLog,
  };
  const Model = modelMap[collectionName.toLowerCase()];
  if (!Model) return [];
  return await Model.find({}).lean();
}

async function saveData(collectionName, data) {
  if (getIsFallbackMode()) {
    const col = getLocalCollection(collectionName);
    col.length = 0;
    col.push(...data);
    saveLocalCollection(collectionName);
    return;
  }
  const modelMap = {
    schedules: models.Schedule, costsavings: models.CostSaving,
    inventory: models.Inventory, vmiplanning: models.VmiPlanning,
    vmitracking: models.VmiTracking, buyers: models.Buyer,
    suppliers: models.Supplier, items: models.Item,
    emailhistory: models.EmailHistory,
  };
  const Model = modelMap[collectionName.toLowerCase()];
  if (!Model) return;
  await Model.deleteMany({});
  if (data.length > 0) await Model.insertMany(data);
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
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
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
      if (filters.buyer) r = r.filter(x => x.buyer === filters.buyer);
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

// ============ GENERIC CRUD ============
router.get('/data/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    let data = await getData(collection);
    data = recalcWithDependencies(collection, data);
    const f = req.query;
    if (f.buyer) data = data.filter(x => x.buyer === f.buyer);
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
    let row = { ...req.body, _id: req.body._id || uuidv4() };
    const val = validateRow(collection, row);
    row = val.row;
    let data = await getData(collection);
    data.push(row);
    data = recalcWithDependencies(collection, data);
    await saveData(collection, data);
    if (req.app.io) req.app.io.emit('dataUpdate', { collection });
    res.json({ data, message: 'Row added & recalculated', validation: val });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/data/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    let data = await getData(collection);
    const idx = data.findIndex(r => r._id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    
    let updatedRow = { ...data[idx], ...req.body, _id: id };
    const val = validateRow(collection, updatedRow);
    data[idx] = val.row;
    
    data = recalcWithDependencies(collection, data);
    await saveData(collection, data);
    if (req.app.io) req.app.io.emit('dataUpdate', { collection });
    res.json({ data, message: 'Updated & recalculated', validation: val });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/data/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    let data = await getData(collection);
    data = data.filter(r => r._id !== id);
    data = recalcWithDependencies(collection, data);
    await saveData(collection, data);
    if (req.app.io) req.app.io.emit('dataUpdate', { collection });
    res.json({ data, message: 'Deleted & recalculated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/data/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    let data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected array' });
    data = data.map(r => validateRow(collection, r).row);
    data = recalcWithDependencies(collection, data);
    await saveData(collection, data);
    if (req.app.io) req.app.io.emit('dataUpdate', { collection });
    res.json({ data, message: 'Bulk updated & recalculated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ UPLOAD ============
router.post('/upload/:collection', upload.single('file'), async (req, res) => {
  try {
    const { collection } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws);
    
    const withIds = rawRows.map(r => {
      let mapped = autoMapColumns(r);
      mapped._id = mapped._id || uuidv4();
      return validateRow(collection, mapped).row;
    });
    
    let existing = await getData(collection);
    existing.push(...withIds);
    existing = recalcWithDependencies(collection, existing);
    await saveData(collection, existing);
    
    if (getIsFallbackMode()) {
      const files = getLocalCollection('uploadedfiles');
      files.push({ _id: uuidv4(), filename: req.file.filename, originalName: req.file.originalname, rowCount: rawRows.length, targetCollection: collection, uploadedAt: new Date().toISOString() });
      saveLocalCollection('uploadedfiles');
    }
    fs.unlinkSync(req.file.path);
    if (req.app.io) req.app.io.emit('dataUpdate', { collection });
    res.json({ data: existing, rowCount: rawRows.length, message: `Uploaded ${rawRows.length} rows & recalculated` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/paste/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Expected rows array' });
    
    const withIds = rows.map(r => {
      let mapped = autoMapColumns(r);
      mapped._id = mapped._id || uuidv4();
      return validateRow(collection, mapped).row;
    });
    
    let existing = await getData(collection);
    existing.push(...withIds);
    existing = recalcWithDependencies(collection, existing);
    await saveData(collection, existing);
    
    if (req.app.io) req.app.io.emit('dataUpdate', { collection });
    res.json({ data: existing, message: `Pasted ${rows.length} rows & recalculated` });
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
