import React, { useMemo, useState } from 'react';
import {
  PiggyBank,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Building,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Wallet,
  CheckCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';

export const FinanceView: React.FC = () => {
  const { sales, expenses, customers, suppliers, currency } = useApp();

  const [period, setPeriod] = useState<'all' | 'today' | 'this_month'>('this_month');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const financialData = useMemo(() => {
    let filteredSales = sales.filter((s) => s.status === 'completed');
    let filteredExpenses = expenses;

    if (period === 'today') {
      filteredSales = filteredSales.filter((s) => s.createdAt.startsWith(todayStr));
      filteredExpenses = filteredExpenses.filter((e) => e.date.startsWith(todayStr));
    } else if (period === 'this_month') {
      filteredSales = filteredSales.filter((s) => s.createdAt.startsWith(currentMonthStr));
      filteredExpenses = filteredExpenses.filter((e) => e.date.startsWith(currentMonthStr));
    }

    // Revenue
    const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    // Cost of Goods Sold (COGS)
    const totalCostOfGoods = filteredSales.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    // Gross Profit = Revenue - COGS
    const grossProfit = totalRevenue - totalCostOfGoods;
    // Total Operational Expenses
    const totalOperatingExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    // Net Profit = Gross Profit - Operating Expenses
    const netProfit = grossProfit - totalOperatingExpenses;

    // Payment methods breakdown
    const cashSales = filteredSales
      .filter((s) => s.paymentMethod === 'cash')
      .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

    const transferSales = filteredSales
      .filter((s) => s.paymentMethod === 'transfer')
      .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

    const creditSales = filteredSales
      .filter((s) => s.paymentMethod === 'credit')
      .reduce((sum, s) => sum + (s.debtAmount || 0), 0);

    // Receivables & Payables (Balance sheet level, non-period bound)
    const accountsReceivable = customers.reduce((sum, c) => sum + (c.outstandingDebt || 0), 0);
    const accountsPayable = suppliers.reduce((sum, s) => sum + (s.outstandingPayable || 0), 0);
    const netWorkingCapital = accountsReceivable - accountsPayable;

    // Cashflow: Real money in (Cash + Transfer) minus expenses paid
    const actualCashIn = cashSales + transferSales;
    const netCashFlow = actualCashIn - totalOperatingExpenses;

    return {
      totalRevenue,
      totalCostOfGoods,
      grossProfit,
      grossMarginPct: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0',
      totalOperatingExpenses,
      netProfit,
      netMarginPct: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0',
      cashSales,
      transferSales,
      creditSales,
      accountsReceivable,
      accountsPayable,
      netWorkingCapital,
      actualCashIn,
      netCashFlow,
      completedOrdersCount: filteredSales.length,
      expenseCount: filteredExpenses.length,
    };
  }, [sales, expenses, customers, suppliers, period, todayStr, currentMonthStr]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">การเงิน บัญชี และผลกำไร (Finance & P&L)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            สรุปรายรับ ต้นทุนขาย กำไรขั้นต้น รายจ่ายดำเนินงาน และกำไรสุทธิตามหลักบัญชี
          </p>
        </div>

        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setPeriod('today')}
            className={`px-3 py-1.5 rounded-lg transition ${
              period === 'today' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            วันนี้ (Today)
          </button>
          <button
            onClick={() => setPeriod('this_month')}
            className={`px-3 py-1.5 rounded-lg transition ${
              period === 'this_month' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            เดือนนี้ (This Month)
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              period === 'all' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ทั้งหมด (All Time)
          </button>
        </div>
      </div>

      {/* P&L Statement Highlights (Income Statement) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
              1. รายรับจากการขาย (Revenue)
            </span>
            <TrendingUp className="w-5 h-5 text-blue-300" />
          </div>
          <p className="text-3xl font-extrabold mt-3">
            {formatCurrency(financialData.totalRevenue, currency)}
          </p>
          <p className="text-xs text-blue-200 mt-1">
            จาก {financialData.completedOrdersCount} บิลขายที่สำเร็จ
          </p>
          <div className="mt-4 pt-3 border-t border-blue-800/80 text-xs text-blue-200 flex justify-between">
            <span>ต้นทุนสินค้าที่ขายไป (COGS):</span>
            <span className="font-bold text-white">-{formatCurrency(financialData.totalCostOfGoods, currency)}</span>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="bg-gradient-to-br from-emerald-800 to-teal-900 text-white p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">
              2. กำไรขั้นต้น (Gross Profit)
            </span>
            <DollarSign className="w-5 h-5 text-emerald-300" />
          </div>
          <p className="text-3xl font-extrabold mt-3">
            {formatCurrency(financialData.grossProfit, currency)}
          </p>
          <p className="text-xs text-emerald-200 mt-1">
            อัตรากำไรขั้นต้น: <span className="font-bold text-white">{financialData.grossMarginPct}%</span>
          </p>
          <div className="mt-4 pt-3 border-t border-emerald-700/80 text-xs text-emerald-200 flex justify-between">
            <span>หักค่าใช้จ่ายดำเนินงาน:</span>
            <span className="font-bold text-white">-{formatCurrency(financialData.totalOperatingExpenses, currency)}</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
              3. กำไรสุทธิ (Net Profit)
            </span>
            <CheckCircle className="w-5 h-5 text-indigo-400" />
          </div>
          <p
            className={`text-3xl font-extrabold mt-3 ${
              financialData.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {formatCurrency(financialData.netProfit, currency)}
          </p>
          <p className="text-xs text-slate-300 mt-1">
            อัตรากำไรสุทธิ: <span className="font-bold text-white">{financialData.netMarginPct}%</span>
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-300 flex justify-between">
            <span>กระแสเงินสดสุทธิ (Cash Flow):</span>
            <span className="font-bold text-emerald-400">
              {formatCurrency(financialData.netCashFlow, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Receivables (ลูกหนี้) vs Payables (เจ้าหนี้) Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Accounts Receivable */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">ลูกหนี้การค้า (Accounts Receivable)</h3>
                <p className="text-[11px] text-slate-500">เงินที่ลูกค้าค้างชำระกับทางร้าน</p>
              </div>
            </div>
            <span className="text-xl font-extrabold text-amber-600">
              {formatCurrency(financialData.accountsReceivable, currency)}
            </span>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>ลูกค้าที่มียอดค้างชำระ:</span>
              <span className="font-bold text-slate-800">
                {customers.filter((c) => (c.outstandingDebt || 0) > 0).length} ราย
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>ยอดขายแบบเครดิตในรอบนี้:</span>
              <span className="font-bold text-amber-700">
                {formatCurrency(financialData.creditSales, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Accounts Payable */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-700 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">เจ้าหนี้การค้า (Accounts Payable)</h3>
                <p className="text-[11px] text-slate-500">เงินที่ทางร้านค้างจ่ายให้ซัพพลายเออร์</p>
              </div>
            </div>
            <span className="text-xl font-extrabold text-red-600">
              {formatCurrency(financialData.accountsPayable, currency)}
            </span>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>ซัพพลายเออร์ที่ค้างจ่าย:</span>
              <span className="font-bold text-slate-800">
                {suppliers.filter((s) => (s.outstandingPayable || 0) > 0).length} บริษัท
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>ส่วนต่างลูกหนี้สุทธิ (AR - AP):</span>
              <span
                className={`font-bold ${
                  financialData.netWorkingCapital >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}
              >
                {formatCurrency(financialData.netWorkingCapital, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Inflow Breakdown (Cash vs Transfer) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="font-bold text-sm text-slate-800 mb-4">ช่องทางรับเงิน (Payment Methods Inflow)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <span className="text-xs font-semibold text-emerald-800">เงินสด (Cash in Drawer)</span>
            <p className="text-xl font-extrabold text-emerald-900 mt-1">
              {formatCurrency(financialData.cashSales, currency)}
            </p>
            <p className="text-[11px] text-emerald-700 mt-0.5">ยอดเงินสดในลิ้นชักหน้าร้าน</p>
          </div>

          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl">
            <span className="text-xs font-semibold text-blue-800">เงินโอน / สแกน QR</span>
            <p className="text-xl font-extrabold text-blue-900 mt-1">
              {formatCurrency(financialData.transferSales, currency)}
            </p>
            <p className="text-[11px] text-blue-700 mt-0.5">โอนเข้าบัญชีธนาคาร</p>
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
            <span className="text-xs font-semibold text-amber-800">ขายเชื่อ / ลูกหนี้ค้าง</span>
            <p className="text-xl font-extrabold text-amber-900 mt-1">
              {formatCurrency(financialData.creditSales, currency)}
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">รอเรียกเก็บเงินตามรอบ</p>
          </div>
        </div>
      </div>
    </div>
  );
};
