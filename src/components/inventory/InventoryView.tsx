import React, { useState, useMemo } from 'react';
import {
  Warehouse,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  History,
  AlertTriangle,
  Search,
  CheckCircle2,
  Package,
  Layers,
  X,
  Plus,
  RotateCcw,
  Camera,
  Barcode,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, InventoryTransactionType } from '../../types/pos';
import { formatCurrency, formatNumber, formatDateTime } from '../../utils/formatters';
import { CameraBarcodeScannerModal } from '../common/CameraBarcodeScannerModal';
import { useHardwareBarcodeScanner } from '../../utils/hardwareBarcodeScanner';

export const InventoryView: React.FC = () => {
  const {
    products,
    suppliers,
    transactions,
    currency,
    adjustStock,
    showToast,
    currentUser,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');
  const [search, setSearch] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');

  // Modals state
  const [actionModal, setActionModal] = useState<'in' | 'out' | 'adjust' | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [inputQty, setInputQty] = useState<number>(1);
  const [actionReason, setActionReason] = useState<string>('');
  const [referenceDoc, setReferenceDoc] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);

  // Barcode Handler for Inventory (Search & Stock In/Audit)
  const handleBarcodeScanned = (rawCode: string) => {
    const code = String(rawCode).trim();
    if (!code) return;
    const found = products.find(
      (p) =>
        p.barcode === code ||
        p.sku.toLowerCase() === code.toLowerCase()
    );

    if (found) {
      if (actionModal) {
        setSelectedProductId(found.id);
        if (actionModal === 'adjust') {
          setInputQty(found.stockQty);
        }
        showToast(`เลือกสินค้า "${found.name}" จากบาร์โค้ดสำเร็จ`, 'success');
      } else {
        setSearch(found.name);
        showToast(`พบสินค้า "${found.name}" (สต็อก: ${found.stockQty} ${found.unit})`, 'success');
      }
    } else {
      showToast(`ไม่พบสินค้าตรงกับบาร์โค้ด "${code}" ในระบบคลังสินค้า`, 'warning');
    }
  };

  useHardwareBarcodeScanner({
    onScan: handleBarcodeScanned,
    enabled: !isCameraScannerOpen,
    duplicateTimeoutMs: 800,
  });

  // Stats calculations
  const stats = useMemo(() => {
    const totalValuationCost = products.reduce((acc, p) => acc + (p.stockQty || 0) * (p.costPrice || 0), 0);
    const totalValuationRetail = products.reduce((acc, p) => acc + (p.stockQty || 0) * (p.retailPrice || 0), 0);
    const lowStock = products.filter((p) => p.stockQty <= (p.minStockAlert || 10) && p.stockQty > 0);
    const outOfStock = products.filter((p) => p.stockQty <= 0);

    return {
      totalValuationCost,
      totalValuationRetail,
      potentialProfit: totalValuationRetail - totalValuationCost,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
    };
  }, [products]);

  // Selected Product detail for modal
  const targetProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  const handleOpenActionModal = (type: 'in' | 'out' | 'adjust', prodId?: string) => {
    setActionModal(type);
    setSelectedProductId(prodId || products[0]?.id || '');
    setInputQty(type === 'adjust' ? (products.find((p) => p.id === prodId)?.stockQty || 0) : 10);
    setActionReason(
      type === 'in'
        ? 'รับสินค้าเข้าคลังสินค้า'
        : type === 'out'
        ? 'สินค้าชำรุดเสียหาย'
        : 'ตรวจนับสต็อกประจำงวด'
    );
    setReferenceDoc('');
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast('กรุณาเลือกสินค้า', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      if (actionModal === 'in') {
        await adjustStock(selectedProductId, Math.abs(inputQty), 'in', actionReason, referenceDoc);
      } else if (actionModal === 'out') {
        await adjustStock(selectedProductId, -Math.abs(inputQty), 'out', actionReason, referenceDoc);
      } else if (actionModal === 'adjust') {
        await adjustStock(selectedProductId, Math.max(0, inputQty), 'adjustment', actionReason, referenceDoc);
      }
      setIsSubmitting(false);
      setActionModal(null);
    } catch (err) {
      setIsSubmitting(false);
      console.error(err);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchType = filterType === 'all' || tx.type === filterType;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        tx.productName.toLowerCase().includes(q) ||
        tx.sku.toLowerCase().includes(q) ||
        (tx.referenceId && tx.referenceId.toLowerCase().includes(q)) ||
        tx.reason.toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [transactions, filterType, search]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">ระบบจัดการคลังสินค้า (Inventory)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ตรวจนับ, รับเข้า, เบิกออก และประวัติการเคลื่อนไหวสต็อกสินค้าแบบตรวจสอบได้
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleOpenActionModal('in')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition"
          >
            <ArrowDownLeft className="w-4 h-4" />
            รับสินค้าเข้า (Stock In)
          </button>
          <button
            onClick={() => handleOpenActionModal('out')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition"
          >
            <ArrowUpRight className="w-4 h-4" />
            เบิกสินค้าออก (Stock Out)
          </button>
          <button
            onClick={() => handleOpenActionModal('adjust')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition"
          >
            <SlidersHorizontal className="w-4 h-4" />
            ปรับยอดตรวจนับ (Audit)
          </button>
        </div>
      </div>

      {/* Inventory KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cost Valuation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            มูลค่าสต็อกคงคลัง (ราคาทุน)
          </span>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {formatCurrency(stats.totalValuationCost, currency)}
          </p>
          <p className="text-xs text-slate-400 mt-1">คำนวณจากจำนวนคงเหลือ × ราคาทุนล่าสุด</p>
        </div>

        {/* Total Retail Valuation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            มูลค่าสต็อก (ราคาขายปลีก)
          </span>
          <p className="text-2xl font-bold text-blue-700 mt-2">
            {formatCurrency(stats.totalValuationRetail, currency)}
          </p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">
            กำไรคาดหวัง: +{formatCurrency(stats.potentialProfit, currency)}
          </p>
        </div>

        {/* Low Stock Items */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
            สินค้าใกล้หมดสต็อก
          </span>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {stats.lowStockCount} <span className="text-xs font-normal text-slate-500">รายการ</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">ต่ำกว่าจุดสั่งซื้อขั้นต่ำที่ตั้งไว้</p>
        </div>

        {/* Out of Stock Items */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
            สินค้าหมดสต็อก (Out of Stock)
          </span>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {stats.outOfStockCount} <span className="text-xs font-normal text-slate-500">รายการ</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">ต้องติดต่อสั่งซื้อจากซัพพลายเออร์</p>
        </div>
      </div>

      {/* Tabs: Stock Overview Table vs Audit Movement Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition ${
                activeTab === 'overview'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายการสินค้าและสต็อกคงเหลือ
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition ${
                activeTab === 'transactions'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ประวัติการเคลื่อนไหวสต็อก (Audit Log)
            </button>
          </div>

          {/* Search bar & Barcode Scanner inside tab */}
          <div className="flex items-center gap-2">
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, รหัส หรือเลขอ้างอิง..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsCameraScannerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer shrink-0"
              title="เปิดกล้องสแกนบาร์โค้ดสินค้าในคลัง"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">สแกนบาร์โค้ด</span>
            </button>

            {(search !== '' || (activeTab === 'transactions' && filterType !== 'all')) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilterType('all');
                  showToast('รีเซ็ตการค้นหาและตัวกรองสต็อกแล้ว', 'info');
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                title="รีเซ็ตการค้นหาและตัวกรอง"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                <span>รีเซ็ต</span>
              </button>
            )}
          </div>
        </div>

        {activeTab === 'overview' ? (
          /* Current Inventory Level Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                <tr>
                  <th className="py-3 px-4">รหัส SKU</th>
                  <th className="py-3 px-4">ชื่อสินค้า</th>
                  <th className="py-3 px-4 text-right">ราคาทุน</th>
                  <th className="py-3 px-4 text-right">ราคาปลีก</th>
                  <th className="py-3 px-4 text-center">เตือนขั้นต่ำ</th>
                  <th className="py-3 px-4 text-center">คงเหลือในสต็อก</th>
                  <th className="py-3 px-4 text-right">มูลค่ารวม (ทุน)</th>
                  <th className="py-3 px-4 text-center">จัดการด่วน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products
                  .filter(
                    (p) =>
                      !search ||
                      p.name.toLowerCase().includes(search.toLowerCase()) ||
                      p.sku.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((p) => {
                    const isOutOfStock = p.stockQty <= 0;
                    const isLow = p.stockQty <= (p.minStockAlert || 10) && !isOutOfStock;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-blue-700">{p.sku}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{p.name}</td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          {formatCurrency(p.costPrice, currency)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {formatCurrency(p.retailPrice, currency)}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500 font-mono">
                          {p.minStockAlert || 10} {p.unit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                              isOutOfStock
                                ? 'bg-red-100 text-red-700'
                                : isLow
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {p.stockQty} {p.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">
                          {formatCurrency((p.stockQty || 0) * (p.costPrice || 0), currency)}
                        </td>
                        <td className="py-3 px-4 text-center space-x-1">
                          <button
                            onClick={() => handleOpenActionModal('in', p.id)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold"
                            title="รับของเข้า"
                          >
                            + รับเข้า
                          </button>
                          <button
                            onClick={() => handleOpenActionModal('adjust', p.id)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                            title="ปรับปรุงยอดนับจริง"
                          >
                            ตรวจนับ
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Movement History Log Table */
          <div className="overflow-x-auto">
            {/* Filter buttons */}
            <div className="p-3 bg-white border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs text-slate-500 font-medium">ประเภทรายการ:</span>
              {(['all', 'in', 'out', 'sale', 'void_return', 'adjustment'] as const).map((tType) => (
                <button
                  key={tType}
                  onClick={() => setFilterType(tType)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    filterType === tType
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tType === 'all'
                    ? 'ทั้งหมด'
                    : tType === 'in'
                    ? 'รับเข้า (+)'
                    : tType === 'out'
                    ? 'เบิกออก (-)'
                    : tType === 'sale'
                    ? 'ขายตัดสต็อก'
                    : tType === 'void_return'
                    ? 'คืนสต็อก (ยกเลิกบิล)'
                    : 'ปรับยอดตรวจนับ'}
                </button>
              ))}
            </div>

            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                <tr>
                  <th className="py-3 px-4">วัน-เวลา</th>
                  <th className="py-3 px-4">สินค้า</th>
                  <th className="py-3 px-4">ประเภทรายการ</th>
                  <th className="py-3 px-4 text-center">จำนวนที่เปลี่ยน</th>
                  <th className="py-3 px-4 text-center">ก่อนหน้า ➔ คงเหลือใหม่</th>
                  <th className="py-3 px-4">เอกสารอ้างอิง / เหตุผล</th>
                  <th className="py-3 px-4">ผู้ทำรายการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      ไม่พบประวัติการเคลื่อนไหวสต็อก
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isPositive = tx.quantityChange > 0;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {formatDateTime(tx.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800">{tx.productName}</p>
                          <span className="font-mono text-[10px] text-slate-400">{tx.sku}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              tx.type === 'in'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tx.type === 'out'
                                ? 'bg-amber-100 text-amber-800'
                                : tx.type === 'sale'
                                ? 'bg-blue-100 text-blue-800'
                                : tx.type === 'void_return'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {tx.type === 'in'
                              ? 'รับเข้า'
                              : tx.type === 'out'
                              ? 'เบิกออก'
                              : tx.type === 'sale'
                              ? 'ขาย POS'
                              : tx.type === 'void_return'
                              ? 'คืนสต็อก'
                              : 'ตรวจนับ'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono">
                          <span className={isPositive ? 'text-emerald-600' : 'text-red-500'}>
                            {isPositive ? `+${tx.quantityChange}` : tx.quantityChange}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600 font-mono text-xs">
                          {tx.previousStock} ➔ <span className="font-bold text-slate-900">{tx.newStock}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 text-xs">
                          <p className="font-medium">{tx.reason}</p>
                          {tx.referenceId && (
                            <span className="text-[10px] text-blue-600 font-mono">
                              อ้างอิง: #{tx.referenceId}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-xs">{tx.performedBy || 'พนักงาน'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* STOCK ACTION MODAL (In / Out / Adjust) */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {actionModal === 'in' && <ArrowDownLeft className="w-5 h-5 text-emerald-600" />}
                {actionModal === 'out' && <ArrowUpRight className="w-5 h-5 text-amber-600" />}
                {actionModal === 'adjust' && <SlidersHorizontal className="w-5 h-5 text-blue-600" />}
                <h3 className="font-bold text-slate-800 text-sm">
                  {actionModal === 'in'
                    ? 'รับสินค้าเข้าคลัง (Stock In)'
                    : actionModal === 'out'
                    ? 'เบิกสินค้าออก (Stock Out)'
                    : 'ปรับปรุงยอดตรวจนับจริง (Audit)'}
                </h3>
              </div>
              <button onClick={() => setActionModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAction} className="space-y-3.5">
              {/* Product Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">เลือกสินค้า</label>
                  <button
                    type="button"
                    onClick={() => setIsCameraScannerOpen(true)}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3 h-3" />
                    <span>สแกนบาร์โค้ดเลือกสินค้า</span>
                  </button>
                </div>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    const found = products.find((p) => p.id === e.target.value);
                    if (actionModal === 'adjust' && found) {
                      setInputQty(found.stockQty);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.barcode ? `(${p.barcode})` : ''} - คงเหลือ: {p.stockQty} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    {actionModal === 'adjust' ? 'จำนวนที่นับได้จริง (ยอดคงเหลือใหม่)' : 'จำนวนที่ต้องการปรับ'}
                  </label>
                  {targetProduct && (
                    <span className="text-[10px] text-slate-500">
                      สต็อกเดิม: {targetProduct.stockQty} {targetProduct.unit}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min={actionModal === 'adjust' ? 0 : 1}
                  required
                  value={inputQty}
                  onChange={(e) => setInputQty(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-base font-bold bg-white border border-slate-300 rounded-xl focus:outline-hidden font-mono"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">เหตุผล / สาเหตุ</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ซื้อของเพิ่มจากซัพพลายเออร์, สินค้าชำรุดเสียหาย, ตรวจนับสต็อกประจำสัปดาห์"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เลขอ้างอิง / ใบสั่งซื้อ (PO/Ref No.)
                </label>
                <input
                  type="text"
                  placeholder="เช่น PO-202611-001 หรือ ใบส่งของ"
                  value={referenceDoc}
                  onChange={(e) => setReferenceDoc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (actionModal === 'adjust') {
                      setInputQty(targetProduct?.stockQty || 0);
                    } else {
                      setInputQty(10);
                    }
                    setActionReason(
                      actionModal === 'in'
                        ? 'รับสินค้าเข้าคลังสินค้า'
                        : actionModal === 'out'
                        ? 'สินค้าชำรุดเสียหาย'
                        : 'ตรวจนับสต็อกประจำงวด'
                    );
                    setReferenceDoc('');
                    showToast('รีเซ็ตฟอร์มเป็นค่าเริ่มต้นแล้ว', 'info');
                  }}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition active:scale-95 cursor-pointer"
                  title="รีเซ็ตฟอร์มเป็นค่าเริ่มต้น"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                  <span>รีเซ็ตฟอร์ม</span>
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 transition"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการปรับสต็อก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CAMERA BARCODE SCANNER MODAL */}
      <CameraBarcodeScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={handleBarcodeScanned}
        autoClose={true}
        continuous={false}
        title="สแกนบาร์โค้ดสินค้าในคลัง (Inventory Barcode Scanner)"
        existingProducts={products}
      />
    </div>
  );
};
