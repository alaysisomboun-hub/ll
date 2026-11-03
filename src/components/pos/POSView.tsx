import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Barcode,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  User,
  Tag,
  AlertCircle,
  X,
  History,
  RotateCcw,
  Check,
  Percent,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, Customer, Sale } from '../../types/pos';
import { formatCurrency, formatNumber, formatDateTime } from '../../utils/formatters';
import { ReceiptModal } from './ReceiptModal';

export const POSView: React.FC = () => {
  const {
    products,
    categories,
    customers,
    sales,
    cart,
    addToCart,
    updateCartItemQty,
    updateCartItemDiscount,
    removeFromCart,
    clearCart,
    cartTotals,
    completeSale,
    voidSale,
    posMode,
    setPosMode,
    selectedCustomer,
    setSelectedCustomer,
    billDiscountPercent,
    setBillDiscountPercent,
    billDiscountAmount,
    setBillDiscountAmount,
    currency,
    settings,
    currentUser,
    canVoidSales,
    canViewCosts,
    t,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'terminal' | 'history'>('terminal');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');

  // Modals
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Receipt Modal
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

  // Void Sale Modal
  const [voidSaleTarget, setVoidSaleTarget] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState<string>('ลูกค้าขอคืนสินค้า');

  // Customer Picker Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [customerSearch, setCustomerSearch] = useState<string>('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive) return false;
      const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Role-based sales visibility: Staff sees only their own sales history
  const isStaffOnly = currentUser?.role === 'staff' || currentUser?.role === 'cashier';
  const visibleSales = useMemo(() => {
    if (isStaffOnly && currentUser) {
      return sales.filter(
        (s) => s.cashierId === currentUser.id || s.cashierName === currentUser.displayName
      );
    }
    return sales;
  }, [sales, currentUser, isStaffOnly]);

  // Handle Barcode Scan / Enter
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const matched = products.find(
      (p) =>
        p.isActive &&
        (p.barcode === code ||
          p.sku.toLowerCase() === code.toLowerCase() ||
          p.name.toLowerCase() === code.toLowerCase())
    );

    if (matched) {
      addToCart(matched, 1);
      setBarcodeInput('');
    } else {
      showToast(`ไม่พบสินค้าที่ตรงกับบาร์โค้ด "${code}"`, 'warning');
    }
  };

  // Quick cash bill buttons based on currency
  const quickCashOptions = useMemo(() => {
    const total = Math.ceil(cartTotals.grandTotal);
    if (currency === 'LAK') {
      return [
        { label: 'พอดี', value: total },
        { label: '50,000 ₭', value: 50000 },
        { label: '100,000 ₭', value: 100000 },
        { label: '200,000 ₭', value: 200000 },
        { label: '500,000 ₭', value: 500000 },
        { label: '1,000,000 ₭', value: 1000000 },
      ];
    } else if (currency === 'USD') {
      return [
        { label: 'Exact', value: total },
        { label: '$10', value: 10 },
        { label: '$20', value: 20 },
        { label: '$50', value: 50 },
        { label: '$100', value: 100 },
      ];
    } else {
      // THB default
      return [
        { label: 'พอดี', value: total },
        { label: '100 ฿', value: 100 },
        { label: '500 ฿', value: 500 },
        { label: '1,000 ฿', value: 1000 },
        { label: '2,000 ฿', value: 2000 },
      ];
    }
  }, [currency, cartTotals.grandTotal]);

  const numAmountPaid = parseFloat(amountPaidInput) || 0;
  const changeDue = Math.max(0, numAmountPaid - cartTotals.grandTotal);

  // Trigger Checkout
  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      showToast('กรุณาเลือกสินค้าเข้าตะกร้าก่อนชำระเงิน', 'warning');
      return;
    }
    setAmountPaidInput(Math.ceil(cartTotals.grandTotal).toString());
    setPaymentMethod('cash');
    setIsCheckoutOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (paymentMethod === 'credit' && !selectedCustomer) {
      showToast('การขายแบบติดหนี้ (เครดิต) ต้องระบุชื่อลูกค้าในระบบ', 'warning');
      return;
    }

    if (paymentMethod === 'cash' && numAmountPaid < cartTotals.grandTotal) {
      showToast('จำนวนเงินสดที่ได้รับมาต้องไม่น้อยกว่ายอดรวมที่ต้องชำระ', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const saleRecord = await completeSale({
        method: paymentMethod,
        amountPaid: paymentMethod === 'credit' ? numAmountPaid : Math.max(numAmountPaid, cartTotals.grandTotal),
        notes: saleNotes,
      });

      setIsSubmitting(false);
      setIsCheckoutOpen(false);
      setSaleNotes('');
      setAmountPaidInput('');
      setLastCompletedSale(saleRecord);
    } catch (err) {
      setIsSubmitting(false);
      console.error(err);
    }
  };

  // Void Sale Confirmation
  const handleConfirmVoid = async () => {
    if (!voidSaleTarget) return;
    try {
      await voidSale(voidSaleTarget.id, voidReason);
      setVoidSaleTarget(null);
      setVoidReason('ลูกค้าขอคืนสินค้า');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-100 overflow-hidden">
      {/* POS Top Control Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
        {/* Terminal vs History Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition ${
              activeTab === 'terminal'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            หน้าแคชเชียร์ขาย (POS)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            ประวัติการขาย & คืนบิล
          </button>
        </div>

        {/* Wholesale vs Retail Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">ประเภทราคา:</span>
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setPosMode('retail')}
              className={`px-3 py-1.5 rounded-lg transition ${
                posMode === 'retail'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🛒 ราคาปลีก (Retail)
            </button>
            <button
              onClick={() => setPosMode('wholesale')}
              className={`px-3 py-1.5 rounded-lg transition ${
                posMode === 'wholesale'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📦 ราคาส่ง (Wholesale)
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'terminal' ? (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: Product Catalog Panel */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-3 md:p-4">
            {/* Search and Barcode Input Bar */}
            <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
              {/* Barcode Quick Scan */}
              <form onSubmit={handleBarcodeSubmit} className="relative sm:w-64">
                <Barcode className="absolute left-3 top-2.5 w-4 h-4 text-blue-600" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="สแกนบาร์โค้ดแล้วกด Enter..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-white border border-blue-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 font-mono shadow-xs"
                />
              </form>

              {/* Keyword Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t.searchProduct}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 shadow-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 shrink-0 custom-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
                }`}
              >
                ทั้งหมด ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto pr-1 pt-1 custom-scrollbar">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center text-slate-400">
                  <AlertCircle className="w-10 h-10 mb-2 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">ไม่พบสินค้า</p>
                  <p className="text-xs">ลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อื่น</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                  {filteredProducts.map((product) => {
                    const isOutOfStock = product.stockQty <= 0;
                    const isLowStock = product.stockQty <= (product.minStockAlert || 10) && !isOutOfStock;
                    const isWholesaleActive = posMode === 'wholesale' || selectedCustomer?.type === 'wholesale';
                    const activeDisplayPrice = isWholesaleActive ? product.wholesalePrice : product.retailPrice;

                    return (
                      <div
                        key={product.id}
                        onClick={() => !isOutOfStock && addToCart(product, 1)}
                        className={`bg-white rounded-xl border p-2.5 flex flex-col justify-between transition group relative select-none ${
                          isOutOfStock
                            ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50'
                            : 'cursor-pointer hover:shadow-md hover:border-blue-400 active:scale-98 border-slate-200'
                        }`}
                      >
                        {/* Image / Thumbnail */}
                        <div className="w-full h-24 rounded-lg bg-slate-100 overflow-hidden relative mb-2 flex items-center justify-center">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <Tag className="w-8 h-8 text-slate-300" />
                          )}

                          {/* Stock Badge */}
                          <span
                            className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-xs ${
                              isOutOfStock
                                ? 'bg-red-600 text-white'
                                : isLowStock
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-900/80 text-white'
                            }`}
                          >
                            {isOutOfStock ? 'หมด' : `${product.stockQty} ${product.unit}`}
                          </span>
                        </div>

                        {/* Title & SKU */}
                        <div>
                          <h4 className="font-semibold text-xs text-slate-800 line-clamp-2 leading-tight">
                            {product.name}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{product.sku}</p>
                        </div>

                        {/* Pricing details */}
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-end justify-between">
                          <div>
                            <div className="text-sm font-bold text-blue-700">
                              {formatCurrency(activeDisplayPrice, currency)}
                            </div>
                            {posMode === 'retail' && product.wholesalePrice > 0 && (
                              <div className="text-[10px] text-emerald-600">
                                ส่ง {formatCurrency(product.wholesalePrice, currency)} (≥{product.wholesaleMinQty})
                              </div>
                            )}
                          </div>
                          <button
                            disabled={isOutOfStock}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition shadow-xs ${
                              isOutOfStock
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Cart & Checkout Panel */}
          <div className="w-full lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg z-10 shrink-0">
            {/* Customer Picker Banner */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {selectedCustomer ? selectedCustomer.name : 'ลูกค้าทั่วไป (Walk-in)'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {selectedCustomer ? (
                      selectedCustomer.outstandingDebt > 0 ? (
                        <span className="text-amber-600 font-bold">
                          หนี้ค้าง: {formatCurrency(selectedCustomer.outstandingDebt, currency)}
                        </span>
                      ) : (
                        <span className="text-emerald-600">ไม่มีหนี้ค้างชำระ</span>
                      )
                    ) : (
                      'ลูกค้าหน้าร้านทั่วไป'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {selectedCustomer && (
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="ล้างการเลือกลูกค้า"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-blue-700 rounded-lg text-xs font-semibold shadow-xs"
                >
                  เลือกลูกค้า
                </button>
              </div>
            </div>

            {/* Cart Items Header */}
            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                ตะกร้า ({cart.length} รายการ / {cartTotals.itemCount} ชิ้น)
              </span>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  ล้างตะกร้า
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                  <ShoppingCart className="w-12 h-12 text-slate-200 mb-2" />
                  <p className="text-sm font-semibold text-slate-600">{t.emptyCart}</p>
                  <p className="text-xs">คลิกเลือกสินค้าหรือสแกนบาร์โค้ดทางซ้าย</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-800 truncate">
                            {item.product.name}
                          </span>
                          {item.priceTier === 'wholesale' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                              ราคาส่ง
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>
                            @ {formatCurrency(item.unitPrice, currency)} / {item.product.unit}
                          </span>
                          {item.discount > 0 && (
                            <span className="text-red-500 font-medium">
                              ลด -{formatCurrency(item.discount, currency)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quantity Controls and Total */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg">
                        <button
                          onClick={() => updateCartItemQty(item.product.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-l-lg"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          min={1}
                          max={item.product.stockQty}
                          onChange={(e) =>
                            updateCartItemQty(item.product.id, parseInt(e.target.value) || 1)
                          }
                          className="w-10 text-center text-xs font-bold text-slate-800 focus:outline-hidden"
                        />
                        <button
                          onClick={() => updateCartItemQty(item.product.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-r-lg"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900">
                          {formatCurrency(item.totalPrice, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Summary & Discount Input */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2 text-xs">
              {/* Discount inputs */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500">ส่วนลดบิล:</span>
                <div className="flex-1 flex gap-1">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="ลด (บาท/กีบ)"
                      min={0}
                      value={billDiscountAmount || ''}
                      onChange={(e) => setBillDiscountAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                    />
                  </div>
                  <div className="relative w-16">
                    <input
                      type="number"
                      placeholder="%"
                      min={0}
                      max={100}
                      value={billDiscountPercent || ''}
                      onChange={(e) => setBillDiscountPercent(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Subtotal */}
              <div className="flex justify-between text-slate-600">
                <span>ยอดรวมสินค้า:</span>
                <span>{formatCurrency(cartTotals.subtotal, currency)}</span>
              </div>

              {cartTotals.discountTotal > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>ส่วนลดรวม:</span>
                  <span>-{formatCurrency(cartTotals.discountTotal, currency)}</span>
                </div>
              )}

              {settings.isTaxEnabled && (
                <div className="flex justify-between text-slate-600">
                  <span>ภาษีมูลค่าเพิ่ม ({settings.taxRatePercent}%):</span>
                  <span>{formatCurrency(cartTotals.taxTotal, currency)}</span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                <span className="text-sm font-bold text-slate-800">ยอดสุทธิที่ต้องชำระ:</span>
                <span className="text-xl font-extrabold text-blue-700">
                  {formatCurrency(cartTotals.grandTotal, currency)}
                </span>
              </div>

              {/* Estimated profit for manager/owner/admin only */}
              {canViewCosts && (
                <div className="flex justify-between text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md font-medium">
                  <span>กำไรประมาณการบิลนี้:</span>
                  <span>{formatCurrency(cartTotals.profitTotal, currency)}</span>
                </div>
              )}

              {/* Checkout Button */}
              <button
                onClick={handleOpenCheckout}
                disabled={cart.length === 0}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-md active:scale-98 mt-2 ${
                  cart.length === 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'
                }`}
              >
                <Banknote className="w-5 h-5" />
                ชำระเงิน • คิดเงิน ({formatCurrency(cartTotals.grandTotal, currency)})
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* SALES HISTORY & VOID TAB */
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <div className="max-w-6xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-slate-800">
                  {isStaffOnly ? 'ประวัติการขายของคุณ (My Sales)' : 'ประวัติการขายล่าสุด'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isStaffOnly
                    ? 'รายการบิลขายที่คุณเป็นผู้ทำรายการ'
                    : 'รายการบิลขายทั้งหมดในระบบ สามารถตรวจสอบและยกเลิกบิล'}
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {isStaffOnly ? `รายการของคุณ ${visibleSales.length} รายการ` : `ทั้งหมด ${visibleSales.length} รายการ`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="py-3 px-4">เลขที่บิล</th>
                    <th className="py-3 px-4">วัน-เวลา</th>
                    <th className="py-3 px-4">ลูกค้า</th>
                    <th className="py-3 px-4">พนักงานขาย</th>
                    <th className="py-3 px-4">ประเภท</th>
                    <th className="py-3 px-4">วิธีชำระ</th>
                    <th className="py-3 px-4 text-right">ยอดรวม</th>
                    <th className="py-3 px-4 text-center">สถานะ</th>
                    <th className="py-3 px-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleSales.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        {isStaffOnly ? 'คุณยังไม่มีประวัติการขาย' : 'ยังไม่มีประวัติการขายในระบบ'}
                      </td>
                    </tr>
                  ) : (
                    visibleSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-blue-700">
                          {sale.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {formatDateTime(sale.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {sale.customerName || 'ลูกค้าทั่วไป'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-xs">
                          {sale.cashierName || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              sale.saleType === 'wholesale'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {sale.saleType === 'wholesale' ? 'ขายส่ง' : 'ขายปลีก'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 uppercase text-xs">
                          {sale.paymentMethod === 'cash'
                            ? 'เงินสด'
                            : sale.paymentMethod === 'transfer'
                            ? 'โอนเงิน'
                            : 'เครดิต (หนี้)'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">
                          {formatCurrency(sale.totalAmount, currency)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              sale.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {sale.status === 'completed' ? 'สำเร็จ' : 'ยกเลิกแล้ว'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap space-x-1.5">
                          <button
                            onClick={() => setLastCompletedSale(sale)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                            title="พิมพ์ใบเสร็จ"
                          >
                            ใบเสร็จ
                          </button>
                          {sale.status === 'completed' && canVoidSales && (
                            <button
                              onClick={() => setVoidSaleTarget(sale)}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold"
                              title="ยกเลิกและคืนสต็อก (เฉพาะผู้มีสิทธิ์)"
                            >
                              ยกเลิกบิล
                            </button>
                          )}
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

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">ชำระเงินค่าสินค้า</h3>
                <p className="text-xs text-blue-100">
                  {posMode === 'wholesale' ? 'โหมดขายส่ง' : 'โหมดขายปลีก'} •{' '}
                  {selectedCustomer ? selectedCustomer.name : 'ลูกค้าทั่วไป'}
                </p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 text-blue-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Grand Total Display */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <span className="text-xs text-blue-700 font-semibold uppercase">
                  ยอดรวมที่ต้องชำระสุทธิ
                </span>
                <p className="text-3xl font-extrabold text-blue-900 mt-1">
                  {formatCurrency(cartTotals.grandTotal, currency)}
                </p>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  วิธีชำระเงิน
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 font-semibold text-xs transition ${
                      paymentMethod === 'cash'
                        ? 'border-blue-600 bg-blue-50/80 text-blue-700 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    <span>เงินสด (Cash)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 font-semibold text-xs transition ${
                      paymentMethod === 'transfer'
                        ? 'border-blue-600 bg-blue-50/80 text-blue-700 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <QrCode className="w-5 h-5" />
                    <span>โอนเงิน / QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit')}
                    className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 font-semibold text-xs transition ${
                      paymentMethod === 'credit'
                        ? 'border-amber-600 bg-amber-50 text-amber-700 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>ค้างชำระ (ติดหนี้)</span>
                  </button>
                </div>
              </div>

              {/* Cash Options & Change Calculation */}
              {paymentMethod === 'cash' && (
                <div className="space-y-3">
                  {/* Quick Cash Buttons */}
                  <div>
                    <span className="text-xs text-slate-500 font-medium">ปุ่มลัดธนบัตร:</span>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-1">
                      {quickCashOptions.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setAmountPaidInput(opt.value.toString())}
                          className="py-1 px-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      จำนวนเงินสดที่ได้รับมา:
                    </label>
                    <input
                      type="number"
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      className="w-full px-3 py-2 text-lg font-bold bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Change Due Box */}
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800">เงินทอน (Change):</span>
                    <span className="text-xl font-extrabold text-emerald-700">
                      {formatCurrency(changeDue, currency)}
                    </span>
                  </div>
                </div>
              )}

              {/* Transfer Details */}
              {paymentMethod === 'transfer' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center space-y-1">
                  <p className="text-xs font-semibold text-blue-900">
                    ให้ลูกค้าสแกน QR Code หรือโอนเงินเข้าบัญชีร้าน
                  </p>
                  <p className="text-xs text-blue-700">
                    ยอดเงิน: <span className="font-bold">{formatCurrency(cartTotals.grandTotal, currency)}</span>
                  </p>
                </div>
              )}

              {/* Credit / Debt Details */}
              {paymentMethod === 'credit' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                  {!selectedCustomer ? (
                    <div className="text-xs text-red-600 font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>กรุณากด "เลือกลูกค้า" ที่มุมขวาบน เพื่อบันทึกบัญชีลูกหนี้</span>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-900 space-y-0.5">
                      <p>
                        ลูกค้า: <span className="font-bold">{selectedCustomer.name}</span>
                      </p>
                      <p>
                        หนี้เดิมคงค้าง:{' '}
                        <span className="font-semibold">{formatCurrency(selectedCustomer.outstandingDebt, currency)}</span>
                      </p>
                      <p className="text-red-700 font-bold">
                        ยอดหนี้ที่จะเพิ่มในบิลนี้: +{formatCurrency(cartTotals.grandTotal, currency)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  placeholder="เช่น เลขอ้างอิงโอนเงิน, แผนก, หรือคำขอพิเศษ"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-semibold text-xs md:text-sm text-slate-700 hover:bg-slate-100 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmCheckout}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs md:text-sm shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? 'กำลังบันทึกและตัดสต็อก...' : 'ยืนยันการขาย & ตัดสต็อก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER PICKER MODAL */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">เลือกลูกค้าสำหรับบิลนี้</h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อหรือเบอร์โทรศัพท์ลูกค้า..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
              {/* Default Walk-in */}
              <div
                onClick={() => {
                  setSelectedCustomer(null);
                  setIsCustomerModalOpen(false);
                }}
                className={`p-2.5 rounded-xl border cursor-pointer transition ${
                  selectedCustomer === null
                    ? 'border-blue-500 bg-blue-50/60'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-bold text-slate-800">ลูกค้าทั่วไป (Walk-in)</p>
                <p className="text-[10px] text-slate-500">ซื้อหน้าร้าน ไม่บันทึกประวัติลูกหนี้</p>
              </div>

              {customers
                .filter(
                  (c) =>
                    !customerSearch ||
                    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                    c.phone.includes(customerSearch)
                )
                .map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setIsCustomerModalOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      selectedCustomer?.id === cust.id
                        ? 'border-blue-500 bg-blue-50/60'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">{cust.name}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            cust.type === 'wholesale'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {cust.type === 'wholesale' ? 'ขายส่ง' : 'ขายปลีก'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">โทร: {cust.phone}</p>
                    </div>

                    <div className="text-right">
                      {cust.outstandingDebt > 0 ? (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          หนี้: {formatCurrency(cust.outstandingDebt, currency)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-medium">ไม่มีหนี้</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* VOID SALE MODAL */}
      {voidSaleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center gap-2 text-red-600 font-bold">
              <RotateCcw className="w-5 h-5" />
              <h3>ยกเลิกบิลขายและคืนสต็อกสินค้า</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              คุณต้องการยกเลิกบิลเลขที่ <span className="font-bold text-slate-900">#{voidSaleTarget.invoiceNumber}</span> ยอดเงิน{' '}
              <span className="font-bold text-slate-900">{formatCurrency(voidSaleTarget.totalAmount, currency)}</span> หรือไม่?
              ระบบจะเพิ่มจำนวนสินค้าที่ขายไปในบิลนี้กลับเข้าสต็อกอัตโนมัติ
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เหตุผลการยกเลิก / คืนสินค้า
              </label>
              <select
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
              >
                <option value="ลูกค้าขอคืนสินค้า">ลูกค้าขอคืนสินค้า</option>
                <option value="สินค้าชำรุดเสียหาย">สินค้าชำรุดเสียหาย</option>
                <option value="ออกบิลผิดพลาด">ออกบิลผิดพลาด</option>
                <option value="ลูกค้าเปลี่ยนใจ">ลูกค้าเปลี่ยนใจ</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setVoidSaleTarget(null)}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmVoid}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs"
              >
                ยืนยันการคืนสินค้า
              </button>
            </div>
          </div>
        </div>
      )}

      {/* THERMAL RECEIPT MODAL */}
      {lastCompletedSale && (
        <ReceiptModal
          sale={lastCompletedSale}
          settings={settings}
          currency={currency}
          onClose={() => setLastCompletedSale(null)}
          onNewSale={() => {
            setLastCompletedSale(null);
            clearCart();
          }}
        />
      )}
    </div>
  );
};
