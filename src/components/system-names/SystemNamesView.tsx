import React, { useState, useMemo } from 'react';
import {
  Type,
  Search,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  ShieldCheck,
  Lock,
  Layers,
  FileText,
  Tag,
  CheckCircle2,
  Sliders,
  History,
  Eye,
  Menu as MenuIcon,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SystemNamesConfig, SystemNameItem } from '../../types/pos';
import { defaultSystemNames } from '../../utils/defaultSystemNames';
import { ResetConfirmModal } from '../common/ResetConfirmModal';
import { formatDateTime } from '../../utils/formatters';

type NameTab = 'menus' | 'categories' | 'units' | 'documents' | 'statuses' | 'alerts' | 'roles' | 'logs';

export const SystemNamesView: React.FC = () => {
  const {
    systemNames,
    updateSystemNames,
    resetSystemNamesToDefault,
    systemNameLogs,
    currentUser,
    showToast,
  } = useApp();

  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<NameTab>('menus');

  // Search
  const [search, setSearch] = useState<string>('');

  // Editable local state buffer (copy of systemNames)
  const [formData, setFormData] = useState<SystemNamesConfig>(() => ({
    menus: { ...defaultSystemNames.menus, ...(systemNames.menus || {}) },
    categories: { ...defaultSystemNames.categories, ...(systemNames.categories || {}) },
    productTypes: { ...defaultSystemNames.productTypes, ...(systemNames.productTypes || {}) },
    units: systemNames.units && systemNames.units.length > 0 ? [...systemNames.units] : [...defaultSystemNames.units],
    documents: { ...defaultSystemNames.documents, ...(systemNames.documents || {}) },
    statuses: { ...defaultSystemNames.statuses, ...(systemNames.statuses || {}) },
    alerts: { ...defaultSystemNames.alerts, ...(systemNames.alerts || {}) },
    roles: { ...defaultSystemNames.roles, ...(systemNames.roles || {}) },
  }));

  // Sync if systemNames from Firestore updates
  React.useEffect(() => {
    setFormData({
      menus: { ...defaultSystemNames.menus, ...(systemNames.menus || {}) },
      categories: { ...defaultSystemNames.categories, ...(systemNames.categories || {}) },
      productTypes: { ...defaultSystemNames.productTypes, ...(systemNames.productTypes || {}) },
      units: systemNames.units && systemNames.units.length > 0 ? [...systemNames.units] : [...defaultSystemNames.units],
      documents: { ...defaultSystemNames.documents, ...(systemNames.documents || {}) },
      statuses: { ...defaultSystemNames.statuses, ...(systemNames.statuses || {}) },
      alerts: { ...defaultSystemNames.alerts, ...(systemNames.alerts || {}) },
      roles: { ...defaultSystemNames.roles, ...(systemNames.roles || {}) },
    });
  }, [systemNames]);

  // Is saving
  const [isSaving, setIsSaving] = useState(false);

  // Confirm Reset Modal state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<{ id: string; name: string } | null>(null);

  // Add custom item modal
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customSection, setCustomSection] = useState<'units' | 'categories' | 'documents'>('units');

  // Handle label change in string dictionaries
  const handleLabelChange = (
    section: 'menus' | 'categories' | 'productTypes' | 'documents' | 'statuses' | 'alerts' | 'roles',
    key: string,
    value: string
  ) => {
    if (!isAdminOrOwner) return;
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  // Handle unit rename
  const handleUnitRename = (id: string, newName: string) => {
    if (!isAdminOrOwner) return;
    setFormData((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === id ? { ...u, name: newName } : u)),
    }));
  };

  // Toggle unit enable
  const handleToggleUnit = (id: string) => {
    if (!isAdminOrOwner) return;
    setFormData((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === id ? { ...u, isEnabled: !u.isEnabled } : u)),
    }));
  };

  // Delete unit
  const handleDeleteUnit = (id: string, name: string) => {
    if (!isAdminOrOwner) return;
    setUnitToDelete({ id, name });
  };

  // Add custom item
  const handleAddCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLabel.trim()) return;

    if (customSection === 'units') {
      const newId = 'u_' + Date.now();
      setFormData((prev) => ({
        ...prev,
        units: [
          ...prev.units,
          { id: newId, name: customLabel.trim(), isDefault: false, isEnabled: true },
        ],
      }));
      showToast(`เพิ่มหน่วยสินค้า "${customLabel}" สำเร็จ`, 'success');
    } else {
      const safeKey = customKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'custom_' + Date.now();
      setFormData((prev) => ({
        ...prev,
        [customSection]: {
          ...prev[customSection],
          [safeKey]: customLabel.trim(),
        },
      }));
      showToast(`เพิ่มข้อความกำหนดเองสำเร็จ`, 'success');
    }

    setCustomKey('');
    setCustomLabel('');
    setIsAddCustomOpen(false);
  };

  // Save all changes
  const handleSaveAll = async () => {
    if (!isAdminOrOwner) {
      showToast('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถบันทึกชื่อระบบได้', 'error');
      return;
    }
    try {
      setIsSaving(true);
      await updateSystemNames(formData, `อัปเดตข้อความในหมวด ${activeTab}`);
      setIsSaving(false);
    } catch (err) {
      setIsSaving(false);
      console.error(err);
    }
  };

  // Confirm Reset to Defaults
  const handleConfirmReset = async () => {
    try {
      await resetSystemNamesToDefault();
      setFormData({ ...defaultSystemNames });
    } catch (err) {
      console.error(err);
    }
  };

  // Search filter helper
  const matchesSearch = (key: string, label: string, defaultLabel?: string) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      key.toLowerCase().includes(q) ||
      label.toLowerCase().includes(q) ||
      (defaultLabel && defaultLabel.toLowerCase().includes(q))
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">
              จัดการชื่อและข้อความทั้งหมด (System Name Management)
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Admin Control
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin สามารถปรับเปลี่ยนชื่อเมนู หมวดหมู่ หน่วยสินค้า ชื่อเอกสาร และข้อความทั้งระบบได้เองโดยไม่ต้องแก้โค้ด
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add custom item */}
          {isAdminOrOwner && (
            <button
              type="button"
              onClick={() => setIsAddCustomOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-600" />
              <span>+ เพิ่มชื่อ/หน่วยกำหนดเอง</span>
            </button>
          )}

          {/* Reset to defaults */}
          {isAdminOrOwner && (
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
              title="คืนค่าชื่อและข้อความทั้งหมดเป็นค่าเริ่มต้น"
            >
              <RotateCcw className="w-4 h-4 text-amber-700" />
              <span>คืนค่าเริ่มต้น</span>
            </button>
          )}

          {/* Save Changes */}
          {isAdminOrOwner && (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Permission Banner for Non-Admin */}
      {!isAdminOrOwner && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-900">
          <Lock className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <strong>โหมดดูอย่างเดียว (View Only):</strong> บัญชีของคุณ ({currentUser?.role}) สามารถดูชื่อและข้อความที่ตั้งไว้ได้ แต่ไม่สามารถแก้ไขหรือบันทึกได้ กรุณาติดต่อ Admin หรือ Owner
          </div>
        </div>
      )}

      {/* Realtime Safety Guarantee Note */}
      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>
          <strong>ระบบความปลอดภัยข้อมูล:</strong> การเปลี่ยนชื่อจะเปลี่ยนเฉพาะชื่อที่แสดงผลบนหน้าจอ (Display Label) โดยไม่เปลี่ยน ID หรือโครงสร้างข้อมูลหลัก และไม่ทำให้ข้อมูลสินค้า สต็อก หรือบิลการขายเดิมสูญหาย
        </span>
      </div>

      {/* Search Bar & Tab Navigation */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="ค้นหาชื่อเดิม หรือชื่อที่ต้องการแก้ไขในทุกหมวด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
          />
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {[
            { id: 'menus', label: '1. ชื่อเมนู (Sidebar & Nav)' },
            { id: 'categories', label: '2. หมวดหมู่และประเภท' },
            { id: 'units', label: `3. หน่วยสินค้า (${formData.units.length} หน่วย)` },
            { id: 'documents', label: '4. ชื่อระบบและเอกสาร' },
            { id: 'statuses', label: '5. สถานะรายการ' },
            { id: 'alerts', label: '6. ข้อความแจ้งเตือน' },
            { id: 'roles', label: '7. บทบาทผู้ใช้งาน' },
            { id: 'logs', label: `8. ประวัติการแก้ไข (${systemNameLogs.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as NameTab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. MENUS TAB */}
      {/* ============================================================== */}
      {activeTab === 'menus' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-800">จัดการชื่อเมนูหลัก (Main Navigation Menus)</h3>
              <p className="text-[11px] text-slate-500">ชื่อที่แสดงบน Sidebar เมนูด้านข้าง และ Header</p>
            </div>
            <span className="text-xs text-slate-400">แก้ไขแล้วมีผลทั่วทั้งระบบทันที</span>
          </div>

          <div className="divide-y divide-slate-100">
            {Object.entries(defaultSystemNames.menus)
              .filter(([key, defVal]) => matchesSearch(key, formData.menus[key] || '', defVal))
              .map(([key, defaultLabel]) => (
                <div
                  key={key}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                >
                  <div className="sm:w-1/3">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                      key: {key}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">ชื่อเริ่มต้น: {defaultLabel}</p>
                  </div>

                  <div className="flex-1 max-w-md">
                    <input
                      type="text"
                      disabled={!isAdminOrOwner}
                      value={formData.menus[key] || ''}
                      onChange={(e) => handleLabelChange('menus', key, e.target.value)}
                      placeholder={defaultLabel}
                      className="w-full px-3.5 py-2 text-xs md:text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-600 transition disabled:opacity-75"
                    />
                  </div>

                  <div className="sm:w-28 text-right">
                    {formData.menus[key] !== defaultLabel ? (
                      <button
                        type="button"
                        disabled={!isAdminOrOwner}
                        onClick={() => handleLabelChange('menus', key, defaultLabel)}
                        className="text-[11px] text-amber-700 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        คืนค่าเดิม
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">ค่าเริ่มต้น</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. CATEGORIES & PRODUCT TYPES TAB */}
      {/* ============================================================== */}
      {activeTab === 'categories' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Product Types */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800">ชื่อประเภทการขายสินค้า (Product Sale Types)</h3>
              <p className="text-[11px] text-slate-500">เช่น ขายปลีก, ขายส่ง</p>
            </div>
            <div className="divide-y divide-slate-100">
              {Object.entries(defaultSystemNames.productTypes).map(([key, defaultLabel]) => (
                <div
                  key={key}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                >
                  <div className="sm:w-1/3">
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      type: {key}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">เริ่มต้น: {defaultLabel}</p>
                  </div>
                  <div className="flex-1 max-w-md">
                    <input
                      type="text"
                      disabled={!isAdminOrOwner}
                      value={formData.productTypes[key] || ''}
                      onChange={(e) => handleLabelChange('productTypes', key, e.target.value)}
                      placeholder={defaultLabel}
                      className="w-full px-3.5 py-2 text-xs md:text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-600 disabled:opacity-75"
                    />
                  </div>
                  <div className="sm:w-28 text-right">
                    {formData.productTypes[key] !== defaultLabel && (
                      <button
                        type="button"
                        disabled={!isAdminOrOwner}
                        onClick={() => handleLabelChange('productTypes', key, defaultLabel)}
                        className="text-[11px] text-amber-700 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        คืนค่าเดิม
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Income & Expense & Product Categories */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800">ชื่อหมวดหมู่รายรับและรายจ่าย (Categories Display Names)</h3>
              <p className="text-[11px] text-slate-500">
                เปลี่ยนชื่อที่แสดงผลของหมวดหมู่รายรับและรายจ่าย โดยระบบบัญชีเดิมจะยังทำงานได้อย่างถูกต้อง
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {Object.entries(defaultSystemNames.categories)
                .filter(([key, defVal]) => matchesSearch(key, formData.categories[key] || '', defVal))
                .map(([key, defaultLabel]) => (
                  <div
                    key={key}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                  >
                    <div className="sm:w-1/3">
                      <span
                        className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                          key.startsWith('income')
                            ? 'bg-emerald-50 text-emerald-800'
                            : key.startsWith('exp')
                            ? 'bg-rose-50 text-rose-800'
                            : 'bg-blue-50 text-blue-800'
                        }`}
                      >
                        {key}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-1">เริ่มต้น: {defaultLabel}</p>
                    </div>
                    <div className="flex-1 max-w-md">
                      <input
                        type="text"
                        disabled={!isAdminOrOwner}
                        value={formData.categories[key] || ''}
                        onChange={(e) => handleLabelChange('categories', key, e.target.value)}
                        placeholder={defaultLabel}
                        className="w-full px-3.5 py-2 text-xs md:text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-600 disabled:opacity-75"
                      />
                    </div>
                    <div className="sm:w-28 text-right">
                      {formData.categories[key] !== defaultLabel && (
                        <button
                          type="button"
                          disabled={!isAdminOrOwner}
                          onClick={() => handleLabelChange('categories', key, defaultLabel)}
                          className="text-[11px] text-amber-700 hover:underline cursor-pointer disabled:opacity-50"
                        >
                          คืนค่าเดิม
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. UNITS TAB */}
      {/* ============================================================== */}
      {activeTab === 'units' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                จัดการชื่อหน่วยสินค้า (Product Units Management)
              </h3>
              <p className="text-[11px] text-slate-500">
                ชิ้น, แพ็ก, กล่อง, ลัง, ถุง, กิโลกรัม, ขวด, โหล — สามารถแก้ไข เปิด/ปิด หรือเพิ่มหน่วยใหม่ได้
              </p>
            </div>
            {isAdminOrOwner && (
              <button
                type="button"
                onClick={() => {
                  setCustomSection('units');
                  setCustomLabel('');
                  setIsAddCustomOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ เพิ่มหน่วยสินค้า</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                <tr>
                  <th className="py-3 px-4">รหัสหน่วย (ID)</th>
                  <th className="py-3 px-4">ชื่อหน่วยที่แสดงผล</th>
                  <th className="py-3 px-4 text-center">สถานะการใช้งาน</th>
                  <th className="py-3 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {formData.units
                  .filter((u) => matchesSearch(u.id, u.name))
                  .map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">{unit.id}</td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          disabled={!isAdminOrOwner}
                          value={unit.name}
                          onChange={(e) => handleUnitRename(unit.id, e.target.value)}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-600 disabled:opacity-75 max-w-xs w-full"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          disabled={!isAdminOrOwner}
                          onClick={() => handleToggleUnit(unit.id)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer disabled:opacity-75 ${
                            unit.isEnabled
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {unit.isEnabled ? '✓ ใช้งานอยู่' : 'ปิดใช้งาน'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isAdminOrOwner && !unit.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUnit(unit.id, unit.name)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition cursor-pointer"
                            title="ลบหน่วยที่สร้างเอง"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. DOCUMENTS & SYSTEM TAB */}
      {/* ============================================================== */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-800">ชื่อเอกสารและหัวรายงาน (Document & Report Titles)</h3>
            <p className="text-[11px] text-slate-500">ชื่อที่ปรากฏบนหัวใบเสร็จ ใบเสนอราคา และรายงาน</p>
          </div>

          <div className="divide-y divide-slate-100">
            {Object.entries(defaultSystemNames.documents)
              .filter(([key, defVal]) => matchesSearch(key, formData.documents[key] || '', defVal))
              .map(([key, defaultLabel]) => (
                <div
                  key={key}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                >
                  <div className="sm:w-1/3">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {key}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">เริ่มต้น: {defaultLabel}</p>
                  </div>
                  <div className="flex-1 max-w-md">
                    <input
                      type="text"
                      disabled={!isAdminOrOwner}
                      value={formData.documents[key] || ''}
                      onChange={(e) => handleLabelChange('documents', key, e.target.value)}
                      placeholder={defaultLabel}
                      className="w-full px-3.5 py-2 text-xs md:text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-600 disabled:opacity-75"
                    />
                  </div>
                  <div className="sm:w-28 text-right">
                    {formData.documents[key] !== defaultLabel && (
                      <button
                        type="button"
                        disabled={!isAdminOrOwner}
                        onClick={() => handleLabelChange('documents', key, defaultLabel)}
                        className="text-[11px] text-amber-700 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        คืนค่าเดิม
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. STATUSES TAB */}
      {/* ============================================================== */}
      {activeTab === 'statuses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-800">ชื่อสถานะรายการ (Transaction Status Display)</h3>
            <p className="text-[11px] text-slate-500">ชื่อสถานะบิลขาย สถานะชำระเงิน และสถานะสต็อก</p>
          </div>

          <div className="divide-y divide-slate-100">
            {Object.entries(defaultSystemNames.statuses)
              .filter(([key, defVal]) => matchesSearch(key, formData.statuses[key] || '', defVal))
              .map(([key, defaultLabel]) => (
                <div
                  key={key}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                >
                  <div className="sm:w-1/3">
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      {key}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">เริ่มต้น: {defaultLabel}</p>
                  </div>
                  <div className="flex-1 max-w-md">
                    <input
                      type="text"
                      disabled={!isAdminOrOwner}
                      value={formData.statuses[key] || ''}
                      onChange={(e) => handleLabelChange('statuses', key, e.target.value)}
                      placeholder={defaultLabel}
                      className="w-full px-3.5 py-2 text-xs md:text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-600 disabled:opacity-75"
                    />
                  </div>
                  <div className="sm:w-28 text-right">
                    {formData.statuses[key] !== defaultLabel && (
                      <button
                        type="button"
                        disabled={!isAdminOrOwner}
                        onClick={() => handleLabelChange('statuses', key, defaultLabel)}
                        className="text-[11px] text-amber-700 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        คืนค่าเดิม
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. ALERTS TAB */}
      {/* ============================================================== */}
      {activeTab === 'alerts' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-800">ข้อความแจ้งเตือนของระบบ (System Notification Texts)</h3>
            <p className="text-[11px] text-slate-500">ข้อความเตือนสต็อกหมด สิทธิ์การเข้าถึง และการทำงานผิดพลาด</p>
          </div>

          <div className="divide-y divide-slate-100">
            {Object.entries(defaultSystemNames.alerts)
              .filter(([key, defVal]) => matchesSearch(key, formData.alerts[key] || '', defVal))
              .map(([key, defaultLabel]) => (
                <div
                  key={key}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                >
                  <div className="sm:w-1/3">
                    <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                      {key}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">เริ่มต้น: {defaultLabel}</p>
                  </div>
                  <div className="flex-1 max-w-md">
                    <input
                      type="text"
                      disabled={!isAdminOrOwner}
                      value={formData.alerts[key] || ''}
                      onChange={(e) => handleLabelChange('alerts', key, e.target.value)}
                      placeholder={defaultLabel}
                      className="w-full px-3.5 py-2 text-xs md:text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-600 disabled:opacity-75"
                    />
                  </div>
                  <div className="sm:w-28 text-right">
                    {formData.alerts[key] !== defaultLabel && (
                      <button
                        type="button"
                        disabled={!isAdminOrOwner}
                        onClick={() => handleLabelChange('alerts', key, defaultLabel)}
                        className="text-[11px] text-amber-700 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        คืนค่าเดิม
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. ROLES TAB */}
      {/* ============================================================== */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-800">ชื่อบทบาทผู้ใช้งาน (User Roles Display Names)</h3>
            <p className="text-[11px] text-slate-500">ชื่อตำแหน่งที่แสดงสำหรับแต่ละระดับสิทธิ์</p>
          </div>

          <div className="divide-y divide-slate-100">
            {Object.entries(defaultSystemNames.roles)
              .filter(([key, defVal]) => matchesSearch(key, formData.roles[key] || '', defVal))
              .map(([key, defaultLabel]) => (
                <div
                  key={key}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                >
                  <div className="sm:w-1/3">
                    <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md">
                      role: {key}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">เริ่มต้น: {defaultLabel}</p>
                  </div>
                  <div className="flex-1 max-w-md">
                    <input
                      type="text"
                      disabled={!isAdminOrOwner}
                      value={formData.roles[key] || ''}
                      onChange={(e) => handleLabelChange('roles', key, e.target.value)}
                      placeholder={defaultLabel}
                      className="w-full px-3.5 py-2 text-xs md:text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-600 disabled:opacity-75"
                    />
                  </div>
                  <div className="sm:w-28 text-right">
                    {formData.roles[key] !== defaultLabel && (
                      <button
                        type="button"
                        disabled={!isAdminOrOwner}
                        onClick={() => handleLabelChange('roles', key, defaultLabel)}
                        className="text-[11px] text-amber-700 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        คืนค่าเดิม
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8. LOGS TAB */}
      {/* ============================================================== */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              <span>ประวัติการแก้ไขชื่อระบบ (System Name Audit Logs)</span>
            </h3>
            <span className="text-xs text-slate-400">{systemNameLogs.length} บันทึก</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                <tr>
                  <th className="py-3 px-4">วัน-เวลา</th>
                  <th className="py-3 px-4">หมวดหมู่</th>
                  <th className="py-3 px-4">รายละเอียดการแก้ไข</th>
                  <th className="py-3 px-4">ผู้แก้ไข</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {systemNameLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      ยังไม่มีประวัติการแก้ไขชื่อระบบ
                    </td>
                  </tr>
                ) : (
                  systemNameLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                        {formatDateTime(log.modifiedAt)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{log.section}</td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="font-medium">{log.newValue}</span>
                        {log.oldValue && log.oldValue !== '-' && (
                          <span className="text-[11px] text-slate-400 block">
                            (เดิม: {log.oldValue})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">{log.modifiedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOM ITEM */}
      {isAddCustomOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">เพิ่มชื่อ / หน่วยกำหนดเอง</h3>
              <button
                type="button"
                onClick={() => setIsAddCustomOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ประเภทที่ต้องการเพิ่ม</label>
                <select
                  value={customSection}
                  onChange={(e) => setCustomSection(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                >
                  <option value="units">หน่วยสินค้าใหม่ (Product Unit)</option>
                  <option value="categories">หมวดหมู่เพิ่มเติม (Category)</option>
                  <option value="documents">ชื่อเอกสารใหม่ (Document Title)</option>
                </select>
              </div>

              {customSection !== 'units' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสอ้างอิง (Key - ภาษาอังกฤษ)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น custom_receipt, express_delivery"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl font-mono focus:outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อที่ต้องการให้แสดงผล (Display Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={customSection === 'units' ? 'เช่น ตะกร้า, ม้วน, แท่ง' : 'ระบุชื่อที่แสดงบนหน้าเว็บ'}
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  เพิ่มข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM RESET MODAL */}
      <ResetConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleConfirmReset}
        title="ยืนยันการคืนค่าชื่อเริ่มต้นของระบบ"
        description="คุณต้องการคืนค่าชื่อเมนู หมวดหมู่ หน่วยสินค้า และข้อความทั้งหมดเป็นค่าเริ่มต้นจากโรงงานหรือไม่?"
        detailBadge="ข้อมูลสินค้า สต็อก และบิลขายจะไม่ได้รับผลกระทบ"
        confirmLabel="ยืนยันคืนค่าเริ่มต้น"
      />

      {/* CONFIRM DELETE UNIT MODAL */}
      <ResetConfirmModal
        isOpen={!!unitToDelete}
        onClose={() => setUnitToDelete(null)}
        onConfirm={() => {
          if (!unitToDelete) return;
          const targetName = unitToDelete.name;
          const targetId = unitToDelete.id;
          setFormData((prev) => ({
            ...prev,
            units: prev.units.filter((u) => u.id !== targetId),
          }));
          showToast(`ลบหน่วยสินค้า "${targetName}" แล้ว (กดบันทึกเพื่อมีผลถาวร)`, 'info');
          setUnitToDelete(null);
        }}
        title="ยืนยันการลบหน่วยสินค้า"
        description={`คุณต้องการลบหน่วยสินค้า "${unitToDelete?.name}" ออกจากระบบใช่หรือไม่?`}
        detailBadge="กดบันทึกการเปลี่ยนแปลงเพื่อมีผลถาวร"
        confirmLabel="ลบหน่วยสินค้านี้"
      />
    </div>
  );
};
