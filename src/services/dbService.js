// Unified DB service for PharmaCare
// - Exposes async methods for use in React components
// - Uses a pluggable `driver` internally so native SQLite can be wired later
// - Falls back to an in-memory mock for Vite/browser development

const MEDICINES_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    tagline TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    dl_number TEXT,
    gst_number TEXT,
    currency_symbol TEXT DEFAULT 'Rs.',
    default_tax_rate REAL DEFAULT 0,
    address TEXT NOT NULL,
    theme TEXT DEFAULT 'light',
    database_path TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    dl_number TEXT,
    gstin TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
  CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);

  CREATE TABLE IF NOT EXISTS medicines (
    id TEXT PRIMARY KEY,
    product_code TEXT UNIQUE,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    supplier_id TEXT,
    supplier_name TEXT,
    purchase_date TEXT,
    has_multi_unit INTEGER DEFAULT 0,
    unit_pack_size INTEGER DEFAULT 1,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    buy_price REAL NOT NULL DEFAULT 0.0,
    sale_price REAL NOT NULL DEFAULT 0.0,
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    rack_location TEXT,
    min_stock_level INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_medicines_product_code ON medicines(product_code);
  CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
  CREATE INDEX IF NOT EXISTS idx_medicines_batch ON medicines(batch_number);
  CREATE INDEX IF NOT EXISTS idx_medicines_expiry ON medicines(expiry_date);
  CREATE INDEX IF NOT EXISTS idx_medicines_stock ON medicines(stock_quantity);

  CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    po_number TEXT UNIQUE NOT NULL,
    supplier_id TEXT,
    supplier_name TEXT NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0.0,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL,
    medicine_id TEXT,
    medicine_name TEXT NOT NULL,
    order_quantity INTEGER NOT NULL DEFAULT 1,
    buy_price REAL NOT NULL DEFAULT 0.0,
    total_price REAL NOT NULL DEFAULT 0.0,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
  CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
  CREATE INDEX IF NOT EXISTS idx_po_items_poid ON purchase_order_items(po_id);

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_name TEXT DEFAULT 'Walk-in Customer',
    customer_phone TEXT,
    doctor_name TEXT,
    subtotal REAL NOT NULL DEFAULT 0.0,
    discount REAL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    payment_method TEXT DEFAULT 'Cash',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    medicine_id TEXT NOT NULL,
    medicine_name TEXT NOT NULL,
    batch_number TEXT,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
  CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
  CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
  CREATE INDEX IF NOT EXISTS idx_sale_items_medicine_id ON sale_items(medicine_id);
`;

const normalizeProductCode = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.startsWith('#')) return raw;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? `#${parsed}` : raw;
};

const parseProductCodeNumber = (value) => {
  const raw = String(value ?? '').replace(/#/g, '').trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeMedicineRow = (row = {}) => {
  const dateValue = row.created_at || row.createdAt || new Date().toISOString();
  const expiryDate = row.expiry_date || row.expiryDate || '';

  return {
    ...row,
    id: row.id || `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_code: normalizeProductCode(row.product_code ?? row.productCode ?? null),
    name: row.name || '',
    company: row.company || null,
    supplier_id: row.supplier_id ?? row.supplierId ?? null,
    supplier_name: row.supplier_name ?? row.supplierName ?? null,
    purchase_date: row.purchase_date ?? row.purchaseDate ?? null,
    has_multi_unit: Number(row.has_multi_unit ?? row.hasMultiUnit ?? 0),
    unit_pack_size: Number(row.unit_pack_size ?? row.unitPackSize ?? 1),
    batch_number: row.batch_number ?? row.batchNumber ?? '',
    expiry_date: expiryDate,
    buy_price: Number(row.buy_price ?? row.buyPrice ?? 0),
    sale_price: Number(row.sale_price ?? row.salePrice ?? 0),
    stock_quantity: Number(row.stock_quantity ?? row.stockQuantity ?? 0),
    min_stock_level: Number(row.min_stock_level ?? row.minStockLevel ?? 10),
    rack_location: row.rack_location ?? row.rackLocation ?? null,
    created_at: dateValue,
    updated_at: row.updated_at || row.updatedAt || dateValue,
  };
};

const normalizeSupplierRow = (row = {}) => ({
  ...row,
  id: row.id || `sup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: row.name || '',
  contact_person: row.contact_person ?? row.contactPerson ?? row.contact_number ?? row.contactNumber ?? null,
  phone: row.phone ?? row.contactNumber ?? row.contact_number ?? null,
  email: row.email || null,
  address: row.address || row.shop_address || row.shopAddress || null,
  dl_number: row.dl_number ?? row.dlNumber ?? row.drug_license ?? row.drugLicense ?? null,
  gstin: row.gstin || null,
  created_at: row.created_at || row.createdAt || new Date().toISOString(),
  updated_at: row.updated_at || row.updatedAt || new Date().toISOString(),
});

const DEFAULT_STORE_SETTINGS = {
  id: 'settings',
  storeName: 'Sanjeevani Medicos & Healthcare',
  tagline: 'Licensed Retail & Wholesale Chemist',
  address: 'Shop No. 12-14, Health Plaza, Ring Road, New Delhi 110024',
  phone: '+91 98765 43210',
  email: 'support@sanjeevanimedicos.com',
  dlNumber: 'DL-20B/14589 & DL-21B/14590',
  gstNumber: '07AAAAA0000A1Z5',
  currencySymbol: 'Rs.',
  defaultTaxRate: 0,
  theme: 'light',
  databasePath: '',
};

const normalizeSettingsRow = (row = {}) => ({
  ...DEFAULT_STORE_SETTINGS,
  ...(row || {}),
  id: row.id || 'settings',
  storeName: row.storeName ?? row.store_name ?? DEFAULT_STORE_SETTINGS.storeName,
  tagline: row.tagline ?? row.store_tagline ?? DEFAULT_STORE_SETTINGS.tagline,
  address: row.address ?? row.store_address ?? DEFAULT_STORE_SETTINGS.address,
  phone: row.phone ?? row.store_phone ?? DEFAULT_STORE_SETTINGS.phone,
  email: row.email ?? DEFAULT_STORE_SETTINGS.email,
  dlNumber: row.dlNumber ?? row.dl_number ?? DEFAULT_STORE_SETTINGS.dlNumber,
  gstNumber: row.gstNumber ?? row.gst_number ?? DEFAULT_STORE_SETTINGS.gstNumber,
  currencySymbol: row.currencySymbol ?? row.currency_symbol ?? DEFAULT_STORE_SETTINGS.currencySymbol,
  defaultTaxRate: Number(row.defaultTaxRate ?? row.default_tax_rate ?? DEFAULT_STORE_SETTINGS.defaultTaxRate ?? 0),
  theme: row.theme === 'dark' ? 'dark' : 'light',
  databasePath: normalizeDatabaseDirectory(row.databasePath ?? row.database_path ?? ''),
  updated_at: row.updated_at || row.updatedAt || new Date().toISOString(),
});

const DEFAULT_DATABASE_FILE_NAME = 'pharmacare.db';
const DATABASE_PATH_STORAGE_KEY = 'pharma_database_directory_v1';
const DEFAULT_WINDOWS_DATABASE_DIRECTORY = 'E:\\PharmaCare Database';

const normalizeDatabaseDirectory = (directoryPath = '') => {
  const value = String(directoryPath ?? '').trim().replace(/['"]/g, '');
  if (!value) return '';
  return value.replace(/[\\/]+$/, '');
};

const ensureDatabaseDirectoryExists = async (directoryPath = '') => {
  const targetDirectory = normalizeDatabaseDirectory(directoryPath);
  if (!targetDirectory) return null;

  try {
    const fs = await import('@tauri-apps/plugin-fs');
    const mkdir = fs?.mkdir || fs?.default?.mkdir;
    if (typeof mkdir === 'function') {
      await mkdir(targetDirectory.replace(/\\/g, '/'), { recursive: true });
    }
    return targetDirectory;
  } catch {
    return null;
  }
};

const buildDatabaseFilePath = (directoryPath = '') => {
  const normalizedDirectory = normalizeDatabaseDirectory(directoryPath);
  if (!normalizedDirectory) return DEFAULT_DATABASE_FILE_NAME;

  const safeDirectory = normalizedDirectory.replace(/\\/g, '/');
  if (/\.db$/i.test(safeDirectory)) return safeDirectory;

  return `${safeDirectory.replace(/\/+$/, '')}/${DEFAULT_DATABASE_FILE_NAME}`;
};

const toSqliteUri = (databaseFilePath = '') => {
  const rawPath = String(databaseFilePath ?? '').trim();
  if (!rawPath) return `sqlite:${DEFAULT_DATABASE_FILE_NAME}`;
  return `sqlite:${rawPath.replace(/^sqlite:/i, '').replace(/\\/g, '/')}`;
};

const getDefaultDatabaseDirectory = async () => {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    try {
      const fs = await import('@tauri-apps/plugin-fs');
      const exists = fs?.exists || fs?.default?.exists;
      const hasEDrive = typeof exists === 'function' ? await exists('E:/').catch(() => false) : false;

      if (hasEDrive) {
        return normalizeDatabaseDirectory(DEFAULT_WINDOWS_DATABASE_DIRECTORY) || 'E:/PharmaCare Database';
      }
    } catch {
      // fall through to app-data fallback below
    }

    try {
      const { appDataDir } = await import('@tauri-apps/api/path');
      const basePath = await appDataDir();
      const normalized = normalizeDatabaseDirectory(String(basePath).replace(/\\/g, '/'));
      return `${normalized}/pharmacare`;
    } catch {
      // ignore and fall back below
    }
  }

  return normalizeDatabaseDirectory(DEFAULT_WINDOWS_DATABASE_DIRECTORY) || 'E:/PharmaCare Database';
};

const getConfiguredDatabaseDirectory = async () => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(DATABASE_PATH_STORAGE_KEY);
      const normalized = normalizeDatabaseDirectory(stored);
      if (normalized) return normalized;
    } catch {
      // ignore and fall back below
    }
  }

  return getDefaultDatabaseDirectory();
};

const persistDatabaseDirectory = async (directoryPath = '') => {
  const normalized = normalizeDatabaseDirectory(directoryPath) || (await getDefaultDatabaseDirectory());

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DATABASE_PATH_STORAGE_KEY, normalized);
    } catch {
      // ignore write failures in restricted environments
    }
  }

  return normalized;
};

const moveDatabaseFileIfNeeded = async (sourceFilePath, targetFilePath) => {
  if (!sourceFilePath || !targetFilePath || sourceFilePath === targetFilePath) return false;

  try {
    const fs = await import('@tauri-apps/plugin-fs');
    const rename = fs?.rename || fs?.default?.rename;
    const mkdir = fs?.mkdir || fs?.default?.mkdir;
    const exists = fs?.exists || fs?.default?.exists;
    const copyFile = fs?.copyFile || fs?.default?.copyFile;

    const normalizedSource = String(sourceFilePath).replace(/\\/g, '/');
    const normalizedTarget = String(targetFilePath).replace(/\\/g, '/');
    const targetDir = normalizedTarget.substring(0, normalizedTarget.lastIndexOf('/'));

    if (targetDir && typeof mkdir === 'function') {
      try { await mkdir(targetDir, { recursive: true }); } catch { /* ignore */ }
    }

    if (typeof rename === 'function') {
      try {
        await rename(normalizedSource, normalizedTarget);
        return true;
      } catch {
        // Fall back to a copy when the OS blocks rename semantics or a file exists at target.
      }
    }

    if (typeof copyFile === 'function' && typeof exists === 'function') {
      const targetExists = await exists(normalizedTarget).catch(() => false);
      if (!targetExists) {
        await copyFile(normalizedSource, normalizedTarget);
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
};

const getCurrentDatabaseDirectory = async () => getConfiguredDatabaseDirectory();
const getCurrentDatabaseFilePath = async () => buildDatabaseFilePath(await getConfiguredDatabaseDirectory());

const resetDatabaseDirectory = async () => {
  const defaultDirectory = await getDefaultDatabaseDirectory();
  await persistDatabaseDirectory(defaultDirectory);
  return defaultDirectory;
};

const normalizeSaleRow = (row = {}) => ({
  ...row,
  id: row.id || `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6)}`,
  invoice_number: row.invoice_number ?? row.invoiceNumber ?? `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001`,
  customer_name: row.customer_name ?? row.customerName ?? 'Walk-in Customer',
  customer_phone: row.customer_phone ?? row.customerPhone ?? null,
  doctor_name: row.doctor_name ?? row.doctorName ?? null,
  subtotal: Number(row.subtotal ?? 0),
  discount: Number(row.discount ?? 0),
  total_amount: Number(row.total_amount ?? row.totalAmount ?? 0),
  payment_method: row.payment_method ?? row.paymentMethod ?? 'Cash',
  created_at: row.created_at || row.createdAt || new Date().toISOString(),
});

const normalizeSaleItemRow = (row = {}) => ({
  ...row,
  id: row.id || `sale-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  sale_id: row.sale_id ?? row.saleId ?? null,
  medicine_id: row.medicine_id ?? row.medicineId ?? null,
  medicine_name: row.medicine_name ?? row.medicineName ?? '',
  batch_number: row.batch_number ?? row.batchNumber ?? null,
  quantity: Number(row.quantity ?? 0),
  unit_price: Number(row.unit_price ?? row.unitPrice ?? 0),
  total_price: Number(row.total_price ?? row.totalPrice ?? 0),
});

const normalizePurchaseOrderStatus = (status) => {
  const value = String(status ?? 'Pending').trim();
  if (['Received'].includes(value)) return 'Received';
  if (['Ordered', 'Sent'].includes(value)) return 'Ordered';
  if (['Cancelled'].includes(value)) return 'Cancelled';
  return 'Pending';
};

const normalizePurchaseOrderRow = (row = {}) => ({
  ...row,
  id: row.id || `po-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  po_number: row.po_number ?? row.poNumber ?? `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6)}`,
  supplier_id: row.supplier_id ?? row.supplierId ?? row.partyId ?? null,
  supplier_name: row.supplier_name ?? row.supplierName ?? row.partyName ?? 'Unknown Supplier',
  total_amount: Number(row.total_amount ?? row.totalAmount ?? row.totalEstimatedCost ?? 0),
  status: normalizePurchaseOrderStatus(row.status),
  created_at: row.created_at || row.createdAt || new Date().toISOString(),
});

const normalizePurchaseOrderItemRow = (row = {}) => ({
  ...row,
  id: row.id || `po-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  po_id: row.po_id ?? row.poId ?? null,
  medicine_id: row.medicine_id ?? row.medicineId ?? null,
  medicine_name: row.medicine_name ?? row.medicineName ?? 'Unnamed medicine',
  order_quantity: Number(row.order_quantity ?? row.orderQuantity ?? 1),
  buy_price: Number(row.buy_price ?? row.buyPrice ?? 0),
  total_price: Number(row.total_price ?? row.totalPrice ?? 0),
});

const parseInsertPayload = (sql, values) => {
  const match = sql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)\s*VALUES\s*\(/i);
  if (!match) return typeof values[0] === 'object' ? values[0] : {};

  const columns = match[1]
    .split(',')
    .map((part) => part.trim().replace(/`/g, ''));

  const payload = {};
  columns.forEach((column, index) => {
    payload[column] = values[index];
  });
  return payload;
};

const parseUpdatePayload = (sql, values) => {
  const match = sql.match(/UPDATE\s+\w+\s+SET\s+(.+?)(?:\s+WHERE\s+|$)/i);
  if (!match) return typeof values[0] === 'object' ? values[0] : {};

  const assignments = match[1].split(',').map((part) => part.trim());
  const payload = {};
  assignments.forEach((assignment, index) => {
    const [column] = assignment.split('=').map((part) => part.trim().replace(/`/g, ''));
    if (!column) return;
    payload[column] = values[index];
  });

  const idIndex = values.length - 1;
  if (idIndex >= 0) {
    payload.id = values[idIndex];
  }
  return payload;
};

const createMockDriver = () => {
  const unit_suggestions = new Set();
  const suppliers = new Map();
  const medicines = new Map();
  const batches = new Map();
  const purchase_orders = new Map();
  const purchase_order_items = new Map();
  const sales = new Map();
  const sale_items = new Map();
  const settings = new Map();

  return {
    async init() {
      return true;
    },
    reset() {
      unit_suggestions.clear();
      suppliers.clear();
      medicines.clear();
      batches.clear();
      purchase_orders.clear();
      purchase_order_items.clear();
      sales.clear();
      sale_items.clear();
      settings.clear();
      return true;
    },
    async all(sql, params = []) {
      if (/PRAGMA\s+table_info\s*\(\s*medicines\s*\)/i.test(sql)) {
        return [
          { name: 'id', type: 'TEXT' },
          { name: 'product_code', type: 'TEXT' },
          { name: 'name', type: 'TEXT' },
          { name: 'company', type: 'TEXT' },
          { name: 'supplier_id', type: 'TEXT' },
          { name: 'supplier_name', type: 'TEXT' },
          { name: 'purchase_date', type: 'TEXT' },
          { name: 'has_multi_unit', type: 'INTEGER' },
          { name: 'unit_pack_size', type: 'INTEGER' },
          { name: 'stock_quantity', type: 'INTEGER' },
          { name: 'buy_price', type: 'REAL' },
          { name: 'sale_price', type: 'REAL' },
          { name: 'batch_number', type: 'TEXT' },
          { name: 'expiry_date', type: 'TEXT' },
          { name: 'rack_location', type: 'TEXT' },
          { name: 'min_stock_level', type: 'INTEGER' },
        ];
      }
      if (/FROM unit_suggestions/i.test(sql)) {
        return Array.from(unit_suggestions).map((unit) => ({ unit }));
      }
      if (/FROM suppliers/i.test(sql)) {
        const rows = Array.from(suppliers.values());
        return [...rows].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      }
      if (/FROM medicines/i.test(sql)) {
        let rows = Array.from(medicines.values());

        if (/WHERE/i.test(sql)) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          rows = rows.filter((row) => {
            const stockQty = Number(row.stock_quantity ?? 0);
            const expiryValue = row.expiry_date ? new Date(String(row.expiry_date).includes('T') ? row.expiry_date : `${row.expiry_date}T00:00:00`) : null;

            if (/stock_quantity\s*>\s*0/i.test(sql) && stockQty <= 0) return false;
            if (/stock_quantity\s*<=\s*min_stock_level/i.test(sql) && stockQty > Number(row.min_stock_level ?? 0)) return false;
            if (/expiry_date\s+IS\s+NOT\s+NULL/i.test(sql) && !row.expiry_date) return false;

            if (/expiry_date\s*<\s*date\(["']?now["']?\)/i.test(sql)) {
              if (!expiryValue || expiryValue >= today) return false;
            }

            if (/expiry_date\s*>=\s*date\(["']?now["']?\)/i.test(sql) && /expiry_date\s*<=\s*date\(["']?now["']?\s*,\s*["']\+\d+\s+days["']\)/i.test(sql)) {
              const daysMatch = sql.match(/date\(["']?now["']?\s*,\s*["']\+(\d+)\s+days["']\)/i);
              const days = daysMatch ? Number(daysMatch[1]) : 30;
              const futureDate = new Date(today);
              futureDate.setDate(today.getDate() + days);
              futureDate.setHours(23, 59, 59, 999);

              if (!expiryValue || expiryValue < today || expiryValue > futureDate) return false;
            }

            return true;
          });
        }

        if (/ORDER BY/i.test(sql) && /name/i.test(sql)) {
          return [...rows].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        }
        if (/ORDER BY/i.test(sql) && /expiry_date/i.test(sql)) {
          return [...rows].sort((a, b) => String(a.expiry_date || '').localeCompare(String(b.expiry_date || '')));
        }
        return rows;
      }
      if (/FROM batches/i.test(sql)) {
        return Array.from(batches.values());
      }
      if (/FROM purchase_orders/i.test(sql)) {
        const rows = Array.from(purchase_orders.values());
        return [...rows].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))).reverse();
      }
      if (/FROM purchase_order_items/i.test(sql)) {
        const rows = Array.from(purchase_order_items.values());
        return rows;
      }
      if (/FROM sales/i.test(sql)) {
        const rows = Array.from(sales.values());
        return [...rows].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))).reverse();
      }
      if (/FROM sale_items/i.test(sql)) {
        const rows = Array.from(sale_items.values());
        return rows;
      }
      if (/FROM settings/i.test(sql)) {
        const row = settings.get('settings');
        return row ? [row] : [];
      }
      return [];
    },
    async get(sql, params = []) {
      const values = Array.isArray(params) ? params : [params];
      if (/FROM suppliers/i.test(sql) && /WHERE\s+id\s*\?/i.test(sql)) {
        return suppliers.get(values[0]) || null;
      }
      if (/FROM medicines/i.test(sql) && /WHERE\s+id\s*=/i.test(sql)) {
        const id = values[0];
        return medicines.get(id) || null;
      }
      if (/FROM medicines/i.test(sql) && /WHERE\s+id\s*\?/i.test(sql)) {
        const id = values[0];
        return medicines.get(id) || null;
      }
      if (/FROM purchase_orders/i.test(sql) && /WHERE\s+id\s*\?/i.test(sql)) {
        return purchase_orders.get(values[0]) || null;
      }
      if (/FROM sales/i.test(sql) && /WHERE\s+id\s*\?/i.test(sql)) {
        return sales.get(values[0]) || null;
      }
      return null;
    },
    async run(sql, params = []) {
      const values = Array.isArray(params) ? params : [params];

      if (/ALTER TABLE medicines ADD COLUMN/i.test(sql)) {
        return { lastID: null, changes: 1 };
      }

      if (/INSERT INTO unit_suggestions/i.test(sql)) {
        const unit = values[0];
        if (unit) unit_suggestions.add(unit);
        return { lastID: null, changes: 1 };
      }

      if (/INSERT INTO suppliers/i.test(sql)) {
        const payload = parseInsertPayload(sql, values);
        const row = normalizeSupplierRow(payload);
        suppliers.set(row.id, row);
        return { lastID: row.id, changes: 1 };
      }

      if (/UPDATE suppliers/i.test(sql)) {
        const id = values[values.length - 1];
        const existing = suppliers.get(id) || {};
        const nextRow = normalizeSupplierRow({
          ...existing,
          name: values[0],
          contact_person: values[1],
          phone: values[2],
          email: values[3],
          address: values[4],
          dl_number: values[5],
          gstin: values[6],
          id,
          updated_at: new Date().toISOString(),
        });
        suppliers.set(id, nextRow);
        return { lastID: id, changes: 1 };
      }

      if (/DELETE FROM suppliers/i.test(sql)) {
        const id = values[0];
        const deleted = suppliers.delete(id);
        return { lastID: null, changes: deleted ? 1 : 0 };
      }

      if (/INSERT INTO medicines/i.test(sql)) {
        const payload = parseInsertPayload(sql, values);
        const row = normalizeMedicineRow(payload);
        medicines.set(row.id, row);
        return { lastID: row.id, changes: 1 };
      }

      if (/UPDATE medicines/i.test(sql)) {
        const id = values[values.length - 1];
        const existing = medicines.get(id) || {};
        const nextRow = normalizeMedicineRow({
          ...existing,
          name: values[0],
          company: values[1],
          supplier_id: values[2],
          supplier_name: values[3],
          batch_number: values[4],
          expiry_date: values[5],
          buy_price: values[6],
          sale_price: values[7],
          stock_quantity: values[8],
          min_stock_level: values[9],
          rack_location: values[10],
          id,
          updated_at: new Date().toISOString(),
        });
        medicines.set(id, nextRow);
        return { lastID: id, changes: 1 };
      }

      if (/DELETE FROM medicines/i.test(sql)) {
        const id = values[0];
        const deleted = medicines.delete(id);
        return { lastID: null, changes: deleted ? 1 : 0 };
      }

      if (/INSERT INTO sales/i.test(sql)) {
        const payload = parseInsertPayload(sql, values);
        const row = normalizeSaleRow(payload);
        sales.set(row.id, row);
        return { lastID: row.id, changes: 1 };
      }

      if (/INSERT INTO sale_items/i.test(sql)) {
        const payload = parseInsertPayload(sql, values);
        const row = normalizeSaleItemRow(payload);
        sale_items.set(row.id, row);
        return { lastID: row.id, changes: 1 };
      }

      if (/DELETE FROM sales/i.test(sql)) {
        const id = values[0];
        const deleted = sales.delete(id);
        return { lastID: null, changes: deleted ? 1 : 0 };
      }

      if (/DELETE FROM sale_items/i.test(sql)) {
        const saleId = values[0];
        let removed = 0;
        for (const [key, item] of sale_items.entries()) {
          if (item.sale_id === saleId) {
            sale_items.delete(key);
            removed += 1;
          }
        }
        return { lastID: null, changes: removed };
      }

      if (/INSERT INTO batches/i.test(sql)) {
        const payload = typeof values[0] === 'object' ? values[0] : {};
        const id = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        batches.set(id, { id, ...payload });
        return { lastID: id, changes: 1 };
      }

      if (/INSERT INTO purchase_orders/i.test(sql)) {
        const payload = parseInsertPayload(sql, values);
        const row = normalizePurchaseOrderRow(payload);
        purchase_orders.set(row.id, row);
        return { lastID: row.id, changes: 1 };
      }

      if (/UPDATE purchase_orders/i.test(sql)) {
        const id = values[values.length - 1];
        const existing = purchase_orders.get(id) || {};
        const nextRow = normalizePurchaseOrderRow({
          ...existing,
          status: values[0],
          id,
          created_at: existing.created_at || new Date().toISOString(),
        });
        purchase_orders.set(id, nextRow);
        return { lastID: id, changes: 1 };
      }

      if (/DELETE FROM purchase_orders/i.test(sql)) {
        const id = values[0];
        const deleted = purchase_orders.delete(id);
        return { lastID: null, changes: deleted ? 1 : 0 };
      }

      if (/INSERT INTO purchase_order_items/i.test(sql)) {
        const payload = parseInsertPayload(sql, values);
        const row = normalizePurchaseOrderItemRow(payload);
        purchase_order_items.set(row.id, row);
        return { lastID: row.id, changes: 1 };
      }

      if (/DELETE FROM purchase_order_items/i.test(sql)) {
        const poId = values[0];
        let removed = 0;
        for (const [key, item] of purchase_order_items.entries()) {
          if (item.po_id === poId) {
            purchase_order_items.delete(key);
            removed += 1;
          }
        }
        return { lastID: null, changes: removed };
      }

      if (/INSERT INTO settings/i.test(sql)) {
        const payload = parseInsertPayload(sql, values);
        const row = normalizeSettingsRow({ ...payload, id: payload.id || 'settings' });
        settings.set('settings', row);
        return { lastID: row.id, changes: 1 };
      }

      if (/UPDATE settings/i.test(sql)) {
        const id = values[values.length - 1];
        const existing = settings.get(id) || settings.get('settings') || DEFAULT_STORE_SETTINGS;
        const nextRow = normalizeSettingsRow({ ...existing, ...parseUpdatePayload(sql, values), id, updated_at: new Date().toISOString() });
        settings.set('settings', nextRow);
        return { lastID: id, changes: 1 };
      }

      return { lastID: null, changes: 0 };
    },
  };
};

// Removed `better-sqlite3` native driver from frontend code. Node native bindings cannot run in browser/renderer.
// Keep a placeholder that returns null in non-Tauri renderer environments. The Tauri plugin driver is used when available.
const createSqliteDriver = async (databaseDirectoryOverride = null) => {
  return null;
};

const isTauriRuntime = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__);
};

const createTauriSqliteDriver = async (databaseDirectoryOverride = null) => {
  if (!isTauriRuntime()) return null;

  try {
    const sqlPlugin = await import('@tauri-apps/plugin-sql');
    const Database = sqlPlugin.default || sqlPlugin.Database;
    if (!Database || typeof Database.load !== 'function') return null;

    const targetDirectory = normalizeDatabaseDirectory(databaseDirectoryOverride || await getConfiguredDatabaseDirectory()) || await getDefaultDatabaseDirectory();
    await ensureDatabaseDirectoryExists(targetDirectory);
    const dbFilePath = buildDatabaseFilePath(targetDirectory);
    const db = await Database.load(toSqliteUri(dbFilePath));
    const executeScript = async (script) => {
      const statements = String(script)
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await db.execute(statement);
      }
    };

    return {
      async init() {
        try {
          const targetFile = buildDatabaseFilePath(await getConfiguredDatabaseDirectory());
          if (typeof window !== 'undefined' && window.__TAURI__) {
            console.info('[PharmaCare] SQLite path:', targetFile);
          }
        } catch {
          // ignore path logging failures in the browser shell
        }

        try {
          await executeScript(MEDICINES_SCHEMA_SQL);
        } catch {
          // Tauri plugin handles table creation idempotently; explicit schema creation here is minimal
        }
        return true;
      },
      async reset() {
        try {
          await executeScript('DELETE FROM purchase_order_items; DELETE FROM purchase_orders; DELETE FROM sale_items; DELETE FROM sales; DELETE FROM medicines; DELETE FROM suppliers; DELETE FROM batches; DELETE FROM settings;');
        } catch {
          // keep resets safe for first-run databases
        }
        return true;
      },
      async all(sql, params = []) {
        const values = Array.isArray(params) ? params : [params];
        const rows = await db.select(sql, values);
        return Array.isArray(rows) ? rows : [];
      },
      async get(sql, params = []) {
        const values = Array.isArray(params) ? params : [params];
        const rows = await db.select(sql, values);
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      },
      async run(sql, params = []) {
        const values = Array.isArray(params) ? params : [params];
        const result = await db.execute(sql, values);
        return { lastID: result?.lastInsertId ?? null, changes: result?.changes ?? 0 };
      },
    };
  } catch {
    return null;
  }
};

let driver = createMockDriver();

async function ensureMedicineSchema() {
  if (!driver || typeof driver.all !== 'function') return;

  try {
    const columns = await driver.all('PRAGMA table_info(medicines)');
    const existing = new Set((columns || []).map((column) => column.name));
    const required = [
      ['product_code', 'TEXT UNIQUE'],
      ['purchase_date', 'TEXT'],
      ['has_multi_unit', 'INTEGER DEFAULT 0'],
      ['unit_pack_size', 'INTEGER DEFAULT 1'],
      ['company', 'TEXT NOT NULL'],
      ['min_stock_level', 'INTEGER DEFAULT 10'],
    ];

    for (const [columnName, columnType] of required) {
      if (!existing.has(columnName)) {
        try {
          await driver.run(`ALTER TABLE medicines ADD COLUMN ${columnName} ${columnType}`);
        } catch {
          // ignore migration failures for browser/mock drivers
        }
      }
    }

    try {
      await driver.run('CREATE INDEX IF NOT EXISTS idx_medicines_product_code ON medicines(product_code)');
      await driver.run('CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name)');
      await driver.run('CREATE INDEX IF NOT EXISTS idx_medicines_batch ON medicines(batch_number)');
      await driver.run('CREATE INDEX IF NOT EXISTS idx_medicines_expiry ON medicines(expiry_date)');
      await driver.run('CREATE INDEX IF NOT EXISTS idx_medicines_stock ON medicines(stock_quantity)');
    } catch {
      // ignore legacy index issues during migration
    }
  } catch {
    // ignore schema enforcement issues in mock/browser mode
  }
}

async function init(driverOverride) {
  if (driverOverride) {
    driver = driverOverride;
  }

  const configuredDirectory = await getConfiguredDatabaseDirectory();
  const tauriDriver = await createTauriSqliteDriver(configuredDirectory);
  if (tauriDriver) {
    driver = tauriDriver;
  } else {
    const sqliteDriver = await createSqliteDriver(configuredDirectory);
    if (sqliteDriver && typeof window === 'undefined') {
      driver = sqliteDriver;
    }
  }

  if (driver && typeof driver.init === 'function') {
    await driver.init();
  }

  await ensureMedicineSchema();
}

async function setDatabaseLocation(directoryPath, options = {}) {
  const { moveExisting = false } = options;
  const nextDirectory = normalizeDatabaseDirectory(directoryPath) || (await getDefaultDatabaseDirectory());
  const currentDirectory = await getConfiguredDatabaseDirectory();
  const currentDatabaseFile = buildDatabaseFilePath(currentDirectory);
  const nextDatabaseFile = buildDatabaseFilePath(nextDirectory);

  await ensureDatabaseDirectoryExists(nextDirectory);

  if (moveExisting && currentDatabaseFile !== nextDatabaseFile) {
    try {
      const fs = await import('@tauri-apps/plugin-fs');
      const exists = fs?.exists || fs?.default?.exists;
      const sourceExists = typeof window !== 'undefined' && window.__TAURI__ && typeof exists === 'function'
        ? await exists(currentDatabaseFile).catch(() => false)
        : false;

      if (sourceExists) {
        const migrated = await moveDatabaseFileIfNeeded(currentDatabaseFile, nextDatabaseFile);
        if (!migrated) {
          throw new Error('Unable to move the existing database to the selected directory.');
        }
      }
    } catch (error) {
      throw new Error(error?.message || 'The selected folder is not writable or not accessible.');
    }
  }

  await persistDatabaseDirectory(nextDirectory);
  await init();

  return {
    path: nextDirectory,
    filePath: nextDatabaseFile,
  };
}

async function pickDatabaseDirectory(currentPath = '') {
  if (typeof window === 'undefined' || !window.__TAURI__) {
    return null;
  }

  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const directoryPath = await open({
      directory: true,
      recursive: false,
      multiple: false,
      defaultPath: normalizeDatabaseDirectory(currentPath) || (await getCurrentDatabaseDirectory()),
    });

    if (typeof directoryPath !== 'string' || !directoryPath.trim()) {
      return null;
    }

    return normalizeDatabaseDirectory(directoryPath);
  } catch {
    return null;
  }
}

async function getUnitSuggestions(type = null) {
  const sql = 'SELECT unit FROM unit_suggestions' + (type ? ' WHERE type = ?' : '');
  const params = type ? [type] : [];
  const rows = await driver.all(sql, params);
  return rows.map((row) => row.unit);
}

async function addMedicineWithBatch(medicineData, batchData) {
  const unitsToEnsure = new Set();
  if (medicineData && medicineData.default_unit) unitsToEnsure.add(medicineData.default_unit);
  if (batchData && batchData.unit) unitsToEnsure.add(batchData.unit);

  for (const unit of unitsToEnsure) {
    await driver.run('INSERT INTO unit_suggestions(unit) VALUES(?)', [unit]);
  }

  const medPayload = {
    id: medicineData.id || `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: medicineData.name,
    company: medicineData.company || null,
    supplier_id: medicineData.supplier_id || medicineData.supplierId || null,
    supplier_name: medicineData.supplier_name || medicineData.supplierName || null,
    batch_number: batchData.batch_no,
    expiry_date: batchData.expiry,
    buy_price: batchData.purchase_price || 0,
    sale_price: batchData.mrp || 0,
    stock_quantity: batchData.quantity || 0,
    min_stock_level: medicineData.min_stock_level || medicineData.minStockLevel || 10,
    rack_location: medicineData.rack_location || medicineData.rackLocation || null,
  };

  const medRes = await driver.run(
    'INSERT INTO medicines(id, name, company, supplier_id, supplier_name, batch_number, expiry_date, buy_price, sale_price, stock_quantity, min_stock_level, rack_location, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
    [
      medPayload.id,
      medPayload.name,
      medPayload.company,
      medPayload.supplier_id,
      medPayload.supplier_name,
      medPayload.batch_number,
      medPayload.expiry_date,
      medPayload.buy_price,
      medPayload.sale_price,
      medPayload.stock_quantity,
      medPayload.min_stock_level,
      medPayload.rack_location,
    ]
  );

  const batchPayload = {
    medicine_id: medRes.lastID || medPayload.id,
    batch_no: batchData.batch_no,
    expiry: batchData.expiry,
    quantity: batchData.quantity,
    unit: batchData.unit,
    purchase_price: batchData.purchase_price || null,
    mrp: batchData.mrp || null,
  };

  const batchRes = await driver.run('INSERT INTO batches(...) VALUES(...)', [batchPayload]);

  return {
    medicineId: medRes.lastID || medPayload.id,
    batchId: batchRes.lastID,
  };
}

async function getNextProductCode() {
  try {
    const rows = await driver.all("SELECT product_code FROM medicines WHERE product_code IS NOT NULL ORDER BY CAST(REPLACE(product_code, '#', '') AS INTEGER) DESC LIMIT 1");
    const maxCode = rows && rows.length > 0 ? parseProductCodeNumber(rows[0].product_code) : 0;
    return maxCode > 0 ? maxCode + 1 : 1;
  } catch {
    const fallback = await driver.all('SELECT * FROM medicines');
    const maxCode = fallback.reduce((max, row) => Math.max(max, parseProductCodeNumber(row.product_code ?? row.productCode ?? 0)), 0);
    return maxCode > 0 ? maxCode + 1 : 1;
  }
}

async function getSuppliers() {
  return getAllSuppliers();
}

async function getAllSuppliers() {
  const rows = await driver.all('SELECT * FROM suppliers ORDER BY name COLLATE NOCASE ASC');
  return rows.map((row) => normalizeSupplierRow(row));
}

async function searchSuppliers(query = '') {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return getSuppliers();

  const rows = await driver.all('SELECT * FROM suppliers ORDER BY name COLLATE NOCASE ASC');
  const filtered = rows.filter((row) => {
    const name = String(row.name ?? '').toLowerCase();
    const phone = String(row.phone ?? '').toLowerCase();
    const address = String(row.address ?? '').toLowerCase();
    const dl = String(row.dl_number ?? '').toLowerCase();
    return name.includes(q) || phone.includes(q) || address.includes(q) || dl.includes(q);
  });

  return filtered.map((row) => normalizeSupplierRow(row));
}

async function getSupplierById(id) {
  if (!id) return null;
  const row = await driver.get('SELECT * FROM suppliers WHERE id = ?', [id]);
  return row ? normalizeSupplierRow(row) : null;
}

async function addSupplier(supplierData = {}) {
  const payload = normalizeSupplierRow(supplierData);

  if (!payload.name) {
    throw new Error('Supplier name is required.');
  }

  const insertSql = `
    INSERT INTO suppliers(id, name, contact_person, phone, email, address, dl_number, gstin, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  const values = [
    payload.id,
    payload.name,
    payload.contact_person,
    payload.phone,
    payload.email,
    payload.address,
    payload.dl_number,
    payload.gstin,
  ];

  await driver.run(insertSql, values);
  return payload;
}

async function updateSupplier(id, supplierData = {}) {
  if (!id) return null;

  const current = await getSupplierById(id);
  if (!current) return null;

  const nextPayload = normalizeSupplierRow({ ...current, ...supplierData, id, updated_at: new Date().toISOString() });

  const updateSql = `
    UPDATE suppliers
    SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, dl_number = ?, gstin = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  const values = [
    nextPayload.name,
    nextPayload.contact_person,
    nextPayload.phone,
    nextPayload.email,
    nextPayload.address,
    nextPayload.dl_number,
    nextPayload.gstin,
    id,
  ];

  await driver.run(updateSql, values);
  return nextPayload;
}

async function deleteSupplier(id) {
  if (!id) return 0;
  const result = await driver.run('DELETE FROM suppliers WHERE id = ?', [id]);
  return Number(result?.changes || 0);
}

async function getAllMedicines() {
  const rows = await driver.all('SELECT * FROM medicines ORDER BY name COLLATE NOCASE ASC');
  return rows.map((row) => normalizeMedicineRow(row));
}

async function getMedicineById(id) {
  if (!id) return null;
  const row = await driver.get('SELECT * FROM medicines WHERE id = ?', [id]);
  return row ? normalizeMedicineRow(row) : null;
}

async function addMedicine(medicineData = {}) {
  const payload = normalizeMedicineRow(medicineData);
  const computedCode = medicineData.product_code ?? (await getNextProductCode());
  const nextCode = normalizeProductCode(computedCode) || `#${await getNextProductCode()}`;

  if (!payload.name || !payload.batch_number || !payload.expiry_date) {
    throw new Error('Medicine name, batch_number, and expiry_date are required.');
  }

  const insertSql = `
    INSERT INTO medicines(
      id, product_code, name, company, supplier_id, supplier_name, purchase_date,
      has_multi_unit, unit_pack_size, stock_quantity, buy_price, sale_price,
      batch_number, expiry_date, rack_location, min_stock_level, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  const values = [
    payload.id,
    nextCode,
    payload.name,
    payload.company,
    payload.supplier_id,
    payload.supplier_name,
    payload.purchase_date,
    payload.has_multi_unit,
    payload.unit_pack_size,
    payload.stock_quantity,
    payload.buy_price,
    payload.sale_price,
    payload.batch_number,
    payload.expiry_date,
    payload.rack_location,
    payload.min_stock_level,
  ];

  const result = await driver.run(insertSql, values);
  return { ...payload, product_code: nextCode, id: payload.id, created_at: payload.created_at, updated_at: payload.updated_at, _result: result };
}

async function updateMedicine(id, medicineData = {}) {
  if (!id) return null;

  const current = await getMedicineById(id);
  if (!current) return null;

  const nextPayload = normalizeMedicineRow({ ...current, ...medicineData, id, updated_at: new Date().toISOString() });

  const updateSql = `
    UPDATE medicines
    SET name = ?, company = ?, supplier_id = ?, supplier_name = ?, batch_number = ?,
        expiry_date = ?, buy_price = ?, sale_price = ?, stock_quantity = ?,
        min_stock_level = ?, rack_location = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  const values = [
    nextPayload.name,
    nextPayload.company,
    nextPayload.supplier_id,
    nextPayload.supplier_name,
    nextPayload.batch_number,
    nextPayload.expiry_date,
    nextPayload.buy_price,
    nextPayload.sale_price,
    nextPayload.stock_quantity,
    nextPayload.min_stock_level,
    nextPayload.rack_location,
    id,
  ];

  await driver.run(updateSql, values);
  return normalizeMedicineRow({ ...current, ...nextPayload, id });
}

async function deleteMedicine(id) {
  if (!id) return 0;
  const result = await driver.run('DELETE FROM medicines WHERE id = ?', [id]);
  return Number(result?.changes || 0);
}

async function getLowStockMedicines() {
  const rows = await driver.all('SELECT * FROM medicines WHERE stock_quantity <= min_stock_level ORDER BY stock_quantity ASC, name COLLATE NOCASE ASC');
  return rows.map((row) => normalizeMedicineRow(row));
}

async function getExpiredMedicines() {
  const rows = await driver.all('SELECT * FROM medicines WHERE expiry_date IS NOT NULL AND stock_quantity > 0 AND expiry_date < date("now") ORDER BY expiry_date ASC');
  return rows.map((row) => normalizeMedicineRow(row));
}

async function getExpiringSoonMedicines(days = 30) {
  const safeDays = Number(days) > 0 ? Number(days) : 30;
  const rows = await driver.all(
    `SELECT * FROM medicines WHERE expiry_date IS NOT NULL AND stock_quantity > 0 AND expiry_date >= date("now") AND expiry_date <= date("now", "+${safeDays} days") ORDER BY expiry_date ASC`
  );
  return rows.map((row) => normalizeMedicineRow(row));
}

async function disposeExpiredMedicine(id) {
  if (!id) return null;

  const current = await getMedicineById(id);
  if (!current) return null;

  const result = await driver.run(
    'UPDATE medicines SET stock_quantity = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id]
  );

  return { ...current, stock_quantity: 0, updated_at: new Date().toISOString(), _result: result };
}

async function createPurchaseOrder(poData = {}, poItems = []) {
  const normalizedPo = normalizePurchaseOrderRow(poData);
  const safeItems = Array.isArray(poItems) ? poItems : [];

  await driver.run(
    'INSERT INTO purchase_orders(id, po_number, supplier_id, supplier_name, total_amount, status, created_at) VALUES(?,?,?,?,?,?,?)',
    [
      normalizedPo.id,
      normalizedPo.po_number,
      normalizedPo.supplier_id,
      normalizedPo.supplier_name,
      normalizedPo.total_amount,
      normalizedPo.status,
      normalizedPo.created_at,
    ]
  );

  for (const item of safeItems) {
    const normalizedItem = normalizePurchaseOrderItemRow({
      ...item,
      po_id: normalizedPo.id,
      medicine_id: item.medicine_id ?? item.medicineId ?? null,
      medicine_name: item.medicine_name ?? item.medicineName ?? item.productName ?? 'Unnamed medicine',
      order_quantity: item.order_quantity ?? item.orderQuantity ?? 1,
      buy_price: item.buy_price ?? item.buyPrice ?? item.purchaseRate ?? 0,
      total_price: item.total_price ?? item.totalPrice ?? item.totalAmount ?? 0,
    });

    await driver.run(
      'INSERT INTO purchase_order_items(id, po_id, medicine_id, medicine_name, order_quantity, buy_price, total_price) VALUES(?,?,?,?,?,?,?)',
      [
        normalizedItem.id,
        normalizedPo.id,
        normalizedItem.medicine_id,
        normalizedItem.medicine_name,
        normalizedItem.order_quantity,
        normalizedItem.buy_price,
        normalizedItem.total_price,
      ]
    );
  }

  return { ...normalizedPo, items: safeItems.map((item) => normalizePurchaseOrderItemRow({ ...item, po_id: normalizedPo.id })) };
}

async function getAllPurchaseOrders() {
  const rows = await driver.all('SELECT * FROM purchase_orders ORDER BY created_at DESC');
  const services = await Promise.all(rows.map(async (row) => {
    const items = await driver.all('SELECT * FROM purchase_order_items WHERE po_id = ? ORDER BY id ASC', [row.id]);
    return { ...normalizePurchaseOrderRow(row), items: items.map((item) => normalizePurchaseOrderItemRow(item)) };
  }));
  return services;
}

async function getPurchaseOrderById(id) {
  if (!id) return null;

  const rows = await driver.all('SELECT * FROM purchase_orders ORDER BY created_at DESC');
  const row = rows.find((entry) => entry.id === id || entry.po_number === id) || null;
  if (!row) return null;

  const items = await driver.all('SELECT * FROM purchase_order_items WHERE po_id = ? ORDER BY id ASC', [id]);
  return { ...normalizePurchaseOrderRow(row), items: items.map((item) => normalizePurchaseOrderItemRow(item)) };
}

async function updatePOStatus(id, status) {
  if (!id) return null;
  const current = await getPurchaseOrderById(id);
  if (!current) return null;

  const nextStatus = normalizePurchaseOrderStatus(status);
  await driver.run('UPDATE purchase_orders SET status = ? WHERE id = ?', [nextStatus, id]);

  if (nextStatus === 'Received') {
    for (const item of current.items || []) {
      const medicineId = item.medicine_id ?? item.productId ?? null;
      const qty = Number(item.order_quantity ?? item.orderQuantity ?? 0);
      if (medicineId && qty > 0) {
        await updateMedicineStock(medicineId, qty);
      }
    }
  }

  return { ...current, status: nextStatus };
}

async function updateMedicineStock(medicineId, quantityDelta) {
  if (!medicineId || !Number.isFinite(Number(quantityDelta))) return null;

  const medicine = await getMedicineById(medicineId);
  if (!medicine) return null;

  const nextQuantity = Number(medicine.stock_quantity || 0) + Number(quantityDelta);
  return updateMedicine(medicineId, { stock_quantity: nextQuantity });
}

async function resetDatabase() {
  try {
    if (driver && typeof driver.reset === 'function') {
      driver.reset();
    }
  } catch {
    // ignore reset issues for legacy SQLite files
  }

  try {
    await driver.run('DELETE FROM purchase_order_items');
    await driver.run('DELETE FROM purchase_orders');
    await driver.run('DELETE FROM sale_items');
    await driver.run('DELETE FROM sales');
    await driver.run('DELETE FROM medicines');
    await driver.run('DELETE FROM suppliers');
    await driver.run('DELETE FROM batches');
    await driver.run('DELETE FROM settings');
  } catch {
    // ignore cleanup failures for empty-state reset fallback
  }

  if (driver && typeof driver.init === 'function') {
    await driver.init();
  }

  return true;
}

async function getSettings() {
  await init();
  try {
    const rows = await driver.all('SELECT * FROM settings ORDER BY id LIMIT 1');
    if (rows && rows.length > 0) return normalizeSettingsRow(rows[0]);
  } catch {
    // ignore and fall back below
  }

  const fallback = normalizeSettingsRow(DEFAULT_STORE_SETTINGS);
  try {
    await driver.run(
      'INSERT INTO settings(id, store_name, tagline, phone, email, dl_number, gst_number, currency_symbol, default_tax_rate, address, theme, database_path, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        fallback.id,
        fallback.storeName,
        fallback.tagline,
        fallback.phone,
        fallback.email,
        fallback.dlNumber,
        fallback.gstNumber,
        fallback.currencySymbol,
        fallback.defaultTaxRate,
        fallback.address,
        fallback.theme,
        fallback.databasePath,
        new Date().toISOString(),
      ]
    );
  } catch {
    // ignore when the backing driver is not SQL-backed
  }

  return fallback;
}

async function saveSettings(settingsData = {}) {
  await init();
  const payload = normalizeSettingsRow(settingsData);

  const row = {
    id: payload.id,
    store_name: payload.storeName,
    tagline: payload.tagline,
    phone: payload.phone,
    email: payload.email,
    dl_number: payload.dlNumber,
    gst_number: payload.gstNumber,
    currency_symbol: payload.currencySymbol,
    default_tax_rate: payload.defaultTaxRate,
    address: payload.address,
    theme: payload.theme,
    database_path: payload.databasePath || '',
    updated_at: new Date().toISOString(),
  };

  try {
    const existing = await driver.get('SELECT * FROM settings WHERE id = ?', [payload.id]);
    if (existing) {
      await driver.run(
        'UPDATE settings SET store_name = ?, tagline = ?, phone = ?, email = ?, dl_number = ?, gst_number = ?, currency_symbol = ?, default_tax_rate = ?, address = ?, theme = ?, database_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [row.store_name, row.tagline, row.phone, row.email, row.dl_number, row.gst_number, row.currency_symbol, row.default_tax_rate, row.address, row.theme, row.database_path, payload.id]
      );
    } else {
      await driver.run(
        'INSERT INTO settings(id, store_name, tagline, phone, email, dl_number, gst_number, currency_symbol, default_tax_rate, address, theme, database_path, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [payload.id, row.store_name, row.tagline, row.phone, row.email, row.dl_number, row.gst_number, row.currency_symbol, row.default_tax_rate, row.address, row.theme, row.database_path, row.updated_at]
      );
    }
  } catch {
    try {
      await driver.run(
        'INSERT INTO settings(id, store_name, tagline, phone, email, dl_number, gst_number, currency_symbol, default_tax_rate, address, theme, database_path, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [payload.id, row.store_name, row.tagline, row.phone, row.email, row.dl_number, row.gst_number, row.currency_symbol, row.default_tax_rate, row.address, row.theme, row.database_path, row.updated_at]
      );
    } catch {
      // ignore if not supported
    }
  }

  return normalizeSettingsRow({ ...payload, databasePath: row.database_path, updated_at: row.updated_at });
}

async function getDatabaseCounts() {
  await init();
  const [medicines, suppliers, sales] = await Promise.all([
    driver.all('SELECT COUNT(*) AS total FROM medicines'),
    driver.all('SELECT COUNT(*) AS total FROM suppliers'),
    driver.all('SELECT COUNT(*) AS total FROM sales'),
  ]);

  const toTotal = (rows) => {
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return 0;
    return Number(row.total ?? row['COUNT(*)'] ?? row.count ?? 0);
  };

  return {
    medicines: toTotal(medicines),
    suppliers: toTotal(suppliers),
    bills: toTotal(sales),
  };
}

async function exportBackup(options = {}) {
  await init();
  const payload = {
    app: 'PharmaCare Medical Store Management System',
    version: '1.1.0',
    exportDate: new Date().toISOString(),
    settings: normalizeSettingsRow(options.settings || (await getSettings())),
    medicines: Array.isArray(options.medicines) ? options.medicines : await getAllMedicines(),
    suppliers: Array.isArray(options.suppliers) ? options.suppliers : await getAllSuppliers(),
    sales: Array.isArray(options.sales) ? options.sales : await getAllSales(),
  };

  const jsonBlob = typeof Blob !== 'undefined' ? new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }) : null;
  if (jsonBlob && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(jsonBlob);
    const link = document.createElement('a');
    const fileName = `pharmacare-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 300);
  }

  return payload;
}

async function importBackup(jsonData) {
  if (!jsonData) {
    throw new Error('Backup data is required.');
  }

  const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup JSON format.');
  }

  const hasExpectedShape = Array.isArray(parsed.medicines) || Array.isArray(parsed.suppliers) || Array.isArray(parsed.sales) || parsed.settings;
  if (!hasExpectedShape) {
    throw new Error('The uploaded file does not contain valid PharmaCare backup data.');
  }

  await resetDatabase();
  await init();

  if (parsed.settings) {
    await saveSettings(parsed.settings);
  }

  const suppliers = Array.isArray(parsed.suppliers) ? parsed.suppliers : [];
  for (const supplier of suppliers) {
    await addSupplier(supplier);
  }

  const medicines = Array.isArray(parsed.medicines) ? parsed.medicines : [];
  for (const medicine of medicines) {
    await addMedicine(medicine);
  }

  const sales = Array.isArray(parsed.sales) ? parsed.sales : [];
  for (const sale of sales) {
    const items = Array.isArray(sale.items) ? sale.items : [];
    await createSale(
      {
        id: sale.id,
        invoice_number: sale.invoice_number ?? sale.invoiceNumber,
        customer_name: sale.customer_name ?? sale.customerName,
        customer_phone: sale.customer_phone ?? sale.customerPhone,
        doctor_name: sale.doctor_name ?? sale.doctorName,
        subtotal: Number(sale.subtotal ?? 0),
        discount: Number(sale.discount ?? 0),
        total_amount: Number(sale.total_amount ?? sale.totalAmount ?? sale.grandTotal ?? 0),
        payment_method: sale.payment_method ?? sale.paymentMethod ?? 'Cash',
        created_at: sale.created_at || sale.date || new Date().toISOString(),
      },
      items.map((item) => ({
        id: item.id,
        medicine_id: item.medicine_id ?? item.medicineId,
        medicine_name: item.medicine_name ?? item.medicineName ?? item.productName,
        batch_number: item.batch_number ?? item.batchNumber,
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? item.unitPrice ?? item.rate ?? 0),
        total_price: Number(item.total_price ?? item.totalPrice ?? item.total ?? 0),
      }))
    );
  }

  return { success: true, medicines: medicines.length, suppliers: suppliers.length, sales: sales.length };
}

async function loadSampleData() {
  await resetDatabase();
  await init();

  const supplierSeed = [
    { id: 'sup-1', name: 'Apex Pharma Distributors', phone: '+91 98765 11111', email: 'sales@apexpharma.in', address: 'Connaught Place, New Delhi', contact_person: 'Rahul Verma', dl_number: 'DL-20B/10001', gstin: '07AABCA1234A1Z8' },
    { id: 'sup-2', name: 'Prime Care Wholesale', phone: '+91 98210 22222', email: 'care@primewholesale.in', address: 'Karol Bagh, New Delhi', contact_person: 'Anita Sharma', dl_number: 'DL-21B/10002', gstin: '07AABCC4567A1Z2' },
  ];

  for (const supplier of supplierSeed) {
    await addSupplier(supplier);
  }

  const medicineSeed = [
    { id: 'med-1', name: 'Cefixime 200mg', company: 'Apex Labs', supplier_id: 'sup-1', supplier_name: 'Apex Pharma Distributors', product_code: '#101', batch_number: 'CFX-200-APR', expiry_date: '2027-04-30', purchase_date: '2026-01-15', buy_price: 64, sale_price: 92, stock_quantity: 48, min_stock_level: 15, rack_location: 'A1-04' },
    { id: 'med-2', name: 'Paracetamol 650mg', company: 'Prime Care', supplier_id: 'sup-2', supplier_name: 'Prime Care Wholesale', product_code: '#102', batch_number: 'PCM-650-MAR', expiry_date: '2026-12-18', purchase_date: '2026-02-08', buy_price: 18, sale_price: 30, stock_quantity: 120, min_stock_level: 20, rack_location: 'B3-10' },
    { id: 'med-3', name: 'Amoxicillin 500mg', company: 'Apex Labs', supplier_id: 'sup-1', supplier_name: 'Apex Pharma Distributors', product_code: '#103', batch_number: 'AMX-500-MAY', expiry_date: '2026-09-12', purchase_date: '2026-03-05', buy_price: 52, sale_price: 78, stock_quantity: 34, min_stock_level: 12, rack_location: 'A2-02' },
  ];

  for (const medicine of medicineSeed) {
    await addMedicine(medicine);
  }

  await createSale(
    {
      invoice_number: 'INV-2026-1001',
      customer_name: 'Rakesh Verma',
      customer_phone: '+91 98111 22334',
      doctor_name: 'Dr. Mehta',
      subtotal: 164,
      discount: 5,
      total_amount: 159,
      payment_method: 'Cash',
      created_at: '2026-09-29T11:34:00.000Z',
    },
    [
      { medicine_id: 'med-1', quantity: 2, unit_price: 92, total_price: 184 },
    ]
  );

  await saveSettings({
    storeName: 'Sanjeevani Medicos & Healthcare',
    tagline: 'Licensed Retail & Wholesale Chemist',
    address: 'Shop No. 12-14, Health Plaza, Ring Road, New Delhi 110024',
    phone: '+91 98765 43210',
    email: 'support@sanjeevanimedicos.com',
    dlNumber: 'DL-20B/14589 & DL-21B/14590',
    gstNumber: '07AAAAA0000A1Z5',
    currencySymbol: 'Rs.',
    defaultTaxRate: 0,
    theme: 'light',
  });

  return { success: true, suppliers: supplierSeed.length, medicines: medicineSeed.length, sales: 1 };
}

async function createSale(saleData = {}, saleItems = []) {
  const normalizedItems = Array.isArray(saleItems) ? saleItems : [];
  const invoiceNumber = saleData.invoice_number || saleData.invoiceNumber || `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-3)}`;
  const saleId = saleData.id || invoiceNumber;
  const createdAt = new Date().toISOString();
  const subtotal = Number(saleData.subtotal ?? normalizedItems.reduce((sum, item) => sum + Number(item.total_price ?? item.totalPrice ?? 0), 0));
  const discount = Number(saleData.discount ?? 0);
  const totalAmount = Number(saleData.total_amount ?? saleData.totalAmount ?? Math.max(0, subtotal - discount));

  if (driver && typeof driver.init === 'function') {
    await driver.init();
  }

  const transaction = async () => {
    const saleRow = normalizeSaleRow({
      id: saleId,
      invoice_number: invoiceNumber,
      customer_name: saleData.customer_name ?? saleData.customerName ?? 'Walk-in Customer',
      customer_phone: saleData.customer_phone ?? saleData.customerPhone ?? null,
      doctor_name: saleData.doctor_name ?? saleData.doctorName ?? null,
      subtotal,
      discount,
      total_amount: totalAmount,
      payment_method: saleData.payment_method ?? saleData.paymentMethod ?? 'Cash',
      created_at: createdAt,
    });

    await driver.run(
      'INSERT INTO sales(id, invoice_number, customer_name, customer_phone, doctor_name, subtotal, discount, total_amount, payment_method, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      [
        saleRow.id,
        saleRow.invoice_number,
        saleRow.customer_name,
        saleRow.customer_phone,
        saleRow.doctor_name,
        saleRow.subtotal,
        saleRow.discount,
        saleRow.total_amount,
        saleRow.payment_method,
        saleRow.created_at,
      ]
    );

    for (const item of normalizedItems) {
      const medicine = await getMedicineById(item.medicine_id ?? item.medicineId);
      if (!medicine) {
        throw new Error(`Medicine not found for sale item: ${item.medicine_id ?? item.medicineId ?? 'unknown'}`);
      }

      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(item.unit_price ?? item.unitPrice ?? medicine.sale_price ?? 0);
      const totalPrice = Number(item.total_price ?? item.totalPrice ?? quantity * unitPrice);

      await driver.run(
        'UPDATE medicines SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [quantity, medicine.id]
      );

      const saleItemRow = normalizeSaleItemRow({
        id: item.id || `sale-item-${saleRow.id}-${Math.random().toString(36).slice(2, 8)}`,
        sale_id: saleRow.id,
        medicine_id: medicine.id,
        medicine_name: item.medicine_name ?? item.medicineName ?? medicine.name,
        batch_number: item.batch_number ?? item.batchNumber ?? medicine.batch_number,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      });

      await driver.run(
        'INSERT INTO sale_items(id, sale_id, medicine_id, medicine_name, batch_number, quantity, unit_price, total_price) VALUES(?,?,?,?,?,?,?,?)',
        [
          saleItemRow.id,
          saleItemRow.sale_id,
          saleItemRow.medicine_id,
          saleItemRow.medicine_name,
          saleItemRow.batch_number,
          saleItemRow.quantity,
          saleItemRow.unit_price,
          saleItemRow.total_price,
        ]
      );
    }

    return saleRow;
  };

  return transaction();
}

async function getAllSales() {
  const rows = await driver.all('SELECT * FROM sales ORDER BY created_at DESC');
  const services = await Promise.all(rows.map(async (row) => {
    const items = await driver.all('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC', [row.id]);
    return { ...normalizeSaleRow(row), items: items.map((item) => normalizeSaleItemRow(item)) };
  }));
  return services;
}

async function getSaleById(id) {
  if (!id) return null;
  const sale = await driver.get('SELECT * FROM sales WHERE id = ?', [id]);
  if (!sale) return null;

  const items = await driver.all('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC', [id]);
  return { ...normalizeSaleRow(sale), items: items.map((row) => normalizeSaleItemRow(row)) };
}

async function getSalesByDateRange(startDate, endDate) {
  const rows = await driver.all('SELECT * FROM sales WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC', [startDate, endDate]);
  return rows.map((row) => normalizeSaleRow(row));
}

const dbService = {
  init,
  getDefaultDatabaseDirectory,
  getCurrentDatabaseDirectory,
  getCurrentDatabaseFilePath,
  setDatabaseLocation,
  pickDatabaseDirectory,
  resetDatabaseDirectory,
  getUnitSuggestions,
  addMedicineWithBatch,
  getSettings,
  saveSettings,
  getDatabaseCounts,
  exportBackup,
  importBackup,
  loadSampleData,
  getSuppliers,
  getAllSuppliers,
  searchSuppliers,
  getSupplierById,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  resetDatabase,
  createSale,
  getAllSales,
  getSaleById,
  getSalesByDateRange,
  getNextProductCode,
  getAllMedicines,
  getMedicineById,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getLowStockMedicines,
  getExpiredMedicines,
  getExpiringSoonMedicines,
  disposeExpiredMedicine,
  createPurchaseOrder,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePOStatus,
  updateMedicineStock,
  _setDriver(d) {
    driver = d;
  },
};

export default dbService;
