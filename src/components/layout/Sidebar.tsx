import React, { useState } from 'react';
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
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types/pos';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (m: boolean) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  badge?: number | string;
  badgeColor?: string;
}

interface MenuGroup {
  groupLabel: string;
  items: MenuItem[];
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

  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  // Stock alert counts
  const lowStockCount = products.filter(
    (p) => p.stockQty <= (p.minStockAlert || 10) && p.stockQty > 0
  ).length;
  const outOfStockCount = products.filter((p) => p.stockQty <= 0).length;
  const totalStockAlerts = lowStockCount + outOfStockCount;

  const debtCustomersCount = customers.filter((c) => (c.outstandingDebt || 0) > 0).length;

  // Grouped Menu Structure
  const menuGroups: MenuGroup[] = [
    {
      groupLabel: 'งานขาย',
      items: [
        { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
        { id: 'pos', label: t.pos, icon: ShoppingCart, highlight: true },
      ],
    },
    {
      groupLabel: 'สินค้าและคลัง',
      items: [
        { id: 'products', label: t.products, icon: Package },
        {
          id: 'inventory',
          label: t.inventory,
          icon: Warehouse,
          badge: totalStockAlerts > 0 ? totalStockAlerts : undefined,
          badgeColor: outOfStockCount > 0 ? 'bg-red-500' : 'bg-amber-500',
        },
      ],
    },
    {
      groupLabel: 'คู่ค้าและลูกค้า',
      items: [
        {
          id: 'customers',
          label: t.customers,
          icon: Users,
          badge: debtCustomersCount > 0 ? debtCustomersCount : undefined,
          badgeColor: 'bg-blue-500',
        },
        { id: 'suppliers', label: t.suppliers, icon: Truck },
      ],
    },
    {
      groupLabel: 'บัญชีและการเงิน',
      items: [
        { id: 'expenses', label: t.expenses, icon: Receipt },
        { id: 'finance', label: t.finance, icon: PiggyBank },
        { id: 'reports', label: t.reports, icon: BarChart3 },
      ],
    },
    {
      groupLabel: 'ระบบและการจัดการ',
      items: [
        { id: 'employees', label: t.employees, icon: UserCog },
        { id: 'settings', label: t.settings, icon: Settings },
      ],
    },
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    if (mobileOpen) setMobileOpen(false);
  };

  const roleDisplayNames: Record<string, string> = {
    owner: 'เจ้าของร้าน (Owner)',
    admin: 'ผู้ดูแลระบบ (Admin)',
    manager: 'ผู้จัดการ (Manager)',
    staff: 'พนักงานขาย (Staff)',
    cashier: 'พนักงานขาย (Staff)',
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
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
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <h1 className="font-bold text-white text-sm tracking-tight truncate leading-tight">
                  POS Wholesale & Retail
                </h1>
                <p className="text-[11px] text-slate-400 font-normal">ระบบจัดการร้านค้าครบวงจร</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
            title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* User Card & Role Switcher */}
        {!collapsed ? (
          <div className="mx-3 my-2.5 p-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-300 flex items-center justify-center text-xs font-semibold shrink-0">
                  {currentUser?.displayName ? currentUser.displayName.slice(0, 1) : 'U'}
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate leading-tight">
                    {currentUser?.displayName || 'User'}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {roleDisplayNames[currentUser?.role || 'staff']}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-md transition-colors"
                title="สลับสิทธิ์การใช้งานเพื่อทดสอบ"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${roleSwitcherOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Quick 4-role switcher dropdown */}
            {roleSwitcherOpen && (
              <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-slate-700/50 text-[11px]">
                {(['owner', 'admin', 'manager', 'staff'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      switchUserRole(r);
                      setRoleSwitcherOpen(false);
                    }}
                    className={`py-1 px-2 rounded-lg text-left transition ${
                      currentUser?.role === r
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    {r === 'owner' ? '👑 เจ้าของร้าน' : r === 'admin' ? '🛡️ แอดมิน' : r === 'manager' ? '👔 ผู้จัดการ' : '🛒 พนักงานขาย'}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center py-2.5 border-b border-slate-800">
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
              className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-blue-400" />
            </button>
          </div>
        )}

        {/* Navigation Links Grouped */}
        <nav className="flex-1 px-2.5 py-2 overflow-y-auto custom-scrollbar space-y-4">
          {menuGroups.map((group, gIdx) => {
            const accessibleItems = group.items.filter((item) => canAccessTab(item.id));
            if (accessibleItems.length === 0) return null;

            return (
              <div key={gIdx} className="space-y-1">
                {!collapsed && (
                  <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    {group.groupLabel}
                  </div>
                )}

                {accessibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors relative cursor-pointer ${
                        isActive
                          ? item.highlight
                            ? 'bg-blue-600 text-white font-semibold shadow-xs'
                            : 'bg-slate-800 text-white font-semibold'
                          : item.highlight
                          ? 'text-blue-400 hover:bg-slate-800/60'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      } ${collapsed ? 'justify-center px-0' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? item.highlight
                              ? 'text-white'
                              : 'text-blue-400'
                            : 'text-slate-400'
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}

                      {/* Badge counter */}
                      {item.badge !== undefined && (
                        <span
                          className={`ml-auto px-1.5 py-0.2 text-[10px] font-bold text-white rounded-md tabular-nums ${item.badgeColor} ${
                            collapsed
                              ? 'absolute top-1 right-2 w-2 h-2 p-0 overflow-hidden text-[0px] rounded-full'
                              : ''
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Low Stock Warning Box (Clean, minimal) */}
        {!collapsed && totalStockAlerts > 0 && (
          <div className="p-2.5 mx-3 mb-2 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-300 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>สินค้าใกล้หมด ({totalStockAlerts})</span>
              </span>
              <button
                onClick={() => handleNavClick('inventory')}
                className="text-[10px] text-amber-200 underline hover:text-white"
              >
                ดูสต็อก
              </button>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={logout}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title="ออกจากระบบ (Sign Out)"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>ออกจากระบบ</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
