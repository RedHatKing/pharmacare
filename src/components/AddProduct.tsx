import React, { useState, useMemo, useRef, useEffect } from 'react';
import dbService from '../services/dbService';
import { useInventory } from '../context/InventoryContext';
import { Party } from '../types/inventory';
import {
  PackagePlus,
  Building2,
  Calendar,
  Hash,
  Coins,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Plus,
  ArrowRight,
  Camera,
  X,
  Layers,
  ShieldAlert,
  Search,
  Check
} from 'lucide-react';



const DEFAULT_MANUFACTURERS = [
  'Cipla',
  'Sun Pharma',
  'Abbott',
  'GlaxoSmithKline',
  'Pfizer',
  'Novartis',
  'Sanofi',
  "Dr. Reddy's",
  'Lupin',
  'Mankind Pharma',
  'Torrent Pharmaceuticals',
  'Zydus Cadila',
  'Alkem Laboratories',
  'AstraZeneca',
  'Glenmark',
  'Intas Pharmaceuticals',
  'Bayer',
  'Roche'
];

interface AddProductProps {
  onSuccessNavigate: () => void;
}

export const AddProduct: React.FC<AddProductProps> = ({ onSuccessNavigate }) => {
  const { products, parties, addProduct, addParty, refreshInventory, settings } = useInventory();

  const [nextProductCode, setNextProductCode] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;

    const loadNextCode = async () => {
      try {
        const nextCode = await dbService.getNextProductCode();
        if (!cancelled) {
          setNextProductCode(nextCode);
        }
      } catch {
        const fallback = products && products.length > 0 ? Math.max(...products.map((p) => p.product_code || 0)) + 1 : 1;
        if (!cancelled) {
          setNextProductCode(fallback);
        }
      }
    };

    void loadNextCode();

    return () => {
      cancelled = true;
    };
  }, [products]);

  // Form fields
  const [productName, setProductName] = useState('');
  const [partyId, setPartyId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manufacturer, setManufacturer] = useState('');
  const [showManufacturerDropdown, setShowManufacturerDropdown] = useState(false);
  // removed individual unit buy/sell inputs; using pack-based pricing
  // Pack / unit fields for live calculation
  const [packBuyPrice, setPackBuyPrice] = useState<string>('');
  const [subQuantityPerPack, setSubQuantityPerPack] = useState<string>('');
  const [hasPacking, setHasPacking] = useState<boolean>(false);
  const [unitBuyPrice, setUnitBuyPrice] = useState<string>('');
  const [packSalePrice, setPackSalePrice] = useState<string>('');
  const [unitSalePrice, setUnitSalePrice] = useState<string>('');
  const [profitMargin, setProfitMargin] = useState<string>('');
  const [unitSaleOverridden, setUnitSaleOverridden] = useState<boolean>(false);
  const [looseRetailMargin, setLooseRetailMargin] = useState<string>('');
  const [unitOptions, setUnitOptions] = useState<string[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedPackUnit, setSelectedPackUnit] = useState<string | null>(null);
  const [selectedSubUnit, setSelectedSubUnit] = useState<string | null>(null);
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [stockQuantity, setStockQuantity] = useState<string>('50');
  const [photoUrl, setPhotoUrl] = useState<string>('');

  // Persistent dynamic manufacturers
  const [customManufacturers, setCustomManufacturers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pharma_custom_manufacturers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });


  // Dropdown click outside refs
  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const supplierInputRef = useRef<HTMLInputElement>(null);
  const manufacturerDropdownRef = useRef<HTMLDivElement>(null);
  const manufacturerInputRef = useRef<HTMLInputElement>(null);
  

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        supplierDropdownRef.current &&
        !supplierDropdownRef.current.contains(target) &&
        supplierInputRef.current &&
        !supplierInputRef.current.contains(target)
      ) {
        setShowSupplierDropdown(false);
      }
      if (
        manufacturerDropdownRef.current &&
        !manufacturerDropdownRef.current.contains(target) &&
        manufacturerInputRef.current &&
        !manufacturerInputRef.current.contains(target)
      ) {
        setShowManufacturerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize DB service and load unit suggestions
  useEffect(() => {
    (async () => {
      try {
        await dbService.init();
        const units = await dbService.getUnitSuggestions();
        setUnitOptions(units || []);
        if (units && units.length > 0) setSelectedUnit(units[0]);
      } catch (err) {
        // ignore - mock driver will work in browser
      }
    })();
  }, []);

  // Default suggestion lists for pack and sub-units (editable via datalist)
  const PACK_UNIT_SUGGESTIONS = [
    'Box',
    'Pack',
    'Carton',
    'Container',
    'Jar',
    'Bottle',
    'Display Box'
  ];

  const SUB_UNIT_SUGGESTIONS = [
    'Tablet',
    'Capsule',
    'Strip',
    'Sachet',
    'Packet',
    'Piece',
    'Ampoule',
    'Vial',
    'Tube',
    'Blister'
  ];

  const singleModeFinancials = useMemo(() => {
    const quantity = Number.parseFloat(stockQuantity || '0');
    const buyPrice = Number.parseFloat(packBuyPrice || '0');
    const salePrice = Number.parseFloat(packSalePrice || '0');

    const safeQuantity = Number.isFinite(quantity) ? Math.max(quantity, 0) : 0;
    const safeBuyPrice = Number.isFinite(buyPrice) ? Math.max(buyPrice, 0) : 0;
    const safeSalePrice = Number.isFinite(salePrice) ? Math.max(salePrice, 0) : 0;

    const totalInvestment = safeQuantity * safeBuyPrice;
    const grossProfitPerUnit = safeSalePrice - safeBuyPrice;
    const profitMargin = safeBuyPrice > 0 ? (grossProfitPerUnit / safeBuyPrice) * 100 : 0;
    const estimatedTotalProfit = grossProfitPerUnit * safeQuantity;

    const formatMoney = (value: number) => `${settings.currencySymbol} ${value.toFixed(2)}`;
    const formatPercent = (value: number) => (value === 0 ? '0%' : `${value.toFixed(2)}%`);

    return {
      totalInvestment,
      profitMargin,
      estimatedTotalProfit,
      totalInvestmentText: formatMoney(totalInvestment),
      profitMarginText: formatPercent(profitMargin),
      estimatedTotalProfitText: formatMoney(estimatedTotalProfit)
    };
  }, [stockQuantity, packBuyPrice, packSalePrice, settings.currencySymbol]);

  // (liquid auto-lock removed)

  // When switching between single-product and packing modes, enforce defaults
  useEffect(() => {
    if (!hasPacking) {
      // single-item mode: sub-quantity = 1, clear pack/sub unit selections
      setSubQuantityPerPack('1');
      setSelectedSubUnit(null);
      setSelectedPackUnit(null);
      // ensure unit sale mirrors pack sale for single-item mode
      if (packSalePrice) {
        setUnitSalePrice(packSalePrice);
        setUnitSaleOverridden(true);
      }
    } else {
      // entering packing mode: allow suggestion behavior
      setUnitSaleOverridden(false);
      // clear single-mode mirrors
      if (!subQuantityPerPack || subQuantityPerPack === '1') setSubQuantityPerPack('');
    }
  }, [hasPacking]);

  // Live calculations: unit buy = packBuy / subQty
  useEffect(() => {
    const pb = parseFloat(packBuyPrice || '0');
    const sq = parseFloat(subQuantityPerPack || '0');
    if (!isNaN(pb) && sq > 0) {
      setUnitBuyPrice((pb / sq).toFixed(2));
    } else {
      setUnitBuyPrice('');
    }
  }, [packBuyPrice, subQuantityPerPack]);

  // Live calculations: when pack sale changes and unit sale hasn't been overridden,
  // suggest unit sale = packSale / subQuantity
  useEffect(() => {
    const ps = parseFloat(packSalePrice || '0');
    const sq = parseFloat(subQuantityPerPack || '0');
    const pb = parseFloat(packBuyPrice || '0');
    if (!unitSaleOverridden) {
      if (!isNaN(ps) && sq > 0) {
        setUnitSalePrice((ps / sq).toFixed(2));
      } else {
        setUnitSalePrice('');
      }
    }
    // Pack profit margin
    if (!isNaN(pb) && pb > 0) {
      const margin = ((ps - pb) / pb) * 100;
      setProfitMargin(!isNaN(margin) ? margin.toFixed(2) : '');
    } else {
      setProfitMargin('');
    }
  }, [packSalePrice, packBuyPrice, subQuantityPerPack, unitSaleOverridden]);

  // When sub-quantity changes, if unit sale not overridden, update suggestion from pack
  useEffect(() => {
    const sq = parseFloat(subQuantityPerPack || '0');
    const ps = parseFloat(packSalePrice || '0');
    if (!unitSaleOverridden && !isNaN(ps) && sq > 0) {
      setUnitSalePrice((ps / sq).toFixed(2));
    }
  }, [subQuantityPerPack, packSalePrice, unitSaleOverridden]);

  const handlePackSaleChange = (val: string) => {
    setPackSalePrice(val);
    // mirror in single-item mode
    if (!hasPacking) {
      setUnitSalePrice(val);
      setUnitSaleOverridden(true);
    }
  };

  const handleUnitSaleChange = (val: string) => {
    setUnitSalePrice(val);
    setUnitSaleOverridden(true);
  };

  // Loose retail margin based on unit sale vs unit buy
  useEffect(() => {
    const us = parseFloat(unitSalePrice || '0');
    const ub = parseFloat(unitBuyPrice || '0');
    if (!isNaN(us) && !isNaN(ub) && ub > 0) {
      const margin = ((us - ub) / ub) * 100;
      setLooseRetailMargin(!isNaN(margin) ? margin.toFixed(2) : '');
    } else {
      setLooseRetailMargin('');
    }
  }, [unitSalePrice, unitBuyPrice]);

  // Compute all available unique manufacturers from defaults, custom stored types, and existing inventory
  const allManufacturers = useMemo(() => {
    const fromInventory = products
      .map((p) => p.manufacturer?.trim())
      .filter((m): m is string => Boolean(m));
    return Array.from(
      new Set([...DEFAULT_MANUFACTURERS, ...customManufacturers, ...fromInventory])
    ).filter(Boolean);
  }, [products, customManufacturers]);

  // Filter manufacturers based on user input
  const filteredManufacturers = useMemo(() => {
    const q = manufacturer.toLowerCase().trim();
    if (!q) return allManufacturers;
    return allManufacturers.filter((m) => m.toLowerCase().includes(q));
  }, [allManufacturers, manufacturer]);

  // (medicine type feature removed)

  // Filter parties based on search query
  const filteredParties = useMemo(() => {
    const query = supplierSearch.toLowerCase().trim();
    if (!query) return parties;
    return parties.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.contactNumber.toLowerCase().includes(query) ||
        (p.address && p.address.toLowerCase().includes(query))
    );
  }, [parties, supplierSearch]);

  const handleSupplierInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSupplierSearch(val);
    setPartyName(val);
    const matched = parties.find((p) => p.name.toLowerCase() === val.toLowerCase().trim());
    setPartyId(matched ? matched.id : '');
    setShowSupplierDropdown(true);
  };

  const handleSelectParty = (p: Party) => {
    setPartyId(p.id);
    setPartyName(p.name);
    setSupplierSearch(p.name);
    setShowSupplierDropdown(false);
  };

  const handleClearSupplier = () => {
    setPartyId('');
    setPartyName('');
    setSupplierSearch('');
    setShowSupplierDropdown(false);
    supplierInputRef.current?.focus();
  };

  // Quick Party Modal
  const [showQuickPartyModal, setShowQuickPartyModal] = useState(false);
  const [quickPartyName, setQuickPartyName] = useState('');
  const [quickPartyContact, setQuickPartyContact] = useState('');
  const [quickPartyAddress, setQuickPartyAddress] = useState('');

  // Status message
  const [successInfo, setSuccessInfo] = useState<{ name: string; batch: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleQuickAddParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPartyName.trim() || !quickPartyContact.trim()) return;

    const newParty = addParty({
      name: quickPartyName.trim(),
      contactNumber: quickPartyContact.trim(),
      address: quickPartyAddress.trim() || 'Distributor Agency Address',
    });

    setPartyId(newParty.id);
    setPartyName(newParty.name);
    setSupplierSearch(newParty.name);
    setShowSupplierDropdown(false);
    setShowQuickPartyModal(false);
    setQuickPartyName('');
    setQuickPartyContact('');
    setQuickPartyAddress('');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Image size must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
        setErrorMsg('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!supplierSearch.trim()) {
      setErrorMsg('Please select or type a supplier (party) name.');
      return;
    }
    if (!productName.trim()) {
      setErrorMsg('Please enter the medicine name.');
      return;
    }
    if (!manufacturer.trim()) {
      setErrorMsg('Please enter the company or manufacturer name.');
      return;
    }
    if (!batchNumber.trim()) {
      setErrorMsg('Please enter the batch number.');
      return;
    }
    if (!expiryDate) {
      setErrorMsg('Please select the expiry date.');
      return;
    }
    const packBuy = parseFloat(packBuyPrice || '0');
    if (isNaN(packBuy) || packBuy <= 0) {
      setErrorMsg('Please enter a valid pack buy price.');
      return;
    }

    const packSale = parseFloat(packSalePrice || String(packBuy * 1.25));
    const qty = parseInt(stockQuantity, 10) || 1;
    const minStock = 15;

    const chosenPartyName = partyName.trim() || supplierSearch.trim() || (parties.length > 0 ? parties[0].name : 'Direct Supplier');
    const chosenPartyId = partyId || parties.find((p) => p.name.toLowerCase() === chosenPartyName.toLowerCase())?.id || null;
    const chosenManufacturer = manufacturer.trim();

    if (
      chosenManufacturer &&
      !allManufacturers.some((m) => m.toLowerCase() === chosenManufacturer.toLowerCase())
    ) {
      const updatedManufacturers = [...customManufacturers, chosenManufacturer];
      setCustomManufacturers(updatedManufacturers);
      try {
        localStorage.setItem('pharma_custom_manufacturers', JSON.stringify(updatedManufacturers));
      } catch {
        // ignore
      }
    }

    (async () => {
      try {
        const nextCode = await dbService.getNextProductCode();
        const savedMedicine = await dbService.addMedicine({
          product_code: `#${nextCode}`,
          name: productName.trim(),
          company: chosenManufacturer,
          supplier_id: chosenPartyId,
          supplier_name: chosenPartyName,
          purchase_date: invoiceDate,
          has_multi_unit: hasPacking ? 1 : 0,
          unit_pack_size: hasPacking ? (parseInt(subQuantityPerPack || '1', 10) || 1) : 1,
          stock_quantity: qty,
          buy_price: packBuy,
          sale_price: packSale,
          batch_number: batchNumber.trim().toUpperCase(),
          expiry_date: expiryDate,
          rack_location: '',
          min_stock_level: minStock,
        });

        addProduct({
          product_code: nextCode,
          name: savedMedicine.name,
          partyId: chosenPartyId || '',
          partyName: chosenPartyName,
          invoiceDate: invoiceDate,
          manufacturer: chosenManufacturer,
          purchaseRate: packBuy,
          sellingRate: packSale,
          batchNumber: savedMedicine.batch_number,
          expiryDate: expiryDate,
          stockQuantity: qty,
          minimumStockLevel: minStock,
        }, { skipDbInsert: true });

        setNextProductCode(nextCode + 1);
        await refreshInventory();
        setSuccessInfo({ name: savedMedicine.name, batch: savedMedicine.batch_number });

        setProductName('');
        setManufacturer('');
        setShowManufacturerDropdown(false);
        setBatchNumber('');
        setPackBuyPrice('');
        setPackSalePrice('');
        setSubQuantityPerPack('');
        setSelectedPackUnit(null);
        setSelectedSubUnit(null);
        setExpiryDate('');
        setPhotoUrl('');
        setUnitSalePrice('');
        setUnitSaleOverridden(false);
        setLooseRetailMargin('');
        setUnitBuyPrice('');
        setStockQuantity('50');
        setSupplierSearch('');
        setPartyId('');
        setPartyName('');
        setShowSupplierDropdown(false);
      } catch (err) {
        setErrorMsg('Failed to save medicine.');
      }
    })();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
          <PackagePlus className="w-4 h-4 text-emerald-700" />
          <span>Add New Medicine Stock</span>
        </h2>
        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
          Enter details of new medicines bought for your store
        </p>
      </div>

      {/* Success Notification */}
      {successInfo && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <div>
              <p className="font-bold text-emerald-900 dark:text-emerald-200">
                "{successInfo.name}" (Batch: {successInfo.batch}) saved successfully!
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                This medicine is now in stock and ready to sell.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSuccessInfo(null)}
              className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900"
            >
              Add Another Medicine
            </button>
            <button
              onClick={onSuccessNavigate}
              className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 flex items-center gap-1"
            >
              <span>View All Medicines</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="p-1 hover:text-rose-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Sharp Form Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-5 md:p-6 shadow-2xs">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Supplier & Drug Identity */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-800 mb-4 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>1. Supplier & Medicine Details</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Code (read-only) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Product Code
                </label>
                <input
                  type="text"
                  readOnly
                  value={`#${nextProductCode}`}
                  className="w-full px-2.5 py-2 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                />
                <p className="text-[10.5px] text-slate-500 font-mono mt-1">Auto-assigned sequential code for this product</p>
              </div>
              {/* 1. Supplier (Party) Searchable Autocomplete */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    1. Supplier (Party) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickPartyName(supplierSearch);
                      setShowQuickPartyModal(true);
                      setShowSupplierDropdown(false);
                    }}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 font-bold uppercase tracking-wider inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add Supplier</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    ref={supplierInputRef}
                    type="text"
                    required
                    value={supplierSearch}
                    onChange={handleSupplierInputChange}
                    onFocus={() => setShowSupplierDropdown(true)}
                    placeholder="Type supplier name to search..."
                    className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  />
                  {supplierSearch && (
                    <button
                      type="button"
                      onClick={handleClearSupplier}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
                      title="Clear supplier"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Floating Suggestions Dropdown */}
                {showSupplierDropdown && (
                  <div
                    ref={supplierDropdownRef}
                    className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
                  >
                    {filteredParties.length > 0 ? (
                      filteredParties.map((p) => {
                        const isSelected = p.id === partyId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectParty(p);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                              isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold block truncate">{p.name}</span>
                              <span className="text-[10.5px] text-slate-500 font-mono block truncate">
                                {p.contactNumber} {p.address ? `· ${p.address}` : ''}
                              </span>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center text-xs text-slate-500">
                        <p>No matching supplier found for "{supplierSearch}"</p>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setQuickPartyName(supplierSearch);
                            setShowQuickPartyModal(true);
                            setShowSupplierDropdown(false);
                          }}
                          className="mt-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 hover:underline"
                        >
                          + Add "{supplierSearch}" as New Supplier
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[10.5px] text-slate-500 font-mono mt-1">
                  {partyId ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Selected: {partyName}
                    </span>
                  ) : (
                    'Type supplier name to search and select from list'
                  )}
                </p>
              </div>

              {/* 2. Product Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  2. Medicine Name *
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Type medicine name (e.g. Paracetamol 650mg, Augmentin 625 Duo)"
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
                <p className="text-[10.5px] text-slate-500 font-mono mt-1">Include strength or pack size (e.g. 15 tablets, 100ml syrup)</p>
              </div>

              {/* 3. Invoice Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  3. Purchase Date *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  />
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[10.5px] text-slate-500 font-mono mt-1">Date printed on the supplier bill</p>
              </div>

              {/* 4. Company / Manufacturer with Dynamic Autocomplete */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    4. Company / Manufacturer *
                  </label>
                  <span className="text-[10.5px] text-slate-400 font-mono">
                    {allManufacturers.length} brands
                  </span>
                </div>
                <div className="relative">
                  <input
                    ref={manufacturerInputRef}
                    type="text"
                    required
                    value={manufacturer}
                    onChange={(e) => {
                      setManufacturer(e.target.value);
                      setShowManufacturerDropdown(true);
                    }}
                    onFocus={() => setShowManufacturerDropdown(true)}
                    placeholder="e.g. Cipla, Sun Pharma, Abbott"
                    className="w-full px-2.5 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  />
                  {manufacturer && (
                    <button
                      type="button"
                      onClick={() => {
                        setManufacturer('');
                        setShowManufacturerDropdown(true);
                        manufacturerInputRef.current?.focus();
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
                      title="Clear manufacturer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Floating Suggestions Dropdown */}
                {showManufacturerDropdown && (
                  <div
                    ref={manufacturerDropdownRef}
                    className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
                  >
                    {filteredManufacturers.length > 0 ? (
                      filteredManufacturers.map((companyOption) => {
                        const isSelected = companyOption.toLowerCase() === manufacturer.toLowerCase().trim();
                        return (
                          <button
                            key={companyOption}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setManufacturer(companyOption);
                              setShowManufacturerDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                              isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <span className="truncate">{companyOption}</span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-2.5 text-center text-xs text-slate-500">
                        <p>No matching company found.</p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-1">
                          "{manufacturer}" will be auto-saved on submit!
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[10.5px] text-slate-500 font-mono mt-1">Company that made this medicine (select or type custom)</p>
              </div>
            </div>
          </div>

          {/* Section 2: Batch, Rates & Expiry */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-800 mb-4 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-emerald-700" />
              <span>2. Batch, Price & Expiry Date</span>
            </h3>

            <div className="mb-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hasPacking} onChange={(e) => setHasPacking(e.target.checked)} className="w-4 h-4" />
                <span className="text-xs font-semibold">Enable Multi-Unit / Packing (Check this for Boxes containing Strips/Tablets)</span>
              </label>
            </div>

            {!hasPacking ? (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Quantity In Stock *</label>
                    <input type="number" min="0" required value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Buy Price ({settings.currencySymbol})</label>
                    <input type="number" step="0.01" min="0" required value={packBuyPrice} onChange={(e) => setPackBuyPrice(e.target.value)} className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Sale Price ({settings.currencySymbol})</label>
                    <input type="number" step="0.01" min="0" required value={packSalePrice} onChange={(e) => handlePackSaleChange(e.target.value)} className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Batch Number</label>
                    <input type="text" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value.toUpperCase())} className="w-full px-2.5 py-2 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Expiry Date</label>
                    <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full px-2.5 py-2 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Total Investment</div>
                    <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{singleModeFinancials.totalInvestmentText}</div>
                  </div>

                  <div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Profit Margin</div>
                    <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{singleModeFinancials.profitMarginText}</div>
                  </div>

                  <div className="rounded border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">Estimated Total Profit</div>
                    <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{singleModeFinancials.estimatedTotalProfitText}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Quantity In Stock (packs)</label>
                  <input type="number" min="0" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white" />
                </div>

                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded border border-slate-200 dark:border-slate-700">
                    <h4 className="text-xs font-bold uppercase mb-2">PACKAGING & LOOSE BREAKDOWN</h4>

                    <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 px-3 py-2 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                      Packing Ratio: 1 {selectedPackUnit || 'Pack Unit'} = {subQuantityPerPack || '0'} {selectedSubUnit || 'Sub-Unit'}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-semibold">Pack / Main Unit (e.g. Box, Pack, Carton)</label>
                        <input
                          list="pack-unit-suggestions"
                          type="text"
                          value={selectedPackUnit || ''}
                          onChange={(e) => setSelectedPackUnit(e.target.value || null)}
                          placeholder="e.g. Box"
                          className="w-full px-2 py-2 text-xs mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                        />
                        <datalist id="pack-unit-suggestions">
                          {PACK_UNIT_SUGGESTIONS.map((s) => (
                            <option key={s} value={s} />
                          ))}
                          {unitOptions.map((u) => (
                            <option key={`u-${u}`} value={u} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold">Loose Quantity per Pack *</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 10 or 20"
                          value={subQuantityPerPack}
                          onChange={(e) => setSubQuantityPerPack(e.target.value)}
                          
                          className="w-full px-2 py-2 text-xs mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold">Sub-Unit / Loose Type (e.g. Sachet, Packet, Tablet, Piece)</label>
                        <input
                          list="sub-unit-suggestions"
                          type="text"
                          value={selectedSubUnit || ''}
                          onChange={(e) => setSelectedSubUnit(e.target.value || null)}
                          placeholder="e.g. Tablet"
                          className="w-full px-2 py-2 text-xs mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                        />
                        <datalist id="sub-unit-suggestions">
                          {SUB_UNIT_SUGGESTIONS.map((s) => (
                            <option key={s} value={s} />
                          ))}
                          {unitOptions.map((u) => (
                            <option key={`u2-${u}`} value={u} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold">Batch Number</label>
                        <input type="text" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value.toUpperCase())} className="w-full px-2 py-2 text-xs mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700" />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold">Expiry Date</label>
                        <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full px-2 py-2 text-xs mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded border border-slate-200 dark:border-slate-700">
                    <h4 className="text-xs font-bold uppercase mb-2">Pricing & Profit Margin</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-semibold">Pack / Box Buy Price (Rs.)</label>
                        <input type="number" step="0.01" min="0" value={packBuyPrice} onChange={(e) => setPackBuyPrice(e.target.value)} className="w-full px-2 py-2 text-xs mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700" />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold">Pack / Box Sale Price (Rs.)</label>
                        <input type="number" step="0.01" min="0" value={packSalePrice} onChange={(e) => handlePackSaleChange(e.target.value)} className="w-full px-2 py-2 text-xs mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700" />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold">Single Piece / Loose Sale Price (Rs.)</label>
                        <input type="number" step="0.01" min="0" value={unitSalePrice} onChange={(e) => handleUnitSaleChange(e.target.value)} className="w-full px-2 py-2 text-xs mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700" />
                      </div>

                      <div className="grid grid-cols-3 gap-3 mt-2">
                        <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
                          <div className="text-[11px] font-semibold">Unit Buy Price</div>
                          <div className="mt-1 text-xs font-mono">{unitBuyPrice ? `${settings.currencySymbol} ${unitBuyPrice}` : '—'}</div>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
                          <div className="text-[11px] font-semibold">Unit Sale Price</div>
                          <div className="mt-1 text-xs font-mono">{unitSalePrice ? `${settings.currencySymbol} ${unitSalePrice}` : '—'}</div>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
                          <div className="text-[11px] font-semibold">Margins</div>
                          <div className="mt-1 text-xs font-mono">
                            <div>Pack Profit: {profitMargin ? `${profitMargin}%` : '—'}</div>
                            <div>Loose Retail: {looseRetailMargin ? `${looseRetailMargin}%` : '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Medicine Type removed */}
          </div>

          {/* Section 3: 8. Product Photo */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-800 mb-3 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-emerald-700" />
              <span>3. Medicine Photo (Optional)</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Sharp dashed box with exact label requirement */}
              <label className="relative flex flex-col items-center justify-center w-full sm:w-64 h-32 border-2 border-dashed border-slate-400 dark:border-slate-700 hover:border-emerald-700 cursor-pointer bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 transition-colors group overflow-hidden shrink-0">
                {photoUrl ? (
                  <div className="relative w-full h-full">
                    <img src={photoUrl} alt="Product package" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-mono font-bold uppercase">
                      Tap to replace photo
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 text-center">
                    <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center mb-1.5 border border-slate-300 dark:border-slate-600">
                      <Camera className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Tap to capture / Upload
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">Take photo or upload image</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              {photoUrl && (
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Photo added</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="px-2.5 py-1 text-[11px] font-bold uppercase text-rose-700 border border-rose-300 bg-rose-50 hover:bg-rose-100"
                  >
                    Remove Photo
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Prominent "Save Medicine" Button */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setProductName('');
                setBatchNumber('');
                setPackBuyPrice('');
                setPackSalePrice('');
                setUnitSalePrice('');
                setExpiryDate('');
                setPhotoUrl('');
              }}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Clear Form
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 shadow-xs flex items-center gap-2"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Save Medicine</span>
            </button>
          </div>
        </form>
      </div>

      {/* Quick Add Party Modal */}
      {showQuickPartyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-700 p-5 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-700" />
                <span>Add New Supplier (Party)</span>
              </h3>
              <button
                onClick={() => setShowQuickPartyModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-mono text-xs"
              >
                [ESC]
              </button>
            </div>

            <form onSubmit={handleQuickAddParty} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Supplier / Agency Name *
                </label>
                <input
                  type="text"
                  required
                  value={quickPartyName}
                  onChange={(e) => setQuickPartyName(e.target.value)}
                  placeholder="e.g. Mankind Pharma Regional Depot"
                  className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={quickPartyContact}
                  onChange={(e) => setQuickPartyContact(e.target.value)}
                  placeholder="e.g. +91 98102 77665"
                  className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Shop or Office Address
                </label>
                <input
                  type="text"
                  value={quickPartyAddress}
                  onChange={(e) => setQuickPartyAddress(e.target.value)}
                  placeholder="e.g. Industrial Area Phase IV, Gurugram"
                  className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuickPartyModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
