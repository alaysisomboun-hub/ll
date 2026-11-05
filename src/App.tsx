import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { LoginView } from './components/auth/LoginView';
import { DashboardView } from './components/dashboard/DashboardView';
import { POSView } from './components/pos/POSView';
import { ProductsView } from './components/products/ProductsView';
import { InventoryView } from './components/inventory/InventoryView';
import { CustomersView } from './components/customers/CustomersView';
import { SuppliersView } from './components/suppliers/SuppliersView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { FinanceView } from './components/finance/FinanceView';
import { ReportsView } from './components/reports/ReportsView';
import { EmployeesView } from './components/employees/EmployeesView';
import { SettingsView } from './components/settings/SettingsView';
import { SystemNamesView } from './components/system-names/SystemNamesView';
import { CheckCircle2, AlertCircle, Info, X, ShieldAlert } from 'lucide-react';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl shadow-lg border text-xs md:text-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'success'
              ? 'bg-emerald-900/90 text-white border-emerald-700/80'
              : toast.type === 'error'
              ? 'bg-red-900/90 text-white border-red-700/80'
              : toast.type === 'warning'
              ? 'bg-amber-900/90 text-white border-amber-700/80'
              : 'bg-slate-900/90 text-white border-slate-700/80'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
          {toast.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />}

          <span className="flex-1 font-medium leading-snug">{toast.message}</span>

          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/60 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

const AccessDeniedView: React.FC = () => {
  const { currentUser, setActiveTab } = useApp();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-bold text-slate-800">ไม่มีสิทธิ์เข้าถึงหน้านี้ (Access Restricted)</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">
        สิทธิ์ของคุณ ({currentUser?.role}) ไม่ได้รับอนุญาตให้เข้าถึงเมนูนี้ กรุณาติดต่อผู้ดูแลระบบหรือเจ้าของร้าน
      </p>
      <button
        onClick={() => setActiveTab(currentUser?.role === 'staff' ? 'pos' : 'dashboard')}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
      >
        กลับสู่หน้าหลักที่ได้รับอนุญาต
      </button>
    </div>
  );
};

const MainContent: React.FC = () => {
  const { isAuthenticated, currentUser, activeTab, setActiveTab, canAccessTab } = useApp();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Enforce access control on tab change or role change
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      if (!canAccessTab(activeTab)) {
        if (currentUser.role === 'staff' || currentUser.role === 'cashier') {
          setActiveTab('pos');
        } else {
          setActiveTab('dashboard');
        }
      }
    }
  }, [activeTab, currentUser, isAuthenticated]);

  // If not authenticated, render the Login View
  if (!isAuthenticated || !currentUser) {
    return (
      <>
        <LoginView />
        <ToastContainer />
      </>
    );
  }

  const hasAccess = canAccessTab(activeTab);

  return (
    <div className="min-h-screen bg-slate-100 flex text-slate-800 font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <Header onMenuToggle={() => setMobileOpen(!mobileOpen)} />

        <main className="flex-1 overflow-x-hidden">
          {!hasAccess ? (
            <AccessDeniedView />
          ) : (
            <>
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'pos' && <POSView />}
              {activeTab === 'products' && <ProductsView />}
              {activeTab === 'inventory' && <InventoryView />}
              {activeTab === 'customers' && <CustomersView />}
              {activeTab === 'suppliers' && <SuppliersView />}
              {activeTab === 'expenses' && <ExpensesView />}
              {activeTab === 'finance' && <FinanceView />}
              {activeTab === 'reports' && <ReportsView />}
              {activeTab === 'employees' && <EmployeesView />}
              {activeTab === 'settings' && <SettingsView />}
              {activeTab === 'name_management' && <SystemNamesView />}
            </>
          )}
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
