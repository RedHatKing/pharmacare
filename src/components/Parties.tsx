import React, { useState, useMemo, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Party } from '../types/inventory';
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  FileBadge,
  Package,
  Pencil,
  Trash2,
  XCircle,
  X,
  CheckCircle2,
  Building2
} from 'lucide-react';

export const Parties: React.FC = () => {
  const { parties, products, addParty, updateParty, deleteParty, searchSuppliers } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Party[]>(parties);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contactNumber: '',
    email: '',
    dlNumber: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      contactNumber: '',
      email: '',
      dlNumber: '',
    });
    setEditingParty(null);
    setShowAddForm(false);
  };

  const handleOpenEdit = (party: Party) => {
    setEditingParty(party);
    setFormData({
      name: party.name,
      address: party.address,
      contactNumber: party.contactNumber,
      email: party.email || '',
      dlNumber: party.dlNumber || '',
    });
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim() || !formData.contactNumber.trim()) return;

    if (editingParty) {
      updateParty(editingParty.id, {
        name: formData.name.trim(),
        address: formData.address.trim(),
        contactNumber: formData.contactNumber.trim(),
        email: formData.email.trim() || undefined,
        dlNumber: formData.dlNumber.trim() || undefined,
      });
      setSuccessMessage(`Supplier "${formData.name}" updated successfully.`);
    } else {
      addParty({
        name: formData.name.trim(),
        address: formData.address.trim(),
        contactNumber: formData.contactNumber.trim(),
        email: formData.email.trim() || undefined,
        dlNumber: formData.dlNumber.trim() || undefined,
      });
      setSuccessMessage(`New supplier "${formData.name}" added successfully.`);
    }

    resetForm();
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Associated product batch counts
  const partyProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const prod of products) {
      if (prod.partyId) {
        counts[prod.partyId] = (counts[prod.partyId] || 0) + 1;
      } else if (prod.partyName) {
        const match = parties.find((p) => p.name.toLowerCase() === prod.partyName.toLowerCase());
        if (match) {
          counts[match.id] = (counts[match.id] || 0) + 1;
        }
      }
    }
    return counts;
  }, [products, parties]);

  useEffect(() => {
    let cancelled = false;

    const runSearch = async () => {
      const q = searchQuery.trim();
      if (!q) {
        setSearchResults(parties);
        return;
      }

      try {
        const matches = await searchSuppliers(q);
        if (!cancelled) {
          setSearchResults(matches.map((party: any) => ({
            id: party.id,
            name: party.name || '',
            address: party.address || '',
            contactNumber: party.contactNumber || party.phone || party.contact_person || '',
            email: party.email || undefined,
            dlNumber: party.dlNumber || party.dl_number || undefined,
            createdAt: party.createdAt || party.created_at || new Date().toISOString(),
          })));
        }
      } catch {
        if (!cancelled) {
          setSearchResults(
            parties.filter((p) => {
              const lower = q.toLowerCase();
              return (
                p.name.toLowerCase().includes(lower) ||
                p.contactNumber.toLowerCase().includes(lower) ||
                p.address.toLowerCase().includes(lower) ||
                (p.dlNumber && p.dlNumber.toLowerCase().includes(lower))
              );
            })
          );
        }
      }
    };

    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [parties, searchQuery, searchSuppliers]);

  const filteredParties = useMemo(() => searchResults, [searchResults]);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-700" />
            <span>Suppliers (Parties)</span>
          </h2>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            All companies and distributors you buy medicines from ({parties.length} saved)
          </p>
        </div>

        <button
          onClick={() => {
            if (showAddForm) {
              resetForm();
            } else {
              setEditingParty(null);
              setShowAddForm(true);
            }
          }}
          className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
            showAddForm
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-400 dark:border-slate-600'
              : 'bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800'
          }`}
        >
          {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{showAddForm ? 'Close Form' : 'Add Supplier'}</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Add / Edit Party Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-700 p-4 shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>{editingParty ? 'Edit Supplier Details' : 'Add New Supplier (Party)'}</span>
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 font-mono text-xs">
              [ESC]
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Party Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Supplier / Agency Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Type company or distributor name"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
                />
              </div>

              {/* Contact Number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.contactNumber}
                  onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                  placeholder="Type 10-digit phone or mobile number"
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="supplier@email.com"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
                />
              </div>

              {/* DL Number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Drug License Number (Optional)
                </label>
                <input
                  type="text"
                  value={formData.dlNumber}
                  onChange={(e) => setFormData({ ...formData, dlNumber: e.target.value })}
                  placeholder="e.g. DL-12345"
                  className="w-full px-2.5 py-1.5 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
                />
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Shop or Office Address *
                </label>
                <textarea
                  required
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address, area, city"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800"
              >
                {editingParty ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Type supplier name, phone, or address to search..."
          className="w-full pl-9 pr-8 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            title="Clear Search"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Saved Parties Cards */}
      {filteredParties.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-12 text-center">
          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            No suppliers found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {searchQuery ? `No supplier found matching "${searchQuery}".` : 'You have not added any suppliers yet. Click "Add Supplier" above.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredParties.map((party) => {
            const productCount = partyProductCounts[party.id] || 0;

            return (
              <div
                key={party.id}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:border-emerald-700 p-4 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs uppercase tracking-tight text-slate-900 dark:text-white truncate" title={party.name}>
                        {party.name}
                      </h4>
                      {party.dlNumber && (
                        <p className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                          <FileBadge className="w-3 h-3 text-slate-400" />
                          <span>DL: {party.dlNumber}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(party)}
                        className="p-1 border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-emerald-700 hover:border-emerald-700 transition-colors"
                        title="Edit Supplier"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPartyToDelete(party)}
                        className="p-1 border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-700 hover:border-rose-700 transition-colors"
                        title="Delete Supplier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="leading-tight text-[11px]">{party.address}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{party.contactNumber}</span>
                      </div>
                      <a
                        href={`tel:${party.contactNumber}`}
                        className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100"
                      >
                        Call
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Medicines Supplied:</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {productCount} {productCount === 1 ? 'medicine' : 'medicines'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {partyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-700 p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Delete Supplier?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              Are you sure you want to remove <strong className="text-slate-900 dark:text-white">{partyToDelete.name}</strong> from your suppliers list?
            </p>
            <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setPartyToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
              >
                No, Keep
              </button>
              <button
                onClick={() => {
                  deleteParty(partyToDelete.id);
                  setPartyToDelete(null);
                }}
                className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-rose-700 hover:bg-rose-800 border border-rose-800"
              >
                Yes, Delete Supplier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
