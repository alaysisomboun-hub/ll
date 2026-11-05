import React, { useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  Users,
  CreditCard,
  ShoppingCart,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatNumber } from '../../utils/formatters';

export const DashboardView: React.FC = () => {
  const {
    sales,
    products,
    customers,
    expenses,
    currency,
    setActiveTab,
    setPosMode,
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

  // Last 7 days sales for visualization
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
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Action Header (Clean & Minimal) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
            ภาพรวมร้านค้าและยอดขาย
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            สรุปข้อมูลยอดขาย กำไร และสถานะสินค้าคงคลังแบบเรียลไทม์
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPosMode('retail');
              setActiveTab('pos');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>เปิดการขายปลีก</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPosMode('wholesale');
              setActiveTab('pos');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Package className="w-4 h-4" />
            <span>เปิดการขายส่ง</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <span>รับสินค้าเข้าสต็อก</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards (4 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">ยอดขายวันนี้</span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
            {formatCurrency(metrics.todaySales, currency)}
          </p>
          <div className="flex items-center justify-between text-xs mt-2 text-slate-500 pt-2 border-t border-slate-100">
            <span>{metrics.todayOrdersCount} รายการบิล</span>
            <span className="text-emerald-600 font-medium font-mono tabular-nums">
              กำไร: {formatCurrency(metrics.todayProfit, currency)}
            </span>
          </div>
        </div>

        {/* Month's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">ยอดขายเดือนนี้</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums tracking-tight">
            {formatCurrency(metrics.monthSales, currency)}
          </p>
          <div className="flex items-center justify-between text-xs mt-2 text-slate-500 pt-2 border-t border-slate-100">
            <span>กำไรขั้นต้น:</span>
            <span className="text-emerald-600 font-medium font-mono tabular-nums">
              {formatCurrency(metrics.monthProfit, currency)}
            </span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">กำไรสุทธิเดือนนี้</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-2 font-mono tabular-nums tracking-tight">
            {formatCurrency(metrics.netMonthProfit, currency)}
          </p>
          <div className="flex items-center justify-between text-xs mt-2 text-slate-500 pt-2 border-t border-slate-100">
            <span>หักรายจ่าย:</span>
            <span className="text-red-500 font-medium font-mono tabular-nums">
              -{formatCurrency(metrics.monthExpensesTotal, currency)}
            </span>
          </div>
        </div>

        {/* Receivables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">ลูกหนี้ค้างชำระ</span>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2 font-mono tabular-nums tracking-tight">
            {formatCurrency(metrics.totalOutstandingDebt, currency)}
          </p>
          <div className="flex items-center justify-between text-xs mt-2 text-slate-500 pt-2 border-t border-slate-100">
            <span>ลูกค้า: {metrics.totalCustomers} ราย</span>
            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className="text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
            >
              ดูรายการ
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Metric Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between">
          <span className="text-xs text-slate-500">สินค้าในระบบทั้งหมด</span>
          <span className="text-sm font-bold text-slate-800 font-mono tabular-nums">
            {metrics.totalProducts} รายการ
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between">
          <span className="text-xs text-slate-500">สินค้าใกล้หมดสต็อก</span>
          <span className="text-sm font-bold text-amber-600 font-mono tabular-nums">
            {metrics.lowStockCount} รายการ
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between">
          <span className="text-xs text-slate-500">สินค้าหมดสต็อก</span>
          <span className="text-sm font-bold text-red-600 font-mono tabular-nums">
            {metrics.outOfStockCount} รายการ
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 flex items-center justify-between">
          <span className="text-xs text-slate-500">ฐานข้อมูลลูกค้า</span>
          <span className="text-sm font-bold text-slate-800 font-mono tabular-nums">
            {metrics.totalCustomers} ราย
          </span>
        </div>
      </div>

      {/* Chart & Low Stock Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart (Last 7 Days) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm md:text-base">แนวโน้มยอดขายย้อนหลัง 7 วัน</h3>
              <p className="text-xs text-slate-500">เปรียบเทียบยอดขายรวมและกำไรในแต่ละวัน</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
                <span>ยอดขาย</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                <span>กำไร</span>
              </span>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="h-60 flex items-end gap-3 md:gap-5 pt-4 pb-2 px-2 border-b border-slate-100">
            {last7DaysData.map((d, idx) => {
              const heightPct = Math.min(100, Math.max(8, (d.amount / maxDailyAmount) * 100));
              const profitPct = d.amount > 0 ? (d.profit / d.amount) * 100 : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="text-[10px] text-slate-500 font-mono tabular-nums mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {formatCurrency(d.amount, currency)}
                  </div>
                  <div
                    className="w-full max-w-[36px] bg-blue-600 rounded-t-md transition-all duration-300 relative group-hover:bg-blue-700"
                    style={{ height: `${heightPct}%` }}
                  >
                    {/* Inner profit bar */}
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-xs"
                      style={{ height: `${profitPct}%` }}
                      title={`กำไร: ${formatCurrency(d.profit, currency)}`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium mt-2 truncate max-w-full">
                    {d.dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-slate-900 text-sm">สินค้าใกล้หมดสต็อก</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
            >
              จัดการคลัง
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[240px] space-y-2 custom-scrollbar pr-1">
            {metrics.lowStockProducts.length === 0 && metrics.outOfStockCount === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-xs font-medium text-slate-600">สต็อกสินค้าอยู่ในเกณฑ์ดี</p>
                <p className="text-[11px] text-slate-400">ไม่มีสินค้าใกล้หมดหรือขาดสต็อก</p>
              </div>
            ) : (
              [...metrics.lowStockProducts, ...products.filter((p) => p.stockQty <= 0)]
                .slice(0, 6)
                .map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="truncate mr-2">
                      <p className="text-xs font-semibold text-slate-800 truncate">{prod.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {prod.sku} · จุดเตือน: {prod.minStockAlert || 10} {prod.unit}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 tabular-nums ${
                        prod.stockQty <= 0
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
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

      {/* Top 10 Bestselling Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm md:text-base">สินค้าขายดี 10 อันดับแรก</h3>
            <p className="text-xs text-slate-500">จัดอันดับตามจำนวนชิ้นที่ขายจริงจากประวัติบิล</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>ดูรายงานเต็ม</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50/70 text-slate-500 font-medium border-b border-slate-200/80 text-xs">
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
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    ยังไม่มีข้อมูลประวัติการขาย เริ่มต้นเปิดบิลแรกที่เมนูระบบขาย (POS)
                  </td>
                </tr>
              ) : (
                topProducts.map((p, index) => (
                  <tr key={p.productId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-500 font-mono">
                      {index + 1}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 text-center font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 font-mono tabular-nums">
                      {formatNumber(p.qty)} <span className="font-normal text-xs text-slate-500">{p.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800 font-mono tabular-nums">
                      {formatCurrency(p.revenue, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600 font-mono tabular-nums">
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
