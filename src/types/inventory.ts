export interface Party {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
  email?: string;
  dlNumber?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  product_code: number;
  partyId?: string;
  partyName: string;
  invoiceDate: string;
  manufacturer: string;
  purchaseRate: number;
  sellingRate: number;
  batchNumber: string;
  expiryDate: string;
  stockQuantity: number;
  minimumStockLevel?: number;
  photoUrl?: string;
  category?: string;
  createdAt: string;
}

export interface POItem {
  productId: string;
  productName: string;
  manufacturer: string;
  batchNumber: string;
  currentStock: number;
  minimumStockLevel: number;
  orderQuantity: number;
  purchaseRate: number;
  totalAmount: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  partyId?: string;
  partyName: string;
  partyContact?: string;
  partyAddress?: string;
  partyDlNumber?: string;
  createdAt: string;
  items: POItem[];
  totalEstimatedCost: number;
  status: 'Draft' | 'Sent' | 'Received' | 'Pending' | 'Ordered' | 'Cancelled';
  notes?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  rate: number;
  buyPrice?: number; // pack/full product purchase price
  unitBuyPrice?: number; // per-unit purchase price if sold loose/sub-units
}

export interface BillItem {
  productId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface Bill {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  doctorName?: string;
  date: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: 'Cash' | 'Card' | 'UPI';
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  dlNumber: string;
  gstNumber: string;
  currencySymbol: string;
  defaultTaxRate: number;
  databasePath?: string;
}

export type ViewTab = 'dashboard' | 'pos' | 'addProduct' | 'reorder' | 'expired' | 'parties' | 'settings';
