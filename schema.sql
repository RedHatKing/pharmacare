-- ============================================================================
-- PHARMACY & MEDICAL STORE MANAGEMENT SYSTEM (POS & SAAS)
-- Database Engine: SQLite 3
-- Schema Version: 2.1.0
-- Architecture: 2-Tier Packaging (Pack & Loose Base Units), FEFO Inventory,
--               Dynamic Unit Suggestions, Full POS, Financials & Audit Logs
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- ============================================================================
-- 1. USERS, ROLES & ACCESS CONTROL
-- ============================================================================

-- Table: users
-- Stores pharmacy operators, cashiers, and administrators with role-based access
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT UNIQUE COLLATE NOCASE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Admin', 'Pharmacist', 'Cashier')),
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'Suspended')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: audit_logs
-- Tracks every critical business transaction, modification, and security event
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL, -- e.g., 'LOGIN', 'CREATE_INVOICE', 'MANUAL_STOCK_ADJUSTMENT'
    target_table TEXT NOT NULL, -- e.g., 'sales_invoices', 'batches'
    record_id INTEGER,
    old_values TEXT, -- JSON representation of previous state
    new_values TEXT, -- JSON representation of new state
    ip_address TEXT,
    device_info TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 2. DYNAMIC UNIT SUGGESTIONS ENGINE (2-TIER PACKAGING)
-- ============================================================================

-- Table: unit_suggestions
-- Stores pre-populated and dynamically discovered packaging units (Pack vs Sub-Unit)
CREATE TABLE IF NOT EXISTS unit_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_type TEXT NOT NULL CHECK(unit_type IN ('pack', 'sub_unit')),
    unit_name TEXT NOT NULL COLLATE NOCASE,
    is_standard INTEGER NOT NULL DEFAULT 1, -- 1 = Seeded/Standard, 0 = User Custom
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(unit_type, unit_name)
);

-- ============================================================================
-- 3. MEDICINES MASTER, CATEGORIES & BRANDS
-- ============================================================================

-- Table: categories
-- Therapeutic classifications or general retail store categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: manufacturers
-- Pharmaceutical companies and marketing brands
CREATE TABLE IF NOT EXISTS manufacturers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: medicines
-- Master product catalog with 2-tier pack definitions and atomic conversion factors
CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE,
    generic_name TEXT COLLATE NOCASE, -- e.g. 'Amoxicillin + Clavulanic Acid'
    sku TEXT UNIQUE,
    barcode TEXT UNIQUE,
    category_id INTEGER,
    manufacturer_id INTEGER,
    medicine_type TEXT NOT NULL DEFAULT 'Tablets & Capsules', -- Form: 'Tablets & Capsules', 'Syrup', etc.
    rack_location TEXT, -- Shelf/bin reference (e.g., 'Shelf B-3')
    
    -- 2-Tier Unit Configuration:
    pack_unit TEXT NOT NULL DEFAULT 'Strip', -- Outer unit: 'Strip', 'Box', 'Bottle', 'Tube'
    sub_unit TEXT NOT NULL DEFAULT 'Tablet',  -- Atomic unit: 'Tablet', 'Capsule', 'ml', 'Ampoule'
    default_sub_quantity_per_pack INTEGER NOT NULL DEFAULT 1 CHECK(default_sub_quantity_per_pack >= 1),
    -- Note: For liquids, drops, and ointments, default_sub_quantity_per_pack = 1
    
    reorder_level_base_units INTEGER NOT NULL DEFAULT 15, -- Alert threshold in atomic base units
    is_prescription_required INTEGER NOT NULL DEFAULT 0 CHECK(is_prescription_required IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    photo_url TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON DELETE SET NULL
);

-- ============================================================================
-- 4. SUPPLIERS & PURCHASE ORDERS
-- ============================================================================

-- Table: suppliers
-- Pharmaceutical distributors, wholesalers, and vendors
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE,
    company_name TEXT,
    contact_person TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    dl_number TEXT,  -- Drug License Number
    gstin TEXT,      -- Tax ID / GSTIN / NTN
    current_balance REAL NOT NULL DEFAULT 0.00, -- Running balance (Payable to supplier)
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: purchase_orders
-- Commercial purchase contracts issued to wholesale distributors
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL,
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    total_amount REAL NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Partial', 'Received', 'Cancelled')),
    notes TEXT,
    created_by_user_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table: purchase_order_items
-- Specific medicines and pack quantities ordered from a distributor
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    ordered_packs INTEGER NOT NULL CHECK(ordered_packs > 0),
    received_packs INTEGER NOT NULL DEFAULT 0 CHECK(received_packs >= 0),
    sub_quantity_per_pack INTEGER NOT NULL DEFAULT 1 CHECK(sub_quantity_per_pack >= 1),
    pack_cost_price REAL NOT NULL CHECK(pack_cost_price >= 0),
    line_total REAL NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
);

-- ============================================================================
-- 5. BATCHES & INVENTORY (FEFO - FIRST EXPIRY FIRST OUT)
-- ============================================================================

-- Table: batches
-- Crucial FEFO Inventory Table.
-- INVENTORY TRACKING RULE:
-- Stock is strictly tracked at the atomic unit level (`total_base_quantity`).
-- Initial Formula: total_base_quantity = purchase_packs * sub_quantity_per_pack
CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_number TEXT NOT NULL COLLATE NOCASE,
    medicine_id INTEGER NOT NULL,
    supplier_id INTEGER,
    expiry_date DATE NOT NULL, -- Standard ISO format YYYY-MM-DD for fast index sorting
    purchase_date DATE NOT NULL,
    
    -- Packaging Specifications for this specific batch:
    purchase_packs INTEGER NOT NULL DEFAULT 0 CHECK(purchase_packs >= 0),
    sub_quantity_per_pack INTEGER NOT NULL DEFAULT 1 CHECK(sub_quantity_per_pack >= 1),
    
    -- Current atomic inventory remaining (Decremented on sales, incremented on returns):
    total_base_quantity INTEGER NOT NULL DEFAULT 0 CHECK(total_base_quantity >= 0),
    
    -- Pricing Tier:
    pack_buy_price REAL NOT NULL CHECK(pack_buy_price >= 0),
    pack_sale_price REAL NOT NULL CHECK(pack_sale_price >= 0),
    unit_buy_price REAL NOT NULL CHECK(unit_buy_price >= 0),
    unit_sale_price REAL NOT NULL CHECK(unit_sale_price >= 0),
    mrp REAL, -- Maximum Retail Price printed on package
    
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    UNIQUE(batch_number, medicine_id)
);

-- ============================================================================
-- 6. POS SALES & BILLING
-- ============================================================================

-- Table: customers
-- Retail walk-in and registered credit account patients
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE,
    phone TEXT COLLATE NOCASE,
    email TEXT,
    address TEXT,
    balance_amount REAL NOT NULL DEFAULT 0.00, -- Positive = Customer owes store (Receivable)
    loyalty_points INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: sales_invoices
-- Counter sale receipts and clinical checkout transactions
CREATE TABLE IF NOT EXISTS sales_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    doctor_name TEXT,
    payment_type TEXT NOT NULL DEFAULT 'Cash' CHECK(payment_type IN ('Cash', 'Card', 'UPI', 'Credit', 'Split')),
    subtotal REAL NOT NULL DEFAULT 0.00,
    discount_amount REAL NOT NULL DEFAULT 0.00,
    tax_amount REAL NOT NULL DEFAULT 0.00,
    final_total REAL NOT NULL DEFAULT 0.00,
    paid_amount REAL NOT NULL DEFAULT 0.00,
    due_amount REAL NOT NULL DEFAULT 0.00,
    cashier_user_id INTEGER,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Completed' CHECK(status IN ('Completed', 'Refunded', 'Cancelled')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (cashier_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table: sales_invoice_items
-- Line items sold on each invoice (Supports Full Pack and Loose Unit Sales)
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    is_loose_sale INTEGER NOT NULL DEFAULT 0 CHECK(is_loose_sale IN (0, 1)),
    
    -- Quantity sold expressed in the lowest atomic base unit:
    -- e.g. 1 strip of 10 tablets = 10 base units sold.
    -- e.g. 3 loose tablets = 3 base units sold.
    quantity_sold_base_units INTEGER NOT NULL CHECK(quantity_sold_base_units > 0),
    
    unit_price_sold_at REAL NOT NULL CHECK(unit_price_sold_at >= 0), -- Price per atomic base unit
    discount_amount REAL NOT NULL DEFAULT 0.00,
    total_price REAL NOT NULL CHECK(total_price >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
);

-- ============================================================================
-- 7. RETURNS & STOCK ADJUSTMENTS
-- ============================================================================

-- Table: sales_returns
-- Customer return headers (Refunds & Exchanges)
CREATE TABLE IF NOT EXISTS sales_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_no TEXT NOT NULL UNIQUE,
    original_invoice_id INTEGER,
    customer_id INTEGER,
    return_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    refund_amount REAL NOT NULL DEFAULT 0.00,
    payment_mode TEXT NOT NULL DEFAULT 'Cash' CHECK(payment_mode IN ('Cash', 'Card', 'Credit_Note')),
    reason TEXT,
    cashier_user_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (original_invoice_id) REFERENCES sales_invoices(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (cashier_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table: sales_return_items
-- Specific medicines and base units refunded
CREATE TABLE IF NOT EXISTS sales_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    return_quantity_base_units INTEGER NOT NULL CHECK(return_quantity_base_units > 0),
    unit_refund_rate REAL NOT NULL,
    total_refund_amount REAL NOT NULL,
    restock_status TEXT NOT NULL DEFAULT 'Restocked' CHECK(restock_status IN ('Restocked', 'Damaged_Waste')),
    FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
);

-- Table: purchase_returns
-- Supplier debits for expired, damaged, or recalled goods
CREATE TABLE IF NOT EXISTS purchase_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_no TEXT NOT NULL UNIQUE,
    po_id INTEGER,
    supplier_id INTEGER NOT NULL,
    return_date DATE NOT NULL,
    total_refund_amount REAL NOT NULL DEFAULT 0.00,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'Completed' CHECK(status IN ('Pending', 'Approved', 'Completed')),
    created_by_user_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table: purchase_return_items
-- Line items returned back to distributor
CREATE TABLE IF NOT EXISTS purchase_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    return_packs INTEGER NOT NULL DEFAULT 0,
    return_base_units INTEGER NOT NULL CHECK(return_base_units > 0),
    pack_return_rate REAL NOT NULL,
    total_line_amount REAL NOT NULL,
    FOREIGN KEY (return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
);

-- Table: stock_adjustments
-- Internal audit adjustments, breakages, damaged ampoules, and physical inventory reconciliations
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    adjustment_no TEXT NOT NULL UNIQUE,
    batch_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('Damage', 'Expiry', 'Theft', 'Audit_Correction', 'Bonus_Stock')),
    quantity_base_units INTEGER NOT NULL, -- Positive = Stock Addition, Negative = Stock Deduction
    reason TEXT NOT NULL,
    adjusted_by_user_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT,
    FOREIGN KEY (adjusted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 8. EXPENSES & FINANCIAL ACCOUNTS
-- ============================================================================

-- Table: expense_categories
-- Ledger groups for non-inventory business operational costs
CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: expenses
-- Daily store operational expenses (Rent, Electricity, Generator Fuel, Staff Salary)
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    payment_mode TEXT NOT NULL DEFAULT 'Cash' CHECK(payment_mode IN ('Cash', 'Bank_Transfer', 'Card', 'UPI')),
    payment_date DATE NOT NULL,
    notes TEXT,
    recorded_by_user_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 9. PERFORMANCE INDEXES
-- ============================================================================

-- Fast lookup for medicine names, barcodes, and formulas
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_generic_name ON medicines(generic_name);
CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category_id);
CREATE INDEX IF NOT EXISTS idx_medicines_manufacturer ON medicines(manufacturer_id);

-- FEFO sorting indexes on batches for POS billing & expiry audits
CREATE INDEX IF NOT EXISTS idx_batches_medicine_expiry ON batches(medicine_id, expiry_date, total_base_quantity);
CREATE INDEX IF NOT EXISTS idx_batches_expiry_date ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_stock_level ON batches(total_base_quantity);
CREATE INDEX IF NOT EXISTS idx_batches_batch_num ON batches(batch_number);

-- Sales & billing invoice indexes
CREATE INDEX IF NOT EXISTS idx_sales_invoices_no ON sales_invoices(invoice_no);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_invoice ON sales_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_batch ON sales_invoice_items(batch_id);

-- Supplier and PO indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);
CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_supplier_status ON purchase_orders(supplier_id, status);

-- Unit suggestions lookup index
CREATE INDEX IF NOT EXISTS idx_unit_suggestions_lookup ON unit_suggestions(unit_type, unit_name);

-- Audit log timeline index
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(created_at, target_table);

-- ============================================================================
-- 10. REAL-TIME REPORTING VIEWS
-- ============================================================================

-- View: v_active_inventory_fefo
-- Displays active medicines with their earliest expiring batches, pack counts,
-- and loose unit calculations ready for counter POS selection.
CREATE VIEW IF NOT EXISTS v_active_inventory_fefo AS
SELECT 
    m.id AS medicine_id,
    m.name AS medicine_name,
    m.generic_name,
    man.name AS manufacturer_name,
    b.id AS batch_id,
    b.batch_number,
    b.expiry_date,
    b.sub_quantity_per_pack,
    m.pack_unit,
    m.sub_unit,
    -- Calculation: Full packs remaining
    (b.total_base_quantity / b.sub_quantity_per_pack) AS full_packs_remaining,
    -- Calculation: Loose atomic units remaining
    (b.total_base_quantity % b.sub_quantity_per_pack) AS loose_units_remaining,
    b.total_base_quantity AS total_base_units_remaining,
    b.pack_sale_price,
    b.unit_sale_price,
    -- Status flag for FEFO expiration warning
    CASE 
        WHEN b.expiry_date <= DATE('now') THEN 'EXPIRED'
        WHEN b.expiry_date <= DATE('now', '+90 days') THEN 'NEAR_EXPIRY'
        ELSE 'GOOD'
    END AS expiry_status
FROM batches b
JOIN medicines m ON b.medicine_id = m.id
LEFT JOIN manufacturers man ON m.manufacturer_id = man.id
WHERE b.is_active = 1 AND b.total_base_quantity > 0
ORDER BY b.expiry_date ASC;

-- View: v_low_stock_alerts
-- Aggregates total stock across all batches and triggers reorder warnings
CREATE VIEW IF NOT EXISTS v_low_stock_alerts AS
SELECT 
    m.id AS medicine_id,
    m.name AS medicine_name,
    man.name AS manufacturer_name,
    m.pack_unit,
    m.sub_unit,
    m.default_sub_quantity_per_pack,
    m.reorder_level_base_units,
    COALESCE(SUM(b.total_base_quantity), 0) AS total_stock_base_units,
    (COALESCE(SUM(b.total_base_quantity), 0) / m.default_sub_quantity_per_pack) AS total_stock_packs,
    (COALESCE(SUM(b.total_base_quantity), 0) % m.default_sub_quantity_per_pack) AS total_stock_loose_units
FROM medicines m
LEFT JOIN manufacturers man ON m.manufacturer_id = man.id
LEFT JOIN batches b ON m.id = b.medicine_id AND b.is_active = 1
WHERE m.is_active = 1
GROUP BY m.id
HAVING total_stock_base_units <= m.reorder_level_base_units
ORDER BY total_stock_base_units ASC;

-- ============================================================================
-- 11. DEFAULT SEED DATA
-- ============================================================================

-- 11.1 Standard Unit Suggestions Engine
INSERT OR IGNORE INTO unit_suggestions (unit_type, unit_name, is_standard) VALUES
-- Pack Units
('pack', 'Strip', 1),
('pack', 'Box', 1),
('pack', 'Bottle', 1),
('pack', 'Tube', 1),
('pack', 'Pack', 1),
('pack', 'Blister', 1),
('pack', 'Carton', 1),
('pack', 'Vial', 1),
('pack', 'Jar', 1),
('pack', 'Sachet Box', 1),

-- Sub Units (Atomic Units)
('sub_unit', 'Tablet', 1),
('sub_unit', 'Capsule', 1),
('sub_unit', 'ml', 1),
('sub_unit', 'Piece', 1),
('sub_unit', 'Sachet', 1),
('sub_unit', 'Ampoule', 1),
('sub_unit', 'Gram', 1),
('sub_unit', 'Drop', 1),
('sub_unit', 'Patch', 1),
('sub_unit', 'Suppository', 1);

-- 11.2 Standard Medicine Categories
INSERT OR IGNORE INTO categories (name, description) VALUES
('Tablets & Capsules', 'Solid dose medicines for oral administration'),
('Syrups & Suspensions', 'Liquid oral formulations'),
('Injections & IV Fluids', 'Sterile injectable medicines and intravenous infusions'),
('Ointments & Creams', 'Topical dermatological preparations'),
('Eye & Ear Drops', 'Sterile ophthalmic and otic solutions'),
('Surgical & First Aid', 'Bandages, syringes, cannulas, and surgical supplies'),
('Ayurvedic & Herbal', 'Traditional, botanical, and natural medicines'),
('Pediatric & Infant Care', 'Baby nutritional supplements, formulas, and medicines');

-- 11.3 Standard Expense Categories
INSERT OR IGNORE INTO expense_categories (name, description) VALUES
('Store Rent', 'Monthly premises rental payment'),
('Electricity & Utilities', 'Power, water, and utility bills'),
('Staff Salaries', 'Pharmacist and helper payroll'),
('Logistics & Delivery', 'Supplier transport and freight charges'),
('Maintenance & Repairs', 'Air conditioner, refrigeration, and fixture repairs'),
('Packaging & Stationary', 'Thermal receipt paper rolls, bags, and office supplies');

-- 11.4 Initial Admin User (Default credentials to be changed on first login)
INSERT OR IGNORE INTO users (id, username, email, full_name, password_hash, role, status) VALUES
(1, 'admin', 'admin@medstore.local', 'Master Administrator', 'pbkdf2:sha256:600000$default_admin_hash', 'Admin', 'Active');
