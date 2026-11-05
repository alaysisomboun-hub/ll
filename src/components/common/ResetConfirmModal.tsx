import React from 'react';
import { RotateCcw, X, AlertTriangle } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  detailBadge?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'ยืนยันการรีเซ็ต',
  description = 'คุณต้องการรีเซ็ตข้อมูลที่กำลังใช้งานหรือไม่? ข้อมูลที่ยังไม่ได้บันทึกอาจสูญหาย',
  detailBadge,
  confirmLabel = 'ยืนยันรีเซ็ต',
  cancelLabel = 'ยกเลิก',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-slate-200/90 space-y-4">
        {/* Icon & Close */}
        <div className="flex items-start justify-between">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <span>{title}</span>
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">{description}</p>

          {detailBadge && (
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/70">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{detailBadge}</span>
              </span>
            </div>
          )}
        </div>

        {/* Notice: Safety guarantee */}
        <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2.5">
          * ระบบจะรีเซ็ตเฉพาะข้อมูลชั่วคราวในหน้านี้ โดยไม่ลบประวัติการขายหรือฐานข้อมูลจริง
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
