import React, { useState, useEffect } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { ViewTab } from './types/inventory';
import { Dashboard } from './components/Dashboard';
import { Parties } from './components/Parties';
import { AddProduct } from './components/AddProduct';
import { ExpiredProducts } from './components/ExpiredProducts';
import { PurchaseOrders } from './components/PurchaseOrders';
import { POS } from './components/POS';
import { Settings } from './components/Settings';
import {
  LayoutDashboard,
  Users,
  PackagePlus,
  AlertOctagon,
  ShoppingCart,
  Settings as SettingsIcon,
  ShieldAlert,
  Phone,
  Activity,
  ClipboardList,
  AlertTriangle
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');
  const {
    settings,
    updateSettings,
    getExpiredProducts,
    getLowStockProducts,
    getOutOfStockProducts,
    products
  } = useInventory();

  const expiredCount = getExpiredProducts().length;
  const lowStockCount = getLowStockProducts().length;
  const outOfStockCount = getOutOfStockProducts().length;
  const reorderAlertCount = lowStockCount + outOfStockCount;

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }, []);

  // Keyboard shortcut support F1 - F7
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'F1') { e.preventDefault(); setCurrentTab('dashboard'); }
      else if (e.key === 'F2') { e.preventDefault(); setCurrentTab('pos'); }
      else if (e.key === 'F3') { e.preventDefault(); setCurrentTab('addProduct'); }
      else if (e.key === 'F4') { e.preventDefault(); setCurrentTab('reorder'); }
      else if (e.key === 'F5') { e.preventDefault(); setCurrentTab('expired'); }
      else if (e.key === 'F6') { e.preventDefault(); setCurrentTab('parties'); }
      else if (e.key === 'F7') { e.preventDefault(); setCurrentTab('settings'); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    {
      id: 'dashboard' as ViewTab,
      label: 'Medicine Stock',
      shortLabel: 'Stock',
      code: 'F1',
      description: 'Search & view all medicines',
      icon: LayoutDashboard,
    },
    {
      id: 'pos' as ViewTab,
      label: 'Make Bill (Sell)',
      shortLabel: 'Billing',
      code: 'F2',
      description: 'Sell medicines & print slip',
      icon: ShoppingCart,
    },
    {
      id: 'addProduct' as ViewTab,
      label: 'Add New Medicine',
      shortLabel: 'Add Stock',
      code: 'F3',
      description: 'Add newly bought stock',
      icon: PackagePlus,
    },
    {
      id: 'reorder' as ViewTab,
      label: 'Purchase Orders & Reorder',
      shortLabel: 'Orders / PO',
      code: 'F4',
      description: 'Low-stock items & PO generator',
      icon: ClipboardList,
      badge: reorderAlertCount > 0 ? reorderAlertCount : undefined,
      badgeType: 'amber' as const,
    },
    {
      id: 'expired' as ViewTab,
      label: 'Expired Medicines',
      shortLabel: 'Expired',
      code: 'F5',
      description: 'Items past expiry date',
      icon: AlertOctagon,
      badge: expiredCount > 0 ? expiredCount : undefined,
      badgeType: 'rose' as const,
    },
    {
      id: 'parties' as ViewTab,
      label: 'Suppliers (Parties)',
      shortLabel: 'Suppliers',
      code: 'F6',
      description: 'Wholesalers & distributors',
      icon: Users,
    },
    {
      id: 'settings' as ViewTab,
      label: 'Store Settings & Backup',
      shortLabel: 'Settings',
      code: 'F7',
      description: 'Save backup & store info',
      icon: SettingsIcon,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row antialiased">
      {/* Desktop Enterprise Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 shrink-0 select-none">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-700 text-white flex items-center justify-center font-bold shadow-xs border border-emerald-800 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h1 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white truncate">
                  {settings.storeName}
                </h1>
              </div>
              <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 truncate uppercase tracking-tight">
                Pharmacy Store Management
              </p>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>D.L: {settings.dlNumber.split('&')[0] || 'REG-ACTIVE'}</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-sans font-semibold text-[10px]">
              <span className="w-1.5 h-1.5 bg-emerald-600 inline-block"></span>
              READY
            </span>
          </div>
        </div>

        {/* Quick Operational Metrics */}
        <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-300 dark:border-slate-800 grid grid-cols-3 gap-1.5 text-[10.5px]">
          <div>
            <span className="text-[9.5px] text-slate-500 block uppercase font-medium">Medicines</span>
            <span className="font-bold font-mono text-slate-900 dark:text-white tabular-nums">{products.length}</span>
          </div>
          <button
            onClick={() => setCurrentTab('reorder')}
            className="text-left hover:opacity-80 transition-opacity"
            title="View low-stock medicines & POs"
          >
            <span className="text-[9.5px] text-amber-700 dark:text-amber-400 block uppercase font-bold">Low Stock</span>
            <span className={`font-bold font-mono tabular-nums ${reorderAlertCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'}`}>
              {reorderAlertCount}
            </span>
          </button>
          <button
            onClick={() => setCurrentTab('expired')}
            className="text-left hover:opacity-80 transition-opacity"
            title="View expired medicines"
          >
            <span className="text-[9.5px] text-rose-700 dark:text-rose-400 block uppercase font-bold">Expired</span>
            <span className={`font-bold font-mono tabular-nums ${expiredCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
              {expiredCount}
            </span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-2 overflow-y-auto space-y-0.5">
          <div className="px-4 py-1.5 text-[9.5px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Store Menu
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full px-3.5 py-2 flex items-center justify-between text-xs font-semibold transition-all group border-l-3 ${
                  isActive
                    ? 'bg-emerald-700 text-white border-l-emerald-900 dark:border-l-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 border-l-transparent hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? 'text-white'
                        : item.id === 'expired' && expiredCount > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : item.id === 'reorder' && reorderAlertCount > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
                    }`}
                  />
                  <div className="truncate">
                    <span className="block truncate">{item.label}</span>
                    <span
                      className={`text-[10px] font-normal block truncate ${
                        isActive ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.description}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 text-[10px] font-mono font-bold border tabular-nums ${
                        isActive
                          ? 'bg-white text-emerald-900 border-white'
                          : item.badgeType === 'amber'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900'
                          : 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <span
                    className={`text-[9.5px] font-mono px-1 py-0.5 border ${
                      isActive
                        ? 'border-emerald-500 text-emerald-100 bg-emerald-800/60'
                        : 'border-slate-300 dark:border-slate-700 text-slate-400 bg-slate-50 dark:bg-slate-800'
                    }`}
                  >
                    {item.code}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px] mb-2 font-mono">
            <span className="truncate flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{settings.phone}</span>
            </span>

          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5">
            <span>GSTIN: {settings.gstNumber}</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">SECURE</span>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-3 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-700 text-white flex items-center justify-center font-bold border border-emerald-800">
            <Activity className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-xs uppercase tracking-tight text-slate-900 dark:text-white truncate max-w-[190px]">
              {settings.storeName}
            </h1>
            <p className="text-[9.5px] text-slate-500 font-mono">PHARMACY STORE</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {reorderAlertCount > 0 && (
            <button
              onClick={() => setCurrentTab('reorder')}
              className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10.5px] font-mono font-bold border border-amber-300 dark:border-amber-900 flex items-center gap-1"
              title="Low Stock Items"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>{reorderAlertCount}</span>
            </button>
          )}

          {expiredCount > 0 && (
            <button
              onClick={() => setCurrentTab('expired')}
              className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10.5px] font-mono font-bold border border-rose-300 dark:border-rose-900 flex items-center gap-1"
              title="Expired Items"
            >
              <ShieldAlert className="w-3 h-3" />
              <span>{expiredCount}</span>
            </button>
          )}


        </div>
      </header>

      {/* Main Viewport Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-16 md:pb-6">
        {/* Desktop Top Control Bar */}
        <div className="hidden md:flex items-center justify-between px-6 py-2.5 border-b border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 uppercase">STORE /</span>
            <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {navItems.find((n) => n.id === currentTab)?.label}
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-[11px] text-slate-500 font-sans">
              Currency: <strong className="text-slate-900 dark:text-white font-mono">{settings.currencySymbol}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentTab !== 'reorder' && reorderAlertCount > 0 && (
              <button
                onClick={() => setCurrentTab('reorder')}
                className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900/60 border border-amber-400 dark:border-amber-800 transition-colors flex items-center gap-1.5"
              >
                <ClipboardList className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                <span>Reorder Items ({reorderAlertCount})</span>
              </button>
            )}
            {currentTab !== 'pos' && (
              <button
                onClick={() => setCurrentTab('pos')}
                className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 shadow-xs transition-colors flex items-center gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Create Bill (F2)</span>
              </button>
            )}
            {currentTab !== 'addProduct' && (
              <button
                onClick={() => setCurrentTab('addProduct')}
                className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>Add Medicine (F3)</span>
              </button>
            )}
          </div>
        </div>

        {/* View Content */}
        <div className="p-3 md:p-6 flex-1 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <Dashboard
              onNavigateToAddProduct={() => setCurrentTab('addProduct')}
              onNavigateToExpired={() => setCurrentTab('expired')}
              onNavigateToReorder={() => setCurrentTab('reorder')}
            />
          )}

          {currentTab === 'parties' && <Parties />}

          {currentTab === 'addProduct' && (
            <AddProduct onSuccessNavigate={() => setCurrentTab('dashboard')} />
          )}

          {currentTab === 'reorder' && (
            <PurchaseOrders
              onNavigateToInventory={() => setCurrentTab('dashboard')}
              onNavigateToAddProduct={() => setCurrentTab('addProduct')}
            />
          )}

          {currentTab === 'expired' && (
            <ExpiredProducts
              onNavigateToInventory={() => setCurrentTab('dashboard')}
              onNavigateToReorder={() => setCurrentTab('reorder')}
            />
          )}

          {currentTab === 'pos' && <POS />}

          {currentTab === 'settings' && <Settings />}
        </div>
      </main>

      {/* Mobile Persistent Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-300 dark:border-slate-800 flex items-stretch divide-x divide-slate-200 dark:divide-slate-800 shadow-lg overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex-1 py-2 px-1 flex flex-col items-center justify-center transition-colors relative min-w-[50px] ${
                isActive
                  ? 'bg-emerald-700 text-white font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {item.badge !== undefined && (
                  <span className={`absolute -top-1.5 -right-2 px-1 py-0.2 text-white font-mono text-[8.5px] font-bold ${
                    item.badgeType === 'amber' ? 'bg-amber-600' : 'bg-rose-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[8.5px] uppercase tracking-tight mt-1 truncate max-w-[48px]">
                {item.shortLabel || item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <InventoryProvider>
      <MainLayout />
    </InventoryProvider>
  );
}
