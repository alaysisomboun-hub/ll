import React, { useState } from 'react';
import {
  RotateCcw,
  X,
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  Database,
  Calendar,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';

interface FinanceResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSummary: {
    totalRevenue: number;
    totalOperatingExpenses: number;
    netProfit: number;
    cashBalance: number;
    transferBalance: number;
    salesCount: number;
    expensesCount: number;
  };
}

export const FinanceResetModal: React.FC<FinanceResetModalProps> = ({
  isOpen,
  onClose,
  currentSummary,
}) => {
  const { recordFinanceReset, currency, currentUser, showToast } = useApp();

  const [reason, setReason] = useState('ตัดรอบบัญชีสิ้นงวดประจำเดือน และเริ่มรอบใหม่');
  const [periodLabel, setPeriodLabel] = useState(`รอบสิ้นสุด ณ วันที่ ${new Date().toISOString().split('T')[0]}`);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrOwner) {
      showToast('เฉพาะผู้ดูแลระบบ (Admin) หรือ เจ้าของร้านเท่านั้นที่สามารถรีเซ็ตรอบบัญชีได้', 'error');
      return;
    }
    if (!reason.trim()) {
      showToast('กรุณาระบุเหตุผลการรีเซ็ตรอบการเงิน', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      await recordFinanceReset(reason.trim(), periodLabel.trim());
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-amber-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">รีเซ็ตรอบการเงิน (Admin Finance Reset)</h3>
              <p className="text-[11px] text-slate-500">บันทึก Checkpoint และเริ่มนับรอบการเงินใหม่เป็น 0</p>
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

        {/* Security / Permission Notice */}
        {!isAdminOrOwner ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800">ไม่มีสิทธิ์ดำเนินการ (Admin Only)</h4>
            <p className="text-xs text-slate-500">
              การรีเซ็ตรอบบัญชีและการเงินต้องใช้สิทธิ์ของ <strong>Admin</strong> หรือ <strong>Owner</strong> เท่านั้น
            </p>
            <button
              onClick={onClose}
              className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
            {/* Safety Guarantee Banner */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-900">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">รับประกันความปลอดภัยข้อมูล 100%</p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  ระบบจะบันทึกสำรองยอดสะสมทั้งหมดก่อนรีเซ็ต (Snapshot) และไม่ลบประวัติการขาย, บิลรายจ่าย, ลูกหนี้, สินค้า หรือสต็อกในฐานข้อมูล สามารถเปิดดูย้อนหลังได้ตลอดเวลา
                </p>
              </div>
            </div>

            {/* Snapshot Preview Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                ยอดสรุปที่จะถูกบันทึกสำรอง (Pre-reset Snapshot):
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                  <span className="text-slate-400 text-[10px] block">รายรับรวมในรอบนี้:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {formatCurrency(currentSummary.totalRevenue, currency)}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                  <span className="text-slate-400 text-[10px] block">รายจ่ายรวมในรอบนี้:</span>
                  <span className="font-bold text-rose-700 text-sm">
                    {formatCurrency(currentSummary.totalOperatingExpenses, currency)}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                  <span className="text-slate-400 text-[10px] block">กำไรสุทธิในรอบนี้:</span>
                  <span className="font-bold text-indigo-700 text-sm">
                    {formatCurrency(currentSummary.netProfit, currency)}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                  <span className="text-slate-400 text-[10px] block">ยอดเงินสดในลิ้นชัก:</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatCurrency(currentSummary.cashBalance, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Period Label */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อรอบ / งวดบัญชีที่บันทึกสำรอง <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="เช่น ปิดงวดเดือน พฤศจิกายน 2026 หรือ ปิดรอบไตรมาส 4"
                className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-amber-600"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เหตุผลหรือวัตถุประสงค์ในการรีเซ็ต <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ระบุเหตุผล เช่น สิ้นสุดรอบเดือน, ตรวจนับบัญชีประจำงวด, สรุปยอดเพื่อจ่ายปันผล..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-amber-600 resize-none"
              />
            </div>

            {/* Warning Text */}
            <p className="text-[11px] text-amber-800 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200">
              * หลังการยืนยัน ยอดสรุปการเงินของ "รอบปัจจุบัน" จะเริ่มต้นนับจาก 0 โดยคุณสามารถสลับไปดูประวัติย้อนหลังทั้งหมดได้ทุกเมื่อผ่านปุ่มตัวกรองมุมบน
            </p>

            {/* Buttons */}
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
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isSubmitting ? 'กำลังบันทึก Checkpoint...' : 'ยืนยันรีเซ็ตรอบการเงิน'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
