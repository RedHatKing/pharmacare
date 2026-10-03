import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Product, CartItem, Bill } from '../types/inventory';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  User,
  Phone,
  Stethoscope,
  XCircle,
  AlertTriangle,
  RotateCcw,
  History,
  QrCode
} from 'lucide-react';

export const POS: React.FC = () => {
  const { products, bills, createBill, settings } = useInventory();

  // Search & Selection
  const [codeQuery, setCodeQuery] = useState(''); // Fast code entry
  const [nameQuery, setNameQuery] = useState(''); // Name/batch search
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer & Bill Details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const paymentMethod: 'Cash' | 'Card' | 'UPI' = 'Cash';
  const [discountAmount, setDiscountAmount] = useState<string>('0');

  // Completed Slip Modal
  const [activeReceiptBill, setActiveReceiptBill] = useState<Bill | null>(null);
  const [showRecentBills, setShowRecentBills] = useState(false);
  const [alertError, setAlertError] = useState('');

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Utility: parse pack size from product name like "(15 Tabs)"
  const getPackSize = (p: Product): number | null => {
    const m = p.name.match(/\((\d+)\s*(tabs|tab|tabs|Tab|Tabs|Caps|Capsules|Caps)\)/i);
    if (m) return parseInt(m[1], 10) || null;
    return null;
  };

  // Filter available products for POS name search. If no nameQuery, show popular medicines.
  const searchResults = useMemo(() => {
    const q = nameQuery.toLowerCase().trim();

    const base = products.filter((p) => new Date(p.expiryDate) >= today && p.stockQuantity > 0);

    if (!q) {
      return base.slice(0, 12);
    }

    return base
      .filter((p) => p.name.toLowerCase().includes(q) || p.batchNumber.toLowerCase().includes(q) || p.manufacturer.toLowerCase().includes(q))
      .slice(0, 50);
  }, [products, nameQuery, today]);

  // Keyboard navigation state
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [codeNotFound, setCodeNotFound] = useState(false);

  useEffect(() => {
    // focus code input on mount
    codeInputRef.current?.focus();
    const onGlobalKey = (e: KeyboardEvent) => {
      // F1 / Alt+C -> focus code input
      if (e.key === 'F1' || (e.altKey && (e.key === 'c' || e.key === 'C'))) {
        e.preventDefault();
        codeInputRef.current?.focus();
      }
      // F2 / Alt+N -> focus name input
      if (e.key === 'F2' || (e.altKey && (e.key === 'n' || e.key === 'N'))) {
        e.preventDefault();
        nameInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

  // Reset selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(searchResults.length > 0 ? 0 : -1);
  }, [searchResults]);

  const addToCart = (product: Product) => {
    setAlertError('');

    // Check if expired
    const isExpired = new Date(product.expiryDate) < today;
    if (isExpired) {
      setAlertError(`Cannot add: ${product.name} (Batch: ${product.batchNumber}) has expired.`);
      return;
    }

    if (product.stockQuantity <= 0) {
      setAlertError(`Out of stock: "${product.name}" has 0 items left.`);
      return;
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          setAlertError(`Cannot add more: Only ${product.stockQuantity} items in stock for ${product.name}`);
          return prevCart;
        }
        return prevCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        // Determine buy price fields. If product name contains unit info like "(15 Tabs)",
        // compute unit buy price as purchaseRate / packSize. Otherwise use purchaseRate as buyPrice.
        let buyPrice: number | undefined = product.purchaseRate;
        let unitBuyPrice: number | undefined = undefined;

        // Try to extract pack size from product.name like "(15 Tabs)" or "(10 Tabs)"
        const packMatch = product.name.match(/\((\d+)\s*(tabs|tabs|tabs|tabs|Tab|Tabs|Caps|Capsules|Caps|Tabs|Tabs)\)/i);
        if (packMatch) {
          const packSize = parseInt(packMatch[1], 10);
          if (packSize > 1) {
            unitBuyPrice = +(product.purchaseRate / packSize);
          }
        }

        return [...prevCart, { product, quantity: 1, rate: product.sellingRate || product.purchaseRate * 1.25, buyPrice, unitBuyPrice }];
      }
    });

    setNameQuery('');
  };

  // Add a single loose/unit to cart (1 unit)
  const addLooseToCart = (product: Product) => {
    // compute buy prices
    const packSize = getPackSize(product);
    const buyPrice = product.purchaseRate;
    const unitBuyPrice = packSize && packSize > 1 ? +(product.purchaseRate / packSize) : undefined;

    setAlertError('');
    const isExpired = new Date(product.expiryDate) < today;
    if (isExpired) {
      setAlertError(`Cannot add: ${product.name} (Batch: ${product.batchNumber}) has expired.`);
      return;
    }
    if (product.stockQuantity <= 0) {
      setAlertError(`Out of stock: "${product.name}" has 0 items left.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.stockQuantity) {
          setAlertError(`Cannot add more: Only ${product.stockQuantity} items in stock for ${product.name}`);
          return prev;
        }
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1, rate: product.sellingRate || product.purchaseRate * 1.25, buyPrice, unitBuyPrice }];
    });
    setNameQuery('');
  };

  // Add a full pack to cart (packSize units). If packSize unknown, add 1 unit.
  const addPackToCart = (product: Product) => {
    const packSize = getPackSize(product) || 1;
    const buyPrice = product.purchaseRate;
    const unitBuyPrice = packSize > 1 ? +(product.purchaseRate / packSize) : undefined;

    setAlertError('');
    const isExpired = new Date(product.expiryDate) < today;
    if (isExpired) {
      setAlertError(`Cannot add: ${product.name} (Batch: ${product.batchNumber}) has expired.`);
      return;
    }
    if (product.stockQuantity <= 0) {
      setAlertError(`Out of stock: "${product.name}" has 0 items left.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity + packSize > product.stockQuantity) {
          setAlertError(`Cannot add more: Only ${product.stockQuantity} items in stock for ${product.name}`);
          return prev;
        }
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + packSize } : i);
      }
      return [...prev, { product, quantity: packSize, rate: product.sellingRate || product.purchaseRate * 1.25, buyPrice, unitBuyPrice }];
    });
    setNameQuery('');
  };

  const updateQuantity = (productId: string, newQty: number) => {
    setAlertError('');
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const targetProduct = products.find((p) => p.id === productId);
    if (targetProduct && newQty > targetProduct.stockQuantity) {
      setAlertError(`Only ${targetProduct.stockQuantity} items available for ${targetProduct.name}`);
      return;
    }

    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: newQty } : item))
    );
  };

  const updateItemRate = (productId: string, newRate: number) => {
    if (newRate < 0) return;
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, rate: newRate } : item))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount('0');
    setCustomerName('');
    setCustomerPhone('');
    setDoctorName('');
    setAlertError('');
  };

  // Totals calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  }, [cart]);

  const discount = useMemo(() => {
    const d = parseFloat(discountAmount);
    return isNaN(d) ? 0 : Math.min(d, subtotal);
  }, [discountAmount, subtotal]);

  const tax = useMemo(() => {
    if (!settings.defaultTaxRate || settings.defaultTaxRate <= 0) return 0;
    return (subtotal - discount) * (settings.defaultTaxRate / 100);
  }, [subtotal, discount, settings.defaultTaxRate]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discount + tax);
  }, [subtotal, discount, tax]);

  // Handle Generate Slip & Save Bill
  const handleGenerateSlip = () => {
    if (cart.length === 0) {
      setAlertError('Please add at least one medicine before generating bill slip.');
      return;
    }

    const billItems = cart.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      batchNumber: item.product.batchNumber,
      expiryDate: item.product.expiryDate,
      quantity: item.quantity,
      rate: item.rate,
      total: item.quantity * item.rate,
    }));

    const generated = createBill({
      customerName: customerName.trim() || 'Walk-in Customer',
      customerPhone: customerPhone.trim() || undefined,
      doctorName: doctorName.trim() || undefined,
      items: billItems,
      subtotal,
      discount,
      tax,
      grandTotal,
      paymentMethod,
    });

    setActiveReceiptBill(generated);
    clearCart();
  };

  return (
    <div className="space-y-4">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-700" />
            <span>Create Customer Bill (POS)</span>
          </h2>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            Search medicines, add to bill, and print customer receipt slip
          </p>
        </div>

        <button
          onClick={() => setShowRecentBills(!showRecentBills)}
          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
        >
          <History className="w-3.5 h-3.5 text-emerald-700" />
          <span>{showRecentBills ? 'Hide Past Bills' : `Past Bills (${bills.length})`}</span>
        </button>
      </div>

      {/* Alert Banner */}
      {alertError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{alertError}</span>
          </div>
          <button onClick={() => setAlertError('')} className="p-1 hover:text-rose-950">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Recent Invoices Quick Drawer */}
      {showRecentBills && (
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Recent Bills (Click to view or reprint slip)
            </h4>
            <button
              onClick={() => setShowRecentBills(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-mono"
            >
              Close [ESC]
            </button>
          </div>
          {bills.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4 font-mono">No customer bills made yet today.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {bills.slice(0, 8).map((b) => (
                <div
                  key={b.id}
                  onClick={() => setActiveReceiptBill(b)}
                  className="p-2.5 border border-slate-300 dark:border-slate-700 hover:border-emerald-700 cursor-pointer bg-slate-50 dark:bg-slate-800/60 transition-all flex flex-col justify-between text-xs"
                >
                  <div className="flex justify-between items-start font-mono">
                    <span className="font-bold text-slate-900 dark:text-white">{b.invoiceNumber}</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {settings.currencySymbol} {b.grandTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-slate-500 mt-1 flex justify-between">
                    <span className="truncate max-w-[100px]">{b.customerName || 'Walk-in'}</span>
                    <span className="font-mono">{b.paymentMethod}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Search & Cart Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Product Search & Quick Shelf (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Live Barcode / Medicine Search */}
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3">
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Search Medicine
            </label>
            <div className="relative">
              <div className="flex items-center gap-2">
                <input
                  ref={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  value={codeQuery}
                  onChange={(e) => { setCodeQuery(e.target.value.replace(/[^0-9]/g, '')); setCodeNotFound(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const code = Number(codeQuery);
                      if (!isNaN(code) && code > 0) {
                        const found = products.find((p) => p.product_code === code);
                        if (found) {
                          addLooseToCart(found);
                          setCodeQuery('');
                          setCodeNotFound(false);
                          setTimeout(() => codeInputRef.current?.focus(), 0);
                        } else {
                          // flash not found
                          setCodeNotFound(true);
                          setTimeout(() => setCodeNotFound(false), 800);
                        }
                      }
                    } else if (e.key === 'Tab' || (e.key === 'ArrowRight' && codeQuery === '')) {
                      // move focus to name input
                      e.preventDefault();
                      nameInputRef.current?.focus();
                    }
                  }}
                  placeholder="Code + Enter"
                  className={`w-36 px-2 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border ${codeNotFound ? 'border-rose-600' : 'border-slate-300'} dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-all`}
                />

                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={nameQuery}
                    onChange={(e) => { setNameQuery(e.target.value); setSelectedIndex(0); }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedIndex((s) => Math.min(s + 1, searchResults.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedIndex((s) => Math.max(s - 1, 0));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        const sel = searchResults[selectedIndex >= 0 ? selectedIndex : 0];
                        if (sel) {
                          if (e.shiftKey) addPackToCart(sel);
                          else addLooseToCart(sel);
                          setNameQuery('');
                          setSelectedIndex(0);
                          setTimeout(() => nameInputRef.current?.focus(), 0);
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setNameQuery('');
                        setSelectedIndex(-1);
                      } else if (e.key === 'Tab' && (e.shiftKey || e.ctrlKey)) {
                        // allow normal tab behavior
                      }
                    }}
                    placeholder="Type name... (Use ↑ ↓ arrows & Enter)"
                    className="w-full pl-9 pr-8 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-sans focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 rounded-sm">[Enter] Add Loose</span>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 rounded-sm">[Shift+Enter] Add Pack</span>
                </div>
              </div>
              {nameQuery && (
                <button
                  onClick={() => setNameQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title="Clear Search"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Compact List / Table View for searchResults */}
            <div className="mt-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 max-h-64 overflow-y-auto w-full overflow-x-hidden text-[10px] text-slate-700 dark:text-slate-300">
              <table className="table-auto w-full">
                <thead>
                  <tr>
                    <th className="w-6 text-[9px] font-bold uppercase tracking-wider text-slate-500 py-1 px-1 text-left">Code</th>
                    <th className="w-auto text-[9px] font-bold uppercase tracking-wider text-slate-500 py-1 px-1 text-left">Product</th>
                    <th className="whitespace-nowrap px-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 py-1 text-left">Batch / Exp</th>
                    <th className="whitespace-nowrap px-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 py-1 text-left">Stock</th>
                    <th className="whitespace-nowrap px-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 py-1 text-left">Cost</th>
                    <th className="whitespace-nowrap px-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 py-1 text-left">Sell</th>
                    <th className="w-[85px] text-right text-[9px] font-bold uppercase tracking-wider text-slate-500 py-1 px-1">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-3 text-center text-slate-400 font-mono">No medicines found.</td>
                    </tr>
                  ) : (
                    searchResults.map((prod, idx) => {
                      const isNearExpiry = (() => {
                        const exp = new Date(prod.expiryDate);
                        const now = new Date();
                        const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                        return diff <= 30; // near expiry within 30 days
                      })();

                      const packSize = getPackSize(prod);
                      const unitBuy = packSize && packSize > 1 ? +(prod.purchaseRate / packSize) : undefined;

                      return (
                        <tr
                          key={prod.id}
                          tabIndex={-1}
                          className={`border-t border-slate-100 dark:border-slate-800 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/30 ${selectedIndex === idx ? 'bg-emerald-100 dark:bg-emerald-950/50' : ''}`}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          onDoubleClick={() => addLooseToCart(prod)}
                        >
                          <td className="py-1 px-1 align-middle font-mono text-[11px] text-slate-700">#{prod.product_code}</td>
                          <td className="py-1 px-1 align-middle">
                            <div title={prod.name} className="text-[11px] font-medium text-slate-900 dark:text-slate-100 truncate max-w-[150px]">{prod.name}</div>
                          </td>
                          <td className="py-1 px-1 align-middle whitespace-nowrap font-mono text-[9px] text-slate-500">
                            <div>{prod.batchNumber} · {(() => { try { const d = new Date(prod.expiryDate); const mm = String(d.getMonth()+1).padStart(2,'0'); const yy = String(d.getFullYear()).slice(-2); return `${mm}/${yy}` } catch(e){ return prod.expiryDate } })()}</div>
                          </td>
                          <td className="py-1 px-1 align-middle whitespace-nowrap font-mono text-[10px] text-slate-600">
                            <div>{prod.stockQuantity}L/{packSize ? Math.floor(prod.stockQuantity / packSize) : 0}P</div>
                          </td>
                          <td className="py-1 px-1 align-middle whitespace-nowrap font-mono text-[10px] font-semibold">
                            <div>{settings.currencySymbol} {unitBuy ? unitBuy.toFixed(2) : prod.purchaseRate.toFixed(2)}</div>
                          </td>
                          <td className="py-1 px-1 align-middle whitespace-nowrap font-mono text-[10px] font-semibold text-emerald-700">
                            <div>{settings.currencySymbol} {prod.sellingRate.toFixed(2)}</div>
                          </td>
                          <td className="py-1 px-1 align-middle">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => addPackToCart(prod)}
                                className="px-1 py-0.5 text-[9px] font-semibold rounded bg-emerald-700 text-white"
                                title="Add 1 Pack (Shift+Enter)"
                              >
                                + Pack
                              </button>
                              <button
                                onClick={() => addLooseToCart(prod)}
                                className="px-1 py-0.5 text-[9px] font-semibold rounded border border-slate-300 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                title="Add 1 Unit"
                              >
                                + Loose
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Removed grid-style quick add; search table shows popular medicines when empty */}
        </div>

        {/* Right Column: Customer Details, Cart Table & Calculation (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex flex-col justify-between">
            {/* Customer & Prescription Header */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Customer & Doctor Details (Optional)
                </span>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-[10.5px] font-bold uppercase tracking-wider text-rose-700 hover:text-rose-800 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Empty Cart</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 sm:col-span-1">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer Name (Optional)"
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Customer Phone (Optional)"
                    className="w-full px-2 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  />
                </div>

                <div className="col-span-2">
                  <input
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="Doctor Name / Clinic (Optional)"
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
              </div>
            </div>

            {/* Cart Items Table */}
            <div className="p-3 flex-1 overflow-y-auto max-h-[320px]">
              <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-slate-500 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                <span>Items in Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
                <span>Total</span>
              </div>

              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-mono text-xs">
                  <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="font-bold uppercase text-slate-500">Your Cart is Empty</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Search above or click any medicine to add it here.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {cart.map((item) => (
                    <div key={item.product.id} className="py-2 space-y-1 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h5 className="font-bold text-slate-900 dark:text-white truncate">
                            {item.product.name}
                          </h5>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Batch: {item.product.batchNumber} · Exp: {item.product.expiryDate.slice(2, 7)}
                          </div>

                          {/* Cost & Margin badge */}
                          <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-2">
                            <span className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 rounded-sm">
                              Cost: {settings.currencySymbol} {((item.unitBuyPrice ?? item.buyPrice) ?? 0).toFixed(2)}
                            </span>
                            <span className="px-1 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-500 rounded-sm">
                              Sell: {settings.currencySymbol} {item.rate.toFixed(2)}
                            </span>
                            <span className="text-slate-500">|</span>
                            <span className="font-mono text-slate-600">
                              Profit: {settings.currencySymbol} {((item.rate - ((item.unitBuyPrice ?? item.buyPrice) ?? 0)) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
                          {settings.currencySymbol} {(item.quantity * item.rate).toFixed(2)}
                        </span>
                      </div>

                      {/* Quantity & Rate Controller */}
                      <div className="flex items-center justify-between pt-0.5">
                        <div className="flex items-center border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="px-2 py-0.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                            title="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 font-mono font-bold tabular-nums text-slate-900 dark:text-white min-w-[24px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="px-2 py-0.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                            title="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center text-[11px] font-mono text-slate-500">
                            <span className="mr-1">Price:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={item.rate}
                              onChange={(e) => updateItemRate(item.product.id, parseFloat(e.target.value) || 0)}
                              className="w-16 px-1 py-0.5 font-mono text-right border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1 border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-rose-700 hover:border-rose-700"
                            title="Remove item"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Calculations & Payment Mode */}
            <div className="p-3 border-t border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 space-y-2.5">
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {settings.currencySymbol} {subtotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Discount ({settings.currencySymbol}):</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-20 px-1.5 py-0.5 text-right font-mono border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 font-bold"
                  />
                </div>

                {settings.defaultTaxRate > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Tax ({settings.defaultTaxRate}%):</span>
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                      {settings.currencySymbol} {tax.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                  <span className="text-xs uppercase tracking-wider">Final Bill Amount:</span>
                  <span className="text-base font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {settings.currencySymbol} {grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Generate Slip Button */}
              <button
                type="button"
                onClick={handleGenerateSlip}
                disabled={cart.length === 0}
                className="w-full py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 border border-emerald-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <Receipt className="w-4 h-4" />
                <span>Print Slip & Complete Sale</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 80mm Thermal Receipt Modal Preview */}
      {activeReceiptBill && (
        <ThermalReceiptModal
          bill={activeReceiptBill}
          settings={settings}
          isOpen={!!activeReceiptBill}
          onClose={() => setActiveReceiptBill(null)}
        />
      )}
    </div>
  );
};
