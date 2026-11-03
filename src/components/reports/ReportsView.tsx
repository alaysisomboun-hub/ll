import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  FileSpreadsheet,
  TrendingUp,
  Package,
  Users,
  Receipt,
  CheckCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatNumber, formatDateOnly } from '../../utils/formatters';

type ReportType =
  | 'daily_sales'
  | 'monthly_sales'
  | 'profit_loss'
  | 'bestsellers'
  | 'inventory_valuation'
  | 'receivables'
  | 'income_expense';

export const ReportsView: React.FC = () => {
  const { sales, products, expenses, customers, currency, showToast } = useApp();

  const [selectedReport, setSelectedReport] = useState<ReportType>('daily_sales');

  const validSales = useMemo(() => sales.filter((s) => s.status === 'completed'), [sales]);

  // Daily Sales Grouping
  const dailySalesData = useMemo(() => {
    const map: Record<string, { date: string; count: number; total: number; cost: number; profit: number }> = {};
    for (const s of validSales) {
      const d = s.createdAt.split('T')[0];
      if (!map[d]) {
        map[d] = { date: d, count: 0, total: 0, cost: 0, profit: 0 };
      }
      map[d].count += 1;
      map[d].total += s.totalAmount || 0;
      map[d].cost += s.totalCost || 0;
      map[d].profit += s.totalProfit || 0;
    }
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [validSales]);

  // Monthly Sales Grouping
  const monthlySalesData = useMemo(() => {
    const map: Record<string, { month: string; count: number; total: number; cost: number; profit: number }> = {};
    for (const s of validSales) {
      const m = s.createdAt.slice(0, 7); // YYYY-MM
      if (!map[m]) {
        map[m] = { month: m, count: 0, total: 0, cost: 0, profit: 0 };
      }
      map[m].count += 1;
      map[m].total += s.totalAmount || 0;
      map[m].cost += s.totalCost || 0;
      map[m].profit += s.totalProfit || 0;
    }
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
  }, [validSales]);

  // Bestsellers Data
  const bestsellersData = useMemo(() => {
    const map: Record<string, { name: string; sku: string; qty: number; revenue: number; profit: number; unit: string }> = {};
    for (const s of validSales) {
      for (const item of s.items || []) {
        if (!map[item.productId]) {
          map[item.productId] = {
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
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [validSales]);

  // Inventory Valuation Data
  const inventoryData = useMemo(() => {
    return products.map((p) => ({
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      stockQty: p.stockQty,
      costPrice: p.costPrice,
      retailPrice: p.retailPrice,
      wholesalePrice: p.wholesalePrice,
      valuationCost: (p.stockQty || 0) * (p.costPrice || 0),
      valuationRetail: (p.stockQty || 0) * (p.retailPrice || 0),
      isLow: p.stockQty <= (p.minStockAlert || 10),
    }));
  }, [products]);

  // Export to Excel function using xlsx
  const handleExportExcel = () => {
    try {
      let exportRows: any[] = [];
      let filename = 'report.xlsx';

      if (selectedReport === 'daily_sales') {
        filename = `daily_sales_${new Date().toISOString().split('T')[0]}.xlsx`;
        exportRows = dailySalesData.map((d) => ({
          'วันที่': d.date,
          'จำนวนบิลขาย': d.count,
          'ยอดขายรวม (บาท)': d.total,
          'ต้นทุนรวม (บาท)': d.cost,
          'กำไรจากการขาย (บาท)': d.profit,
        }));
      } else if (selectedReport === 'monthly_sales') {
        filename = `monthly_sales_${new Date().toISOString().split('T')[0]}.xlsx`;
        exportRows = monthlySalesData.map((m) => ({
          'เดือน': m.month,
          'จำนวนบิลขาย': m.count,
          'ยอดขายรวม (บาท)': m.total,
          'ต้นทุนรวม (บาท)': m.cost,
          'กำไรขั้นต้น (บาท)': m.profit,
        }));
      } else if (selectedReport === 'bestsellers') {
        filename = `bestselling_products_${new Date().toISOString().split('T')[0]}.xlsx`;
        exportRows = bestsellersData.map((p, idx) => ({
          'อันดับ': idx + 1,
          'รหัส SKU': p.sku,
          'ชื่อสินค้า': p.name,
          'จำนวนที่ขายได้': p.qty,
          'หน่วย': p.unit,
          'ยอดขายรวม (บาท)': p.revenue,
          'กำไรจากการขาย (บาท)': p.profit,
        }));
      } else if (selectedReport === 'inventory_valuation') {
        filename = `inventory_valuation_${new Date().toISOString().split('T')[0]}.xlsx`;
        exportRows = inventoryData.map((i) => ({
          'รหัส SKU': i.sku,
          'ชื่อสินค้า': i.name,
          'คงเหลือ': i.stockQty,
          'หน่วย': i.unit,
          'ราคาทุน': i.costPrice,
          'ราคาขายปลีก': i.retailPrice,
          'มูลค่าสต็อกราคาทุน': i.valuationCost,
          'มูลค่าสต็อกราคาขายปลีก': i.valuationRetail,
          'สถานะใกล้หมด': i.isLow ? 'ใช่' : 'ปกติ',
        }));
      } else if (selectedReport === 'receivables') {
        filename = `accounts_receivable_${new Date().toISOString().split('T')[0]}.xlsx`;
        exportRows = customers
          .filter((c) => (c.outstandingDebt || 0) > 0)
          .map((c) => ({
            'ชื่อลูกค้า': c.name,
            'เบอร์โทร': c.phone,
            'ประเภท': c.type,
            'ยอดหนี้ค้างชำระ (บาท)': c.outstandingDebt,
            'วงเงินเครดิต': c.creditLimit,
            'ยอดซื้อสะสม': c.totalSpent,
          }));
      } else {
        filename = `income_expense_${new Date().toISOString().split('T')[0]}.xlsx`;
        exportRows = expenses.map((e) => ({
          'วันที่': e.date,
          'หมวดหมู่': e.category,
          'รายการ': e.title,
          'จำนวนเงิน (บาท)': e.amount,
          'วิธีจ่าย': e.paymentMethod,
          'ผู้บันทึก': e.recordedBy,
        }));
      }

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
      XLSX.writeFile(workbook, filename);
      showToast(`ส่งออกไฟล์ Excel (${filename}) เรียบร้อยแล้ว`, 'success');
    } catch (err) {
      console.error(err);
      showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">รายงานและการวิเคราะห์ (Reports & Analytics)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            รายงานยอดขายรายวัน/รายเดือน, กำไรขาดทุน, สินค้าขายดี, และการส่งออกเป็น Excel / PDF
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-semibold shadow-xs transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            ส่งออก Excel (.xlsx)
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs md:text-sm font-semibold transition"
          >
            <Printer className="w-4 h-4" />
            พิมพ์รายงาน
          </button>
        </div>
      </div>

      {/* Report Categories Switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { id: 'daily_sales', label: 'ยอดขายรายวัน' },
          { id: 'monthly_sales', label: 'ยอดขายรายเดือน' },
          { id: 'bestsellers', label: 'สินค้าขายดี 10 อันดับ' },
          { id: 'inventory_valuation', label: 'มูลค่าสต็อกคงเหลือ' },
          { id: 'receivables', label: 'รายงานลูกหนี้ค้าง' },
          { id: 'income_expense', label: 'รายงานรายรับ-รายจ่าย' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedReport(tab.id as ReportType)}
            className={`p-3 rounded-xl border text-xs font-semibold text-center transition ${
              selectedReport === tab.id
                ? 'bg-blue-600 border-blue-600 text-white shadow-xs font-bold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Report Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {selectedReport === 'daily_sales' && (
          <div className="overflow-x-auto">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800">รายงานยอดขายและกำไรจำแนกรายวัน</h3>
              <span className="text-xs text-slate-500">{dailySalesData.length} วันที่บันทึก</span>
            </div>
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">วันที่ (Date)</th>
                  <th className="py-3 px-4 text-center">จำนวนบิล</th>
                  <th className="py-3 px-4 text-right">ยอดขายรวม</th>
                  <th className="py-3 px-4 text-right">ต้นทุนสินค้า (COGS)</th>
                  <th className="py-3 px-4 text-right">กำไรจากการขาย</th>
                  <th className="py-3 px-4 text-right">อัตรากำไร (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailySalesData.map((d) => (
                  <tr key={d.date} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{d.date}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{d.count} บิล</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(d.total, currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {formatCurrency(d.cost, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      +{formatCurrency(d.profit, currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-700 font-medium">
                      {d.total > 0 ? ((d.profit / d.total) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport === 'monthly_sales' && (
          <div className="overflow-x-auto">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800">รายงานยอดขายและกำไรจำแนกรายเดือน</h3>
              <span className="text-xs text-slate-500">{monthlySalesData.length} เดือน</span>
            </div>
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">เดือน (Month)</th>
                  <th className="py-3 px-4 text-center">จำนวนบิล</th>
                  <th className="py-3 px-4 text-right">ยอดขายรวม</th>
                  <th className="py-3 px-4 text-right">ต้นทุนรวม</th>
                  <th className="py-3 px-4 text-right">กำไรขั้นต้น</th>
                  <th className="py-3 px-4 text-right">อัตรากำไร (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlySalesData.map((m) => (
                  <tr key={m.month} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{m.month}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{m.count} บิล</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(m.total, currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {formatCurrency(m.cost, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      +{formatCurrency(m.profit, currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-700 font-medium">
                      {m.total > 0 ? ((m.profit / m.total) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport === 'bestsellers' && (
          <div className="overflow-x-auto">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800">รายงานสินค้าขายดี 10 อันดับ</h3>
            </div>
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 text-center">อันดับ</th>
                  <th className="py-3 px-4">รหัส SKU</th>
                  <th className="py-3 px-4">ชื่อสินค้า</th>
                  <th className="py-3 px-4 text-right">จำนวนที่ขายได้</th>
                  <th className="py-3 px-4 text-right">ยอดขายรวม</th>
                  <th className="py-3 px-4 text-right">กำไรรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bestsellersData.slice(0, 10).map((b, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-center font-bold">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{b.sku}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{b.name}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">
                      {formatNumber(b.qty)} {b.unit}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-800">
                      {formatCurrency(b.revenue, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      +{formatCurrency(b.profit, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport === 'inventory_valuation' && (
          <div className="overflow-x-auto">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800">รายงานมูลค่าสต็อกสินค้าคงเหลือ</h3>
              <span className="text-xs text-slate-500">{inventoryData.length} รายการ</span>
            </div>
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">รหัส SKU</th>
                  <th className="py-3 px-4">ชื่อสินค้า</th>
                  <th className="py-3 px-4 text-center">จำนวนคงเหลือ</th>
                  <th className="py-3 px-4 text-right">ราคาทุน</th>
                  <th className="py-3 px-4 text-right">มูลค่ารวม (ทุน)</th>
                  <th className="py-3 px-4 text-right">ราคาขายปลีก</th>
                  <th className="py-3 px-4 text-right">มูลค่ารวม (ปลีก)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{item.sku}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{item.name}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          item.stockQty <= 0
                            ? 'bg-red-100 text-red-700'
                            : item.isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.stockQty} {item.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {formatCurrency(item.costPrice, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(item.valuationCost, currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {formatCurrency(item.retailPrice, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-blue-700">
                      {formatCurrency(item.valuationRetail, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport === 'receivables' && (
          <div className="overflow-x-auto">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800">รายงานยอดหนี้ค้างชำระของลูกค้า (ลูกหนี้)</h3>
            </div>
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">ชื่อลูกค้า</th>
                  <th className="py-3 px-4">ประเภท</th>
                  <th className="py-3 px-4">เบอร์โทรศัพท์</th>
                  <th className="py-3 px-4 text-right">ยอดหนี้ค้างชำระ</th>
                  <th className="py-3 px-4 text-right">วงเงินเครดิต</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers
                  .filter((c) => (c.outstandingDebt || 0) > 0)
                  .map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-slate-800">{c.name}</td>
                      <td className="py-3 px-4 text-xs">
                        {c.type === 'wholesale' ? 'ขายส่ง' : 'ขายปลีก'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs">{c.phone}</td>
                      <td className="py-3 px-4 text-right font-bold text-amber-600">
                        {formatCurrency(c.outstandingDebt, currency)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        {formatCurrency(c.creditLimit || 0, currency)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport === 'income_expense' && (
          <div className="overflow-x-auto">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800">รายงานรายจ่ายดำเนินงาน</h3>
              <span className="text-xs text-slate-500">{expenses.length} รายการ</span>
            </div>
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">วันที่</th>
                  <th className="py-3 px-4">หมวดหมู่</th>
                  <th className="py-3 px-4">รายการรายจ่าย</th>
                  <th className="py-3 px-4 text-right">จำนวนเงิน</th>
                  <th className="py-3 px-4">วิธีจ่าย</th>
                  <th className="py-3 px-4">ผู้บันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono text-xs">{formatDateOnly(e.date)}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-700">{e.category}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{e.title}</td>
                    <td className="py-3 px-4 text-right font-bold text-red-600">
                      -{formatCurrency(e.amount, currency)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {e.paymentMethod === 'cash' ? 'เงินสด' : 'โอนเงิน'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{e.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
