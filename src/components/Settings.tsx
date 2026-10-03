import React, { useEffect, useRef, useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import dbService from '../services/dbService';
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  Store,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Database,
  FolderOpen,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { settings, updateSettings, exportBackup, importBackup, products, parties, bills } = useInventory();

  const [storeName, setStoreName] = useState(settings.storeName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [email, setEmail] = useState(settings.email);
  const [dlNumber, setDlNumber] = useState(settings.dlNumber);
  const [gstNumber, setGstNumber] = useState(settings.gstNumber);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [defaultTaxRate, setDefaultTaxRate] = useState(String(settings.defaultTaxRate));
  const [databaseDirectory, setDatabaseDirectory] = useState('E:/PharmaCare Database');
  const [databaseDirectoryBusy, setDatabaseDirectoryBusy] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showRestoreWarning, setShowRestoreWarning] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDatabaseDirectory = async () => {
      try {
        const currentDirectory = await dbService.getCurrentDatabaseDirectory();
        if (isMounted && currentDirectory) {
          setDatabaseDirectory(currentDirectory);
        }
      } catch {
        if (isMounted) {
          setDatabaseDirectory('E:/PharmaCare Database');
        }
      }
    };

    void loadDatabaseDirectory();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleDbError = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const message = customEvent.detail || 'Database initialization failed.';
      setNotification({ type: 'error', message });
      setTimeout(() => setNotification(null), 5000);
    };

    window.addEventListener('pharmacare-db-error', handleDbError);
    return () => window.removeEventListener('pharmacare-db-error', handleDbError);
  }, []);

  const handleSaveStoreProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      storeName: storeName.trim(),
      tagline: tagline.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      dlNumber: dlNumber.trim(),
      gstNumber: gstNumber.trim(),
      currencySymbol: currencySymbol.trim() || 'Rs.',
      defaultTaxRate: parseFloat(defaultTaxRate) || 0,
    });

    setNotification({ type: 'success', message: 'Store details saved successfully.' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setPendingRestoreData(content);
        setShowRestoreWarning(true);
      };
      reader.readAsText(file);
    }
  };

  const confirmRestore = () => {
    if (!pendingRestoreData) return;
    const res = importBackup(pendingRestoreData);
    if (res.success) {
      setNotification({ type: 'success', message: res.message });
      try {
        const parsed = JSON.parse(pendingRestoreData);
        if (parsed.settings) {
          setStoreName(parsed.settings.storeName || '');
          setTagline(parsed.settings.tagline || '');
          setAddress(parsed.settings.address || '');
          setPhone(parsed.settings.phone || '');
          setEmail(parsed.settings.email || '');
          setDlNumber(parsed.settings.dlNumber || '');
          setGstNumber(parsed.settings.gstNumber || '');
        }
      } catch {
        // ignore
      }
    } else {
      setNotification({ type: 'error', message: res.message });
    }
    setShowRestoreWarning(false);
    setPendingRestoreData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => setNotification(null), 4000);
  };

  const handleBrowseDatabaseDirectory = async () => {
    try {
      const pickedPath = await dbService.pickDatabaseDirectory(databaseDirectory || 'E:/PharmaCare Database');
      if (pickedPath) {
        setDatabaseDirectory(pickedPath);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to browse the selected database folder.';
      setNotification({ type: 'error', message });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleSaveDatabaseDirectory = async () => {
    const nextPath = (databaseDirectory || 'E:/PharmaCare Database').trim();
    if (!nextPath) {
      setNotification({ type: 'error', message: 'A database folder path is required.' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setDatabaseDirectoryBusy(true);
    try {
      const result = await dbService.setDatabaseLocation(nextPath, { moveExisting: false });
      const resolvedPath = result?.path || nextPath;
      setDatabaseDirectory(resolvedPath);
      setNotification({ type: 'success', message: `Database storage updated: ${resolvedPath}` });
      setTimeout(() => setNotification(null), 4000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The database folder could not be saved.';
      setNotification({ type: 'error', message });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setDatabaseDirectoryBusy(false);
    }
  };

  const handleResetDatabaseDirectory = async () => {
    setDatabaseDirectoryBusy(true);
    try {
      const defaultPath = await dbService.resetDatabaseDirectory();
      const resolvedPath = defaultPath || 'E:/PharmaCare Database';
      setDatabaseDirectory(resolvedPath);
      setNotification({ type: 'success', message: `Database directory reset to ${resolvedPath}` });
      setTimeout(() => setNotification(null), 4000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The database directory could not be reset.';
      setNotification({ type: 'error', message });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setDatabaseDirectoryBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-emerald-700" />
          <span>Store Settings & Backup</span>
        </h2>
        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
          Change store details and save or restore your data
        </p>
      </div>

      {notification && (
        <div
          className={`p-3 border text-xs flex items-center gap-2.5 font-mono ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-400 dark:border-rose-900 text-rose-800 dark:text-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-5 space-y-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
            <Database className="w-4 h-4 text-emerald-700" />
            <span>Save & Restore Your Data</span>
          </h3>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            Download a safe backup file of all your medicines, bills, and suppliers to your computer, or restore a previously saved file.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Medicines</span>
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">{products.length} medicines</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Suppliers</span>
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">{parties.length} saved</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer Bills</span>
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">{bills.length} bills</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={exportBackup}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 shadow-xs flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Backup</span>
          </button>

          <label className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer flex items-center justify-center gap-2">
            <Upload className="w-3.5 h-3.5 text-emerald-700" />
            <span>Restore Backup</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-5">
        <div className="mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
            <Database className="w-4 h-4 text-emerald-700" />
            <span>DATABASE LOCATION & STORAGE</span>
          </h3>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            Choose where PharmaCare keeps pharmacare.db and reload the SQLite database driver.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              CURRENT DATABASE DIRECTORY
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={databaseDirectory}
                onChange={(e) => setDatabaseDirectory(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
              <button
                type="button"
                onClick={handleBrowseDatabaseDirectory}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2"
              >
                <FolderOpen className="w-3.5 h-3.5 text-emerald-700" />
                <span>BROWSE FOLDER</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleSaveDatabaseDirectory}
              disabled={databaseDirectoryBusy}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 disabled:opacity-60"
            >
              SAVE PATH
            </button>
            <button
              type="button"
              onClick={handleResetDatabaseDirectory}
              disabled={databaseDirectoryBusy}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-300 dark:border-slate-700 disabled:opacity-60"
            >
              RESET TO DEFAULT PATH
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
          <Store className="w-4 h-4 text-emerald-700" />
          <span>Medical Store Details (Printed on Slips)</span>
        </h3>

        <form onSubmit={handleSaveStoreProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Store / Pharmacy Name *
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Store Tagline or Slogan
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. 24 Hour Chemist & Druggist"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Store Phone Number *
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Store Email Address (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Drug License Number (Optional)
              </label>
              <input
                type="text"
                value={dlNumber}
                onChange={(e) => setDlNumber(e.target.value)}
                placeholder="e.g. DL-20B/14589 & DL-21B/14590"
                className="w-full px-2.5 py-1.5 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                GST Number / Tax ID (Optional)
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="e.g. 07AAAAA0000A1Z5"
                className="w-full px-2.5 py-1.5 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Currency Symbol (e.g. Rs. or $)
              </label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                placeholder="Rs."
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Default Tax Rate (% GST)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(e.target.value)}
                placeholder="0"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Store Full Address (Printed on Bill Slips) *
              </label>
              <textarea
                rows={2}
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 shadow-xs flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Save Store Details</span>
            </button>
          </div>
        </form>
      </div>

      {showRestoreWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-700 p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Are you sure you want to restore this backup?</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              This will replace your current medicines, bills, and suppliers with the data from the uploaded backup file.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreWarning(false);
                  setPendingRestoreData(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestore}
                className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-rose-700 hover:bg-rose-800 border border-rose-800"
              >
                Yes, Restore Backup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
