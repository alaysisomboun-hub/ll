import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Users,
  Truck,
  Receipt,
  PiggyBank,
  BarChart3,
  UserCog,
  Settings,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Store,
  LogOut,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types/pos';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (m: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const {
    activeTab,
    setActiveTab,
    t,
    products,
    customers,
    currentUser,
    switchUserRole,
    canAccessTab,
    logout,
  } = useApp();

  // Badges
  const lowStockCount = products.filter(
    (p) => p.stockQty <= (p.minStockAlert || 10) && p.stockQty > 0
  ).length;
  const outOfStockCount = products.filter((p) => p.stockQty <= 0).length;
  const totalStockAlerts = lowStockCount + outOfStockCount;

  const debtCustomersCount = customers.filter((c) => (c.outstandingDebt || 0) > 0).length;

  const allMenuItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'pos', label: t.pos, icon: ShoppingCart, highlight: true },
    { id: 'products', label: t.products, icon: Package },
    {
      id: 'inventory',
      label: t.inventory,
      icon: Warehouse,
      badge: totalStockAlerts > 0 ? totalStockAlerts : undefined,
      badgeColor: outOfStockCount > 0 ? 'bg-red-500' : 'bg-amber-500',
    },
    {
      id: 'customers',
      label: t.customers,
      icon: Users,
      badge: debtCustomersCount > 0 ? debtCustomersCount : undefined,
      badgeColor: 'bg-blue-500',
    },
    { id: 'suppliers', label: t.suppliers, icon: Truck },
    { id: 'expenses', label: t.expenses, icon: Receipt },
    { id: 'finance', label: t.finance, icon: PiggyBank },
    { id: 'reports', label: t.reports, icon: BarChart3 },
    { id: 'employees', label: t.employees, icon: UserCog },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  // RBAC Menu Filtering: Only show menus permitted for the user's role
  const menuItems = allMenuItems.filter((item) => canAccessTab(item.id));

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    if (mobileOpen) setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-200 transition-all duration-300 ease-in-out border-r border-slate-800 ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <h1 className="font-bold text-white text-base tracking-tight truncate leading-tight">
                  POS Pro Wholesale
                </h1>
                <p className="text-xs text-blue-400 font-medium">ระบบขายส่ง & ปลีก</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Current User & Quick Role Switcher */}
        {!collapsed ? (
          <div className="p-3 mx-3 my-3 bg-slate-800/70 border border-slate-700/60 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-blue-600/40 text-blue-300 flex items-center justify-center text-xs font-semibold shrink-0">
                  {currentUser?.displayName ? currentUser.displayName.slice(0, 1) : 'U'}
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">
                    {currentUser?.displayName || 'User'}
                  </p>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-blue-500/20 text-blue-300">
                    {currentUser?.role || 'staff'}
                  </span>
                </div>
              </div>
            </div>

            {/* Role switch toggle - 4 Roles */}
            <div className="grid grid-cols-4 gap-1 mt-2.5 pt-2 border-t border-slate-700/60 text-[10px]">
              {(['owner', 'admin', 'manager', 'staff'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => switchUserRole(r)}
                  className={`py-1 rounded text-center font-medium transition ${
                    currentUser?.role === r
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                  }`}
                >
                  {r === 'owner' ? 'เจ้าของ' : r === 'admin' ? 'แอดมิน' : r === 'manager' ? 'ผจก.' : 'พนักงาน'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-3 border-b border-slate-800">
            <button
              onClick={() => {
                const roleCycle: Record<string, UserRole> = {
                  owner: 'admin',
                  admin: 'manager',
                  manager: 'staff',
                  staff: 'owner',
                  cashier: 'staff',
                };
                switchUserRole(roleCycle[currentUser?.role || 'owner'] || 'owner');
              }}
              title={`สิทธิ์ปัจจุบัน: ${currentUser?.role || 'staff'} (คลิกเพื่อเปลี่ยน)`}
              className="w-10 h-10 rounded-xl bg-blue-600/30 text-blue-300 flex items-center justify-center hover:bg-blue-600/50 transition"
            >
              <ShieldCheck className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all relative ${
                  isActive
                    ? item.highlight
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                      : 'bg-slate-800 text-blue-400 font-semibold border-l-4 border-blue-500'
                    : item.highlight
                    ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 hover:text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive ? (item.highlight ? 'text-white' : 'text-blue-400') : 'text-slate-400'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}

                {/* Badge alert */}
                {item.badge !== undefined && (
                  <span
                    className={`ml-auto px-1.5 py-0.5 text-[11px] font-bold text-white rounded-full ${item.badgeColor} ${
                      collapsed ? 'absolute top-1 right-2 w-2.5 h-2.5 p-0 overflow-hidden text-[0px]' : ''
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Low Stock Footer Warning if alerts exist */}
        {!collapsed && totalStockAlerts > 0 && (
          <div className="p-3 m-3 bg-amber-950/40 border border-amber-800/50 rounded-xl text-amber-300 text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>สินค้าต้องสั่งเพิ่ม</span>
            </div>
            <p className="mt-1 text-[11px] text-amber-400/80">
              มีสินค้า {totalStockAlerts} รายการ ใกล้หมดหรือหมดสต็อก
            </p>
            <button
              onClick={() => handleNavClick('inventory')}
              className="mt-2 w-full py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium rounded text-[11px] transition text-center"
            >
              ดูสต็อกสินค้า
            </button>
          </div>
        )}

        {/* Logout Button */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={logout}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-950/40 border border-transparent hover:border-rose-900/60 rounded-xl transition ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title="ออกจากระบบ (Sign Out)"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>ออกจากระบบ</span>}
          </button>
        </div>

        {/* Quick Version Tag */}
        <div className="px-3 pb-3 text-center text-[10px] text-slate-500">
          {!collapsed && <span>v2.5 Wholesale POS • RBAC Cloud</span>}
        </div>
      </aside>
    </>
  );
};
