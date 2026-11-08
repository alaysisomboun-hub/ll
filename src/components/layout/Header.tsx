import React, { useState, useEffect } from 'react';
import {
  Menu,
  Clock,
  Sparkles,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Language } from '../../utils/translations';

interface HeaderProps {
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const {
    activeTab,
    language,
    setLanguage,
    currency,
    setCurrency,
    t,
    settings,
    products,
    seedDemoData,
    loading,
    currentUser,
    logout,
  } = useApp();

  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const tabTitles: Record<string, string> = {
    dashboard: t.dashboard,
    pos: t.pos,
    products: t.products,
    inventory: t.inventory,
    customers: t.customers,
    suppliers: t.suppliers,
    expenses: t.expenses,
    finance: t.finance,
    reports: t.reports,
    employees: t.employees,
    settings: t.settings,
  };

  const roleLabels: Record<string, string> = {
    owner: 'เจ้าของร้าน (Owner)',
    admin: 'ผู้ดูแลระบบ (Admin)',
    manager: 'ผู้จัดการ (Manager)',
    staff: 'พนักงานขาย (Staff)',
    cashier: 'พนักงานขาย (Staff)',
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white border-b border-slate-200 shadow-2xs transition-colors">
      {/* Left: Hamburger + Page Title & Store Context */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuToggle}
          className="p-2 text-slate-500 rounded-xl hover:bg-slate-100 hover:text-slate-800 lg:hidden focus:outline-hidden transition-colors cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base md:text-lg font-bold text-slate-900 tracking-tight truncate">
              {tabTitles[activeTab] || 'ระบบจัดการร้านค้า'}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              <span>คลาวด์ออนไลน์</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-500 truncate hidden md:block">
            {settings.storeName || 'ระบบ POS จัดการร้านค้าขายส่งและขายปลีก'}
          </p>
        </div>
      </div>

      {/* Right Controls: Clock, Currency, Language, User */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Real-time Clock */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-mono tabular-nums text-slate-800 font-semibold">{time}</span>
        </div>

        {/* Currency Switcher */}
        <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setCurrency('THB')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              currency === 'THB'
                ? 'bg-white text-blue-700 shadow-xs font-bold border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="สกุลเงินบาทไทย (THB)"
          >
            ฿ THB
          </button>
          <button
            type="button"
            onClick={() => setCurrency('LAK')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              currency === 'LAK'
                ? 'bg-white text-blue-700 shadow-xs font-bold border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="สกุลเงินกีบลาว (LAK)"
          >
            ₭ LAK
          </button>
          <button
            type="button"
            onClick={() => setCurrency('USD')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              currency === 'USD'
                ? 'bg-white text-blue-700 shadow-xs font-bold border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="สกุลเงินดอลลาร์สหรัฐ (USD)"
          >
            $ USD
          </button>
        </div>

        {/* Language Switcher */}
        <div className="relative">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="text-xs font-semibold bg-white text-slate-700 border border-slate-200 rounded-xl py-1.5 pl-3 pr-7 hover:border-blue-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer appearance-none shadow-2xs"
          >
            <option value="th">🇹🇭 ไทย</option>
            <option value="lo">🇱🇦 ລາວ</option>
            <option value="vi">🇻🇳 Tiếng Việt</option>
            <option value="en">🇺🇸 English</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
        </div>

        {/* Quick Seed Demo Data button if database is empty */}
        {products.length === 0 && (
          <button
            type="button"
            onClick={seedDemoData}
            disabled={loading}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="คลิกเพื่อลงข้อมูลตัวอย่างสินค้าและคู่ค้า"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>โหลดข้อมูลตัวอย่าง</span>
          </button>
        )}

        {/* User Info & Logout Button */}
        {currentUser && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200/80">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[130px]">
                {currentUser.displayName}
              </span>
              <span className="text-[10px] font-medium text-slate-500">
                {roleLabels[currentUser.role] || currentUser.role}
              </span>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="ออกจากระบบ (Sign Out)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
