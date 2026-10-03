import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Product, Party, PurchaseOrder, POItem } from '../types/inventory';
import {
  ClipboardList,
  Printer,
  Check,
  AlertTriangle,
  AlertOctagon,
  Building2,
  Phone,
  FileText,
  FileSpreadsheet,
  Download,
  Trash2,
  Clock,
  CheckCircle2,
  X,
  HardDrive,
  ArrowRight,
  PackageCheck
} from 'lucide-react';

interface PurchaseOrdersProps {
  onNavigateToInventory?: () => void;
  onNavigateToAddProduct?: () => void;
}

export const PurchaseOrders: React.FC<PurchaseOrdersProps> = ({
  onNavigateToInventory,
  onNavigateToAddProduct,
}) => {
  const {
    products,
    parties,
    settings,
    purchaseOrders,
    savePurchaseOrder,
    receivePurchaseOrder,
    updatePurchaseOrderStatus,
    deletePurchaseOrder,
    updateProduct,
  } = useInventory();

  const [activeTab, setActiveTab] = useState<'reorder-engine' | 'po-history'>('reorder-engine');
  const [selectedPOForPrint, setSelectedPOForPrint] = useState<PurchaseOrder | null>(null);
  const [actionNotice, setActionNotice] = useState<string>('');

  // Editable quantities per product for draft POs: { [productId]: number }
  const [reorderQuantities, setReorderQuantities] = useState<{ [productId: string]: number }>({});
  // Excluded product IDs from PO
  const [excludedProductIds, setExcludedProductIds] = useState<{ [productId: string]: boolean }>({});
  // Selected additional products to add to a supplier's PO: { [supplierName]: productId }
  const [extraProductToAdd, setExtraProductToAdd] = useState<{ [supplierName: string]: string }>({});
  // Additional product IDs loaded into a supplier card beyond the low-stock list
  const [supplementalProductIdsBySupplier, setSupplementalProductIdsBySupplier] = useState<{ [supplierName: string]: string[] }>({});

  // 1. Identify low-stock and out-of-stock products
  const lowStockAndOutProducts = useMemo(() => {
    return products.filter((p) => {
      const min = p.minimumStockLevel !== undefined ? p.minimumStockLevel : 15;
      return p.stockQuantity <= min;
    });
  }, [products]);

  // Group all medicines by supplier so the user sees the full supplier catalog.
  const groupedBySupplier = useMemo(() => {
    const map = new Map<string, { party?: Party; items: Product[] }>();

    products.forEach((prod) => {
      const sName = prod.partyName || 'Direct / General Supplier';
      if (!map.has(sName)) {
        const matchedParty = parties.find(
          (p) => p.id === prod.partyId || p.name.toLowerCase() === sName.toLowerCase()
        );
        map.set(sName, { party: matchedParty, items: [] });
      }
      map.get(sName)!.items.push(prod);
    });

    return Array.from(map.entries()).map(([supplierName, data]) => ({
      supplierName,
      party: data.party,
      items: data.items,
    }));
  }, [products, parties]);

  // Helper to calculate default suggested order quantity
  const getOrderQty = (product: Product): number => {
    if (reorderQuantities[product.id] !== undefined) {
      return reorderQuantities[product.id];
    }
    const minLevel = product.minimumStockLevel !== undefined ? product.minimumStockLevel : 15;
    const deficit = Math.max(minLevel * 2 - product.stockQuantity, 10);
    return Math.max(10, Math.ceil(deficit / 5) * 5);
  };

  const getSupplierVisibleProducts = (supplierName: string, baseItems: Product[], party?: Party): Product[] => {
    const idsInView = new Set(baseItems.map((item) => item.id));
    const extraIds = supplementalProductIdsBySupplier[supplierName] ?? [];

    const extras = products.filter((product) => {
      if (idsInView.has(product.id)) return false;
      if (!extraIds.includes(product.id)) return false;
      return product.partyName === supplierName || (party ? product.partyId === party.id : false);
    });

    return [...baseItems, ...extras];
  };

  const isProductSelectedForSupplier = (product: Product, supplierName: string) => {
    if (lowStockAndOutProducts.some((item) => item.id === product.id)) {
      return excludedProductIds[product.id] !== true;
    }
    return excludedProductIds[product.id] !== true && (supplementalProductIdsBySupplier[supplierName] ?? []).includes(product.id);
  };

  const getCheckedSupplierItems = (supplierItems: Product[]) =>
    supplierItems.map((item) => ({
      ...item,
      checked: excludedProductIds[item.id] === true ? false : true,
      orderQuantity: reorderQuantities[item.id] ?? getOrderQty(item),
    }));

  const getCheckedSupplierCount = (supplierItems: Product[]) =>
    getCheckedSupplierItems(supplierItems).filter((item) => item.checked === true).length;

  const handleQtyChange = (productId: string, val: string) => {
    const num = parseInt(val, 10);
    setReorderQuantities((prev) => ({
      ...prev,
      [productId]: isNaN(num) || num < 1 ? 1 : num,
    }));
  };

  const toggleExcludeProduct = (productId: string) => {
    setExcludedProductIds((prev) => {
      const currentlyExcluded = prev[productId] === true;
      return {
        ...prev,
        [productId]: !currentlyExcluded,
      };
    });
  };

  // Generate PO object for a supplier
  const buildPOForSupplier = (supplierName: string, items: Product[], party?: Party): PurchaseOrder => {
    const selectedItems = getCheckedSupplierItems(items).filter(
      (item) => item.checked === true && Number(item.orderQuantity) > 0
    );
    const poItems: POItem[] = selectedItems.map((prod) => ({
      productId: prod.id,
      productName: prod.name,
      manufacturer: prod.manufacturer,
      batchNumber: prod.batchNumber,
      currentStock: prod.stockQuantity,
      minimumStockLevel: prod.minimumStockLevel !== undefined ? prod.minimumStockLevel : 15,
      orderQuantity: Number(prod.orderQuantity),
      purchaseRate: prod.purchaseRate,
      totalAmount: Number(prod.orderQuantity) * prod.purchaseRate,
    }));

    const totalCost = poItems.reduce((sum, item) => sum + item.totalAmount, 0);
    const dateFormatted = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomSuffix = Math.floor(100 + Math.random() * 900);

    return {
      id: `po-${Date.now()}-${randomSuffix}`,
      poNumber: `PO-${dateFormatted}-${randomSuffix}`,
      partyId: party?.id,
      partyName: supplierName,
      partyContact: party?.contactNumber,
      partyAddress: party?.address,
      partyDlNumber: party?.dlNumber,
      createdAt: new Date().toISOString(),
      items: poItems,
      totalEstimatedCost: totalCost,
      status: 'Draft',
      notes: 'Please supply fresh stock with standard 18+ months expiry.',
    };
  };

  // PRIMARY ACTION: Save & Print PO
  const handleSaveAndPrintPO = (supplierName: string, items: Product[], party?: Party) => {
    const checkedItems = getCheckedSupplierItems(items).filter(
      (item) => item.checked === true && Number(item.orderQuantity) > 0
    );
    if (checkedItems.length === 0) {
      alert('Please include at least one medicine with quantity in the Purchase Order.');
      return;
    }

    const po = buildPOForSupplier(supplierName, items, party);
    if (po.items.length === 0) {
      alert('Please include at least one medicine with quantity in the Purchase Order.');
      return;
    }

    const receiveData = checkedItems.map((item) => ({
      medicineId: item.id,
      quantity: Number(item.orderQuantity),
    }));

    const result = receivePurchaseOrder(receiveData);
    savePurchaseOrder(po);
    const payloadForPrint: PurchaseOrder = {
      ...po,
      items: po.items,
    };
    setSelectedPOForPrint(payloadForPrint);
    setActionNotice(`Successfully updated stock for ${result.updatedCount} items from ${supplierName}!`);
    setTimeout(() => setActionNotice(''), 4500);
  };

  // SECONDARY ACTION: Export PDF (Triggers Print / PDF save dialog)
  const handleExportPDF = (supplierName: string, items: Product[], party?: Party) => {
    const po = buildPOForSupplier(supplierName, items, party);
    if (po.items.length === 0) {
      alert('No medicines selected for export.');
      return;
    }
    savePurchaseOrder(po);
    setSelectedPOForPrint(po);
    setActionNotice(`Generated offline PDF preview for "${supplierName}".`);
    setTimeout(() => setActionNotice(''), 3000);
  };

  // SECONDARY ACTION: Export Excel (.CSV file stored locally)
  const handleExportExcel = (supplierName: string, items: Product[]) => {
    const included = getCheckedSupplierItems(items).filter((item) => item.checked === true && item.orderQuantity > 0);
    if (included.length === 0) {
      alert('No medicines selected for export.');
      return;
    }

    const rows = [
      ['Sr', 'Medicine Name', 'Company / Manufacturer', 'Available Stock', 'Order Quantity'],
      ...included.map((prod, idx) => [
        idx + 1,
        `"${prod.name.replace(/"/g, '""')}"`,
        `"${(prod.manufacturer || '').replace(/"/g, '""')}"`,
        prod.stockQuantity,
        prod.orderQuantity,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeName = supplierName.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute(
      'download',
      `PO_${safeName}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setActionNotice(`Excel/CSV file for "${supplierName}" saved to your local downloads folder.`);
    setTimeout(() => setActionNotice(''), 4000);
  };

  // Add another medicine from this supplier into the list
  const handleAddOtherMedicine = (supplierName: string) => {
    const prodId = extraProductToAdd[supplierName];
    if (!prodId) return;

    const product = products.find((p) => p.id === prodId);
    if (!product) return;

    const alreadyVisible = (supplementalProductIdsBySupplier[supplierName] ?? []).includes(prodId) ||
      lowStockAndOutProducts.some((p) => p.id === prodId);
    if (alreadyVisible) {
      setExtraProductToAdd((prev) => ({ ...prev, [supplierName]: '' }));
      alert('This medicine is already listed in the order sheet.');
      return;
    }

    setSupplementalProductIdsBySupplier((prev) => ({
      ...prev,
      [supplierName]: [...new Set([...(prev[supplierName] ?? []), prodId])],
    }));
    setReorderQuantities((prev) => ({ ...prev, [prodId]: getOrderQty(product) }));
    setExcludedProductIds((prev) => ({ ...prev, [prodId]: false }));
    setExtraProductToAdd((prev) => ({ ...prev, [supplierName]: '' }));
    setActionNotice('Medicine added to this supplier order.');
    setTimeout(() => setActionNotice(''), 3000);
  };

  const loadPurchaseOrderForReorder = (po: PurchaseOrder) => {
    setActiveTab('reorder-engine');
    setSupplementalProductIdsBySupplier((prev) => ({
      ...prev,
      [po.partyName]: [...new Set([...(prev[po.partyName] ?? []), ...po.items.map((item) => item.productId)])],
    }));

    po.items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      setReorderQuantities((prev) => ({
        ...prev,
        [item.productId]: item.orderQuantity || (product ? getOrderQty(product) : 10),
      }));
      setExcludedProductIds((prev) => ({ ...prev, [item.productId]: false }));
    });

    setActionNotice(`Loaded ${po.poNumber} for ${po.partyName}. Edit quantities or untick items before saving.`);
    setTimeout(() => setActionNotice(''), 4000);
  };

  // Handle Mark Stock Received: increments inventory stock by orderQuantity
  const handleMarkStockReceived = (po: PurchaseOrder) => {
    po.items.forEach((item) => {
      const match = products.find((p) => p.id === item.productId);
      if (match) {
        updateProduct(match.id, {
          stockQuantity: match.stockQuantity + item.orderQuantity,
        });
      }
    });

    updatePurchaseOrderStatus(po.id, 'Received');
    setActionNotice(`Stock received for ${po.poNumber}. Quantities updated in inventory!`);
    setTimeout(() => setActionNotice(''), 4000);
  };

  const handlePrint = () => {
    window.print();
  };

  const allVisibleSupplierProducts = useMemo(
    () =>
      groupedBySupplier.flatMap(({ supplierName, party, items }) =>
        getSupplierVisibleProducts(supplierName, items, party)
      ),
    [groupedBySupplier, supplementalProductIdsBySupplier, products]
  );

  // Total active medicines needing order
  const totalActiveItemsCount = useMemo(() => {
    return allVisibleSupplierProducts.filter((prod) => !excludedProductIds[prod.id]).length;
  }, [allVisibleSupplierProducts, excludedProductIds]);

  // Total estimated cost across all selected medicines
  const totalReorderValueAll = useMemo(() => {
    return allVisibleSupplierProducts.reduce((sum, prod) => {
      if (excludedProductIds[prod.id]) return sum;
      const qty = getOrderQty(prod);
      return sum + qty * prod.purchaseRate;
    }, 0);
  }, [allVisibleSupplierProducts, reorderQuantities, excludedProductIds]);

  return (
    <div className="space-y-4">
      {/* 1. Step-by-Step Guidance Banner */}
      <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-4 py-2.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 text-xs shadow-2xs">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold uppercase tracking-wider text-[11px]">
          <HardDrive className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>Desktop Offline PO Workflow</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200">
            Step 1: Review Stock
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200">
            Step 2: Set Quantity
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="px-2 py-0.5 bg-emerald-700 text-white font-bold shadow-2xs">
            Step 3: Click Save & Print PO
          </span>
        </div>
      </div>

      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-emerald-700" />
            <span>Purchase Orders & Reorder</span>
          </h2>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            100% Offline order creation for Windows thermal & laser printers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab(activeTab === 'reorder-engine' ? 'po-history' : 'reorder-engine')}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5 text-emerald-700" />
            <span>{activeTab === 'reorder-engine' ? `View PO History (${purchaseOrders.length})` : 'Back to Order Creator'}</span>
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 2. Top Summary: 2 Clean Badges (Replaces 4 metric boxes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
              Medicines to Order
            </span>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums mt-0.5">
              {totalActiveItemsCount} <span className="text-xs font-normal text-slate-500">Items</span>
            </p>
          </div>
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold text-sm">
            {totalActiveItemsCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 p-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider block">
              Estimated Total Cost
            </span>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5 truncate">
              {settings.currencySymbol} {totalReorderValueAll.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-400 dark:border-emerald-700 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold text-xs">
            EST
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'reorder-engine' ? (
        <div className="space-y-4">
          {groupedBySupplier.length === 0 ? (
            /* Healthy Stock Empty State */
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-12 text-center shadow-2xs">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                All Medicine Stocks Are Healthy!
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 font-mono leading-relaxed">
                Zero medicines have fallen below reorder alert level.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                {onNavigateToInventory && (
                  <button
                    onClick={onNavigateToInventory}
                    className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100"
                  >
                    View Medicine Stock
                  </button>
                )}
                {onNavigateToAddProduct && (
                  <button
                    onClick={onNavigateToAddProduct}
                    className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100"
                  >
                    Add New Stock
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Supplier Groups */
            <div className="space-y-4">
              {groupedBySupplier.map(({ supplierName, party, items }) => {
                const visibleItems = getSupplierVisibleProducts(supplierName, items, party);
                const activeItemCount = getCheckedSupplierCount(visibleItems);

                const allSupplierProducts = products.filter(
                  (p) => p.partyName === supplierName || (party && p.partyId === party.id)
                );

                const otherProductsFromSupplier = allSupplierProducts.filter(
                  (p) => !visibleItems.some((visible) => visible.id === p.id)
                );

                return (
                  <div
                    key={supplierName}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 shadow-2xs overflow-hidden"
                  >
                    {/* Supplier Header & Offline Action Buttons */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <h3 className="font-bold text-xs uppercase tracking-tight text-slate-900 dark:text-white">
                            {supplierName}
                          </h3>
                          {party?.contactNumber && (
                            <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 ml-2">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{party.contactNumber}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-slate-500 font-mono">
                          {activeItemCount} items selected for this Purchase Order
                        </p>
                      </div>

                      {/* Offline Action Buttons (No WhatsApp, Zero Cloud) */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Secondary: Export Excel */}
                        <button
                          type="button"
                          onClick={() => handleExportExcel(supplierName, items)}
                          className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
                          title="Save as Excel CSV locally"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Export Excel</span>
                        </button>

                        {/* Secondary: Export PDF */}
                        <button
                          type="button"
                          onClick={() => handleExportPDF(supplierName, items, party)}
                          className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
                          title="Generate local PDF preview"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-600" />
                          <span>Export PDF</span>
                        </button>

                        {/* PRIMARY ACTION: SAVE & PRINT PO */}
                        <button
                          type="button"
                          onClick={() => handleSaveAndPrintPO(supplierName, visibleItems, party)}
                          className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 shadow-xs flex items-center gap-1.5"
                          title="Save PO, update stock, and print"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>SAVE & PRINT PO</span>
                        </button>
                      </div>
                    </div>

                    {/* 3-Column Clutter-Free Table Layout */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-300 dark:border-slate-700 uppercase tracking-wider text-[10.5px]">
                          <tr>
                            {/* Column 1: Medicine Name */}
                            <th className="p-3">Medicine Name</th>
                            {/* Column 2: Available Stock */}
                            <th className="p-3 border-l border-slate-200 dark:border-slate-800 text-center w-40">
                              Available Stock
                            </th>
                            {/* Column 3: Order Quantity */}
                            <th className="p-3 border-l border-slate-200 dark:border-slate-800 text-center w-36">
                              Order Quantity
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {visibleItems.map((prod) => {
                            const isExcluded = excludedProductIds[prod.id] === true;
                            const itemChecked = !isExcluded;
                            const currentQty = prod.stockQuantity;
                            const isOut = currentQty === 0;
                            const orderQty = reorderQuantities[prod.id] ?? getOrderQty(prod);

                            return (
                              <tr
                                key={prod.id}
                                className={`transition-colors ${
                                  isExcluded
                                    ? 'bg-slate-100/50 dark:bg-slate-900/40 opacity-50'
                                    : isOut
                                    ? 'bg-rose-50/50 dark:bg-rose-950/20'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                }`}
                              >
                                {/* Column 1: Medicine Name with brand subtitle */}
                                <td className="p-3 font-semibold text-slate-900 dark:text-white">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(itemChecked)}
                                      onChange={() => toggleExcludeProduct(prod.id)}
                                      className="cursor-pointer accent-emerald-700 w-4 h-4 shrink-0"
                                      title="Check to include in order"
                                    />
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        {isOut ? (
                                          <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                        ) : (
                                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        )}
                                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                                          {prod.name}
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                                        Brand / Company: {prod.manufacturer || 'Standard Pharmaceutical'}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Column 2: Available Stock (Clean Badge) */}
                                <td className="p-3 border-l border-slate-200 dark:border-slate-800 text-center font-mono">
                                  <span
                                    className={`inline-block px-2.5 py-1 border text-[11px] font-bold ${
                                      isOut
                                        ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900'
                                        : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900'
                                    }`}
                                  >
                                    {isOut ? '0 (Out)' : `${currentQty} left`}
                                  </span>
                                </td>

                                {/* Column 3: Order Quantity (Simple numeric input field) */}
                                <td className="p-3 border-l border-slate-200 dark:border-slate-800 text-center font-mono">
                                  <input
                                    type="number"
                                    min="1"
                                    disabled={isExcluded}
                                    value={orderQty}
                                    onChange={(e) => handleQtyChange(prod.id, e.target.value)}
                                    className="w-24 px-2 py-1.5 text-xs text-center font-mono font-bold bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700 disabled:opacity-40"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Inline Add Another Medicine Option */}
                    {otherProductsFromSupplier.length > 0 && (
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
                            Add other medicine from this supplier:
                          </span>
                          <select
                            value={extraProductToAdd[supplierName] || ''}
                            onChange={(e) =>
                              setExtraProductToAdd({ ...extraProductToAdd, [supplierName]: e.target.value })
                            }
                            className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700 flex-1 sm:w-64"
                          >
                            <option value="">-- Select extra item --</option>
                            {otherProductsFromSupplier.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Stock: {p.stockQuantity})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!extraProductToAdd[supplierName]}
                            onClick={() => handleAddOtherMedicine(supplierName)}
                            className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 disabled:opacity-40"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* PO History & Archive Tab */
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>Purchase Order Archives & Inward Receiving</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {purchaseOrders.length} {purchaseOrders.length === 1 ? 'Order' : 'Orders'} Recorded
            </span>
          </div>

          {purchaseOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 font-mono">
              No Purchase Orders recorded yet. Generate a PO using the "Save & Print PO" button above.
            </div>
          ) : (
            <div className="space-y-3">
              {purchaseOrders.map((po) => {
                const dateStr = new Date(po.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <div
                    key={po.id}
                    className="p-3.5 border border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                          {po.poNumber}
                        </span>
                        <span
                          className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 border uppercase ${
                            po.status === 'Received'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900'
                              : po.status === 'Sent'
                              ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900'
                              : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {po.status === 'Received' ? 'Stock Received' : po.status === 'Sent' ? 'Sent to Party' : 'Draft Note'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{dateStr}</span>
                      </div>

                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Supplier: {po.partyName}
                      </p>

                      <p className="text-[11px] text-slate-500 font-mono">
                        {po.items.length} items ordered · Est Value: {settings.currencySymbol}{' '}
                        {po.totalEstimatedCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      {po.status !== 'Received' && (
                        <button
                          onClick={() => handleMarkStockReceived(po)}
                          className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1"
                          title="Increments stock quantities in inventory"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Received</span>
                        </button>
                      )}

                      <button
                        onClick={() => loadPurchaseOrderForReorder(po)}
                        className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1"
                        title="Load PO into reorder draft"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Reorder</span>
                      </button>

                      <button
                        onClick={() => setSelectedPOForPrint(po)}
                        className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 flex items-center gap-1"
                        title="View / Print PO"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        <span>View / Print</span>
                      </button>

                      <button
                        onClick={() => deletePurchaseOrder(po.id)}
                        className="p-1.5 border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-rose-700 hover:border-rose-700 transition-colors"
                        title="Delete PO Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Printable Purchase Order Modal (Offline Printer & PDF compatible) */}
      {selectedPOForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-700 flex flex-col my-auto max-h-[94vh] shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 shrink-0">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wider">
                <Printer className="w-4 h-4 text-emerald-700" />
                <span>Purchase Order Document (Print Ready)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 shadow-2xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setSelectedPOForPrint(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-mono text-xs"
                >
                  [ESC]
                </button>
              </div>
            </div>

            {/* Printable Document Area */}
            <div className="p-6 md:p-8 overflow-y-auto bg-white text-slate-900 font-sans print:p-0 print:m-0">
              {/* Store Letterhead */}
              <div className="border-b-2 border-slate-800 pb-4 mb-4 text-center">
                <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">
                  {settings.storeName}
                </h1>
                <p className="text-xs font-medium text-slate-700 uppercase tracking-wider">
                  {settings.tagline}
                </p>
                <p className="text-xs text-slate-600 mt-1 max-w-lg mx-auto">
                  {settings.address}
                </p>
                <div className="flex items-center justify-center gap-4 text-[11px] font-mono text-slate-700 mt-1.5 pt-1.5 border-t border-slate-200">
                  <span>Tel: {settings.phone}</span>
                  {settings.dlNumber && <span>· D.L: {settings.dlNumber}</span>}
                  {settings.gstNumber && <span>· GSTIN: {settings.gstNumber}</span>}
                </div>
              </div>

              {/* PO Metadata Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5 pb-4 border-b border-slate-200">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    VENDOR / SUPPLIER (PARTY)
                  </span>
                  <p className="font-bold text-sm text-slate-900 uppercase">
                    {selectedPOForPrint.partyName}
                  </p>
                  {selectedPOForPrint.partyContact && (
                    <p className="text-xs text-slate-700 font-mono">
                      Phone: {selectedPOForPrint.partyContact}
                    </p>
                  )}
                  {selectedPOForPrint.partyAddress && (
                    <p className="text-xs text-slate-600 max-w-sm">
                      {selectedPOForPrint.partyAddress}
                    </p>
                  )}
                  {selectedPOForPrint.partyDlNumber && (
                    <p className="text-[11px] text-slate-600 font-mono">
                      DL No: {selectedPOForPrint.partyDlNumber}
                    </p>
                  )}
                </div>

                <div className="text-left sm:text-right space-y-1 font-mono">
                  <div className="inline-block px-2.5 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider mb-1">
                    PURCHASE ORDER
                  </div>
                  <p className="text-xs font-bold text-slate-900">
                    PO No: <span className="text-emerald-800">{selectedPOForPrint.poNumber}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    Date:{' '}
                    {new Date(selectedPOForPrint.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-slate-600">
                    Status: <span className="font-bold">{selectedPOForPrint.status}</span>
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-6">
                <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[10px] border-b border-slate-300">
                    <tr>
                      <th className="p-2 border-r border-slate-300 w-8 text-center">#</th>
                      <th className="p-2 border-r border-slate-300">Medicine Description</th>
                      <th className="p-2 border-r border-slate-300 text-center font-mono">Current Stock</th>
                      <th className="p-2 border-r border-slate-300 text-center font-mono">Order Qty</th>
                      <th className="p-2 border-r border-slate-300 text-right font-mono">Est Rate</th>
                      <th className="p-2 text-right font-mono">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedPOForPrint.items.map((item, index) => (
                      <tr key={item.productId}>
                        <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-500">
                          {index + 1}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-semibold text-slate-900">
                          <div>{item.productName}</div>
                          <span className="text-[10px] text-slate-500 font-normal">{item.manufacturer}</span>
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center font-mono">
                          {item.currentStock === 0 ? (
                            <span className="text-rose-700 font-bold">0 (Out)</span>
                          ) : (
                            <span>{item.currentStock}</span>
                          )}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-900">
                          {item.orderQuantity}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono tabular-nums text-slate-700">
                          {settings.currencySymbol} {item.purchaseRate.toFixed(2)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {settings.currencySymbol} {item.totalAmount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs">
                      <td colSpan={3} className="p-2 text-right uppercase tracking-wider font-mono">
                        Total Order Summary:
                      </td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">
                        {selectedPOForPrint.items.reduce((s, i) => s + i.orderQuantity, 0)} units
                      </td>
                      <td className="p-2 text-right font-mono border-r border-slate-300">
                        Est. Total:
                      </td>
                      <td className="p-2 text-right font-mono text-emerald-800 text-sm">
                        {settings.currencySymbol}{' '}
                        {selectedPOForPrint.totalEstimatedCost.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Instructions and Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-xs text-slate-700">
                <div className="space-y-1">
                  <span className="font-bold uppercase text-[10px] tracking-wider text-slate-500">
                    Purchase Order Instructions:
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600">
                    <li>Please deliver goods with tax invoice and duplicate challan.</li>
                    <li>Medicines must have minimum 18+ months remaining shelf life.</li>
                    <li>Damaged blisters, broken seals, or leaking bottles will be returned immediately.</li>
                  </ul>
                </div>

                <div className="text-right flex flex-col justify-between pt-6 sm:pt-0">
                  <div className="h-12 border-b border-dashed border-slate-400 w-48 ml-auto"></div>
                  <div className="text-[11px] uppercase font-bold text-slate-800 mt-1">
                    Authorized Pharmacist Signature & Seal
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-mono">
                {selectedPOForPrint.items.length} medicines listed
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPOForPrint(null)}
                  className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 shadow-2xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
