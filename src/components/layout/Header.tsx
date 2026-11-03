import React from 'react';
import {
  Menu,
  ShoppingCart,
  Globe,
  DollarSign,
  Database,
  Sparkles,
  Clock,
  LogOut,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Language } from '../../utils/translations';

interface HeaderProps {
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const {
    activeTab,
    setActiveTab,
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

  const [time, setTime] = React.useState<string>('');

  React.useEffect(() => {
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

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white border-b border-slate-200/80 shadow-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 text-slate-600 rounded-lg hover:bg-slate-100 lg:hidden focus:outline-hidden"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">
              {tabTitles[activeTab] || 'ระบบจัดการร้านค้า'}
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Firestore Live
            </span>
          </div>
          <p className="text-xs text-slate-500 hidden md:block">
            {settings.storeName || 'ระบบ POS จัดการร้านค้าขายส่งและขายปลีก'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real-time Clock */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-mono font-medium">{time}</span>
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setCurrency('THB')}
            className={`px-2 py-1 rounded-md transition ${
              currency === 'THB'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="สกุลเงินบาทไทย (THB)"
          >
            ฿ THB
          </button>
          <button
            onClick={() => setCurrency('LAK')}
            className={`px-2 py-1 rounded-md transition ${
              currency === 'LAK'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="สกุลเงินกีบลาว (LAK)"
          >
            ₭ LAK
          </button>
          <button
            onClick={() => setCurrency('USD')}
            className={`px-2 py-1 rounded-md transition ${
              currency === 'USD'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="สกุลเงินดอลลาร์สหรัฐ (USD)"
          >
            $ USD
          </button>
        </div>

        {/* Language Switcher */}
        <div className="relative flex items-center">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded-lg py-1.5 pl-2 pr-7 hover:bg-slate-200/70 focus:outline-hidden cursor-pointer"
          >
            <option value="th">🇹🇭 ไทย</option>
            <option value="lo">🇱🇦 ລາວ</option>
            <option value="vi">🇻🇳 Tiếng Việt</option>
            <option value="en">🇺🇸 English</option>
          </select>
        </div>

        {/* Quick Seed Demo Data button if database is empty */}
        {products.length === 0 && (
          <button
            onClick={seedDemoData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold shadow-xs transition"
            title="คลิกเพื่อลงข้อมูลตัวอย่างสินค้าและคู่ค้า"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">โหลดข้อมูลตัวอย่าง</span>
          </button>
        )}

        {/* User Info & Logout Button */}
        {currentUser && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[140px]">
                {currentUser.displayName}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
                {currentUser.role === 'owner'
                  ? '👑 เจ้าของร้าน'
                  : currentUser.role === 'admin'
                  ? '🛡️ ผู้ดูแลระบบ'
                  : currentUser.role === 'manager'
                  ? '👔 ผู้จัดการ'
                  : '🛒 พนักงานขาย'}
              </span>
            </div>

            <button
              onClick={() => {
                if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
                  logout();
                }
              }}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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
