import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Product } from '../types/inventory';
import { EditProductModal } from './EditProductModal';
import {
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  AlertOctagon,
  Package,
  Layers,
  TrendingUp,
  XCircle,
  Plus,
  Calendar,
  Building2,
  Tag,
  LayoutGrid,
  List,
  ShieldCheck,
  Clock,
  ClipboardList,
  ArrowUpRight
} from 'lucide-react';

interface DashboardProps {
  onNavigateToAddProduct: () => void;
  onNavigateToExpired: () => void;
  onNavigateToReorder?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToAddProduct,
  onNavigateToExpired,
  onNavigateToReorder,
}) => {
  const { products, deleteProduct, settings, getExpiredProducts } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'in-stock' | 'low-stock' | 'out-of-stock' | 'expired'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const expiredList = useMemo(() => getExpiredProducts(), [products]);

  // Low stock and out of stock lists
  const outOfStockList = useMemo(() => products.filter((p) => p.stockQuantity === 0), [products]);
  const lowStockList = useMemo(() => {
    return products.filter((p) => {
      const min = p.minimumStockLevel !== undefined ? p.minimumStockLevel : 15;
      return p.stockQuantity > 0 && p.stockQuantity <= min;
    });
  }, [products]);

  const reorderAlertCount = outOfStockList.length + lowStockList.length;

  // Filter products by search query and category/stock filter
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.batchNumber.toLowerCase().includes(q) ||
        item.manufacturer.toLowerCase().includes(q) ||
        item.partyName.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const isExpired = new Date(item.expiryDate) < today;
      const minStock = item.minimumStockLevel !== undefined ? item.minimumStockLevel : 15;

      if (filterType === 'in-stock') return item.stockQuantity > minStock && !isExpired;
      if (filterType === 'low-stock') return item.stockQuantity > 0 && item.stockQuantity <= minStock;
      if (filterType === 'out-of-stock') return item.stockQuantity === 0;
      if (filterType === 'expired') return isExpired;

      return true;
    });
  }, [products, searchQuery, filterType, today]);

  // Summary Metrics
  const totalStockUnits = useMemo(
    () => products.reduce((sum, item) => sum + (item.stockQuantity || 0), 0),
    [products]
  );
  const totalInventoryValue = useMemo(
    () => products.reduce((sum, item) => sum + item.purchaseRate * item.stockQuantity, 0),
    [products]
  );

  const handleDeleteConfirm = () => {
    if (productToDelete) {
      deleteProduct(productToDelete.id);
      setProductToDelete(null);
    }
  };

  const getExpiryStatus = (expiryDateStr: string) => {
    const expDate = new Date(expiryDateStr);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Expired (${Math.abs(diffDays)}d ago)`,
        badgeClass: 'text-rose-700 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-900',
        isExpired: true,
      };
    }
    if (diffDays <= 30) {
      return {
        label: `Expires in ${diffDays}d`,
        badgeClass: 'text-amber-800 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-900',
        isExpired: false,
      };
    }
    return {
      label: `Good (${expiryDateStr.slice(0, 7)})`,
      badgeClass: 'text-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-900',
      isExpired: false,
    };
  };

  const getStockIndicator = (product: Product) => {
    const min = product.minimumStockLevel !== undefined ? product.minimumStockLevel : 15;
    if (product.stockQuantity === 0) {
      return {
        isOut: true,
        isLow: true,
        badgeLabel: 'OUT OF STOCK (0)',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900 font-bold',
        cardBorder: 'border-rose-500 dark:border-rose-900',
        cardBanner: 'bg-rose-600 text-white',
        minLevel: min,
      };
    }
    if (product.stockQuantity <= min) {
      return {
        isOut: false,
        isLow: true,
        badgeLabel: `LOW STOCK (${product.stockQuantity}/${min})`,
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900 font-bold',
        cardBorder: 'border-amber-500 dark:border-amber-900',
        cardBanner: 'bg-amber-600 text-white',
        minLevel: min,
      };
    }
    return {
      isOut: false,
      isLow: false,
      badgeLabel: `${product.stockQuantity}`,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900',
      cardBorder: 'border-slate-300 dark:border-slate-800',
      cardBanner: '',
      minLevel: min,
    };
  };

  return (
    <div className="space-y-4">
      {/* Top Metrics Row: High Contrast & Actionable */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* Total Medicines */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Medicines</p>
            <p className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
              {products.length}
            </p>
          </div>
          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4" />
          </div>
        </div>

        {/* Total Stock Units */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Items in Stock</p>
            <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
              {totalStockUnits.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-900 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        {/* Stock Valuation */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Stock Value</p>
            <p className="text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
              {settings.currencySymbol} {totalInventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        {/* Low Stock Alert Button Card */}
        <div
          onClick={onNavigateToReorder}
          className="bg-white dark:bg-slate-900 border border-amber-400 dark:border-amber-800 p-3 shadow-2xs flex items-center justify-between cursor-pointer hover:bg-amber-50/60 dark:hover:bg-amber-950/30 transition-colors group"
          title="Click to open Purchase Orders & Reorder"
        >
          <div>
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                Low Stock Alert
              </p>
              <ArrowUpRight className="w-3 h-3 text-amber-700 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xl font-bold font-mono text-amber-800 dark:text-amber-400 tabular-nums mt-0.5">
              {reorderAlertCount} <span className="text-xs font-normal">{reorderAlertCount === 1 ? 'item' : 'items'}</span>
            </p>
          </div>
          <div className="w-8 h-8 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center justify-center shrink-0">
            <ClipboardList className="w-4 h-4" />
          </div>
        </div>

        {/* Expired Items Alert Button Card */}
        <div
          onClick={onNavigateToExpired}
          className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900 p-3 shadow-2xs flex items-center justify-between cursor-pointer hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-colors group"
          title="Click to view Expired Medicines"
        >
          <div>
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Expired Items
              </p>
              <ArrowUpRight className="w-3 h-3 text-rose-700 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xl font-bold font-mono text-rose-700 dark:text-rose-400 tabular-nums mt-0.5">
              {expiredList.length} <span className="text-xs font-normal">{expiredList.length === 1 ? 'item' : 'items'}</span>
            </p>
          </div>
          <div className="w-8 h-8 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Control Bar: Industrial Flat Filtering & Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 space-y-2.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Top Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type medicine name, batch number, or company..."
              className="w-full pl-9 pr-8 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-sans focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Clear Search"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action buttons & View toggles */}
          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToReorder && reorderAlertCount > 0 && (
              <button
                onClick={onNavigateToReorder}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900 border border-amber-400 dark:border-amber-800 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                title="Open automated reorder sheet"
              >
                <ClipboardList className="w-3.5 h-3.5 text-amber-700" />
                <span>Reorder ({reorderAlertCount})</span>
              </button>
            )}

            <div className="flex items-center border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 text-xs font-bold transition-colors flex items-center gap-1 ${
                  viewMode === 'table'
                    ? 'bg-slate-800 text-white dark:bg-slate-700'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Table View (Compact)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1.5 text-xs font-bold transition-colors flex items-center gap-1 ${
                  viewMode === 'grid'
                    ? 'bg-slate-800 text-white dark:bg-slate-700'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Card View (Boxes)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>

            <button
              onClick={onNavigateToAddProduct}
              className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Medicine</span>
            </button>
          </div>
        </div>

        {/* Filter Badges Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold pt-1 border-t border-slate-200 dark:border-slate-800">
          <span className="text-slate-400 uppercase text-[10px] tracking-wider shrink-0 mr-1">Show:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-0.5 border uppercase font-mono tracking-tight transition-colors shrink-0 ${
              filterType === 'all'
                ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-700 dark:border-slate-600'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            All Medicines ({products.length})
          </button>
          <button
            onClick={() => setFilterType('in-stock')}
            className={`px-2.5 py-0.5 border uppercase font-mono tracking-tight transition-colors shrink-0 ${
              filterType === 'in-stock'
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            Adequate Stock
          </button>
          <button
            onClick={() => setFilterType('low-stock')}
            className={`px-2.5 py-0.5 border uppercase font-mono tracking-tight transition-colors shrink-0 flex items-center gap-1 ${
              filterType === 'low-stock'
                ? 'bg-amber-700 text-white border-amber-700'
                : 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-400 border-amber-400 dark:border-amber-800 hover:bg-amber-50'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Low Stock ({lowStockList.length})</span>
          </button>
          <button
            onClick={() => setFilterType('out-of-stock')}
            className={`px-2.5 py-0.5 border uppercase font-mono tracking-tight transition-colors shrink-0 flex items-center gap-1 ${
              filterType === 'out-of-stock'
                ? 'bg-rose-700 text-white border-rose-700'
                : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-900 hover:bg-rose-50'
            }`}
          >
            <AlertOctagon className="w-3 h-3" />
            <span>Out of Stock ({outOfStockList.length})</span>
          </button>
          <button
            onClick={() => setFilterType('expired')}
            className={`px-2.5 py-0.5 border uppercase font-mono tracking-tight transition-colors shrink-0 ${
              filterType === 'expired'
                ? 'bg-rose-700 text-white border-rose-700'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            Expired Items ({expiredList.length})
          </button>
        </div>
      </div>

      {/* Main Display: High-Density Table or Solid Cards */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-12 text-center">
          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <Package className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            No medicines found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {searchQuery
              ? `No medicine found matching "${searchQuery}". Please check the medicine name or batch number.`
              : 'No medicines match the selected filter criteria.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
              >
                Clear Search
              </button>
            )}
            <button
              onClick={onNavigateToAddProduct}
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Medicine</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* High-Density Industrial Table Layout */
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-300 dark:border-slate-800 uppercase tracking-wider text-[10.5px]">
                <tr>
                  <th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Medicine Name</th>
                  <th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Company / Maker</th>
                  <th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Supplier (Party)</th>
                  <th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800 font-mono">Batch Number</th>
                  <th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">Expiry Date</th>
                  <th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800 text-right">Buy Price</th>
                  <th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800 text-right">Sale Price</th>
                  <th className="px-3 py-2 border-r border-slate-200 dark:border-slate-800 text-center">Stock Level / Alert</th>
                  <th className="px-3 py-2 text-center">Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredProducts.map((prod) => {
                  const isExpired = new Date(prod.expiryDate) < today;
                  const expiryInfo = getExpiryStatus(prod.expiryDate);
                  const stockInfo = getStockIndicator(prod);

                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                        isExpired
                          ? 'bg-rose-50/50 dark:bg-rose-950/20'
                          : stockInfo.isOut
                          ? 'bg-rose-50/30 dark:bg-rose-950/10'
                          : stockInfo.isLow
                          ? 'bg-amber-50/40 dark:bg-amber-950/10'
                          : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                          {isExpired && (
                            <span title="Expired Medicine" className="inline-flex">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            </span>
                          )}
                          {!isExpired && stockInfo.isOut && (
                            <span title="Out of Stock" className="inline-flex">
                              <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            </span>
                          )}
                          {!isExpired && !stockInfo.isOut && stockInfo.isLow && (
                            <span title="Low Stock Warning" className="inline-flex">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            </span>
                          )}
                          <span className="truncate max-w-[200px]" title={prod.name}>
                            {prod.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 truncate max-w-[150px]">
                        {prod.manufacturer}
                      </td>
                      <td className="px-3 py-2 text-slate-500 border-r border-slate-200 dark:border-slate-800 truncate max-w-[150px]">
                        {prod.partyName || 'Direct Purchase'}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-slate-800 dark:text-slate-200 uppercase border-r border-slate-200 dark:border-slate-800">
                        {prod.batchNumber}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold border ${expiryInfo.badgeClass}`}>
                          {prod.expiryDate}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800 tabular-nums">
                        {settings.currencySymbol} {prod.purchaseRate.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-800 tabular-nums">
                        {settings.currencySymbol} {prod.sellingRate.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center font-mono tabular-nums border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        <span className={`px-2 py-0.5 border text-[10.5px] uppercase tracking-tight ${stockInfo.badgeClass}`}>
                          {stockInfo.badgeLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {stockInfo.isLow && onNavigateToReorder && (
                            <button
                              onClick={onNavigateToReorder}
                              className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-400 dark:border-amber-800 hover:bg-amber-200 transition-colors flex items-center gap-0.5"
                              title="Reorder this medicine from supplier"
                            >
                              <ClipboardList className="w-3 h-3 text-amber-700" />
                              <span>Reorder</span>
                            </button>
                          )}
                          <button
                            onClick={() => setEditingProduct(prod)}
                            className="p-1 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:border-emerald-700 dark:hover:text-emerald-400 transition-colors"
                            title="Edit Medicine"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setProductToDelete(prod)}
                            className="p-1 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-700 hover:border-rose-700 dark:hover:text-rose-400 transition-colors"
                            title="Delete Medicine"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Sharp Enterprise Grid Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProducts.map((product) => {
            const isExpired = new Date(product.expiryDate) < today;
            const expiryStatus = getExpiryStatus(product.expiryDate);
            const stockInfo = getStockIndicator(product);

            return (
              <div
                key={product.id}
                className={`bg-white dark:bg-slate-900 border transition-all flex flex-col justify-between ${
                  isExpired
                    ? 'border-rose-400 dark:border-rose-900'
                    : stockInfo.cardBorder
                }`}
              >
                {/* Out of Stock / Low Stock Banner if triggered */}
                {!isExpired && stockInfo.cardBanner && (
                  <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${stockInfo.cardBanner}`}>
                    <span className="flex items-center gap-1">
                      {stockInfo.isOut ? <AlertOctagon className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      <span>{stockInfo.isOut ? 'Out of Stock - Immediate Reorder Needed' : `Low Stock Alert (Min: ${stockInfo.minLevel})`}</span>
                    </span>
                    {onNavigateToReorder && (
                      <button
                        onClick={onNavigateToReorder}
                        className="underline text-[9.5px] uppercase font-bold hover:opacity-80"
                      >
                        Reorder &rarr;
                      </button>
                    )}
                  </div>
                )}

                <div className="p-3.5 space-y-2">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs uppercase tracking-tight text-slate-900 dark:text-white truncate" title={product.name}>
                        {product.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{product.manufacturer}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="p-1 border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-emerald-700 hover:border-emerald-700 transition-colors"
                        title="Edit Medicine"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setProductToDelete(product)}
                        className="p-1 border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-700 hover:border-rose-700 transition-colors"
                        title="Delete Medicine"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata Specs */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Supplier (Party):</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                        {product.partyName || 'Direct Purchase'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-mono">Batch Number:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white uppercase">
                        {product.batchNumber}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Expiry Date:</span>
                      <span className={`px-1.5 py-0.2 border text-[10px] font-mono font-semibold ${expiryStatus.badgeClass}`}>
                        {product.expiryDate}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Reorder Alert Level:</span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {product.minimumStockLevel ?? 15} units
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rates & Stock Footer */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="border-r border-slate-200 dark:border-slate-700 pr-1 text-left">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Buy Price</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      {settings.currencySymbol} {product.purchaseRate}
                    </span>
                  </div>

                  <div className="border-r border-slate-200 dark:border-slate-700 pr-1 text-left">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Sale Price</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {settings.currencySymbol} {product.sellingRate}
                    </span>
                  </div>

                  <div className="text-right flex flex-col items-end justify-center">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Current Stock</span>
                    <span className={`font-mono font-bold tabular-nums px-1.5 py-0.2 border text-[10.5px] uppercase ${stockInfo.badgeClass}`}>
                      {stockInfo.badgeLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Product Modal */}
      <EditProductModal
        product={editingProduct}
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
      />

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border-2 border-rose-600 p-5 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="w-8 h-8 bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-300 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Delete Medicine Record
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">Remove medicine from inventory</p>
              </div>
            </div>

            <div className="py-4 space-y-2 text-xs">
              <p className="text-slate-700 dark:text-slate-300">
                Are you sure you want to permanently delete this medicine batch?
              </p>
              <div className="bg-slate-100 dark:bg-slate-800 p-2.5 border border-slate-300 dark:border-slate-700 font-mono text-[11.5px]">
                <p className="font-bold text-slate-900 dark:text-white uppercase">{productToDelete.name}</p>
                <p className="text-slate-500 text-[10.5px]">
                  Batch: {productToDelete.batchNumber} · Stock: {productToDelete.stockQuantity} units
                </p>
              </div>
              <p className="text-slate-500 text-[11px]">
                This action cannot be undone. Current stock will be removed from system valuation.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
              <button
                onClick={() => setProductToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-rose-700 hover:bg-rose-800 border border-rose-800"
              >
                Delete Medicine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
