import React, { useState } from 'react';
import {
  TrendingUp,
  X,
  Banknote,
  QrCode,
  Calendar,
  Clock,
  User,
  FileText,
  DollarSign,
  Tag,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IncomeCategory } from '../../types/pos';

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const incomeCategoryLabels: Record<IncomeCategory, string> = {
  sales: 'รายรับจากการขายสินค้าหน้าร้าน',
  debt_collection: 'รับชำระหนี้ค้าง (ลูกหนี้)',
  service: 'ค่าบริการ / ค่าจัดส่ง',
  interest: 'ดอกเบี้ย / เงินปันผล',
  other: 'รายรับอื่นๆ',
};

export const IncomeModal: React.FC<IncomeModalProps> = ({ isOpen, onClose }) => {
  const { recordIncome, currency, currentUser, showToast } = useApp();

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'other' as IncomeCategory,
    date: todayStr,
    time: timeStr,
    paymentMethod: 'cash' as 'cash' | 'transfer',
    referenceId: '',
    note: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(formData.amount);
    if (!formData.title.trim() || isNaN(numAmount) || numAmount <= 0) {
      showToast('กรุณาระบุชื่อรายการและจำนวนเงินที่ถูกต้อง', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      await recordIncome({
        title: formData.title.trim(),
        amount: numAmount,
        category: formData.category,
        categoryName: incomeCategoryLabels[formData.category] || formData.category,
        date: formData.date,
        time: formData.time,
        paymentMethod: formData.paymentMethod,
        referenceId: formData.referenceId.trim(),
        note: formData.note.trim(),
        isFromSales: formData.category === 'sales',
      });
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-emerald-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">บันทึกรายการรายรับใหม่ (Add Income)</h3>
              <p className="text-[11px] text-slate-500">บันทึกข้อมูลรายรับเข้าสู่ระบบบัญชี</p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              หมวดหมู่รายรับ <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(incomeCategoryLabels) as IncomeCategory[]).map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setFormData({ ...formData, category: cat })}
                  className={`p-2 rounded-xl text-xs font-medium text-left border transition cursor-pointer truncate ${
                    formData.category === cat
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title={incomeCategoryLabels[cat]}
                >
                  {cat === 'sales' && '🛒 '}
                  {cat === 'debt_collection' && '🤝 '}
                  {cat === 'service' && '🚚 '}
                  {cat === 'interest' && '📈 '}
                  {cat === 'other' && '💰 '}
                  {incomeCategoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ชื่อรายการ / รายละเอียดรายรับ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น รับเงินค่าจัดส่งสินค้า, เงินปันผล, ขายเศษกล่องกระดาษ"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:bg-white focus:border-emerald-600 transition"
            />
          </div>

          {/* Amount & Currency */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              จำนวนเงินที่ได้รับ ({currency}) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">
                <DollarSign className="w-4 h-4" />
              </span>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2.5 text-base font-bold text-emerald-700 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 font-mono"
              />
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                วันที่ทำรายการ <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">เวลาทำรายการ</label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ช่องทางรับเงิน</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: 'cash' })}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                  formData.paymentMethod === 'cash'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>เงินสด (Cash)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: 'transfer' })}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                  formData.paymentMethod === 'transfer'
                    ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>เงินโอน / QR Code</span>
              </button>
            </div>
          </div>

          {/* Reference Document */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              เลขที่เอกสารอ้างอิง / ใบเสร็จ <span className="text-slate-400 font-normal">(ถ้ามี)</span>
            </label>
            <input
              type="text"
              placeholder="เช่น REC-202611-001 หรือ เลขที่สลิปโอน"
              value={formData.referenceId}
              onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              หมายเหตุเพิ่มเติม <span className="text-slate-400 font-normal">(ไม่บังคับ)</span>
            </label>
            <textarea
              rows={2}
              placeholder="รายละเอียดบันทึกความจำ..."
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden resize-none"
            />
          </div>

          {/* Footer Info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>ผู้บันทึก: <strong className="text-slate-700">{currentUser?.displayName || 'เจ้าหน้าที่'}</strong></span>
            </span>
            <span className="text-[10px] text-slate-400">ระบบบันทึกเวลาจริงอัตโนมัติ</span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <TrendingUp className="w-4 h-4" />
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรายรับ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
