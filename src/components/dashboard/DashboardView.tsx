import React, { useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  Users,
  CreditCard,
  ShoppingCart,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatNumber, formatDateTime } from '../../utils/formatters';

export const DashboardView: React.FC = () => {
  const {
    sales,
    products,
    customers,
    expenses,
    currency,
    setActiveTab,
    setPosMode,
    t,
  } = useApp();

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Sales metrics
  const metrics = useMemo(() => {
    // Only completed sales (exclude voided)
    const validSales = sales.filter((s) => s.status === 'completed');

    const todaySalesList = validSales.filter((s) => s.createdAt.startsWith(todayStr));
    const todaySales = todaySalesList.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const todayCost = todaySalesList.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    // Explicit Profit calculation: Revenue - Cost
    const todayProfit = todaySales - todayCost;

    const monthSalesList = validSales.filter((s) => s.createdAt.startsWith(currentMonthStr));
    const monthSales = monthSalesList.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const monthCost = monthSalesList.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    const monthProfit = monthSales - monthCost;

    // Month expenses
    const monthExpensesList = expenses.filter((e) => e.date.startsWith(currentMonthStr));
    const monthExpensesTotal = monthExpensesList.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netMonthProfit = monthProfit - monthExpensesTotal;

    // Inventory metrics
    const totalProducts = products.length;
    const lowStockProducts = products.filter(
      (p) => p.stockQty <= (p.minStockAlert || 10) && p.stockQty > 0
    );
    const outOfStockProducts = products.filter((p) => p.stockQty <= 0);

    // Customer metrics
    const totalCustomers = customers.length;
    const totalOutstandingDebt = customers.reduce((sum, c) => sum + (c.outstandingDebt || 0), 0);

    return {
      todaySales,
      todayProfit,
      todayOrdersCount: todaySalesList.length,
      monthSales,
      monthProfit,
      monthExpensesTotal,
      netMonthProfit,
      totalProducts,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      lowStockProducts,
      totalCustomers,
      totalOutstandingDebt,
    };
  }, [sales, products, customers, expenses, todayStr, currentMonthStr]);

  // Top 10 Bestselling Products
  const topProducts = useMemo(() => {
    const map: Record<
      string,
      {
        productId: string;
        name: string;
        sku: string;
        qty: number;
        revenue: number;
        profit: number;
        unit: string;
      }
    > = {};

    const validSales = sales.filter((s) => s.status === 'completed');
    for (const sale of validSales) {
      if (sale.items) {
        for (const item of sale.items) {
          if (!map[item.productId]) {
            map[item.productId] = {
              productId: item.productId,
              name: item.productName,
              sku: item.sku,
              qty: 0,
              revenue: 0,
              profit: 0,
              unit: item.unit || 'ชิ้น',
            };
          }
          map[item.productId].qty += item.quantity;
          map[item.productId].revenue += item.totalPrice;
          map[item.productId].profit += item.profit;
        }
      }
    }

    return Object.values(map)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [sales]);

  // Last 7 days sales for simple bar visualization
  const last7DaysData = useMemo(() => {
    const days: { dateLabel: string; dateStr: string; amount: number; profit: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const str = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' });

      const daySales = sales
        .filter((s) => s.status === 'completed' && s.createdAt.startsWith(str))
        .reduce((sum, s) => sum + s.totalAmount, 0);

      const dayProfit = sales
        .filter((s) => s.status === 'completed' && s.createdAt.startsWith(str))
        .reduce((sum, s) => sum + s.totalProfit, 0);

      days.push({ dateLabel: label, dateStr: str, amount: daySales, profit: dayProfit });
    }
    return days;
  }, [sales]);

  const maxDailyAmount = Math.max(...last7DaysData.map((d) => d.amount), 1000);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Quick Action Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-md">
        <div>
          <h2 className="text-xl font-bold">ระบบ POS ค้าส่งและค้าปลีก</h2>
          <p className="text-blue-200 text-xs md:text-sm mt-0.5">
            ภาพรวมการขาย สินค้าคงคลัง และผลกำไรประจำวัน
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              setPosMode('retail');
              setActiveTab('pos');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs md:text-sm font-semibold transition shadow-sm active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" />
            เปิดการขายปลีก
          </button>
          <button
            onClick={() => {
              setPosMode('wholesale');
              setActiveTab('pos');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs md:text-sm font-semibold transition shadow-sm active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" />
            เปิดการขายส่ง (Wholesale)
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs md:text-sm font-semibold transition"
          >
            <Package className="w-4 h-4" />
            รับสินค้าเข้าสต็อก
          </button>
        </div>
      </div>

      {/* KPI Stat Cards (4 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ยอดขายวันนี้</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {formatCurrency(metrics.todaySales, currency)}
          </p>
          <div className="flex items-center justify-between text-xs mt-2 text-slate-500">
            <span>{metrics.todayOrdersCount} บิลขาย</span>
            <span className="text-emerald-600 font-medium">กำไร: {formatCurrency(metrics.todayProfit, currency)}</span>
          </div>
        </div>

        {/* Month's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ยอดขายเดือนนี้</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {formatCurrency(metrics.monthSales, currency)}
          </p>
          <div className="flex items-center justify-between text-xs mt-2 text-slate-500">
            <span>กำไรขั้นต้น:</span>
            <span className="text-emerald-600 font-bold">{formatCurrency(metrics.monthProfit, currency)}</span>
          </div>
        </div>

        {/* Net Profit (Gross Profit - Expenses) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">กำไรสุทธิเดือนนี้</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-700 mt-2">
            {formatCurrency(metrics.netMonthProfit, currency)}
          </p>
          <div className="flex items-center justify-between text-xs mt-2 text-slate-500">
            <span>หักรายจ่าย:</span>
            <span className="text-red-500 font-medium">-{formatCurrency(metrics.monthExpensesTotal, currency)}</span>
          </div>
        </div>

        {/* Outstanding Debts / Accounts Receivable */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ยอดหนี้ค้างชำระ (ลูกหนี้)</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {formatCurrency(metrics.totalOutstandingDebt, currency)}
          </p>
          <div className="flex items-center justify-between text-xs mt-2 text-slate-500">
            <span>ลูกค้าทั้งหมด: {metrics.totalCustomers} ราย</span>
            <button
              onClick={() => setActiveTab('customers')}
              className="text-blue-600 hover:underline font-medium"
            >
              ดูรายการหนี้
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">สินค้าในระบบ</p>
            <p className="text-lg font-bold text-slate-800">{metrics.totalProducts} รายการ</p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">สินค้าใกล้หมด</p>
            <p className="text-lg font-bold text-amber-600">{metrics.lowStockCount} รายการ</p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">สินค้าหมดสต็อก</p>
            <p className="text-lg font-bold text-red-600">{metrics.outOfStockCount} รายการ</p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">ฐานข้อมูลลูกค้า</p>
            <p className="text-lg font-bold text-slate-800">{metrics.totalCustomers} ราย</p>
          </div>
        </div>
      </div>

      {/* Chart Section & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart (Last 7 Days) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">ยอดขายย้อนหลัง 7 วัน</h3>
              <p className="text-xs text-slate-500">เปรียบเทียบยอดขายและผลกำไรในแต่ละวัน</p>
            </div>
            <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-md text-slate-600 font-medium">
              อัปเดตเรียลไทม์
            </span>
          </div>

          {/* Bar Chart Container */}
          <div className="h-64 flex items-end gap-2 md:gap-4 pt-6 pb-2 px-2 border-b border-slate-100">
            {last7DaysData.map((d, idx) => {
              const heightPct = Math.min(100, Math.max(8, (d.amount / maxDailyAmount) * 100));
              const profitPct = d.amount > 0 ? (d.profit / d.amount) * 100 : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="text-[10px] text-slate-500 font-semibold mb-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    {formatCurrency(d.amount, currency)}
                  </div>
                  <div
                    className="w-full max-w-[42px] bg-gradient-to-t from-blue-600 to-indigo-500 rounded-t-lg transition-all duration-300 relative group-hover:from-blue-700 group-hover:to-indigo-600 shadow-xs"
                    style={{ height: `${heightPct}%` }}
                  >
                    {/* Inner profit indicator */}
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 rounded-t-xs"
                      style={{ height: `${profitPct}%` }}
                      title={`กำไร: ${formatCurrency(d.profit, currency)}`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-600 font-medium mt-2 truncate max-w-full">
                    {d.dateLabel}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-6 mt-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs bg-blue-600" />
              <span className="text-slate-600 font-medium">ยอดขายรวม</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs bg-emerald-500" />
              <span className="text-slate-600 font-medium">กำไรจากการขาย</span>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-800 text-base">สินค้าใกล้หมดสต็อก</h3>
            </div>
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              จัดการสต็อก
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[260px] space-y-2 pr-1 custom-scrollbar">
            {metrics.lowStockProducts.length === 0 && metrics.outOfStockCount === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-slate-600">สต็อกสินค้าอยู่ในเกณฑ์ดี</p>
                <p className="text-xs">ไม่มีสินค้าใกล้หมดหรือขาดสต็อกในขณะนี้</p>
              </div>
            ) : (
              [...metrics.lowStockProducts, ...products.filter((p) => p.stockQty <= 0)]
                .slice(0, 6)
                .map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition"
                  >
                    <div className="truncate mr-2">
                      <p className="text-xs font-semibold text-slate-800 truncate">{prod.name}</p>
                      <p className="text-[11px] text-slate-500">
                        รหัส: {prod.sku} • จุดแจ้งเตือน: {prod.minStockAlert || 10} {prod.unit}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                        prod.stockQty <= 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      เหลือ {prod.stockQty} {prod.unit}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Top 10 Bestselling Products */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base">สินค้าขายดี 10 อันดับแรก</h3>
            <p className="text-xs text-slate-500">จัดอันดับตามจำนวนชิ้นที่ขายได้จากประวัติบิลจริง</p>
          </div>
          <button
            onClick={() => setActiveTab('reports')}
            className="text-xs text-blue-600 hover:underline font-semibold"
          >
            ดูรายงานฉบับเต็ม
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3 px-4 w-12 text-center">อันดับ</th>
                <th className="py-3 px-4">ชื่อสินค้า</th>
                <th className="py-3 px-4 text-center">รหัส SKU</th>
                <th className="py-3 px-4 text-right">จำนวนที่ขายได้</th>
                <th className="py-3 px-4 text-right">ยอดขายรวม</th>
                <th className="py-3 px-4 text-right">กำไรจากการขาย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    ยังไม่มีข้อมูลประวัติการขาย เริ่มต้นเปิดบิลแรกที่เมนูระบบขาย (POS)
                  </td>
                </tr>
              ) : (
                topProducts.map((p, index) => (
                  <tr key={p.productId} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-center font-bold">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          index === 0
                            ? 'bg-amber-100 text-amber-800'
                            : index === 1
                            ? 'bg-slate-200 text-slate-700'
                            : index === 2
                            ? 'bg-amber-50 text-amber-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{p.name}</td>
                    <td className="py-3 px-4 text-center font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">
                      {formatNumber(p.qty)} <span className="font-normal text-xs text-slate-500">{p.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {formatCurrency(p.revenue, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      {formatCurrency(p.profit, currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
