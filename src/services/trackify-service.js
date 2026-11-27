const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage');
const VENDORS_FILE = path.join(STORAGE_DIR, 'vendors.json');
const INVENTORY_FILE = path.join(STORAGE_DIR, 'inventory.json');

function ensureFiles() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(VENDORS_FILE)) {
    fs.writeFileSync(VENDORS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(INVENTORY_FILE)) {
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify([], null, 2));
  }
}

function getVendors() {
  ensureFiles();
  try {
    return JSON.parse(fs.readFileSync(VENDORS_FILE, 'utf8'));
  } catch (_) {
    return [];
  }
}

function saveVendors(vendors) {
  ensureFiles();
  fs.writeFileSync(VENDORS_FILE, JSON.stringify(vendors, null, 2));
}

function getInventory() {
  ensureFiles();
  try {
    return JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8'));
  } catch (_) {
    return [];
  }
}

function saveInventory(inventory) {
  ensureFiles();
  fs.writeFileSync(INVENTORY_FILE, JSON.stringify(inventory, null, 2));
}

// ── VENDORS OPERATIONS ──────────────────────────────────────────────
function listVendors() {
  const vendors = getVendors();
  const inventory = getInventory();
  
  // Attach current assigned stock count dynamically
  return vendors.map(v => {
    const stockCount = inventory.filter(item => 
      (item.assignedVendor && (item.assignedVendor._id === v._id || item.assignedVendor.id === v._id)) ||
      (item.assignedTo && (item.assignedTo._id === v._id || item.assignedTo.id === v._id))
    ).length;
    return {
      ...v,
      assignedStockCount: stockCount || v.assignedStockCount || 0
    };
  });
}

function createVendor(data) {
  const vendors = getVendors();
  const existing = vendors.find(v => v.email.toLowerCase() === (data.email || '').toLowerCase().trim());
  if (existing) {
    throw new Error('A vendor with this email already exists.');
  }

  const newVendor = {
    _id: data._id || ('vendor_' + crypto.randomBytes(8).toString('hex')),
    name: data.name ? data.name.trim() : 'Vendor User',
    email: (data.email || '').trim(),
    mobile: data.mobile || data.phone || data.mobileNumber || '9999999999',
    role: 'vendor',
    status: data.status || 'Active',
    assignedStockCount: 0,
    adminId: data.adminId || null,
    createdAt: new Date().toISOString()
  };

  vendors.unshift(newVendor);
  saveVendors(vendors);
  return newVendor;
}

function updateVendor(id, data) {
  const vendors = getVendors();
  const idx = vendors.findIndex(v => v._id === id || v.id === id);
  if (idx === -1) {
    throw new Error('Vendor not found.');
  }

  vendors[idx] = {
    ...vendors[idx],
    ...data,
    updatedAt: new Date().toISOString()
  };
  saveVendors(vendors);
  return vendors[idx];
}

function deleteVendor(id) {
  const vendors = getVendors();
  const filtered = vendors.filter(v => v._id !== id && v.id !== id);
  if (filtered.length === vendors.length) {
    throw new Error('Vendor not found.');
  }
  saveVendors(filtered);
  return true;
}

// ── INVENTORY OPERATIONS ────────────────────────────────────────────
function listInventory() {
  return getInventory();
}

function bulkUploadInventory(content, defaultModel = 'M16C Dual-Cam 4G', defaultBrand = 'TrackAnywhere') {
  const inventory = getInventory();
  const lines = content.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  let importedCount = 0;
  const existingImeis = new Set(inventory.map(item => String(item.imei).trim()));

  for (const line of lines) {
    // Skip headers
    if (/^(imei|device|id|sn|model)/i.test(line)) continue;
    
    // Support CSV formats: IMEI, Model, SIM or single IMEI per line
    const parts = line.split(/[,;\t]+/).map(p => p.trim());
    const imei = parts[0];
    if (!imei || imei.length < 5) continue;
    if (existingImeis.has(imei)) continue;

    const model_no = parts[1] || defaultModel;
    const paired_sim = parts[2] || null;

    const newItem = {
      _id: 'inv_' + crypto.randomBytes(8).toString('hex'),
      imei: imei,
      model_no: model_no,
      status: 0, // 0 = Warehouse stock
      assignedTo: null,
      assignedAdmin: null,
      assignedVendor: null,
      assignedCustomer: null,
      paired_sim_number: paired_sim,
      brand: defaultBrand,
      createdAt: new Date().toISOString()
    };

    inventory.unshift(newItem);
    existingImeis.add(imei);
    importedCount++;
  }

  saveInventory(inventory);
  return { importedCount, totalCount: inventory.length };
}

function bulkAssignInventory(imeis, assignedToObj, targetRole = 'vendor') {
  if (!Array.isArray(imeis) || imeis.length === 0) {
    throw new Error('No IMEIs selected for assignment.');
  }

  const inventory = getInventory();
  const imeiSet = new Set(imeis.map(String));
  let modifiedCount = 0;

  for (const item of inventory) {
    if (imeiSet.has(String(item.imei))) {
      item.status = 1; // Assigned
      item.assignedTo = assignedToObj;
      if (targetRole === 'vendor') {
        item.assignedVendor = assignedToObj;
      } else if (targetRole === 'admin') {
        item.assignedAdmin = assignedToObj;
      } else {
        item.assignedCustomer = assignedToObj;
      }
      item.updatedAt = new Date().toISOString();
      modifiedCount++;
    }
  }

  saveInventory(inventory);
  return { modifiedCount };
}

function bulkDeleteInventory(imeis) {
  if (!Array.isArray(imeis) || imeis.length === 0) {
    throw new Error('No IMEIs specified for deletion.');
  }

  const inventory = getInventory();
  const imeiSet = new Set(imeis.map(String));
  const filtered = inventory.filter(item => !imeiSet.has(String(item.imei)));
  const deletedCount = inventory.length - filtered.length;

  saveInventory(filtered);
  return { deletedCount, remainingCount: filtered.length };
}

function updateDevice(idOrImei, updates) {
  const inventory = getInventory();
  const item = inventory.find(i => i._id === idOrImei || String(i.imei) === String(idOrImei));
  if (!item) {
    throw new Error('Inventory item not found.');
  }

  Object.assign(item, updates, { updatedAt: new Date().toISOString() });
  saveInventory(inventory);
  return item;
}

// ── DASHBOARD COUNTS ────────────────────────────────────────────────
function getDashboardCounts() {
  const inventory = getInventory();
  const vendors = getVendors();

  const total = inventory.length;
  const unassigned = inventory.filter(e => e.status === 0 || (!e.assignedAdmin && !e.assignedVendor && !e.assignedCustomer && !e.assignedTo)).length;
  const adminAssigned = inventory.filter(e => e.status === 1 && (e.assignedAdmin || e.assignedVendor || (e.assignedTo && (e.assignedTo.role === 'admin' || e.assignedTo.role === 'vendor')))).length;
  const deployedCustomer = inventory.filter(e => e.status === 1 && (e.assignedCustomer || (e.assignedTo && e.assignedTo.role === 'customer'))).length;
  const directSales = inventory.filter(e => e.status === 1 && e.assignedCustomer && !e.assignedAdmin && !e.assignedVendor).length;
  const deploymentRate = total > 0 ? Math.round((deployedCustomer / total) * 100) : 0;

  return {
    totalAccounts: 30 + vendors.length,
    deployedAssets: 13 + deployedCustomer,
    totalInventory: total,
    unassignedUnits: unassigned,
    adminAssignedUnits: adminAssigned,
    deployedCustomerUnits: deployedCustomer,
    directSalesUnits: directSales,
    deploymentRate: deploymentRate,
    securityAlerts: 0
  };
}

module.exports = {
  listVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  listInventory,
  bulkUploadInventory,
  bulkAssignInventory,
  bulkDeleteInventory,
  updateDevice,
  getDashboardCounts
};
