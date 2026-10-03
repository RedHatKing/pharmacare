import React, { useState, useEffect } from 'react';
import { Product } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { X, Save, Upload, Image as ImageIcon, Trash2, Package } from 'lucide-react';

interface EditProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  const { parties, updateProduct, settings } = useInventory();

  const [formData, setFormData] = useState({
    name: '',
    partyName: '',
    partyId: '',
    manufacturer: '',
    invoiceDate: '',
    purchaseRate: 0,
    sellingRate: 0,
    batchNumber: '',
    expiryDate: '',
    stockQuantity: 0,
    minimumStockLevel: 15,
    photoUrl: '',
    category: '',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        partyName: product.partyName || '',
        partyId: product.partyId || '',
        manufacturer: product.manufacturer || '',
        invoiceDate: product.invoiceDate || '',
        purchaseRate: product.purchaseRate || 0,
        sellingRate: product.sellingRate || 0,
        batchNumber: product.batchNumber || '',
        expiryDate: product.expiryDate || '',
        stockQuantity: product.stockQuantity || 0,
        minimumStockLevel: product.minimumStockLevel !== undefined ? product.minimumStockLevel : 15,
        photoUrl: product.photoUrl || '',
        category: product.category || '',
      });
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const handlePartyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const foundParty = parties.find((p) => p.id === selectedId);
    setFormData((prev) => ({
      ...prev,
      partyId: selectedId,
      partyName: foundParty ? foundParty.name : prev.partyName,
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    updateProduct(product.id, {
      ...formData,
      purchaseRate: Number(formData.purchaseRate),
      sellingRate: Number(formData.sellingRate),
      stockQuantity: Number(formData.stockQuantity),
      minimumStockLevel: Number(formData.minimumStockLevel) || 15,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-700 flex flex-col my-auto max-h-[92vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 shrink-0">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Package className="w-4 h-4 text-emerald-700" />
              <span>Edit Medicine Details</span>
            </h2>
            <p className="text-[10.5px] font-mono text-slate-500 mt-0.5">
              Medicine ID: {product.id} · Batch: {product.batchNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-mono text-xs"
          >
            [ESC]
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Product Name */}
            <div className="md:col-span-2">
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Medicine Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            {/* Manufacturer */}
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Company / Manufacturer *
              </label>
              <input
                type="text"
                required
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            {/* Party Name */}
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Supplier (Party) *
              </label>
              <select
                value={formData.partyId}
                onChange={handlePartyChange}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              >
                <option value="">Select Supplier</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Number */}
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Batch Number *
              </label>
              <input
                type="text"
                required
                value={formData.batchNumber}
                onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value.toUpperCase() })}
                className="w-full px-2.5 py-1.5 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Expiry Date *
              </label>
              <input
                type="date"
                required
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            {/* Invoice Date */}
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Bill / Purchase Date
              </label>
              <input
                type="date"
                value={formData.invoiceDate}
                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            {/* Stock Quantity */}
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Quantity In Stock (Units) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.stockQuantity}
                onChange={(e) => setFormData({ ...formData, stockQuantity: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            {/* Minimum Stock Level (Reorder Point) */}
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Reorder Alert Level (Units) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.minimumStockLevel}
                onChange={(e) => setFormData({ ...formData, minimumStockLevel: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            {/* Purchase Rate */}
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Buy Price ({settings.currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.purchaseRate}
                onChange={(e) => setFormData({ ...formData, purchaseRate: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            {/* Selling Rate */}
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Sale Price / MRP ({settings.currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.sellingRate}
                onChange={(e) => setFormData({ ...formData, sellingRate: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            {/* Photo Upload */}
            <div className="md:col-span-2">
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Medicine Photo (Optional)
              </label>
              <div className="flex items-center gap-3">
                {formData.photoUrl ? (
                  <div className="relative w-16 h-16 border border-slate-300 dark:border-slate-700 shrink-0">
                    <img src={formData.photoUrl} alt="Product" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, photoUrl: '' })}
                      className="absolute top-0 right-0 p-0.5 bg-rose-700 text-white hover:bg-rose-800"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 border border-dashed border-slate-400 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-200">
                  <Upload className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{formData.photoUrl ? 'Replace Photo' : 'Upload Photo'}</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
