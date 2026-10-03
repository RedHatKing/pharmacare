import React, { createContext, useContext, useState, useEffect } from 'react';
import dbService from '../services/dbService';
import { Product, Party, Bill, StoreSettings, PurchaseOrder } from '../types/inventory';

interface InventoryContextType {
  products: Product[];
  parties: Party[];
  bills: Bill[];
  settings: StoreSettings;
  purchaseOrders: PurchaseOrder[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>, options?: { skipDbInsert?: boolean }) => Product;
  refreshInventory: () => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addParty: (party: Omit<Party, 'id' | 'createdAt'>) => Party;
  updateParty: (id: string, updates: Partial<Party>) => void;
  deleteParty: (id: string) => void;
  createBill: (billData: {
    customerName: string;
    customerPhone?: string;
    doctorName?: string;
    items: {
      productId: string;
      productName: string;
      batchNumber: string;
      expiryDate: string;
      quantity: number;
      rate: number;
      total: number;
    }[];
    subtotal: number;
    discount: number;
    tax: number;
    grandTotal: number;
    paymentMethod: 'Cash' | 'Card' | 'UPI';
  }) => Bill;
  savePurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'createdAt'>) => PurchaseOrder;
  receivePurchaseOrder: (items: { medicineId: string; quantity: number }[]) => { updatedCount: number; updatedIds: string[] };
  updatePurchaseOrderStatus: (id: string, status: 'Draft' | 'Sent' | 'Received') => void;
  deletePurchaseOrder: (id: string) => void;
  updateSettings: (updates: Partial<StoreSettings>) => void;
  exportBackup: () => void;
  importBackup: (jsonString: string) => { success: boolean; message: string };
  resetToDemoData: () => void;
  searchSuppliers: (query: string) => Promise<Party[]>;
  disposeExpiredMedicine: (id: string) => Product | null;
  getExpiredProducts: () => Product[];
  getNearExpiryProducts: (daysThreshold?: number) => Product[];
  getLowStockProducts: () => Product[];
  getOutOfStockProducts: () => Product[];
  getReorderNeededProducts: () => Product[];
}

const STORAGE_KEYS = {
  PRODUCTS: 'pharma_products_v1',
  PARTIES: 'pharma_parties_v1',
  BILLS: 'pharma_bills_v1',
  SETTINGS: 'pharma_settings_v1',
  PURCHASE_ORDERS: 'pharma_po_v1',
};

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Sanjeevani Medicos & Healthcare',
  tagline: 'Licensed Retail & Wholesale Chemist',
  address: 'Shop No. 12-14, Health Plaza, Ring Road, New Delhi 110024',
  phone: '+91 98765 43210',
  email: 'support@sanjeevanimedicos.com',
  dlNumber: 'DL-20B/14589 & DL-21B/14590',
  gstNumber: '07AAAAA0000A1Z5',
  currencySymbol: 'Rs.',
  defaultTaxRate: 0,
  databasePath: '',
};

const emptyProducts: Product[] = [];
const emptyParties: Party[] = [];
const emptyBills: Bill[] = [];
const emptyPurchaseOrders: PurchaseOrder[] = [];

const parseProductCode = (value: any): number => {
  const raw = String(value ?? '').replace(/#/g, '').trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapMedicineToProduct = (medicine: any): Product => ({
  id: medicine.id || `prd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  product_code: parseProductCode(medicine.product_code ?? medicine.productCode ?? 0),
  name: medicine.name || 'Unnamed Medicine',
  partyId: medicine.supplier_id || '',
  partyName: medicine.supplier_name || 'Unknown Supplier',
  invoiceDate: medicine.created_at ? String(medicine.created_at).split('T')[0] : new Date().toISOString().split('T')[0],
  manufacturer: medicine.company || 'Unknown Manufacturer',
  purchaseRate: Number(medicine.buy_price ?? 0),
  sellingRate: Number(medicine.sale_price ?? 0),
  batchNumber: medicine.batch_number || '',
  expiryDate: medicine.expiry_date || '',
  stockQuantity: Number(medicine.stock_quantity ?? 0),
  minimumStockLevel: Number(medicine.min_stock_level ?? 15),
  photoUrl: '',
  category: '',
  createdAt: medicine.created_at || new Date().toISOString(),
});

const mapDbPoStatusToUi = (status?: string): PurchaseOrder['status'] => {
  const value = String(status ?? 'Pending').trim();
  if (value === 'Received') return 'Received';
  if (value === 'Ordered' || value === 'Sent') return 'Sent';
  if (value === 'Cancelled') return 'Cancelled';
  return 'Draft';
};

const mapUiPoStatusToDb = (status?: PurchaseOrder['status'] | string): string => {
  const value = String(status ?? 'Draft').trim();
  if (value === 'Received') return 'Received';
  if (value === 'Sent' || value === 'Ordered') return 'Ordered';
  if (value === 'Cancelled') return 'Cancelled';
  return 'Pending';
};

const mapPurchaseOrderToState = (purchaseOrder: any): PurchaseOrder => ({
  id: purchaseOrder.id || `po-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  poNumber: purchaseOrder.po_number || purchaseOrder.poNumber || 'PO-UNKNOWN',
  partyId: purchaseOrder.supplier_id || purchaseOrder.partyId,
  partyName: purchaseOrder.supplier_name || purchaseOrder.partyName || 'Unknown Supplier',
  partyContact: purchaseOrder.party_contact || purchaseOrder.partyContact,
  partyAddress: purchaseOrder.party_address || purchaseOrder.partyAddress,
  partyDlNumber: purchaseOrder.party_dl_number || purchaseOrder.partyDlNumber,
  createdAt: purchaseOrder.created_at || purchaseOrder.createdAt || new Date().toISOString(),
  items: Array.isArray(purchaseOrder.items) ? purchaseOrder.items.map((item: any) => ({
    productId: item.medicine_id || item.productId || '',
    productName: item.medicine_name || item.productName || 'Unnamed medicine',
    manufacturer: item.manufacturer || '',
    batchNumber: item.batch_number || item.batchNumber || '',
    currentStock: Number(item.current_stock ?? item.currentStock ?? 0),
    minimumStockLevel: Number(item.minimum_stock_level ?? item.minimumStockLevel ?? 0),
    orderQuantity: Number(item.order_quantity ?? item.orderQuantity ?? 0),
    purchaseRate: Number(item.buy_price ?? item.purchaseRate ?? 0),
    totalAmount: Number(item.total_price ?? item.totalAmount ?? 0),
  })) : [],
  totalEstimatedCost: Number(purchaseOrder.total_amount ?? purchaseOrder.totalEstimatedCost ?? 0),
  status: mapDbPoStatusToUi(purchaseOrder.status),
  notes: purchaseOrder.notes,
});

const mapSaleToBill = (sale: any): Bill => ({
  id: sale.id || `bill-${Date.now()}`,
  invoiceNumber: sale.invoice_number || sale.invoiceNumber || `INV-${Date.now()}`,
  customerName: sale.customer_name || sale.customerName || 'Walk-in Customer',
  customerPhone: sale.customer_phone || sale.customerPhone || '',
  doctorName: sale.doctor_name || sale.doctorName || '',
  date: sale.created_at || sale.date || new Date().toISOString(),
  items: Array.isArray(sale.items) ? sale.items.map((item: any) => ({
    productId: item.medicine_id || item.productId || '',
    productName: item.medicine_name || item.productName || 'Unknown item',
    batchNumber: item.batch_number || item.batchNumber || '',
    expiryDate: item.expiry_date || item.expiryDate || '',
    quantity: Number(item.quantity ?? 0),
    rate: Number(item.unit_price ?? item.unitPrice ?? item.rate ?? 0),
    total: Number(item.total_price ?? item.totalPrice ?? item.total ?? 0),
  })) : [],
  subtotal: Number(sale.subtotal ?? 0),
  discount: Number(sale.discount ?? 0),
  tax: Number(sale.tax ?? 0),
  grandTotal: Number(sale.total_amount ?? sale.totalAmount ?? sale.grandTotal ?? 0),
  paymentMethod: sale.payment_method === 'Card' ? 'Card' : sale.payment_method === 'UPI' ? 'UPI' : 'Cash',
});

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(() => emptyProducts);

  const [parties, setParties] = useState<Party[]>(() => emptyParties);

  const refreshInventory = async () => {
    try {
      await dbService.init();

      const [medicines, suppliers, poRows, sales, savedSettings] = await Promise.all([
        dbService.getAllMedicines(),
        dbService.getAllSuppliers(),
        dbService.getAllPurchaseOrders().catch(() => []),
        dbService.getAllSales().catch(() => []),
        dbService.getSettings().catch(() => DEFAULT_SETTINGS),
      ]);

      const hasLocalData = (() => {
        try {
          const savedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
          const savedParties = localStorage.getItem(STORAGE_KEYS.PARTIES);
          const parsedProducts = savedProducts ? JSON.parse(savedProducts) : null;
          const parsedParties = savedParties ? JSON.parse(savedParties) : null;
          return (Array.isArray(parsedProducts) && parsedProducts.length > 0) || (Array.isArray(parsedParties) && parsedParties.length > 0);
        } catch {
          return false;
        }
      })();

      const hasDbData = medicines.length > 0 || suppliers.length > 0 || sales.length > 0;

      if (!hasLocalData || hasDbData) {
        if (medicines.length === 0 && suppliers.length === 0 && sales.length === 0) {
          setProducts([]);
          setParties([]);
          setBills([]);
          setPurchaseOrders([]);
          setSettings(DEFAULT_SETTINGS);
          localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
          localStorage.removeItem(STORAGE_KEYS.PARTIES);
          localStorage.removeItem(STORAGE_KEYS.BILLS);
          localStorage.removeItem(STORAGE_KEYS.PURCHASE_ORDERS);
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
          return;
        }

        setProducts(medicines.map(mapMedicineToProduct));
        setParties(suppliers.map((supplier: any) => ({
          id: supplier.id,
          name: supplier.name,
          address: supplier.address || '',
          contactNumber: supplier.phone || '',
          email: supplier.email || '',
          dlNumber: supplier.dl_number || '',
          createdAt: supplier.created_at || new Date().toISOString(),
        })));
        setBills(sales.map(mapSaleToBill));
        setPurchaseOrders(poRows.map(mapPurchaseOrderToState));
        const nextSettings: StoreSettings = {
          ...DEFAULT_SETTINGS,
          ...savedSettings,
        };
        setSettings(nextSettings);
      }
    } catch {
      // ignore DB hydration failures and keep the current localStorage-driven flow intact
    }
  };

  useEffect(() => {
    void refreshInventory();
  }, []);

  const [bills, setBills] = useState<Bill[]>(() => emptyBills);

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => emptyPurchaseOrders);

  const [settings, setSettings] = useState<StoreSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    } catch (e) {
      console.error('Failed to save products to localStorage', e);
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PARTIES, JSON.stringify(parties));
    } catch (e) {
      console.error('Failed to save parties to localStorage', e);
    }
  }, [parties]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(bills));
    } catch (e) {
      console.error('Failed to save bills to localStorage', e);
    }
  }, [bills]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(purchaseOrders));
    } catch (e) {
      console.error('Failed to save purchase orders to localStorage', e);
    }
  }, [purchaseOrders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }

    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }, [settings]);

  const addProduct = (productData: Omit<Product, 'id' | 'createdAt'>, options: { skipDbInsert?: boolean } = {}): Product => {
    const nextCode = (products && products.length > 0) ? Math.max(...products.map(p => p.product_code || 0)) + 1 : 1;
    const newProduct: Product = {
      ...productData,
      minimumStockLevel: productData.minimumStockLevel !== undefined ? productData.minimumStockLevel : 15,
      id: `prd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product_code: productData.product_code || nextCode,
      createdAt: new Date().toISOString(),
    };

    setProducts((prev) => [newProduct, ...prev]);

    if (!options.skipDbInsert) {
      void dbService.init().catch(() => undefined);
      void dbService.addMedicine({
        id: newProduct.id,
        product_code: newProduct.product_code,
        name: newProduct.name,
        company: newProduct.manufacturer,
        supplier_id: newProduct.partyId || null,
        supplier_name: newProduct.partyName || null,
        batch_number: newProduct.batchNumber,
        expiry_date: newProduct.expiryDate,
        purchase_date: newProduct.invoiceDate,
        has_multi_unit: 0,
        unit_pack_size: 1,
        buy_price: newProduct.purchaseRate,
        sale_price: newProduct.sellingRate,
        stock_quantity: newProduct.stockQuantity,
        min_stock_level: newProduct.minimumStockLevel || 15,
        rack_location: null,
        created_at: newProduct.createdAt,
        updated_at: newProduct.createdAt,
      }).then(() => {
        void refreshInventory();
      }).catch(() => undefined);
    }

    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );

    const product = products.find((item) => item.id === id);
    if (!product) return;

    const nextState = { ...product, ...updates };
    void dbService.updateMedicine(id, {
      id: nextState.id,
      name: nextState.name,
      company: nextState.manufacturer,
      supplier_id: nextState.partyId || null,
      supplier_name: nextState.partyName || null,
      batch_number: nextState.batchNumber,
      expiry_date: nextState.expiryDate,
      buy_price: nextState.purchaseRate,
      sale_price: nextState.sellingRate,
      stock_quantity: nextState.stockQuantity,
      min_stock_level: nextState.minimumStockLevel || 15,
      rack_location: null,
      updated_at: new Date().toISOString(),
    }).catch(() => undefined);
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((item) => item.id !== id));
    void dbService.deleteMedicine(id).catch(() => undefined);
  };

  const savePurchaseOrder = (poData: Omit<PurchaseOrder, 'id' | 'createdAt'>): PurchaseOrder => {
    const createdAt = new Date().toISOString();
    const nextPoNumber = poData.poNumber || `PO-${new Date().getFullYear()}-${String(purchaseOrders.length + 101).padStart(4, '0')}`;
    const newPO: PurchaseOrder = {
      ...poData,
      poNumber: nextPoNumber,
      id: `po-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt,
      status: poData.status || 'Draft',
    };

    setPurchaseOrders((prev) => [newPO, ...prev]);

    const poItems = newPO.items.map((item) => ({
      id: `po-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      po_id: newPO.id,
      medicine_id: item.productId,
      medicine_name: item.productName,
      order_quantity: item.orderQuantity,
      buy_price: item.purchaseRate,
      total_price: item.totalAmount,
      current_stock: item.currentStock,
      manufacturer: item.manufacturer,
      batch_number: item.batchNumber,
      minimum_stock_level: item.minimumStockLevel,
    }));

    void dbService.createPurchaseOrder({
      id: newPO.id,
      po_number: newPO.poNumber,
      supplier_id: newPO.partyId || null,
      supplier_name: newPO.partyName,
      total_amount: newPO.totalEstimatedCost,
      status: mapUiPoStatusToDb(newPO.status),
      created_at: createdAt,
    }, poItems).then(() => {
      void refreshInventory();
    }).catch(() => undefined);

    return newPO;
  };

  const receivePurchaseOrder = (items: { medicineId: string; quantity: number }[]) => {
    const validItems = items.filter((item) => item && item.medicineId && Number.isFinite(item.quantity) && item.quantity > 0);
    const updatedIds: string[] = [];

    setProducts((prev) =>
      prev.map((product) => {
        const match = validItems.find((item) => item.medicineId === product.id);
        if (!match) return product;

        updatedIds.push(product.id);
        const nextStock = product.stockQuantity + match.quantity;

        try {
          if (typeof dbService?.updateMedicineStock === 'function') {
            void dbService.updateMedicineStock(product.id, match.quantity);
          }
        } catch {
          // ignore db fallback errors to keep the UI functional in browser-only mode
        }

        return {
          ...product,
          stockQuantity: nextStock,
        };
      })
    );

    return { updatedCount: updatedIds.length, updatedIds };
  };

  const updatePurchaseOrderStatus = (id: string, status: 'Draft' | 'Sent' | 'Received') => {
    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === id ? { ...po, status } : po))
    );

    void dbService.updatePOStatus(id, mapUiPoStatusToDb(status)).then(() => {
      void refreshInventory();
    }).catch(() => undefined);
  };

  const deletePurchaseOrder = (id: string) => {
    setPurchaseOrders((prev) => prev.filter((po) => po.id !== id));
  };

  const addParty = (partyData: Omit<Party, 'id' | 'createdAt'>): Party => {
    const newParty: Party = {
      ...partyData,
      id: `pty-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };

    setParties((prev) => [newParty, ...prev]);

    void dbService.init().catch(() => undefined);
    void dbService.addSupplier({
      id: newParty.id,
      name: newParty.name,
      contact_person: newParty.contactNumber || null,
      phone: newParty.contactNumber || null,
      email: newParty.email || null,
      address: newParty.address || null,
      dl_number: newParty.dlNumber || null,
      gstin: null,
      created_at: newParty.createdAt,
      updated_at: newParty.createdAt,
    }).then(() => {
      void refreshInventory();
    }).catch(() => undefined);

    return newParty;
  };

  const updateParty = (id: string, updates: Partial<Party>) => {
    setParties((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );

    const party = parties.find((item) => item.id === id);
    if (party) {
      const nextParty = { ...party, ...updates };
      void dbService.updateSupplier(id, {
        id: nextParty.id,
        name: nextParty.name,
        contact_person: nextParty.contactNumber || null,
        phone: nextParty.contactNumber || null,
        email: nextParty.email || null,
        address: nextParty.address || null,
        dl_number: nextParty.dlNumber || null,
        gstin: null,
        updated_at: new Date().toISOString(),
      }).catch(() => undefined);
    }

    if (updates.name) {
      setProducts((prev) =>
        prev.map((p) => (p.partyId === id ? { ...p, partyName: updates.name! } : p))
      );
    }
  };

  const deleteParty = (id: string) => {
    setParties((prev) => prev.filter((item) => item.id !== id));
    void dbService.deleteSupplier(id).catch(() => undefined);
  };

  const createBill = (billData: {
    customerName: string;
    customerPhone?: string;
    doctorName?: string;
    items: {
      productId: string;
      productName: string;
      batchNumber: string;
      expiryDate: string;
      quantity: number;
      rate: number;
      total: number;
    }[];
    subtotal: number;
    discount: number;
    tax: number;
    grandTotal: number;
    paymentMethod: 'Cash' | 'Card' | 'UPI';
  }): Bill => {
    const nextInvoiceNumber = `INV-${new Date().getFullYear()}-${String(bills.length + 1001).padStart(4, '0')}`;
    const newBill: Bill = {
      ...billData,
      id: `bill-${Date.now()}`,
      invoiceNumber: nextInvoiceNumber,
      date: new Date().toISOString(),
    };

    // Deduct stock
    setProducts((prev) =>
      prev.map((prod) => {
        const cartMatch = billData.items.find((item) => item.productId === prod.id);
        if (cartMatch) {
          const updatedQty = Math.max(0, prod.stockQuantity - cartMatch.quantity);
          return { ...prod, stockQuantity: updatedQty };
        }
        return prod;
      })
    );

    setBills((prev) => [newBill, ...prev]);
    return newBill;
  };

  const updateSettings = (updates: Partial<StoreSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      void dbService.saveSettings(next).catch(() => undefined);
      return next;
    });
  };

  const exportBackup = () => {
    const backupData = {
      app: 'PharmaCare Medical Store Management System',
      version: '1.1.0',
      exportDate: new Date().toISOString(),
      settings,
      medicines: products,
      suppliers: parties,
      sales: bills,
    };

    void dbService.exportBackup({ settings, medicines: products, suppliers: parties, sales: bills }).catch(() => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateFormatted = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `pharmacare_backup_${dateFormatted}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  };

  const importBackup = (jsonString: string): { success: boolean; message: string } => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, message: 'Invalid JSON file format.' };
      }

      const normalized = {
        ...parsed,
        medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
        suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
        sales: Array.isArray(parsed.sales) ? parsed.sales : [],
      };

      void dbService.importBackup(normalized)
        .then(() => refreshInventory())
        .catch(() => undefined);

      if (Array.isArray(parsed.medicines)) {
        const sanitized = parsed.medicines.map((p: Product) => ({
          ...p,
          minimumStockLevel: p.minimumStockLevel !== undefined ? p.minimumStockLevel : 15,
        }));
        setProducts(sanitized);
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(sanitized));
      }
      if (Array.isArray(parsed.suppliers)) {
        setParties(parsed.suppliers);
        localStorage.setItem(STORAGE_KEYS.PARTIES, JSON.stringify(parsed.suppliers));
      }
      if (Array.isArray(parsed.sales)) {
        setBills(parsed.sales);
        localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(parsed.sales));
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        const nextSettings: StoreSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed.settings,
        };
        setSettings(nextSettings);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(nextSettings));
      }

      return {
        success: true,
        message: `Successfully restored ${normalized.medicines.length} medicines and ${normalized.suppliers.length} suppliers!`,
      };
    } catch (err: any) {
      return { success: false, message: `Could not read this backup file. Please select a valid backup JSON file.` };
    }
  };

  const resetToDemoData = () => {
    void dbService.loadSampleData()
      .then(() => refreshInventory())
      .catch(() => {
        setProducts(emptyProducts);
        setParties(emptyParties);
        setBills(emptyBills);
        setPurchaseOrders(emptyPurchaseOrders);
        setSettings(DEFAULT_SETTINGS);
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(emptyProducts));
        localStorage.setItem(STORAGE_KEYS.PARTIES, JSON.stringify(emptyParties));
        localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(emptyBills));
        localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(emptyPurchaseOrders));
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      });
  };

  const searchSuppliers = async (query: string): Promise<Party[]> => {
    try {
      const matches = await dbService.searchSuppliers(query);
      return matches.map((party: any) => ({
        id: party.id,
        name: party.name || '',
        address: party.address || '',
        contactNumber: party.contactNumber || party.phone || party.contact_person || '',
        email: party.email || undefined,
        dlNumber: party.dlNumber || party.dl_number || undefined,
        createdAt: party.createdAt || party.created_at || new Date().toISOString(),
      }));
    } catch {
      const q = (query ?? '').toLowerCase();
      return parties.filter((party) => {
        return !q || party.name.toLowerCase().includes(q) || party.contactNumber.toLowerCase().includes(q) || party.address.toLowerCase().includes(q) || (party.dlNumber ?? '').toLowerCase().includes(q);
      });
    }
  };

  const disposeExpiredMedicine = (id: string): Product | null => {
    const target = products.find((item) => item.id === id);
    if (!target) return null;

    const updatedProduct = { ...target, stockQuantity: 0 };
    setProducts((prev) => prev.map((item) => (item.id === id ? updatedProduct : item)));
    void dbService.disposeExpiredMedicine(id).catch(() => undefined);
    return updatedProduct;
  };

  const getExpiredProducts = (): Product[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return products.filter((p) => {
      if (!p.expiryDate || p.stockQuantity <= 0) return false;
      const expDate = new Date(p.expiryDate);
      expDate.setHours(23, 59, 59, 999);
      return expDate < today;
    });
  };

  const getNearExpiryProducts = (daysThreshold = 30): Product[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysThreshold);
    futureDate.setHours(23, 59, 59, 999);

    return products.filter((p) => {
      if (!p.expiryDate || p.stockQuantity <= 0) return false;
      const expDate = new Date(p.expiryDate);
      return expDate >= today && expDate <= futureDate && expDate > today;
    });
  };

  const getLowStockProducts = (): Product[] => {
    return products.filter((p) => {
      const min = p.minimumStockLevel !== undefined ? p.minimumStockLevel : 15;
      return p.stockQuantity > 0 && p.stockQuantity <= min;
    });
  };

  const getOutOfStockProducts = (): Product[] => {
    return products.filter((p) => p.stockQuantity === 0);
  };

  const getReorderNeededProducts = (): Product[] => {
    return products.filter((p) => {
      const min = p.minimumStockLevel !== undefined ? p.minimumStockLevel : 15;
      return p.stockQuantity <= min;
    });
  };

  return (
    <InventoryContext.Provider
      value={{
        products,
        parties,
        bills,
        settings,
        purchaseOrders,
        addProduct,
        refreshInventory,
        updateProduct,
        deleteProduct,
        addParty,
        updateParty,
        deleteParty,
        createBill,
        savePurchaseOrder,
        receivePurchaseOrder,
        updatePurchaseOrderStatus,
        deletePurchaseOrder,
        updateSettings,
        exportBackup,
        importBackup,
        resetToDemoData,
        searchSuppliers,
        disposeExpiredMedicine,
        getExpiredProducts,
        getNearExpiryProducts,
        getLowStockProducts,
        getOutOfStockProducts,
        getReorderNeededProducts,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
