import React, { useState } from 'react';
import {
  Settings,
  Store,
  DollarSign,
  Globe,
  Receipt,
  Sparkles,
  Database,
  Save,
  CheckCircle,
  AlertTriangle,
  Cloud,
  Server,
  RefreshCw,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StoreSettings } from '../../types/pos';
import { Language } from '../../utils/translations';
import { testConnection } from '../../firebase';
import { ResetConfirmModal } from '../common/ResetConfirmModal';
import firebaseConfig from '../../../firebase-applet-config.json';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    currency,
    setCurrency,
    language,
    setLanguage,
    seedDemoData,
    products,
    showToast,
  } = useApp();

  const [formData, setFormData] = useState<StoreSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTestingFirebase, setIsTestingFirebase] = useState<boolean>(false);
  const [isResetSettingsModalOpen, setIsResetSettingsModalOpen] = useState<boolean>(false);

  // Reset form to latest saved settings in database
  const handleResetSettings = () => {
    setFormData({ ...settings });
    showToast('รีเซ็ตข้อมูลในแบบฟอร์มการตั้งค่ากลับสู่ค่าที่บันทึกไว้ล่าสุดแล้ว', 'info');
  };

  const handleTestFirebase = async () => {
    setIsTestingFirebase(true);
    try {
      await testConnection();
      showToast('Kết nối Firebase Firestore thành công! (Firebase Connected & Live)', 'success');
    } catch {
      showToast('Không thể kết nối với Firebase. Vui lòng kiểm tra lại mạng.', 'error');
    } finally {
      setIsTestingFirebase(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateSettings(formData);
      setIsSaving(false);
    } catch (err) {
      setIsSaving(false);
      console.error(err);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">ตั้งค่าระบบร้านค้า (System Settings)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            กำหนดข้อมูลร้านค้า สกุลเงิน ภาษา รูปแบบใบเสร็จ และการจัดการข้อมูล
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsResetSettingsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200/90 hover:border-amber-300 text-xs md:text-sm font-semibold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
            title="คืนค่าการตั้งค่าหน้าจอและแบบฟอร์มเป็นค่าเริ่มต้น"
          >
            <RotateCcw className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
            <span>รีเซ็ตการตั้งค่า</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs md:text-sm font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Store Profile */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Store className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-800">ข้อมูลทั่วไปของร้านค้า (Store Profile)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อร้านค้า (Store Name) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">สโลแกน / คำขวัญร้าน</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เบอร์โทรศัพท์ติดต่อ
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เลขประจำตัวผู้เสียภาษี (Tax ID)
              </label>
              <input
                type="text"
                value={formData.taxId || ''}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ที่อยู่ร้านค้า (แสดงบนหัวใบเสร็จรับเงิน)
              </label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Currency & Language */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Globe className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-800">สกุลเงินและภาษา (Currency & Language)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                สกุลเงินหลักที่ใช้งาน
              </label>
              <select
                value={formData.currency}
                onChange={(e) => {
                  const val = e.target.value as 'LAK' | 'THB' | 'USD';
                  setFormData({ ...formData, currency: val });
                  setCurrency(val);
                }}
                className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              >
                <option value="THB">บาทไทย (฿ THB)</option>
                <option value="LAK">กีบลาว (₭ LAK)</option>
                <option value="USD">ดอลลาร์สหรัฐ ($ USD)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ภาษาที่แสดงผลในระบบ
              </label>
              <select
                value={formData.language}
                onChange={(e) => {
                  const val = e.target.value as Language;
                  setFormData({ ...formData, language: val });
                  setLanguage(val);
                }}
                className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              >
                <option value="th">ภาษาไทย (Thai)</option>
                <option value="lo">ພາສາລາວ (Lao)</option>
                <option value="vi">Tiếng Việt (Vietnamese)</option>
                <option value="en">English (US)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tax and VAT Settings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-800">การคำนวณภาษีมูลค่าเพิ่ม (VAT & Tax)</h3>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="taxToggle"
              checked={formData.isTaxEnabled}
              onChange={(e) => setFormData({ ...formData, isTaxEnabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded-xs"
            />
            <label htmlFor="taxToggle" className="text-xs font-semibold text-slate-700">
              เปิดใช้งานการคำนวณภาษีมูลค่าเพิ่มในบิลขาย POS
            </label>
          </div>

          {formData.isTaxEnabled && (
            <div className="w-48">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                อัตราภาษีมูลค่าเพิ่ม (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="any"
                value={formData.taxRatePercent}
                onChange={(e) => setFormData({ ...formData, taxRatePercent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              />
            </div>
          )}
        </div>

        {/* Receipt Customizer */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Receipt className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-sm text-slate-800">รูปแบบใบเสร็จรับเงิน (Thermal Receipt)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ขนาดกระดาษความร้อน
              </label>
              <select
                value={formData.paperWidth}
                onChange={(e) => setFormData({ ...formData, paperWidth: e.target.value as any })}
                className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              >
                <option value="80mm">กระดาษ 80 มม. (มาตรฐานสลิปใหญ่)</option>
                <option value="58mm">กระดาษ 58 มม. (สลิปเล็กกระทัดรัด)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ข้อความท้ายใบเสร็จรับเงิน (Footer Message)
              </label>
              <input
                type="text"
                value={formData.receiptFooterMessage}
                onChange={(e) => setFormData({ ...formData, receiptFooterMessage: e.target.value })}
                className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Database & Demo Data Tool */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Database className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-sm text-slate-800">ฐานข้อมูลและข้อมูลตัวอย่าง (Database & Seeder)</h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-purple-50/60 border border-purple-200 rounded-xl text-xs text-purple-900">
            <div>
              <p className="font-bold">ข้อมูลตัวอย่างร้านค้าขายส่ง-ขายปลีก</p>
              <p className="text-[11px] text-purple-700">
                ปัจจุบันมีสินค้าในระบบ {products.length} รายการ
              </p>
            </div>

            <button
              type="button"
              onClick={seedDemoData}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
            >
              <Sparkles className="w-4 h-4" />
              โหลดข้อมูลตัวอย่างเริ่มต้น
            </button>
          </div>
        </div>

        {/* Firebase Cloud Connection Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  สถานะการเชื่อมต่อ Firebase (Firebase Cloud Connection)
                </h3>
                <p className="text-xs text-slate-500">
                  ข้อมูลถูกจัดเก็บและซิงค์แบบเรียลไทม์บน Google Cloud Firestore
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                เชื่อมต่อคลาวด์แล้ว (Connected)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Server className="w-3.5 h-3.5 text-blue-600" />
                <span>Firebase Project ID</span>
              </div>
              <p className="font-mono text-xs font-bold text-slate-800 truncate">
                {firebaseConfig.projectId}
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-purple-600" />
                <span>Firestore Database ID</span>
              </div>
              <p className="font-mono text-xs font-bold text-slate-800 truncate" title={firebaseConfig.firestoreDatabaseId}>
                {firebaseConfig.firestoreDatabaseId}
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Security Rules & Auth</span>
              </div>
              <p className="font-mono text-xs font-bold text-slate-800 truncate">
                RBAC Active • Deployed
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <p className="text-[11px] text-slate-500">
              Collections: <span className="font-mono text-slate-700 font-semibold">products, categories, sales, customers, suppliers, expenses, users, settings</span>
            </p>

            <button
              type="button"
              onClick={handleTestFirebase}
              disabled={isTestingFirebase}
              className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingFirebase ? 'animate-spin' : ''}`} />
              <span>{isTestingFirebase ? 'กำลังตรวจสอบ...' : 'ทดสอบการเชื่อมต่อสด (Test Connection)'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* RESET SETTINGS CONFIRMATION MODAL */}
      <ResetConfirmModal
        isOpen={isResetSettingsModalOpen}
        onClose={() => setIsResetSettingsModalOpen(false)}
        onConfirm={handleResetSettings}
        title="ยืนยันการรีเซ็ต"
        description="คุณต้องการรีเซ็ตข้อมูลที่กำลังใช้งานหรือไม่? ข้อมูลที่ยังไม่ได้บันทึกอาจสูญหาย"
        confirmLabel="ยืนยันรีเซ็ต"
      />
    </div>
  );
};
