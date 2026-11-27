const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage');
const VENDORS_FILE = path.join(STORAGE_DIR, 'vendors.json');
const INVENTORY_FILE = path.join(STORAGE_DIR, 'inventory.json');

const PLANS_FILE = path.join(STORAGE_DIR, 'plans.json');
const ADMINS_FILE = path.join(STORAGE_DIR, 'admins.json');

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
  if (!fs.existsSync(PLANS_FILE)) {
    fs.writeFileSync(PLANS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(ADMINS_FILE)) {
    fs.writeFileSync(ADMINS_FILE, JSON.stringify([], null, 2));
  }
}

function getPlans() {
  ensureFiles();
  try { return JSON.parse(fs.readFileSync(PLANS_FILE, 'utf8')); } catch (_) { return []; }
}
function savePlans(plans) {
  ensureFiles();
  fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2));
}

function getAdmins() {
  ensureFiles();
  try { return JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8')); } catch (_) { return []; }
}
function saveAdmins(admins) {
  ensureFiles();
  fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
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

// ── DASHBOARD COUNTS (100% Real Dashcam Data) ─────────────────────────
function getFleetData() {
  const fleetFile = path.join(STORAGE_DIR, 'fleet.json');
  try {
    if (fs.existsSync(fleetFile)) {
      return JSON.parse(fs.readFileSync(fleetFile, 'utf8'));
    }
  } catch (_) {}
  return { vehicles: [], devices: [] };
}

function getDashboardCounts() {
  const inventory = getInventory();
  const vendors = getVendors();
  const admins = getAdmins();
  const fleet = getFleetData();
  const vehicles = Array.isArray(fleet.vehicles) ? fleet.vehicles : [];

  const total = inventory.length;
  const unassigned = inventory.filter(e => e.status === 0 || (!e.assignedAdmin && !e.assignedVendor && !e.assignedCustomer && !e.assignedTo)).length;
  const adminAssigned = inventory.filter(e => e.status === 1 && (e.assignedAdmin || e.assignedVendor || (e.assignedTo && (e.assignedTo.role === 'admin' || e.assignedTo.role === 'vendor')))).length;
  const deployedCustomer = inventory.filter(e => e.status === 1 && (e.assignedCustomer || (e.assignedTo && e.assignedTo.role === 'customer'))).length;
  const directSales = inventory.filter(e => e.status === 1 && e.assignedCustomer && !e.assignedAdmin && !e.assignedVendor).length;
  const deploymentRate = total > 0 ? Math.round((deployedCustomer / total) * 100) : 0;

  const activeAdmins = admins.filter(a => (a.status || 'Active').toLowerCase() === 'active').length;
  const activeVendors = vendors.filter(v => (v.status || 'Active').toLowerCase() === 'active').length;
  const totalAccounts = admins.length + vendors.length;
  const activeAccounts = activeAdmins + activeVendors;
  const deactiveAccounts = Math.max(0, totalAccounts - activeAccounts);

  const simItems = inventory.filter(i => i.paired_sim_number || i.simNumber || i.iccid);

  return {
    totalAccounts,
    activeAccounts,
    deactiveAccounts,
    adminsCount: admins.length,
    vendorsCount: vendors.length,
    deployedAssets: vehicles.length,
    totalInventory: total,
    unassignedUnits: unassigned,
    adminAssignedUnits: adminAssigned,
    deployedCustomerUnits: deployedCustomer,
    directSalesUnits: directSales,
    deploymentRate,
    simCount: simItems.length,
    securityAlerts: 0
  };
}

function getTrendStats(filter = 'all') {
  const inventory = getInventory();
  const fleet = getFleetData();
  const vehicles = Array.isArray(fleet.vehicles) ? fleet.vehicles : [];
  const simItems = inventory.filter(i => i.paired_sim_number || i.simNumber || i.iccid);

  const now = new Date();
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  let labels = [];
  if (filter === 'today') {
    labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
  } else if (filter === 'week') {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  } else if (filter === 'month') {
    labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(monthNames[d.getMonth()]);
    }
  }

  // Real counts initialized to 0 unless telemetry/events are present
  const dataCount = labels.map(() => 0);
  const alertsCount = labels.map(() => 0);

  return {
    labels,
    dataCount,
    alertsCount,
    pingsBreakdown: [],
    alertsBreakdown: [],
    simCount: simItems.length,
    vehiclesCount: vehicles.length
  };
}

// ── PLANS & SUBSCRIPTIONS ───────────────────────────────────────────
function listPlans() {
  return getPlans();
}

function createPlan(data) {
  const plans = getPlans();
  const newPlan = {
    _id: 'plan_' + crypto.randomBytes(8).toString('hex'),
    planName: data.planName || 'Custom Plan',
    durationMonths: parseInt(data.durationMonths || 12, 10),
    validityText: data.validityText || `${data.durationMonths || 12} Months`,
    price: parseInt(data.price || 999, 10),
    originalPrice: parseInt(data.originalPrice || 1499, 10),
    gstApplicable: true,
    isSuperCombo: !!data.isSuperCombo,
    tagText: data.tagText || 'Recommended',
    savingText: data.savingText || 'Special Offer',
    popularText: data.popularText || '',
    features: Array.isArray(data.features) ? data.features : [
      'Real-time Live Telematics',
      '4K & 1080P Dashcam Streaming',
      'Geofence & Over-speed Alerts',
      'Route History (90 Days)'
    ],
    createdAt: new Date().toISOString()
  };
  plans.push(newPlan);
  savePlans(plans);
  return newPlan;
}

function deletePlan(id) {
  const plans = getPlans();
  const filtered = plans.filter(p => p._id !== id);
  savePlans(filtered);
  return true;
}

// ── ADMIN MANAGEMENT ────────────────────────────────────────────────
function listAdmins() {
  return getAdmins();
}

function createAdmin(data) {
  const admins = getAdmins();
  const newAdmin = {
    _id: 'admin_' + crypto.randomBytes(8).toString('hex'),
    name: data.name ? data.name.trim() : 'Regional Admin',
    email: (data.email || '').trim(),
    mobile: data.mobile || data.phone || '9999999999',
    role: data.role || 'Regional Admin',
    status: 'Active',
    managedDevicesCount: 0,
    createdAt: new Date().toISOString()
  };
  admins.push(newAdmin);
  saveAdmins(admins);
  return newAdmin;
}

function deleteAdmin(id) {
  const admins = getAdmins();
  const filtered = admins.filter(a => a._id !== id);
  saveAdmins(filtered);
  return true;
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
  getDashboardCounts,
  getTrendStats,
  listPlans,
  createPlan,
  deletePlan,
  listAdmins,
  createAdmin,
  deleteAdmin
};
