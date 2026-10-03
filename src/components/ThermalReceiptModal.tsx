import React from 'react';
import { Bill, StoreSettings } from '../types/inventory';
import { Printer, Check, FileText } from 'lucide-react';

interface ThermalReceiptModalProps {
  bill: Bill;
  settings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  bill,
  settings,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // Date & Time formatting matching reference receipt:
  // e.g. "Sunday, June 28, 2020" and "3:52:34 pm"
  const billDate = new Date(bill.date);
  const isValidDate = !isNaN(billDate.getTime());
  const effectiveDate = isValidDate ? billDate : new Date();

  const formattedDateString = effectiveDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTimeString = effectiveDate
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
    .toLowerCase();

  // Invoice / Token number e.g. "No 4"
  const invoiceNumOnly = bill.invoiceNumber
    ? bill.invoiceNumber.replace(/^[^\d]*/, '').replace(/^0+/, '') || '1'
    : '1';

  const totalProducts = bill.items.length;
  const totalItems = bill.items.reduce((acc, curr) => acc + (Number(curr.quantity) || 1), 0);

  const handleCopyText = () => {
    const textReceipt = `
========================================
${(settings.storeName || 'AHMED INTERNATIONAL HOSPITAL').toUpperCase()}
${(settings.address || 'LAHORE PAKISTAN').toUpperCase()}
${settings.phone || '03131881100'}

No ${invoiceNumOnly}
1   ${bill.customerName ? bill.customerName : 'Cash Customer'}
${formattedDateString}    ${formattedTimeString}
----------------------------------------
Sr Product             Qty   Price  Total
----------------------------------------
${bill.items
  .map(
    (i, idx) =>
      `${String(idx + 1).padEnd(2)} ${i.productName.substring(0, 18).padEnd(19)} ${String(i.quantity).padStart(3)} ${i.rate.toFixed(2).padStart(7)} ${i.total.toFixed(2).padStart(6)}`
  )
  .join('\n')}
----------------------------------------
Total Products ${totalProducts}  Total Items ${totalItems}  G.Tot: ${bill.grandTotal.toFixed(2)}
                              Net.Total: ${bill.grandTotal.toFixed(2)}
----------------------------------------
Bill: ${bill.grandTotal.toFixed(2)}
Paid: ${bill.grandTotal.toFixed(2)}

User  e
Software Provided by  Easy One Soft  03131881100

                THANKS
      ${(settings.storeName || 'AHMED INTERNATIONAL HOSPITAL').toUpperCase()}
========================================
    `.trim();

    navigator.clipboard.writeText(textReceipt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-700 flex flex-col my-auto max-h-[95vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wider">
            <Printer className="w-4 h-4 text-emerald-700" />
            <span>Customer Bill Slip (80mm Thermal)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
              title="Copy receipt as text"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <FileText className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-mono text-xs"
            >
              [ESC]
            </button>
          </div>
        </div>

        {/* Modal Body: Thermal Paper simulation */}
        <div className="p-5 overflow-y-auto bg-slate-200 dark:bg-slate-950 flex justify-center">
          <div
            id="printable-slip"
            className="w-[80mm] max-w-[80mm] bg-white text-black p-3.5 text-[10px] leading-tight select-none border border-slate-300 shadow-md font-sans print:border-none print:shadow-none print:w-full print:p-0"
          >
            {/* 1. Header & Store Branding (Centered) */}
            <div className="text-center mb-3">
              <h1 className="font-extrabold text-[13px] uppercase tracking-wide leading-tight text-black">
                {settings.storeName || 'AHMED INTERNATIONAL HOSPITAL'}
              </h1>
              <p className="text-[10px] uppercase font-bold leading-tight mt-0.5 text-black">
                {settings.address || 'LAHORE PAKISTAN'}
              </p>
              <p className="text-[10px] font-bold leading-tight mt-0.5 text-black">
                {settings.phone || '03131881100'}
              </p>
            </div>

            {/* Invoice & Customer Meta Info (Left-aligned) */}
            <div className="mb-2 text-[10px] font-semibold text-black space-y-0.5">
              <div>No {invoiceNumOnly}</div>
              <div className="flex items-center gap-4">
                <span>1</span>
                <span>{bill.customerName ? bill.customerName : 'Cash Customer'}</span>
              </div>
              <div className="flex justify-between items-center pt-0.5 text-[9.5px]">
                <span>{formattedDateString}</span>
                <span>{formattedTimeString}</span>
              </div>
            </div>

            {/* 2. Grid Table Layout (Strict solid black borders) */}
            <table className="w-full border-collapse border border-black text-black">
              <thead>
                <tr className="border-b border-black">
                  <th className="border-r border-black py-0.5 px-1 text-center font-bold text-[9.5px] w-6">Sr</th>
                  <th className="border-r border-black py-0.5 px-1.5 text-left font-bold text-[9.5px]">Product</th>
                  <th className="border-r border-black py-0.5 px-1 text-center font-bold text-[9.5px] w-7">Qty</th>
                  <th className="border-r border-black py-0.5 px-1 text-right font-bold text-[9.5px] w-12">Price</th>
                  <th className="py-0.5 px-1 text-right font-bold text-[9.5px] w-12">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-black">
                    <td className="border-r border-black py-0.5 px-1 text-center font-normal text-[9px] align-top">{idx + 1}</td>
                    <td className="border-r border-black py-0.5 px-1.5 text-left font-normal text-[9px] uppercase leading-snug align-top break-words">
                      {item.productName}
                    </td>
                    <td className="border-r border-black py-0.5 px-1 text-center font-normal text-[9px] align-top">{item.quantity}</td>
                    <td className="border-r border-black py-0.5 px-1 text-right font-normal text-[9px] tabular-nums align-top">{item.rate.toFixed(2)}</td>
                    <td className="py-0.5 px-1 text-right font-normal text-[9px] tabular-nums align-top">{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* Table Footer Summary Row 1: Total Products X | Total Items Y | G.Tot: [Amount] */}
                <tr className="border-b border-black">
                  <td colSpan={3} className="border-r border-black py-0.5 px-1 text-left font-normal text-[8.5px]">
                    Total Products <span className="font-bold mr-1.5">{totalProducts}</span> Total Items <span className="font-bold">{totalItems}</span>
                  </td>
                  <td colSpan={2} className="py-0.5 px-1 text-right font-bold text-[9.5px] tabular-nums">
                    G.Tot: {bill.grandTotal.toFixed(2)}
                  </td>
                </tr>
                {/* Table Footer Summary Row 2: Net.Total: [Amount] */}
                <tr>
                  <td colSpan={3} className="border-r border-black py-1 px-1"></td>
                  <td colSpan={2} className="py-0.5 px-1 text-right font-bold text-[10px] tabular-nums">
                    Net.Total: {bill.grandTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* 3. Payment Summary & Details */}
            <div className="mt-3.5 space-y-0.5 font-bold text-[10px] text-black">
              <div className="flex gap-1.5">
                <span>Bill:</span>
                <span>{bill.grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex gap-1.5">
                <span>Paid:</span>
                <span>{bill.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* User / Operator */}
            <div className="mt-2.5 text-[9.5px] text-black flex items-center gap-4">
              <span className="font-medium">User</span>
              <span className="font-medium">e</span>
            </div>

            {/* Software Provided by */}
            <div className="mt-2 text-[8.5px] text-black flex items-center justify-between font-normal">
              <span>Software Provided by</span>
              <span className="font-semibold">Easy One Soft</span>
              <span>03131881100</span>
            </div>

            {/* 4. Large centered closing note: THANKS followed by [STORE NAME] */}
            <div className="mt-5 mb-2 text-center text-black">
              <p className="text-[13px] tracking-widest font-serif uppercase">THANKS</p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wider leading-snug max-w-[220px] mx-auto">
                {settings.storeName || 'AHMED INTERNATIONAL HOSPITAL'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 shadow-xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
