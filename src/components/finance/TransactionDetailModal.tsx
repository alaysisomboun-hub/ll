import React from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  User,
  CreditCard,
  Tag,
  FileText,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export interface UnifiedTransactionItem {
  id: string;
  type: 'income' | 'expense';
  title: string;
  amount: number;
  category: string;
  categoryLabel: string;
  date: string;
  time?: string;
  paymentMethod: 'cash' | 'transfer';
  referenceId?: string;
  recordedBy: string;
  note?: string;
  createdAt: string;
  source: 'manual_income' | 'sale' | 'expense';
}

interface TransactionDetailModalProps {
  item: UnifiedTransactionItem | null;
  onClose: () => void;
  onDelete?: (item: UnifiedTransactionItem) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  item,
  onClose,
  onDelete,
}) => {
  const { currency, currentUser } = useApp();

  if (!item) return null;

  const isIncome = item.type === 'income';
  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 px-6 border-b ${
            isIncome ? 'bg-emerald-50/60 border-emerald-100' : 'bg-rose-50/60 border-rose-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-xs ${
                isIncome ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {isIncome ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {isIncome ? 'รายการรายรับ (Income)' : 'รายการรายจ่าย (Expense)'}
              </span>
              <h3 className="font-bold text-slate-800 text-base mt-0.5">{item.title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Amount Hero */}
          <div className="text-center p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-xs text-slate-500 font-medium">จำนวนเงิน</span>
            <p
              className={`text-3xl font-extrabold mt-1 font-mono ${
                isIncome ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {isIncome ? '+' : '-'}{formatCurrency(item.amount, currency)}
            </p>
            <span className="inline-block mt-1 text-[11px] font-semibold text-slate-500">
              ช่องทาง: {item.paymentMethod === 'cash' ? '💵 เงินสด' : '📱 เงินโอน/QR'}
            </span>
          </div>

          {/* Details list */}
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">หมวดหมู่:</span>
              <span className="font-semibold text-slate-800">{item.categoryLabel}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">วันที่ทำรายการ:</span>
              <span className="font-semibold text-slate-800 font-mono">
                {item.date} {item.time ? `(${item.time} น.)` : ''}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">เอกสารอ้างอิง:</span>
              <span className="font-semibold text-slate-800 font-mono">
                {item.referenceId ? `#${item.referenceId}` : '-'}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">ผู้บันทึกรายการ:</span>
              <span className="font-semibold text-slate-800">{item.recordedBy || 'ระบบ'}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">วันเวลาสร้างข้อมูล:</span>
              <span className="text-slate-600 font-mono text-[11px]">
                {formatDateTime(item.createdAt)}
              </span>
            </div>

            {item.note && (
              <div className="pt-1">
                <span className="text-slate-500 block mb-1">หมายเหตุ:</span>
                <p className="p-2.5 bg-slate-50 rounded-xl text-slate-700 leading-relaxed text-xs">
                  {item.note}
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-between gap-2">
            {isAdminOrOwner && onDelete && item.source !== 'sale' && (
              <button
                type="button"
                onClick={() => {
                  onDelete(item);
                  onClose();
                }}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>ลบรายการนี้</span>
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
