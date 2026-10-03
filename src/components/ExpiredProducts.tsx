import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Product } from '../types/inventory';
import {
  AlertOctagon,
  CalendarX,
  Clock,
  Trash2,
  Undo2,
  Building2,
  CheckCircle2,
  TrendingDown,
  FileSpreadsheet,
  ShieldAlert,
  ClipboardList,
  AlertTriangle
} from 'lucide-react';

interface ExpiredProductsProps {
  onNavigateToInventory: () => void;
  onNavigateToReorder?: () => void;
}

export const ExpiredProducts: React.FC<ExpiredProductsProps> = ({
  onNavigateToInventory,
  onNavigateToReorder,
}) => {
  const { products, deleteProduct, disposeExpiredMedicine, settings, getExpiredProducts, getNearExpiryProducts } =
    useInventory();

  const [activeTab, setActiveTab] = useState<'expired' | 'near-expiry'>('expired');
  const [actionNotice, setActionNotice] = useState<string>('');

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const expiredProducts = useMemo(() => getExpiredProducts(), [products]);
  const nearExpiryProducts = useMemo(() => getNearExpiryProducts(30), [products]);

  const activeList = activeTab === 'expired' ? expiredProducts : nearExpiryProducts;

  // Calculate total loss or at-risk inventory value
  const totalFinancialLoss = useMemo(() => {
    return expiredProducts.reduce((sum, item) => sum + item.purchaseRate * item.stockQuantity, 0);
  }, [expiredProducts]);

  const totalExpiredUnits = useMemo(() => {
    return expiredProducts.reduce((sum, item) => sum + item.stockQuantity, 0);
  }, [expiredProducts]);

  const atRiskValue = useMemo(() => {
    return nearExpiryProducts.reduce((sum, item) => sum + item.purchaseRate * item.stockQuantity, 0);
  }, [nearExpiryProducts]);

  const calculateDaysDiff = (expiryStr: string) => {
    const exp = new Date(expiryStr);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStockIndicator = (product: Product) => {
    const min = product.minimumStockLevel !== undefined ? product.minimumStockLevel : 15;
    if (product.stockQuantity === 0) {
      return {
        isOut: true,
        isLow: true,
        label: 'Out of Stock (0 units)',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900',
        minLevel: min,
      };
    }
    if (product.stockQuantity <= min) {
      return {
        isOut: false,
        isLow: true,
        label: `Low Stock (${product.stockQuantity} / Min: ${min})`,
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
        minLevel: min,
      };
    }
    return {
      isOut: false,
      isLow: false,
      label: `In Stock (${product.stockQuantity} units)`,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900',
      minLevel: min,
    };
  };

  const handleWriteOff = (product: Product) => {
    disposeExpiredMedicine(product.id);
    setActionNotice(`Removed ${product.stockQuantity} expired units of ${product.name} from stock.`);
    setTimeout(() => setActionNotice(''), 4000);
  };

  const handleReturnToParty = (product: Product) => {
    deleteProduct(product.id);
    setActionNotice(`Returned batch ${product.batchNumber} of ${product.name} to supplier "${product.partyName || 'supplier'}".`);
    setTimeout(() => setActionNotice(''), 4000);
  };

  const handleExportList = () => {
    const csvRows = [
      ['Medicine Name', 'Batch Number', 'Company', 'Supplier', 'Expiry Date', 'Status', 'Stock Units', 'Stock Alert', 'Buy Price', 'Loss Amount'].join(','),
      ...activeList.map((p) => {
        const diff = calculateDaysDiff(p.expiryDate);
        const status = diff < 0 ? `Expired ${Math.abs(diff)} days ago` : `Expiring in ${diff} days`;
        const stockAlert = p.stockQuantity === 0 ? 'Out of Stock' : p.stockQuantity <= (p.minimumStockLevel ?? 15) ? 'Low Stock' : 'Adequate';
        return [
          `"${p.name}"`,
          `"${p.batchNumber}"`,
          `"${p.manufacturer}"`,
          `"${p.partyName}"`,
          p.expiryDate,
          status,
          p.stockQuantity,
          stockAlert,
          p.purchaseRate,
          (p.purchaseRate * p.stockQuantity).toFixed(2),
        ].join(',');
      }),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expired_medicines_list_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Quarantine Alert Banner */}
      <div className="bg-white dark:bg-slate-900 border-2 border-rose-500/80 dark:border-rose-900 p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-rose-700 text-white flex items-center justify-center border border-rose-900 shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-rose-900 dark:text-rose-200">
                Expired & Near-Expiry Medicines
              </h2>
              <p className="text-[11px] text-rose-800/80 dark:text-rose-300 font-mono mt-0.5 leading-relaxed">
                Expired medicines cannot be sold at the billing counter. Return them to your supplier, dispose of damaged stock, or reorder fresh batches.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {onNavigateToReorder && (
              <button
                onClick={onNavigateToReorder}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-400 dark:border-amber-800 hover:bg-amber-200 flex items-center gap-1.5"
                title="Go to Purchase Orders"
              >
                <ClipboardList className="w-3.5 h-3.5 text-amber-700" />
                <span>Reorder Fresh Batches</span>
              </button>
            )}
            <button
              onClick={handleExportList}
              disabled={activeList.length === 0}
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-rose-700" />
              <span>Download List (CSV)</span>
            </button>
          </div>
        </div>

        {/* Dense Audit Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 pt-3 border-t border-rose-200 dark:border-rose-900/60 font-mono">
          <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 border border-slate-300 dark:border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Expired Medicines</span>
            <span className="text-lg font-bold text-rose-700 dark:text-rose-400 tabular-nums">
              {expiredProducts.length} <span className="text-xs font-normal">{expiredProducts.length === 1 ? 'item' : 'items'}</span>
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 border border-slate-300 dark:border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Expired Packs</span>
            <span className="text-lg font-bold text-rose-700 dark:text-rose-400 tabular-nums">
              {totalExpiredUnits} <span className="text-xs font-normal">units</span>
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 border border-slate-300 dark:border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Loss on Expired Stock</span>
            <span className="text-lg font-bold text-rose-700 dark:text-rose-400 tabular-nums flex items-center gap-1">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              <span>{settings.currencySymbol} {totalFinancialLoss.toFixed(2)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-300 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('expired')}
          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
            activeTab === 'expired'
              ? 'bg-rose-700 text-white border border-rose-800'
              : 'text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100'
          }`}
        >
          <CalendarX className="w-3.5 h-3.5" />
          <span>Expired Items ({expiredProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('near-expiry')}
          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
            activeTab === 'near-expiry'
              ? 'bg-amber-700 text-white border border-amber-800'
              : 'text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Expiring Soon (Within 30 Days) ({nearExpiryProducts.length})</span>
        </button>
      </div>

      {/* Product List */}
      {activeList.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-12 text-center">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 mx-auto flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            {activeTab === 'expired' ? 'No Expired Medicines!' : 'No Medicines Expiring Soon'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 font-mono">
            {activeTab === 'expired'
              ? 'Great news! All medicines currently in your store are fresh and safe to sell.'
              : 'None of your current medicines will expire in the next 30 days.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={onNavigateToInventory}
              className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100"
            >
              View All Medicines
            </button>
            {onNavigateToReorder && (
              <button
                onClick={onNavigateToReorder}
                className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 border border-amber-400 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100"
              >
                Reorder Low Stock
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeList.map((product) => {
            const daysDiff = calculateDaysDiff(product.expiryDate);
            const isOverdue = daysDiff < 0;
            const lossAmount = (product.purchaseRate * product.stockQuantity).toFixed(2);
            const stockInfo = getStockIndicator(product);

            return (
              <div
                key={product.id}
                className={`bg-white dark:bg-slate-900 border transition-all flex flex-col justify-between ${
                  isOverdue ? 'border-rose-400 dark:border-rose-900' : 'border-amber-400 dark:border-amber-900'
                }`}
              >
                <div className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 border uppercase ${
                        isOverdue
                          ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900'
                          : 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900'
                      }`}
                    >
                      {isOverdue ? `Expired ${Math.abs(daysDiff)} days ago` : `Expires in ${daysDiff} days`}
                    </span>

                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                      BATCH: {product.batchNumber}
                    </span>
                  </div>

                  <h4 className="font-bold text-xs uppercase text-slate-900 dark:text-white leading-tight">
                    {product.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{product.manufacturer}</span>
                  </p>

                  <div className="p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-[11px] font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Supplier (Party):</span>
                      <span className="text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                        {product.partyName || 'Direct Purchase'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expiry Date:</span>
                      <span className={`font-bold ${isOverdue ? 'text-rose-700' : 'text-amber-700'}`}>
                        {product.expiryDate}
                      </span>
                    </div>
                    {/* Highlighted Stock Level Indicator */}
                    <div className="flex justify-between items-center pt-0.5 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400">Current Stock:</span>
                      <span className={`font-bold tabular-nums px-1.5 py-0.2 border text-[10.5px] uppercase ${stockInfo.badgeClass}`}>
                        {stockInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono pt-1">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">
                      {isOverdue ? 'Cost of Expired Stock:' : 'Cost at Risk:'}
                    </span>
                    <span className={`font-bold tabular-nums ${isOverdue ? 'text-rose-700' : 'text-amber-700'}`}>
                      {settings.currencySymbol} {lossAmount}
                    </span>
                  </div>
                </div>

                {/* Bottom Sharp Actions */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReturnToParty(product)}
                      className="flex-1 py-1 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-1"
                    >
                      <Undo2 className="w-3 h-3" />
                      <span>Return to Supplier</span>
                    </button>

                    <button
                      onClick={() => handleWriteOff(product)}
                      className="flex-1 py-1 px-2 text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 border border-rose-300 dark:border-rose-900 flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Dispose Stock</span>
                    </button>
                  </div>

                  {onNavigateToReorder && (
                    <button
                      onClick={onNavigateToReorder}
                      className="w-full py-1 px-2 text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-300 dark:border-amber-800 flex items-center justify-center gap-1"
                      title="Reorder fresh batches of this medicine"
                    >
                      <ClipboardList className="w-3 h-3 text-amber-700" />
                      <span>Reorder Fresh Stock &rarr;</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
