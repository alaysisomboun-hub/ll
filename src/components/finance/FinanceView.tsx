import React, { useState, useMemo } from 'react';
import {
  PiggyBank,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Clock,
  Search,
  Filter,
  RotateCcw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Eye,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  BarChart2,
  Table as TableIcon,
  ShieldCheck,
  History,
  Layers,
  Database,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IncomeModal, incomeCategoryLabels } from './IncomeModal';
import { ExpenseModal, expenseCategoryLabels } from './ExpenseModal';
import { FinanceResetModal } from './FinanceResetModal';
import { TransactionDetailModal, UnifiedTransactionItem } from './TransactionDetailModal';
import { ResetConfirmModal } from '../common/ResetConfirmModal';
import { formatCurrency, formatNumber, formatDateOnly, formatDateTime } from '../../utils/formatters';

type FinanceSubTab =
  | 'daily_income'
  | 'monthly_income'
  | 'yearly_income'
  | 'daily_expense'
  | 'monthly_expense'
  | 'yearly_expense'
  | 'profit'
  | 'all_transactions'
  | 'reset_history';

const subTabNav = [
  { id: 'daily_income', label: '1. รายรับรายวัน', icon: TrendingUp, color: 'text-emerald-700 bg-emerald-50' },
  { id: 'monthly_income', label: '2. รายรับรายเดือน', icon: TrendingUp, color: 'text-emerald-700 bg-emerald-50' },
  { id: 'yearly_income', label: '3. รายรับรายปี', icon: TrendingUp, color: 'text-emerald-700 bg-emerald-50' },
  { id: 'daily_expense', label: '4. รายจ่ายรายวัน', icon: TrendingDown, color: 'text-rose-700 bg-rose-50' },
  { id: 'monthly_expense', label: '5. รายจ่ายรายเดือน', icon: TrendingDown, color: 'text-rose-700 bg-rose-50' },
  { id: 'yearly_expense', label: '6. รายจ่ายรายปี', icon: TrendingDown, color: 'text-rose-700 bg-rose-50' },
  { id: 'profit', label: '7. รายงานกำไร', icon: DollarSign, color: 'text-indigo-700 bg-indigo-50' },
  { id: 'all_transactions', label: '8. ประวัติรายการทั้งหมด', icon: History, color: 'text-blue-700 bg-blue-50' },
  { id: 'reset_history', label: '9. ประวัติการรีเซ็ตระบบ', icon: RotateCcw, color: 'text-amber-700 bg-amber-50' },
] as const;

const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export const FinanceView: React.FC = () => {
  const {
    sales,
    expenses,
    incomes,
    financeResets,
    currency,
    currentUser,
    deleteIncome,
    deleteExpense,
    showToast,
  } = useApp();

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  // Sub Tab Navigation
  const [activeSubTab, setActiveSubTab] = useState<FinanceSubTab>('daily_income');

  // Date controls
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(`${currentYear}-${currentMonth}`);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Period Scope: 'active_period' (since latest reset) or 'all_time'
  const [scopeFilter, setScopeFilter] = useState<'active_period' | 'all_time'>('active_period');

  // Search & Filtering for All Transactions
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<'all' | 'cash' | 'transfer'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterMinAmount, setFilterMinAmount] = useState<string>('');
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>('');

  // Modals
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<UnifiedTransactionItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<UnifiedTransactionItem | null>(null);

  // Check latest reset checkpoint
  const latestReset = useMemo(() => {
    if (financeResets.length === 0) return null;
    return [...financeResets].sort(
      (a, b) => new Date(b.resetDate).getTime() - new Date(a.resetDate).getTime()
    )[0];
  }, [financeResets]);

  // Unified items list
  const allUnifiedTransactions: UnifiedTransactionItem[] = useMemo(() => {
    const list: UnifiedTransactionItem[] = [];

    // 1. Completed Sales
    sales
      .filter((s) => s.status === 'completed')
      .forEach((s) => {
        const dateOnly = s.createdAt.split('T')[0];
        const timeOnly = s.createdAt.includes('T') ? s.createdAt.split('T')[1].slice(0, 5) : '';
        list.push({
          id: s.id,
          type: 'income',
          title: `ขายสินค้า บิล #${s.invoiceNumber}`,
          amount: s.totalAmount,
          category: 'sales',
          categoryLabel: 'ยอดขายหน้าร้าน (POS)',
          date: dateOnly,
          time: timeOnly,
          paymentMethod: s.paymentMethod === 'cash' ? 'cash' : 'transfer',
          referenceId: s.invoiceNumber,
          recordedBy: s.cashierName || 'พนักงานขาย',
          note: s.notes || `จำนวน ${s.itemCount} ชิ้น`,
          createdAt: s.createdAt,
          source: 'sale',
        });
      });

    // 2. Manual / Extra Incomes
    incomes.forEach((i) => {
      list.push({
        id: i.id,
        type: 'income',
        title: i.title,
        amount: i.amount,
        category: i.category,
        categoryLabel: incomeCategoryLabels[i.category as keyof typeof incomeCategoryLabels] || i.categoryName || i.category,
        date: i.date,
        time: i.time,
        paymentMethod: i.paymentMethod,
        referenceId: i.referenceId,
        recordedBy: i.recordedBy,
        note: i.note,
        createdAt: i.createdAt,
        source: 'manual_income',
      });
    });

    // 3. Expenses
    expenses.forEach((e) => {
      list.push({
        id: e.id,
        type: 'expense',
        title: e.title,
        amount: e.amount,
        category: e.category,
        categoryLabel: expenseCategoryLabels[e.category] || e.category,
        date: e.date,
        time: e.time,
        paymentMethod: e.paymentMethod,
        referenceId: e.referenceId,
        recordedBy: e.recordedBy,
        note: e.note,
        createdAt: e.createdAt,
        source: 'expense',
      });
    });

    // Sort chronologically descending
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, incomes, expenses]);

  // Filter based on scope (active_period vs all_time)
  const scopedTransactions = useMemo(() => {
    if (scopeFilter === 'active_period' && latestReset) {
      const resetTime = new Date(latestReset.resetDate).getTime();
      return allUnifiedTransactions.filter(
        (t) => new Date(t.createdAt).getTime() > resetTime
      );
    }
    return allUnifiedTransactions;
  }, [allUnifiedTransactions, scopeFilter, latestReset]);

  // Current Overall Financial Summary (for Snapshot Modal & Cards)
  const currentSummary = useMemo(() => {
    const incomeItems = scopedTransactions.filter((t) => t.type === 'income');
    const expenseItems = scopedTransactions.filter((t) => t.type === 'expense');

    const totalRevenue = incomeItems.reduce((acc, i) => acc + (i.amount || 0), 0);
    const totalOperatingExpenses = expenseItems.reduce((acc, e) => acc + (e.amount || 0), 0);
    const netProfit = totalRevenue - totalOperatingExpenses;

    const cashIncome = incomeItems.filter((i) => i.paymentMethod === 'cash').reduce((a, i) => a + i.amount, 0);
    const cashExpense = expenseItems.filter((e) => e.paymentMethod === 'cash').reduce((a, e) => a + e.amount, 0);
    const cashBalance = cashIncome - cashExpense;

    const transferIncome = incomeItems.filter((i) => i.paymentMethod === 'transfer').reduce((a, i) => a + i.amount, 0);
    const transferExpense = expenseItems.filter((e) => e.paymentMethod === 'transfer').reduce((a, e) => a + e.amount, 0);
    const transferBalance = transferIncome - transferExpense;

    return {
      totalRevenue,
      totalOperatingExpenses,
      netProfit,
      cashBalance,
      transferBalance,
      salesCount: incomeItems.length,
      expensesCount: expenseItems.length,
    };
  }, [scopedTransactions]);

  // -------------------------------------------------------------
  // Filtered Lists by Timeframe
  // -------------------------------------------------------------

  // Daily View Data
  const dailyTransactions = useMemo(() => {
    return scopedTransactions.filter((t) => t.date === selectedDay);
  }, [scopedTransactions, selectedDay]);

  const dailyIncomeItems = useMemo(
    () => dailyTransactions.filter((t) => t.type === 'income'),
    [dailyTransactions]
  );
  const dailyExpenseItems = useMemo(
    () => dailyTransactions.filter((t) => t.type === 'expense'),
    [dailyTransactions]
  );

  const dailyTotalIncome = dailyIncomeItems.reduce((a, i) => a + i.amount, 0);
  const dailyTotalExpense = dailyExpenseItems.reduce((a, e) => a + e.amount, 0);
  const dailyNetProfit = dailyTotalIncome - dailyTotalExpense;

  // Monthly View Data
  const monthlyTransactions = useMemo(() => {
    return scopedTransactions.filter((t) => t.date.startsWith(selectedMonthYear));
  }, [scopedTransactions, selectedMonthYear]);

  const monthlyIncomeItems = useMemo(
    () => monthlyTransactions.filter((t) => t.type === 'income'),
    [monthlyTransactions]
  );
  const monthlyExpenseItems = useMemo(
    () => monthlyTransactions.filter((t) => t.type === 'expense'),
    [monthlyTransactions]
  );

  const monthlyTotalIncome = monthlyIncomeItems.reduce((a, i) => a + i.amount, 0);
  const monthlyTotalExpense = monthlyExpenseItems.reduce((a, e) => a + e.amount, 0);
  const monthlyNetProfit = monthlyTotalIncome - monthlyTotalExpense;

  // Monthly Daily Breakdown (Days 1 to 31)
  const monthlyDaysBreakdown = useMemo(() => {
    const [y, m] = selectedMonthYear.split('-').map(Number);
    if (!y || !m) return [];
    const daysInMonth = new Date(y, m, 0).getDate();
    const result = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${selectedMonthYear}-${String(day).padStart(2, '0')}`;
      const dayTxs = monthlyTransactions.filter((t) => t.date === dayStr);
      const inc = dayTxs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
      const exp = dayTxs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
      const profit = inc - exp;
      result.push({
        dayNumber: day,
        dateStr: dayStr,
        income: inc,
        expense: exp,
        profit,
        count: dayTxs.length,
      });
    }
    return result;
  }, [selectedMonthYear, monthlyTransactions]);

  // Yearly View Data
  const yearlyTransactions = useMemo(() => {
    const yStr = String(selectedYear);
    return scopedTransactions.filter((t) => t.date.startsWith(yStr));
  }, [scopedTransactions, selectedYear]);

  const yearlyIncomeItems = useMemo(
    () => yearlyTransactions.filter((t) => t.type === 'income'),
    [yearlyTransactions]
  );
  const yearlyExpenseItems = useMemo(
    () => yearlyTransactions.filter((t) => t.type === 'expense'),
    [yearlyTransactions]
  );

  const yearlyTotalIncome = yearlyIncomeItems.reduce((a, i) => a + i.amount, 0);
  const yearlyTotalExpense = yearlyExpenseItems.reduce((a, e) => a + e.amount, 0);
  const yearlyNetProfit = yearlyTotalIncome - yearlyTotalExpense;

  // Yearly 12-Month Breakdown
  const yearly12MonthsBreakdown = useMemo(() => {
    const yStr = String(selectedYear);
    return Array.from({ length: 12 }, (_, idx) => {
      const mStr = String(idx + 1).padStart(2, '0');
      const yearMonth = `${yStr}-${mStr}`;
      const monthTxs = yearlyTransactions.filter((t) => t.date.startsWith(yearMonth));
      const inc = monthTxs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
      const exp = monthTxs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
      const profit = inc - exp;
      return {
        monthIndex: idx,
        monthName: thaiMonths[idx],
        yearMonth,
        income: inc,
        expense: exp,
        profit,
        count: monthTxs.length,
      };
    });
  }, [yearlyTransactions, selectedYear]);

  // Profit Report Data (P&L Breakdown)
  const pnlData = useMemo(() => {
    // Determine target transactions based on period selector or selected month
    const targetSales = sales.filter((s) => s.status === 'completed');
    const grossSalesRevenue = targetSales.reduce((a, s) => a + (s.totalAmount || 0), 0);
    const cogs = targetSales.reduce((a, s) => a + (s.totalCost || 0), 0);
    const grossProfit = grossSalesRevenue - cogs;

    const otherIncomes = incomes.reduce((a, i) => a + (i.amount || 0), 0);
    const operatingExpenses = expenses.reduce((a, e) => a + (e.amount || 0), 0);
    const netProfit = grossProfit + otherIncomes - operatingExpenses;

    const totalCashIn = targetSales
      .filter((s) => s.paymentMethod === 'cash')
      .reduce((a, s) => a + s.totalAmount, 0) +
      incomes.filter((i) => i.paymentMethod === 'cash').reduce((a, i) => a + i.amount, 0);

    const totalTransferIn = targetSales
      .filter((s) => s.paymentMethod === 'transfer')
      .reduce((a, s) => a + s.totalAmount, 0) +
      incomes.filter((i) => i.paymentMethod === 'transfer').reduce((a, i) => a + i.amount, 0);

    const totalCashOut = expenses.filter((e) => e.paymentMethod === 'cash').reduce((a, e) => a + e.amount, 0);
    const totalTransferOut = expenses.filter((e) => e.paymentMethod === 'transfer').reduce((a, e) => a + e.amount, 0);

    return {
      grossSalesRevenue,
      cogs,
      grossProfit,
      grossMarginPct: grossSalesRevenue > 0 ? ((grossProfit / grossSalesRevenue) * 100).toFixed(1) : '0',
      otherIncomes,
      operatingExpenses,
      netProfit,
      netMarginPct: grossSalesRevenue > 0 ? ((netProfit / grossSalesRevenue) * 100).toFixed(1) : '0',
      totalCashIn,
      totalTransferIn,
      totalCashOut,
      totalTransferOut,
      netCashFlow: (totalCashIn + totalTransferIn) - (totalCashOut + totalTransferOut),
    };
  }, [sales, incomes, expenses]);

  // All Transactions Filtered Query
  const filteredAllTransactions = useMemo(() => {
    return scopedTransactions.filter((tx) => {
      // Type
      if (filterType !== 'all' && tx.type !== filterType) return false;

      // Category
      if (filterCategory !== 'all' && tx.category !== filterCategory) return false;

      // Payment method
      if (filterPaymentMethod !== 'all' && tx.paymentMethod !== filterPaymentMethod) return false;

      // Date Range
      if (filterDateFrom && tx.date < filterDateFrom) return false;
      if (filterDateTo && tx.date > filterDateTo) return false;

      // Amount Range
      const min = parseFloat(filterMinAmount);
      const max = parseFloat(filterMaxAmount);
      if (!isNaN(min) && tx.amount < min) return false;
      if (!isNaN(max) && tx.amount > max) return false;

      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchRef = tx.referenceId && tx.referenceId.toLowerCase().includes(q);
        const matchRecorder = tx.recordedBy && tx.recordedBy.toLowerCase().includes(q);
        const matchNote = tx.note && tx.note.toLowerCase().includes(q);
        const matchCat = tx.categoryLabel.toLowerCase().includes(q);
        if (!matchTitle && !matchRef && !matchRecorder && !matchNote && !matchCat) {
          return false;
        }
      }

      return true;
    });
  }, [
    scopedTransactions,
    filterType,
    filterCategory,
    filterPaymentMethod,
    filterDateFrom,
    filterDateTo,
    filterMinAmount,
    filterMaxAmount,
    searchQuery,
  ]);

  // Quick Day navigation
  const handleShiftDay = (days: number) => {
    const cur = new Date(selectedDay);
    cur.setDate(cur.getDate() + days);
    setSelectedDay(cur.toISOString().split('T')[0]);
  };

  // Quick Month navigation
  const handleShiftMonth = (months: number) => {
    const [y, m] = selectedMonthYear.split('-').map(Number);
    const d = new Date(y, m - 1 + months, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonthYear(`${newY}-${newM}`);
  };

  // Delete transaction handler
  const handleDeleteTransaction = (item: UnifiedTransactionItem) => {
    setItemToDelete(item);
  };

  const handleConfirmDeleteTransaction = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.source === 'manual_income') {
        await deleteIncome(itemToDelete.id);
      } else if (itemToDelete.source === 'expense') {
        await deleteExpense(itemToDelete.id);
      }
      setSelectedDetailItem(null);
      setItemToDelete(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">
              ประวัติรายรับ–รายจ่ายย้อนหลัง (Income & Expense History)
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              ระบบบัญชีมืออาชีพ
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกและตรวจสอบประวัติย้อนหลัง รายวัน รายเดือน และรายปี โดยไม่ลบข้อมูลเก่าเมื่อขึ้นเดือนใหม่
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Income */}
          <button
            type="button"
            onClick={() => setIsIncomeModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <TrendingUp className="w-4 h-4" />
            <span>+ บันทึกรายรับ</span>
          </button>

          {/* Add Expense */}
          <button
            type="button"
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <TrendingDown className="w-4 h-4" />
            <span>+ บันทึกรายจ่าย</span>
          </button>

          {/* Admin Finance Reset Checkpoint */}
          {(currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs md:text-sm font-semibold shadow-xs transition active:scale-95 cursor-pointer"
              title="บันทึก Checkpoint ตัดรอบการเงินของ Admin"
            >
              <RotateCcw className="w-4 h-4 text-amber-700" />
              <span>รีเซ็ตรอบการเงิน (Admin)</span>
            </button>
          )}
        </div>
      </div>

      {/* Scope Filter Banner (Active Period vs All Time) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 px-4 rounded-xl border border-slate-200 shadow-xs text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <Database className="w-4 h-4 text-blue-600" />
          <span>
            ขอบเขตข้อมูลที่แสดง:
            {scopeFilter === 'active_period' && latestReset ? (
              <strong className="text-slate-800 ml-1">
                รอบปัจจุบัน (หลังการรีเซ็ตล่าสุดเมื่อ {formatDateOnly(latestReset.resetDate)})
              </strong>
            ) : (
              <strong className="text-slate-800 ml-1">ประวัติทั้งหมดตลอดกาล (All-Time Historical)</strong>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setScopeFilter('active_period')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              scopeFilter === 'active_period'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            รอบปัจจุบัน (Active)
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('all_time')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              scopeFilter === 'all_time'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ประวัติทั้งหมด (All-time)
          </button>
        </div>
      </div>

      {/* 9 Main Sub-Tabs Menu */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          {subTabNav.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as FinanceSubTab)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. DAILY INCOME (รายรับรายวัน) */}
      {/* ============================================================== */}
      {activeSubTab === 'daily_income' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Day Selector Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleShiftDay(-1)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="วันก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="px-3.5 py-2 text-xs md:text-sm font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => handleShiftDay(1)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="วันถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedDay(todayStr)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                วันนี้
              </button>
            </div>

            <div className="text-xs text-slate-500">
              วันที่เลือก: <strong className="text-slate-800">{formatDateOnly(selectedDay)}</strong>
            </div>
          </div>

          {/* Daily Income Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                รายรับรวมประจำวัน
              </span>
              <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 mt-2 font-mono">
                {formatCurrency(dailyTotalIncome, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">ทั้งหมด {dailyIncomeItems.length} รายการ</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
                รายจ่ายรวมประจำวัน
              </span>
              <p className="text-2xl md:text-3xl font-extrabold text-rose-600 mt-2 font-mono">
                {formatCurrency(dailyTotalExpense, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">ทั้งหมด {dailyExpenseItems.length} รายการ</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                กำไรสุทธิประจำวัน (Income - Expense)
              </span>
              <p
                className={`text-2xl md:text-3xl font-extrabold mt-2 font-mono ${
                  dailyNetProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'
                }`}
              >
                {formatCurrency(dailyNetProfit, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {dailyNetProfit >= 0 ? 'กำไรเป็นบวก' : 'ขาดทุนสุทธิในวันนี้'}
              </p>
            </div>
          </div>

          {/* Table of Daily Income Items */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>รายการรายรับของวันที่ {formatDateOnly(selectedDay)}</span>
              </h3>
              <span className="text-xs text-slate-400">{dailyIncomeItems.length} รายการ</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="py-3 px-4">เวลา</th>
                    <th className="py-3 px-4">รายการรายรับ</th>
                    <th className="py-3 px-4">หมวดหมู่</th>
                    <th className="py-3 px-4 text-right">จำนวนเงิน</th>
                    <th className="py-3 px-4">ช่องทาง</th>
                    <th className="py-3 px-4">เอกสารอ้างอิง</th>
                    <th className="py-3 px-4">ผู้บันทึก</th>
                    <th className="py-3 px-4 text-center">ดูข้อมูล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyIncomeItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <TrendingUp className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-medium">ไม่มีรายการรายรับในวันที่เลือก</p>
                      </td>
                    </tr>
                  ) : (
                    dailyIncomeItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                          {item.time || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800">{item.title}</p>
                          {item.note && <p className="text-[11px] text-slate-400 line-clamp-1">{item.note}</p>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                            {item.categoryLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 font-mono">
                          +{formatCurrency(item.amount, currency)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {item.paymentMethod === 'cash' ? '💵 เงินสด' : '📱 เงินโอน'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-blue-600">
                          {item.referenceId ? `#${item.referenceId}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{item.recordedBy || 'พนักงาน'}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailItem(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="ดูรายละเอียด"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. MONTHLY INCOME (รายรับรายเดือน) */}
      {/* ============================================================== */}
      {activeSubTab === 'monthly_income' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Month Selector Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleShiftMonth(-1)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="month"
                value={selectedMonthYear}
                onChange={(e) => setSelectedMonthYear(e.target.value)}
                className="px-3.5 py-2 text-xs md:text-sm font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => handleShiftMonth(1)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="เดือนถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedMonthYear(`${currentYear}-${currentMonth}`)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                เดือนปัจจุบัน
              </button>
            </div>

            <div className="text-xs text-slate-500">
              งวดเดือน: <strong className="text-slate-800">{selectedMonthYear}</strong>
            </div>
          </div>

          {/* Monthly Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                รายรับรวมประจำเดือน ({selectedMonthYear})
              </span>
              <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 mt-2 font-mono">
                {formatCurrency(monthlyTotalIncome, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">ทั้งหมด {monthlyIncomeItems.length} รายการ</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
                รายจ่ายรวมประจำเดือน
              </span>
              <p className="text-2xl md:text-3xl font-extrabold text-rose-600 mt-2 font-mono">
                {formatCurrency(monthlyTotalExpense, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">ทั้งหมด {monthlyExpenseItems.length} รายการ</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                กำไรสุทธิประจำเดือน
              </span>
              <p
                className={`text-2xl md:text-3xl font-extrabold mt-2 font-mono ${
                  monthlyNetProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'
                }`}
              >
                {formatCurrency(monthlyNetProfit, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {monthlyNetProfit >= 0 ? 'กำไรประจำงวดเป็นบวก' : 'ขาดทุนสุทธิประจำเดือน'}
              </p>
            </div>
          </div>

          {/* Daily Breakdown inside Month */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-600" />
                <span>สรุปเปรียบเทียบรายรับ–รายจ่ายรายวันในเดือน {selectedMonthYear}</span>
              </h3>
              <span className="text-xs text-slate-400">31 วัน</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="py-3 px-4">วันที่</th>
                    <th className="py-3 px-4 text-center">จำนวนรายการ</th>
                    <th className="py-3 px-4 text-right">รายรับ (Income)</th>
                    <th className="py-3 px-4 text-right">รายจ่าย (Expense)</th>
                    <th className="py-3 px-4 text-right">กำไรสุทธิ</th>
                    <th className="py-3 px-4 text-center">ดูรายวัน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyDaysBreakdown.map((row) => (
                    <tr
                      key={row.dayNumber}
                      className={`hover:bg-slate-50 transition ${row.count > 0 ? 'bg-white' : 'opacity-60'}`}
                    >
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                        {row.dateStr}
                      </td>
                      <td className="py-2.5 px-4 text-center text-slate-600 font-mono">
                        {row.count}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-600 font-mono">
                        {row.income > 0 ? `+${formatCurrency(row.income, currency)}` : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-rose-600 font-mono">
                        {row.expense > 0 ? `-${formatCurrency(row.expense, currency)}` : '-'}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-bold font-mono ${
                          row.profit > 0 ? 'text-indigo-600' : row.profit < 0 ? 'text-rose-600' : 'text-slate-400'
                        }`}
                      >
                        {formatCurrency(row.profit, currency)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDay(row.dateStr);
                            setActiveSubTab('daily_income');
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        >
                          เปิดรายวัน
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. YEARLY INCOME (รายรับรายปี) */}
      {/* ============================================================== */}
      {activeSubTab === 'yearly_income' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Year Selector Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y - 1)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="ปีก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 text-base font-extrabold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl font-mono">
                ปี ค.ศ. {selectedYear} (พ.ศ. {selectedYear + 543})
              </span>
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y + 1)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="ปีถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedYear(currentYear)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                ปีปัจจุบัน
              </button>
            </div>

            <div className="text-xs text-slate-500">
              ยอดสรุปทั้งปี: <strong className="text-slate-800">{selectedYear}</strong>
            </div>
          </div>

          {/* Yearly Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                รายรับรวมทั้งปี {selectedYear}
              </span>
              <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 mt-2 font-mono">
                {formatCurrency(yearlyTotalIncome, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">จาก {yearlyIncomeItems.length} รายการรับ</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
                รายจ่ายรวมทั้งปี {selectedYear}
              </span>
              <p className="text-2xl md:text-3xl font-extrabold text-rose-600 mt-2 font-mono">
                {formatCurrency(yearlyTotalExpense, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">จาก {yearlyExpenseItems.length} รายการจ่าย</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                กำไรสุทธิทั้งปี {selectedYear}
              </span>
              <p
                className={`text-2xl md:text-3xl font-extrabold mt-2 font-mono ${
                  yearlyNetProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'
                }`}
              >
                {formatCurrency(yearlyNetProfit, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">ผลประกอบการสุทธิประจำปี</p>
            </div>
          </div>

          {/* 12 Months Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>สรุปแยก 12 เดือน ประจำปี {selectedYear}</span>
              </h3>
              <span className="text-xs text-slate-400">คลิกที่เดือนเพื่อดูรายละเอียดเจาะลึก</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="py-3 px-4">เดือน</th>
                    <th className="py-3 px-4 text-center">จำนวนรายการ</th>
                    <th className="py-3 px-4 text-right">รายรับรวม</th>
                    <th className="py-3 px-4 text-right">รายจ่ายรวม</th>
                    <th className="py-3 px-4 text-right">กำไรสุทธิ</th>
                    <th className="py-3 px-4 text-center">ดูรายละเอียดเดือน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {yearly12MonthsBreakdown.map((m) => (
                    <tr key={m.monthIndex} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {m.monthName} ({m.yearMonth})
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 font-mono">
                        {m.count}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 font-mono">
                        {m.income > 0 ? `+${formatCurrency(m.income, currency)}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600 font-mono">
                        {m.expense > 0 ? `-${formatCurrency(m.expense, currency)}` : '-'}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold font-mono ${
                          m.profit > 0 ? 'text-indigo-600' : m.profit < 0 ? 'text-rose-600' : 'text-slate-400'
                        }`}
                      >
                        {formatCurrency(m.profit, currency)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMonthYear(m.yearMonth);
                            setActiveSubTab('monthly_income');
                          }}
                          className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          ดูงวดเดือนนี้
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. DAILY EXPENSES (รายจ่ายรายวัน) */}
      {/* ============================================================== */}
      {activeSubTab === 'daily_expense' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Day Selector */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleShiftDay(-1)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="วันก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="px-3.5 py-2 text-xs md:text-sm font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => handleShiftDay(1)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="วันถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedDay(todayStr)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                วันนี้
              </button>
            </div>

            <div className="text-xs text-slate-500">
              วันที่เลือก: <strong className="text-slate-800">{formatDateOnly(selectedDay)}</strong>
            </div>
          </div>

          {/* Daily Expense Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
                รวมรายจ่ายในวันที่ {formatDateOnly(selectedDay)}
              </span>
              <p className="text-3xl font-extrabold text-rose-600 mt-2 font-mono">
                {formatCurrency(dailyTotalExpense, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">ทั้งหมด {dailyExpenseItems.length} รายการ</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  ต้องการเพิ่มรายจ่ายประจำวัน?
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  บันทึกค่าใช้จ่าย ค่าไฟ ค่าน้ำ ค่าขนส่ง ค่าแรง ฯลฯ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(true)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
              >
                + บันทึกรายจ่าย
              </button>
            </div>
          </div>

          {/* Table of Daily Expense Items */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <span>รายการรายจ่ายของวันที่ {formatDateOnly(selectedDay)}</span>
              </h3>
              <span className="text-xs text-slate-400">{dailyExpenseItems.length} รายการ</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="py-3 px-4">เวลา</th>
                    <th className="py-3 px-4">รายการรายจ่าย</th>
                    <th className="py-3 px-4">หมวดหมู่</th>
                    <th className="py-3 px-4 text-right">จำนวนเงิน</th>
                    <th className="py-3 px-4">วิธีจ่าย</th>
                    <th className="py-3 px-4">ผู้บันทึก</th>
                    <th className="py-3 px-4 text-center">ดูข้อมูล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyExpenseItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <TrendingDown className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-medium">ไม่มีรายการรายจ่ายในวันที่เลือก</p>
                      </td>
                    </tr>
                  ) : (
                    dailyExpenseItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                          {item.time || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800">{item.title}</p>
                          {item.note && <p className="text-[11px] text-slate-400 line-clamp-1">{item.note}</p>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200/80">
                            {item.categoryLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600 font-mono">
                          -{formatCurrency(item.amount, currency)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {item.paymentMethod === 'cash' ? '💵 เงินสด' : '📱 เงินโอน'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{item.recordedBy || 'พนักงาน'}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailItem(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="ดูรายละเอียด"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MONTHLY EXPENSES (รายจ่ายรายเดือน) */}
      {/* ============================================================== */}
      {activeSubTab === 'monthly_expense' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Month Selector */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleShiftMonth(-1)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="month"
                value={selectedMonthYear}
                onChange={(e) => setSelectedMonthYear(e.target.value)}
                className="px-3.5 py-2 text-xs md:text-sm font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => handleShiftMonth(1)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="เดือนถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedMonthYear(`${currentYear}-${currentMonth}`)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                เดือนปัจจุบัน
              </button>
            </div>

            <div className="text-xs text-slate-500">
              งวดเดือน: <strong className="text-slate-800">{selectedMonthYear}</strong>
            </div>
          </div>

          {/* Monthly Expense Stat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
                รวมรายจ่ายในเดือน {selectedMonthYear}
              </span>
              <p className="text-3xl font-extrabold text-rose-600 mt-2 font-mono">
                {formatCurrency(monthlyTotalExpense, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">จาก {monthlyExpenseItems.length} รายการจ่าย</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                ช่องทางจ่ายเงินในเดือนนี้
              </span>
              <div className="mt-3 flex justify-between text-xs">
                <div>
                  <span className="text-slate-400 block">จ่ายเงินสด:</span>
                  <span className="font-bold text-slate-800 text-base font-mono">
                    {formatCurrency(
                      monthlyExpenseItems
                        .filter((e) => e.paymentMethod === 'cash')
                        .reduce((a, e) => a + e.amount, 0),
                      currency
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">จ่ายเงินโอน:</span>
                  <span className="font-bold text-slate-800 text-base font-mono">
                    {formatCurrency(
                      monthlyExpenseItems
                        .filter((e) => e.paymentMethod === 'transfer')
                        .reduce((a, e) => a + e.amount, 0),
                      currency
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Expense Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <span>รายการรายจ่ายทั้งหมดในเดือน {selectedMonthYear}</span>
              </h3>
              <span className="text-xs text-slate-400">{monthlyExpenseItems.length} รายการ</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="py-3 px-4">วันที่</th>
                    <th className="py-3 px-4">รายการรายจ่าย</th>
                    <th className="py-3 px-4">หมวดหมู่</th>
                    <th className="py-3 px-4 text-right">จำนวนเงิน</th>
                    <th className="py-3 px-4">ช่องทาง</th>
                    <th className="py-3 px-4">ผู้บันทึก</th>
                    <th className="py-3 px-4 text-center">ดูข้อมูล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyExpenseItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        ไม่มีรายการรายจ่ายในเดือนนี้
                      </td>
                    </tr>
                  ) : (
                    monthlyExpenseItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                          {formatDateOnly(item.date)}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800">{item.title}</p>
                          {item.note && <p className="text-[11px] text-slate-400">{item.note}</p>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200/80">
                            {item.categoryLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600 font-mono">
                          -{formatCurrency(item.amount, currency)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {item.paymentMethod === 'cash' ? '💵 เงินสด' : '📱 เงินโอน'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{item.recordedBy}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailItem(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. YEARLY EXPENSES (รายจ่ายรายปี) */}
      {/* ============================================================== */}
      {activeSubTab === 'yearly_expense' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Year Selector */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y - 1)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="ปีก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 text-base font-extrabold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl font-mono">
                ปี ค.ศ. {selectedYear}
              </span>
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y + 1)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="ปีถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedYear(currentYear)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                ปีปัจจุบัน
              </button>
            </div>

            <div className="text-xs text-slate-500">
              รายจ่ายทั้งปี: <strong className="text-slate-800">{selectedYear}</strong>
            </div>
          </div>

          {/* Stat */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
              รวมรายจ่ายทั้งปี {selectedYear}
            </span>
            <p className="text-3xl font-extrabold text-rose-600 mt-2 font-mono">
              {formatCurrency(yearlyTotalExpense, currency)}
            </p>
            <p className="text-xs text-slate-400 mt-1">ทั้งหมด {yearlyExpenseItems.length} รายการจ่ายตลอดปี</p>
          </div>

          {/* 12 Months Breakdown for Expenses */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-600" />
                <span>สรุปรายจ่ายแยก 12 เดือน ประจำปี {selectedYear}</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="py-3 px-4">เดือน</th>
                    <th className="py-3 px-4 text-center">จำนวนบิลจ่าย</th>
                    <th className="py-3 px-4 text-right">รายจ่ายรวม</th>
                    <th className="py-3 px-4 text-center">ดูรายเดือน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {yearly12MonthsBreakdown.map((m) => (
                    <tr key={m.monthIndex} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {m.monthName} ({m.yearMonth})
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 font-mono">
                        {yearlyExpenseItems.filter((e) => e.date.startsWith(m.yearMonth)).length}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600 font-mono">
                        {m.expense > 0 ? `-${formatCurrency(m.expense, currency)}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMonthYear(m.yearMonth);
                            setActiveSubTab('monthly_expense');
                          }}
                          className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          ดูรายจ่ายเดือนนี้
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. PROFIT REPORT (รายงานกำไรสุทธิ และ P&L Statement) */}
      {/* ============================================================== */}
      {activeSubTab === 'profit' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Income Statement (P&L) Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Gross Revenue */}
            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-md">
              <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
                1. ยอดขายสินค้าหน้าร้าน (Sales Revenue)
              </span>
              <p className="text-3xl font-extrabold mt-2 font-mono">
                {formatCurrency(pnlData.grossSalesRevenue, currency)}
              </p>
              <div className="mt-4 pt-3 border-t border-blue-800/80 text-xs text-blue-200 flex justify-between">
                <span>หักต้นทุนขาย (COGS):</span>
                <span className="font-bold text-white font-mono">
                  -{formatCurrency(pnlData.cogs, currency)}
                </span>
              </div>
            </div>

            {/* 2. Gross Profit */}
            <div className="bg-gradient-to-br from-emerald-800 to-teal-900 text-white p-5 rounded-2xl shadow-md">
              <span className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">
                2. กำไรขั้นต้น (Gross Profit)
              </span>
              <p className="text-3xl font-extrabold mt-2 font-mono">
                {formatCurrency(pnlData.grossProfit, currency)}
              </p>
              <p className="text-xs text-emerald-200 mt-1">
                อัตรากำไรขั้นต้น: <span className="font-bold text-white font-mono">{pnlData.grossMarginPct}%</span>
              </p>
              <div className="mt-4 pt-3 border-t border-emerald-700/80 text-xs text-emerald-200 flex justify-between">
                <span>รายรับอื่นๆ เพิ่มเติม:</span>
                <span className="font-bold text-white font-mono">
                  +{formatCurrency(pnlData.otherIncomes, currency)}
                </span>
              </div>
            </div>

            {/* 3. Net Profit */}
            <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-5 rounded-2xl shadow-md">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                3. กำไรสุทธิ (Net Profit)
              </span>
              <p
                className={`text-3xl font-extrabold mt-2 font-mono ${
                  pnlData.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatCurrency(pnlData.netProfit, currency)}
              </p>
              <p className="text-xs text-slate-300 mt-1">
                อัตรากำไรสุทธิ: <span className="font-bold text-white font-mono">{pnlData.netMarginPct}%</span>
              </p>
              <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-300 flex justify-between">
                <span>กระแสเงินสดสุทธิ (Cash Flow):</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {formatCurrency(pnlData.netCashFlow, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Accounting Principle Explanatory Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>หลักการคำนวณความถูกต้องทางบัญชี (Accounting Compliance)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong className="text-slate-800 block mb-1">
                  1. การแยกยอดขาย และการรับชำระหนี้ (No Double Counting)
                </strong>
                ระบบบันทึกยอดขายสินค้าและรับรู้กำไรตั้งแต่ตอนเกิดรายการขาย (Sales) ส่วนการรับชำระหนี้เก่าของลูกค้าถือเป็น
                <strong>กระแสเงินสดรับ (Cash Inflow)</strong> ไม่นับซ้ำในยอดขายหรือกำไร
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong className="text-slate-800 block mb-1">
                  2. การแยกผลกำไร ออกจากกระแสเงินสด (Profit vs Cash Flow)
                </strong>
                กำไรสุทธิคำนวณจาก (ยอดขาย + รายรับอื่นๆ) - (ต้นทุนสินค้า COGS + ค่าใช้จ่ายดำเนินงาน)
                ขณะที่กระแสเงินสดวัดจากเงินสดและเงินโอนที่เข้าออกจริง
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8. ALL TRANSACTIONS LEDGER (ประวัติรายการทั้งหมด) */}
      {/* ============================================================== */}
      {activeSubTab === 'all_transactions' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Advanced Search & Filter Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Text Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อรายการ, เลขอ้างอิง, ผู้บันทึก หรือหมายเหตุ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                />
              </div>

              {/* Type Filter */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(['all', 'income', 'expense'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      filterType === t
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t === 'all' ? 'ทุกประเภท' : t === 'income' ? 'เฉพาะรายรับ' : 'เฉพาะรายจ่าย'}
                  </button>
                ))}
              </div>
            </div>

            {/* Secondary Filter Row: Date Range & Amount Range */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">จากวันที่:</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">ถึงวันที่:</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">จำนวนเงินขั้นต่ำ:</label>
                <input
                  type="number"
                  placeholder="0"
                  value={filterMinAmount}
                  onChange={(e) => setFilterMinAmount(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">จำนวนเงินสูงสุด:</label>
                <input
                  type="number"
                  placeholder="ไม่จำกัด"
                  value={filterMaxAmount}
                  onChange={(e) => setFilterMaxAmount(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden font-mono"
                />
              </div>
            </div>

            {/* Reset Filters button */}
            {(searchQuery || filterType !== 'all' || filterCategory !== 'all' || filterDateFrom || filterDateTo || filterMinAmount || filterMaxAmount) && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('all');
                    setFilterCategory('all');
                    setFilterDateFrom('');
                    setFilterDateTo('');
                    setFilterMinAmount('');
                    setFilterMaxAmount('');
                    showToast('รีเซ็ตตัวกรองการค้นหาแล้ว', 'info');
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                  <span>ล้างตัวกรองทั้งหมด</span>
                </button>
              </div>
            )}
          </div>

          {/* Unified Transactions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                <span>สมุดบัญชีรายรับ–รายจ่ายรวม (พบ {filteredAllTransactions.length} รายการ)</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="py-3 px-4">วัน-เวลา</th>
                    <th className="py-3 px-4">ประเภท</th>
                    <th className="py-3 px-4">รายการ</th>
                    <th className="py-3 px-4">หมวดหมู่</th>
                    <th className="py-3 px-4 text-right">จำนวนเงิน</th>
                    <th className="py-3 px-4">ช่องทาง</th>
                    <th className="py-3 px-4">ผู้บันทึก</th>
                    <th className="py-3 px-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAllTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        ไม่พบประวัติรายการตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  ) : (
                    filteredAllTransactions.map((item) => {
                      const isInc = item.type === 'income';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                            {item.date} {item.time ? `(${item.time})` : ''}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                isInc
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isInc ? 'รายรับ (+)' : 'รายจ่าย (-)'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-800">{item.title}</p>
                            {item.referenceId && (
                              <span className="text-[10px] text-blue-600 font-mono">
                                #{item.referenceId}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                              {item.categoryLabel}
                            </span>
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold font-mono ${
                              isInc ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isInc ? '+' : '-'}{formatCurrency(item.amount, currency)}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {item.paymentMethod === 'cash' ? '💵 เงินสด' : '📱 เงินโอน'}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">{item.recordedBy || 'พนักงาน'}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailItem(item)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="ดูรายละเอียด"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 9. RESET HISTORY (ประวัติการรีเซ็ตระบบ / Checkpoints) */}
      {/* ============================================================== */}
      {activeSubTab === 'reset_history' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Header Explanation */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>ประวัติจุดตัดรอบการเงินและสำรองข้อมูล (Finance Reset Checkpoints)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ประวัติการรีเซ็ตรอบบัญชีที่ดำเนินการโดยผู้ดูแลระบบ (Admin) ข้อมูลประวัติจริงในอดีตจะถูกเก็บรักษาไว้ครบถ้วน
              </p>
            </div>

            {(currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>+ บันทึกตัดรอบการเงินใหม่</span>
              </button>
            )}
          </div>

          {/* Reset Checkpoint List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="py-3 px-4">วัน-เวลาที่รีเซ็ต</th>
                    <th className="py-3 px-4">งวดบัญชี</th>
                    <th className="py-3 px-4">วัตถุประสงค์ / เหตุผล</th>
                    <th className="py-3 px-4 text-right">ยอดรับก่อนรีเซ็ต</th>
                    <th className="py-3 px-4 text-right">ยอดจ่ายก่อนรีเซ็ต</th>
                    <th className="py-3 px-4 text-right">กำไรก่อนรีเซ็ต</th>
                    <th className="py-3 px-4">ผู้ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {financeResets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <ShieldCheck className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                        <p className="font-semibold text-slate-700">ยังไม่มีการบันทึกรีเซ็ตรอบการเงิน</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          ยอดการเงินปัจจุบันคือยอดรวมต่อเนื่องทั้งหมดตั้งแต่เริ่มเปิดใช้งานระบบ
                        </p>
                      </td>
                    </tr>
                  ) : (
                    financeResets.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 text-slate-700 font-mono text-xs whitespace-nowrap">
                          {formatDateTime(r.resetDate)}
                        </td>
                        <td className="py-3 px-4 font-bold text-blue-700">
                          {r.periodLabel || 'รอบการเงิน'}
                        </td>
                        <td className="py-3 px-4 text-slate-700">{r.reason}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 font-mono">
                          {formatCurrency(r.totalIncomeBefore, currency)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600 font-mono">
                          {formatCurrency(r.totalExpenseBefore, currency)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-700 font-mono">
                          {formatCurrency(r.netProfitBefore, currency)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-xs">{r.resetBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <IncomeModal isOpen={isIncomeModalOpen} onClose={() => setIsIncomeModalOpen(false)} />
      <ExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} />
      <FinanceResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        currentSummary={currentSummary}
      />
      <TransactionDetailModal
        item={selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        onDelete={handleDeleteTransaction}
      />
      <ResetConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDeleteTransaction}
        title="ยืนยันการลบรายการ"
        description={`คุณต้องการลบรายการ "${itemToDelete?.title}" ออกจากระบบหรือไม่?`}
        confirmLabel="ยืนยันลบรายการ"
      />
    </div>
  );
};
