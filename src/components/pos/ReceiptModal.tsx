import React, { useRef } from 'react';
import { Printer, X, CheckCircle, Share2, Download } from 'lucide-react';
import { Sale, StoreSettings } from '../../types/pos';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';

interface ReceiptModalProps {
  sale: Sale | null;
  settings: StoreSettings;
  currency: 'LAK' | 'THB' | 'USD';
  onClose: () => void;
  onNewSale: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  settings,
  currency,
  onClose,
  onNewSale,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { systemNames } = useApp();

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const isWidth58 = settings.paperWidth === '58mm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      {/* Hide surrounding UI during actual window.print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-thermal-receipt, #printable-thermal-receipt * {
            visibility: visible;
          }
          #printable-thermal-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm">การขายสำเร็จ • ใบเสร็จรับเงิน</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thermal Receipt Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center custom-scrollbar">
          <div
            ref={printRef}
            id="printable-thermal-receipt"
            className={`bg-white p-5 border border-slate-300 shadow-md font-mono text-slate-800 text-xs transition-all ${
              isWidth58 ? 'w-[280px]' : 'w-[340px]'
            }`}
          >
            {/* Store Header */}
            <div className="text-center pb-3 border-b border-dashed border-slate-400 space-y-1">
              <h2 className="text-sm font-bold tracking-tight text-black">{settings.storeName}</h2>
              <div className="text-[11px] font-bold text-slate-800 bg-slate-100 py-0.5 rounded">
                {systemNames?.documents?.receipt || 'ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ'}
              </div>
              {settings.tagline && <p className="text-[10px] text-slate-600">{settings.tagline}</p>}
              <p className="text-[10px] text-slate-600 leading-snug">{settings.address}</p>
              <p className="text-[10px] text-slate-600">โทร: {settings.phone}</p>
              {settings.taxId && (
                <p className="text-[10px] text-slate-600">เลขประจำตัวผู้เสียภาษี: {settings.taxId}</p>
              )}
            </div>

            {/* Bill Details */}
            <div className="py-2.5 text-[11px] space-y-1 border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span>เลขที่บิล:</span>
                <span className="font-bold">{sale.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>วันที่-เวลา:</span>
                <span>{formatDateTime(sale.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>พนักงานขาย:</span>
                <span>{sale.cashierName || 'แคชเชียร์'}</span>
              </div>
              <div className="flex justify-between">
                <span>ลูกค้า:</span>
                <span>{sale.customerName || 'ลูกค้าทั่วไป'}</span>
              </div>
              <div className="flex justify-between">
                <span>ประเภทการขาย:</span>
                <span className="font-bold uppercase">
                  {sale.saleType === 'wholesale'
                    ? (systemNames?.productTypes?.wholesale || 'ขายส่ง (Wholesale)')
                    : (systemNames?.productTypes?.retail || 'ขายปลีก (Retail)')}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="py-2 border-b border-dashed border-slate-400">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300 pb-1 text-[10px] uppercase font-bold">
                    <th className="py-1">รายการ</th>
                    <th className="py-1 text-center">จำนวน</th>
                    <th className="py-1 text-right">ราคา</th>
                    <th className="py-1 text-right">รวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dotted divide-slate-200">
                  {sale.items && sale.items.map((item, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="py-1.5 pr-1">
                        <div className="font-semibold text-slate-900 leading-tight">{item.productName}</div>
                        {item.priceTier === 'wholesale' && (
                          <span className="text-[9px] text-blue-600 bg-blue-50 px-1 rounded-xs">ราคาส่ง</span>
                        )}
                      </td>
                      <td className="py-1.5 text-center text-slate-700 whitespace-nowrap">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-1.5 text-right text-slate-700 whitespace-nowrap">
                        {formatCurrency(item.unitPrice, currency)}
                      </td>
                      <td className="py-1.5 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(item.totalPrice, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations & Totals */}
            <div className="py-2.5 space-y-1 text-[11px] border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span>ยอดรวมสินค้า:</span>
                <span>{formatCurrency(sale.subtotal, currency)}</span>
              </div>
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>ส่วนลดบิล:</span>
                  <span>-{formatCurrency(sale.discountAmount, currency)}</span>
                </div>
              )}
              {sale.taxAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>ภาษีมูลค่าเพิ่ม (VAT):</span>
                  <span>{formatCurrency(sale.taxAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-sm font-bold border-t border-slate-300">
                <span>ยอดสุทธิ:</span>
                <span className="text-base text-black">{formatCurrency(sale.totalAmount, currency)}</span>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="py-2 space-y-1 text-[11px] border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span>วิธีชำระ:</span>
                <span className="font-semibold uppercase">
                  {sale.paymentMethod === 'cash'
                    ? 'เงินสด'
                    : sale.paymentMethod === 'transfer'
                    ? 'เงินโอน / PromptPay'
                    : 'สินเชื่อ / ค้างชำระ'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>จำนวนเงินที่ชำระ:</span>
                <span>{formatCurrency(sale.amountPaid, currency)}</span>
              </div>
              {sale.changeGiven > 0 && (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>เงินทอน:</span>
                  <span>{formatCurrency(sale.changeGiven, currency)}</span>
                </div>
              )}
              {sale.debtAmount > 0 && (
                <div className="flex justify-between font-bold text-amber-700">
                  <span>ยอดค้างชำระ (หนี้):</span>
                  <span>{formatCurrency(sale.debtAmount, currency)}</span>
                </div>
              )}
            </div>

            {/* Barcode & Footer Message */}
            <div className="text-center pt-3 space-y-2">
              <p className="text-[10px] text-slate-600">
                {settings.receiptFooterMessage || 'ขอบพระคุณที่ใช้บริการ'}
              </p>
              {/* Simulated Barcode */}
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center space-x-[2px] h-9">
                  {Array.from({ length: 32 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full ${
                        (i * 7) % 3 === 0 ? 'w-1 bg-black' : (i * 5) % 2 === 0 ? 'w-0.5 bg-black' : 'w-1 bg-transparent'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[9px] tracking-widest text-slate-500 font-mono mt-0.5">
                  *{sale.invoiceNumber}*
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={onNewSale}
            className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs md:text-sm transition text-center"
          >
            เปิดบิลใหม่
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs md:text-sm transition shadow-sm"
          >
            <Printer className="w-4 h-4" />
            พิมพ์ใบเสร็จ
          </button>
        </div>
      </div>
    </div>
  );
};
