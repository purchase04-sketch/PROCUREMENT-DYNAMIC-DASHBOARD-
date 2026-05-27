const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let isFallbackMode = false;
let localData = {};

const DATA_DIR = path.join(__dirname, '..', 'data');

const collections = [
  'users', 'buyers', 'suppliers', 'items', 'schedules',
  'inventory', 'vmiplanning', 'vmitracking', 'costsavings',
  'uploadedfiles', 'emailhistory', 'ailogs'
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  collections.forEach(col => {
    const filePath = path.join(DATA_DIR, `${col}.json`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', 'utf-8');
    }
    localData[col] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  });
}

function saveCollection(name) {
  const filePath = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(localData[name], null, 2), 'utf-8');
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('ℹ️  No MONGODB_URI configured in .env. Starting in Local Offline Mode...');
    isFallbackMode = true;
    ensureDataDir();
    console.log('✅ Local JSON Database initialized');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });
    console.log('✅ Connected to MongoDB');
    isFallbackMode = false;
  } catch (err) {
    console.warn('⚠️  MongoDB connection failed:', err.message);
    console.log('📁 Switching to Local JSON File Database...');
    isFallbackMode = true;
    ensureDataDir();
    console.log('✅ Local JSON Database initialized');
  }
}

function getIsFallbackMode() {
  return isFallbackMode;
}

function getLocalData() {
  return localData;
}

function getLocalCollection(name) {
  const key = name.toLowerCase();
  if (!localData[key]) {
    localData[key] = [];
    saveCollection(key);
  }
  return localData[key];
}

function saveLocalCollection(name) {
  saveCollection(name.toLowerCase());
}

module.exports = {
  connectDB,
  getIsFallbackMode,
  getLocalData,
  getLocalCollection,
  saveLocalCollection,
};
