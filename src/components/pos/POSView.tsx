import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Camera,
  Scan,
  Zap,
  CheckCircle2,
  Volume2,
  Lock,
  Unlock,
  Sparkles,
  Cpu,
  Store,
  ArrowRight,
  Grid,
} from 'lucide-react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useApp } from '../../context/AppContext';
import { Product, Customer, Sale } from '../../types/pos';
import { formatCurrency, formatNumber, formatDateTime } from '../../utils/formatters';
import { ReceiptModal } from './ReceiptModal';
import { CameraBarcodeScannerModal } from '../common/CameraBarcodeScannerModal';
import { BarcodeScannerDiagnosticModal } from '../common/BarcodeScannerDiagnosticModal';
import { ResetConfirmModal } from '../common/ResetConfirmModal';
import { playScanSuccessSound, playScanErrorSound } from '../../utils/audio';
import { useHardwareBarcodeScanner } from '../../utils/hardwareBarcodeScanner';

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
  const [mobileSubTab, setMobileSubTab] = useState<'cart' | 'catalog'>('cart');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [scanQuantity, setScanQuantity] = useState<number>(1);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);
  const [autoFocusScanner, setAutoFocusScanner] = useState<boolean>(true);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<{
    name: string;
    qty: number;
    barcode: string;
    time: string;
  } | null>(null);

  // Quick Add Product Modal (When scanned barcode is not found in store)
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState<boolean>(false);
  const [quickAddBarcode, setQuickAddBarcode] = useState<string>('');
  const [quickAddName, setQuickAddName] = useState<string>('');
  const [quickAddCategoryId, setQuickAddCategoryId] = useState<string>('');
  const [quickAddRetailPrice, setQuickAddRetailPrice] = useState<string>('');
  const [quickAddWholesalePrice, setQuickAddWholesalePrice] = useState<string>('');
  const [quickAddCostPrice, setQuickAddCostPrice] = useState<string>('');
  const [quickAddStockQty, setQuickAddStockQty] = useState<string>('50');
  const [quickAddUnit, setQuickAddUnit] = useState<string>('ชิ้น');
  const [isQuickAdding, setIsQuickAdding] = useState<boolean>(false);

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

  // Reset Modals State
  const [isResetPOSModalOpen, setIsResetPOSModalOpen] = useState<boolean>(false);
  const [isResetCartModalOpen, setIsResetCartModalOpen] = useState<boolean>(false);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState<boolean>(false);

  // Full POS Terminal Reset
  const handleResetPOS = () => {
    clearCart();
    setSelectedCustomer(null);
    setBillDiscountPercent(0);
    setBillDiscountAmount(0);
    setPosMode('retail');
    setSearchQuery('');
    setBarcodeInput('');
    setSelectedCategory('all');
    setScanQuantity(1);
    setLastScannedFeedback(null);
    showToast('รีเซ็ตหน้าขาย POS และตะกร้าเป็นสถานะเริ่มต้นเรียบร้อยแล้ว', 'success');
  };

  // Cart / Bill Reset only
  const handleResetCart = () => {
    clearCart();
    setSelectedCustomer(null);
    setBillDiscountPercent(0);
    setBillDiscountAmount(0);
    showToast('รีเซ็ตสินค้าในตะกร้าและส่วนลดเรียบร้อยแล้ว', 'info');
  };

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Auto focus scanner input when enabled
  useEffect(() => {
    if (activeTab === 'terminal' && autoFocusScanner && !isCheckoutOpen && !isCustomerModalOpen && !isQuickAddModalOpen && !isCameraScannerOpen) {
      const timer = setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, autoFocusScanner, isCheckoutOpen, isCustomerModalOpen, isQuickAddModalOpen, isCameraScannerOpen]);

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

  // Instant suggestions for mobile search & quick add
  const instantSuggestions = useMemo(() => {
    const q = (searchQuery || barcodeInput).toLowerCase().trim();
    if (q.length < 2) return [];
    return products
      .filter(
        (p) =>
          p.isActive &&
          (p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.includes(q)))
      )
      .slice(0, 5);
  }, [products, searchQuery, barcodeInput]);

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

  // Handle Barcode Scan / Enter with Multiplier Support
  const processScannedBarcode = (code: string, qty: number = scanQuantity) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    // Check if cashier entered multiplier like "3*8850123000018"
    let targetQty = qty > 0 ? qty : 1;
    let actualBarcode = cleanCode;
    if (cleanCode.includes('*')) {
      const parts = cleanCode.split('*');
      const parsedQty = parseInt(parts[0], 10);
      if (!isNaN(parsedQty) && parsedQty > 0 && parts[1]) {
        targetQty = parsedQty;
        actualBarcode = parts[1].trim();
      }
    }

    const matched = products.find(
      (p) =>
        p.isActive &&
        (p.barcode === actualBarcode ||
          p.sku.toLowerCase() === actualBarcode.toLowerCase() ||
          p.name.toLowerCase() === actualBarcode.toLowerCase())
    );

    if (matched) {
      if (matched.stockQty <= 0) {
        playScanErrorSound();
        showToast(`สินค้า "${matched.name}" หมดสต็อกแล้ว!`, 'error');
        return;
      }

      addToCart(matched, targetQty);
      playScanSuccessSound();
      setBarcodeInput('');
      setLastScannedFeedback({
        name: matched.name,
        qty: targetQty,
        barcode: matched.barcode || matched.sku,
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      showToast(`+${targetQty} ${matched.name} สแกนเพิ่มลงตะกร้าแล้ว`, 'success');
      // Reset multiplier back to 1
      setScanQuantity(1);
    } else {
      playScanErrorSound();
      showToast(`ไม่พบสินค้าที่ตรงกับบาร์โค้ด "${actualBarcode}"`, 'warning');
      setQuickAddBarcode(actualBarcode);
      setQuickAddName('');
      setQuickAddCategoryId(categories[0]?.id || '');
      setQuickAddRetailPrice('');
      setQuickAddWholesalePrice('');
      setQuickAddCostPrice('');
      setIsQuickAddModalOpen(true);
    }

    if (autoFocusScanner && barcodeInputRef.current) {
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processScannedBarcode(barcodeInput, scanQuantity);
  };

  // Dedicated Hardware Barcode Scanner Listener (USB / Bluetooth HID)
  const hardwareScannerState = useHardwareBarcodeScanner({
    onScan: (scannedCode) => {
      processScannedBarcode(scannedCode, scanQuantity);
    },
    enabled:
      activeTab === 'terminal' &&
      !isCheckoutOpen &&
      !isCustomerModalOpen &&
      !isQuickAddModalOpen &&
      !isCameraScannerOpen &&
      !isDiagnosticModalOpen,
    duplicateTimeoutMs: 800,
  });

  // Quick Add Product directly from POS scan
  const handleQuickAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddName.trim() || !quickAddBarcode.trim()) {
      showToast('กรุณากรอกชื่อสินค้าและรหัสบาร์โค้ด', 'error');
      return;
    }

    try {
      setIsQuickAdding(true);
      const retail = parseFloat(quickAddRetailPrice) || 0;
      const wholesale = parseFloat(quickAddWholesalePrice) || retail;
      const cost = parseFloat(quickAddCostPrice) || 0;
      const stock = parseInt(quickAddStockQty, 10) || 0;
      const cat = categories.find((c) => c.id === quickAddCategoryId);

      const newRef = doc(collection(db, 'products'));
      const nowIso = new Date().toISOString();

      const newProduct: Product = {
        id: newRef.id,
        sku: 'SKU-' + (quickAddBarcode.slice(-6) || Date.now().toString().slice(-6)),
        barcode: quickAddBarcode.trim(),
        name: quickAddName.trim(),
        categoryId: quickAddCategoryId || categories[0]?.id || '',
        categoryName: cat?.name || 'สินค้าทั่วไป',
        unit: quickAddUnit || 'ชิ้น',
        costPrice: cost,
        retailPrice: retail,
        wholesalePrice: wholesale,
        wholesaleMinQty: 3,
        stockQty: stock,
        minStockAlert: 5,
        imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=400&auto=format&fit=crop&q=80',
        description: 'สร้างด่วนจากระบบสแกนบาร์โค้ดหน้าขาย POS',
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await setDoc(newRef, newProduct);

      // Immediately add to cart
      addToCart(newProduct, scanQuantity);
      playScanSuccessSound();
      showToast(`เพิ่มสินค้า "${newProduct.name}" และใส่ลงในบิลเรียบร้อยแล้ว`, 'success');

      setIsQuickAddModalOpen(false);
      setBarcodeInput('');
      setQuickAddBarcode('');
      setQuickAddName('');
      setQuickAddRetailPrice('');
      setQuickAddWholesalePrice('');
      setQuickAddCostPrice('');
      setIsQuickAdding(false);

      if (autoFocusScanner && barcodeInputRef.current) {
        setTimeout(() => {
          barcodeInputRef.current?.focus();
        }, 100);
      }
    } catch (err) {
      setIsQuickAdding(false);
      handleFirestoreError(err, OperationType.CREATE, 'products');
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
    <div className="min-h-[calc(100dvh-4rem)] md:h-[calc(100dvh-4rem)] flex flex-col bg-slate-100 overflow-x-hidden md:overflow-hidden">
      {/* 1. MOBILE HEADER (< md: Store Name, Cashier status, Quick Reset) */}
      <div className="block md:hidden bg-white border-b border-slate-200/90 px-3.5 py-2.5 shadow-2xs shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {settings.storeName || 'POS แคชเชียร์'}
              </h2>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="truncate">{currentUser?.displayName || 'พนักงาน'}</span>
                <span>•</span>
                <span className={posMode === 'wholesale' ? 'text-emerald-600 font-semibold shrink-0' : 'text-blue-600 font-semibold shrink-0'}>
                  {posMode === 'wholesale' ? '📦 ราคาส่ง' : '🛒 ราคาปลีก'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsResetPOSModalOpen(true)}
            className="flex items-center gap-1 min-h-[36px] px-2.5 py-1.5 bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border border-slate-200/90 rounded-xl text-xs font-semibold shrink-0 transition active:scale-95 cursor-pointer"
            title="รีเซ็ตหน้าขาย POS กลับสู่สถานะเริ่มต้น"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
            <span>รีเซ็ต</span>
          </button>
        </div>
      </div>

      {/* 2. MOBILE NAVIGATION BAR (< md: Terminal vs History + Mode + Mobile View Subtab) */}
      <div className="block md:hidden bg-slate-50 border-b border-slate-200 px-3 py-2 space-y-2 shrink-0">
        {/* Terminal vs History toggle buttons */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'terminal'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>หน้าขาย POS</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>ประวัติการขาย</span>
            {visibleSales.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-slate-100 rounded-full text-slate-600 font-mono">
                {visibleSales.length}
              </span>
            )}
          </button>
        </div>

        {/* Price mode toggle and Subtab toggle (Visible in terminal mode) */}
        {activeTab === 'terminal' && (
          <div className="flex items-center justify-between gap-2">
            {/* Retail vs Wholesale */}
            <div className="inline-flex bg-white p-0.5 rounded-xl border border-slate-200 text-xs font-bold shrink-0">
              <button
                onClick={() => setPosMode('retail')}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  posMode === 'retail' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                🛒 ปลีก
              </button>
              <button
                onClick={() => setPosMode('wholesale')}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  posMode === 'wholesale' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                📦 ส่ง
              </button>
            </div>

            {/* Mobile Subtab Toggle: Cart vs Catalog */}
            <div className="inline-flex bg-white p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setMobileSubTab('cart')}
                className={`min-h-[36px] px-3 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                  mobileSubTab === 'cart' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>ตะกร้า</span>
                {cartTotals.itemCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-white text-blue-700 font-mono font-bold">
                    {cartTotals.itemCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMobileSubTab('catalog')}
                className={`min-h-[36px] px-3 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                  mobileSubTab === 'catalog' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>สินค้า</span>
                <span className="ml-0.5 text-[10px] text-slate-400">
                  ({products.length})
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP TOP CONTROL BAR (>= md: Tablet, Laptop, Desktop) */}
      <div className="hidden md:flex bg-white border-b border-slate-200 px-4 py-2.5 items-center justify-between gap-3 shrink-0 shadow-xs">
        {/* Terminal vs History Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer ${
              activeTab === 'terminal'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>หน้าแคชเชียร์ขาย (POS)</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>ประวัติการขาย & คืนบิล</span>
          </button>
        </div>

        {/* Wholesale vs Retail Toggle & Reset POS Terminal Button */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 hidden sm:inline">ประเภทราคา:</span>
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setPosMode('retail')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  posMode === 'retail'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🛒 ราคาปลีก (Retail)
              </button>
              <button
                onClick={() => setPosMode('wholesale')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  posMode === 'wholesale'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📦 ราคาส่ง (Wholesale)
              </button>
            </div>
          </div>

          {/* Reset POS Button */}
          <button
            type="button"
            onClick={() => setIsResetPOSModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-800 border border-slate-200/90 hover:border-amber-200 rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
            title="รีเซ็ตหน้าขาย POS กลับสู่สถานะเริ่มต้น"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
            <span className="hidden sm:inline">รีเซ็ตหน้าขาย</span>
            <span className="sm:hidden">รีเซ็ต</span>
          </button>
        </div>
      </div>

      {activeTab === 'terminal' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ============================================================== */}
          {/* MOBILE-FIRST POS TERMINAL VIEW (< md screens: iPhone / Android) */}
          {/* ============================================================== */}
          <div className="block md:hidden flex-1 overflow-y-auto overflow-x-hidden bg-slate-100">
            {mobileSubTab === 'cart' ? (
              <div className="flex flex-col min-h-full">
                {/* 3. Search Bar & Barcode Input (Full width, clear button X) */}
                <div className="p-3 bg-white border-b border-slate-200 space-y-2.5">
                  <div className="relative w-full">
                    <form onSubmit={handleBarcodeSubmit} className="relative flex items-center">
                      <Barcode className="absolute left-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        inputMode="text"
                        placeholder="สแกนบาร์โค้ด หรือค้นหาชื่อสินค้า..."
                        value={barcodeInput}
                        onChange={(e) => {
                          setBarcodeInput(e.target.value);
                          setSearchQuery(e.target.value);
                        }}
                        className="w-full pl-10 pr-20 py-3 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900 placeholder:text-slate-400 font-medium transition"
                      />
                      {barcodeInput && (
                        <button
                          type="button"
                          onClick={() => {
                            setBarcodeInput('');
                            setSearchQuery('');
                          }}
                          className="absolute right-12 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-95 cursor-pointer"
                          title="ล้างข้อความ"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="submit"
                        className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>เพิ่ม</span>
                      </button>
                    </form>

                    {/* Instant Suggestions Popover */}
                    {barcodeInput.trim().length >= 2 && instantSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in">
                        <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 flex justify-between items-center">
                          <span>พบสินค้าที่ตรงกัน ({instantSuggestions.length})</span>
                          <span>แตะเพื่อใส่ลงตะกร้า</span>
                        </div>
                        {instantSuggestions.map((prod) => (
                          <div
                            key={prod.id}
                            onClick={() => {
                              addToCart(prod, scanQuantity);
                              setBarcodeInput('');
                              setSearchQuery('');
                              playScanSuccessSound();
                              showToast(`+${scanQuantity} ${prod.name} ใส่ลงตะกร้าแล้ว`, 'success');
                            }}
                            className="p-2.5 flex items-center justify-between hover:bg-blue-50 active:bg-blue-100 cursor-pointer transition"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-xs font-bold text-slate-900 truncate">{prod.name}</p>
                              <p className="text-[11px] text-slate-500">
                                บาร์โค้ด: {prod.barcode || prod.sku} • คงเหลือ {prod.stockQty} {prod.unit}
                              </p>
                            </div>
                            <div className="text-right shrink-0 flex items-center gap-2">
                              <span className="text-xs font-extrabold text-blue-700">
                                {formatCurrency(posMode === 'wholesale' ? prod.wholesalePrice : prod.retailPrice, currency)}
                              </span>
                              <span className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold">
                                + เพิ่ม
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Multipliers & Hardware Scanner Status */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 font-medium">จำนวน:</span>
                      {[1, 2, 5, 10].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setScanQuantity(qty)}
                          className={`min-w-[28px] h-7 px-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            scanQuantity === qty
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:bg-slate-200/60'
                          }`}
                        >
                          {qty}x
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDiagnosticModalOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] font-semibold active:scale-95 cursor-pointer"
                      title="ทดสอบเครื่องสแกนบาร์โค้ด"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>สแกนเนอร์: พร้อม</span>
                      {hardwareScannerState.scanCount > 0 && (
                        <span className="bg-emerald-600 text-white text-[9px] px-1 py-0.2 rounded font-mono font-bold">
                          {hardwareScannerState.scanCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* 4. Camera Barcode Scanner Trigger Button */}
                <div className="p-3 bg-white border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsCameraScannerOpen(true)}
                    className="w-full min-h-[48px] py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-2xl font-bold text-sm shadow-xs flex items-center justify-center gap-2.5 transition cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                    <span>เปิดกล้องสแกนบาร์โค้ด (Camera Scanner)</span>
                    <span className="text-[10px] bg-blue-500/40 text-blue-100 border border-blue-400/30 px-2 py-0.5 rounded-full font-semibold">
                      พร้อมใช้งาน
                    </span>
                  </button>

                  {/* Real-time Feedback Banner */}
                  {lastScannedFeedback && (
                    <div className="mt-2.5 flex items-center justify-between bg-emerald-50 border border-emerald-200/80 px-3 py-2 rounded-xl text-xs text-emerald-800 animate-in fade-in">
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-emerald-950">สแกนสำเร็จ:</span>
                        <span className="truncate font-medium">{lastScannedFeedback.name}</span>
                        <span className="bg-emerald-600 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0">
                          +{lastScannedFeedback.qty}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-mono shrink-0 pl-1">
                        {lastScannedFeedback.time}
                      </span>
                    </div>
                  )}
                </div>

                {/* 5. Customer Info Card */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {selectedCustomer ? selectedCustomer.name : 'ลูกค้าทั่วไป (Walk-in)'}
                        </p>
                        {selectedCustomer && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800 shrink-0">
                            {selectedCustomer.type === 'wholesale' ? 'ส่ง' : 'ปลีก'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {selectedCustomer ? (
                          selectedCustomer.outstandingDebt > 0 ? (
                            <span className="text-amber-600 font-bold">
                              หนี้ค้าง: {formatCurrency(selectedCustomer.outstandingDebt, currency)}
                            </span>
                          ) : (
                            <span className="text-emerald-600">ไม่มีหนี้คงค้าง</span>
                          )
                        ) : (
                          'ซื้อหน้าร้านทั่วไป ไม่บันทึกหนี้'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {selectedCustomer && (
                      <button
                        onClick={() => setSelectedCustomer(null)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-95 cursor-pointer"
                        title="ยกเลิกการเลือกลูกค้า"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="min-h-[44px] px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-blue-700 rounded-xl text-xs font-bold shadow-2xs active:scale-95 cursor-pointer"
                    >
                      {selectedCustomer ? 'เปลี่ยนลูกค้า' : 'เลือกลูกค้า'}
                    </button>
                  </div>
                </div>

                {/* 6. Cart Items List */}
                <div className="flex-1 p-3 space-y-2.5">
                  <div className="flex items-center justify-between pb-1 text-xs">
                    <span className="font-bold text-slate-700">
                      รายการสินค้า ({cart.length} รายการ / {cartTotals.itemCount} ชิ้น)
                    </span>
                    {(cart.length > 0 || selectedCustomer || billDiscountPercent > 0 || billDiscountAmount > 0) && (
                      <button
                        type="button"
                        onClick={() => setIsResetCartModalOpen(true)}
                        className="text-slate-500 hover:text-amber-700 font-semibold flex items-center gap-1 min-h-[36px] px-2.5 py-1 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200 transition cursor-pointer"
                        title="รีเซ็ตสินค้าในตะกร้าและส่วนลดบิลนี้"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                        <span>รีเซ็ตบิล</span>
                      </button>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <div className="py-10 px-4 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                        <ShoppingCart className="w-8 h-8" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">ตะกร้าสินค้ายังว่างเปล่า</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">
                        ยิงบาร์โค้ด ค้นหาชื่อสินค้า หรือเปิดกล้องเพื่อเริ่มคิดเงิน
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 mt-4 w-full max-w-xs">
                        <button
                          type="button"
                          onClick={() => setIsCameraScannerOpen(true)}
                          className="min-h-[44px] flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                        >
                          <Camera className="w-4 h-4 text-white" />
                          <span>สแกนด้วยกล้อง</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileSubTab('catalog')}
                          className="min-h-[44px] flex-1 px-3 py-2 bg-white border border-slate-200 text-blue-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                        >
                          <Grid className="w-4 h-4" />
                          <span>เลือกดูสินค้า</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 break-words">
                                {item.product.name}
                              </span>
                              {item.priceTier === 'wholesale' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                                  ราคาส่ง
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
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
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-red-600 active:scale-95 shrink-0 rounded-xl hover:bg-red-50 cursor-pointer"
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Quantity Controls and Total */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                            <button
                              onClick={() => updateCartItemQty(item.product.id, item.quantity - 1)}
                              className="w-11 h-11 flex items-center justify-center text-slate-700 hover:bg-slate-200 active:scale-95 font-bold cursor-pointer"
                              title="ลดจำนวน"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              min={1}
                              max={item.product.stockQty}
                              onChange={(e) =>
                                updateCartItemQty(item.product.id, parseInt(e.target.value) || 1)
                              }
                              className="w-12 text-center text-sm font-bold text-slate-900 bg-white py-1 focus:outline-hidden"
                            />
                            <button
                              onClick={() => updateCartItemQty(item.product.id, item.quantity + 1)}
                              className="w-11 h-11 flex items-center justify-center text-slate-700 hover:bg-slate-200 active:scale-95 font-bold cursor-pointer"
                              title="เพิ่มจำนวน"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="text-right">
                            <span className="text-base font-extrabold text-slate-900">
                              {formatCurrency(item.totalPrice, currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 7-10. Bill Discount, Subtotal, Tax, Net Total */}
                <div className="p-3 bg-white border-t border-slate-200 space-y-2 text-xs">
                  {/* 7. Discount inputs */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium shrink-0">ส่วนลดบิล:</span>
                    <div className="flex-1 flex gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          placeholder="ลด (บาท/กีบ)"
                          min={0}
                          value={billDiscountAmount || ''}
                          onChange={(e) => setBillDiscountAmount(parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white"
                        />
                      </div>
                      <div className="relative w-20">
                        <input
                          type="number"
                          placeholder="%"
                          min={0}
                          max={100}
                          value={billDiscountPercent || ''}
                          onChange={(e) => setBillDiscountPercent(parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 8. Subtotal */}
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>ยอดรวมสินค้า:</span>
                    <span className="font-semibold">{formatCurrency(cartTotals.subtotal, currency)}</span>
                  </div>

                  {cartTotals.discountTotal > 0 && (
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>ส่วนลดรวม:</span>
                      <span>-{formatCurrency(cartTotals.discountTotal, currency)}</span>
                    </div>
                  )}

                  {/* 9. Tax */}
                  {settings.isTaxEnabled && (
                    <div className="flex justify-between text-slate-600">
                      <span>ภาษีมูลค่าเพิ่ม ({settings.taxRatePercent}%):</span>
                      <span>{formatCurrency(cartTotals.taxTotal, currency)}</span>
                    </div>
                  )}

                  {/* 10. Grand Total */}
                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                    <span className="text-sm font-bold text-slate-800">ยอดสุทธิที่ต้องชำระ:</span>
                    <span className="text-2xl font-black text-blue-700">
                      {formatCurrency(cartTotals.grandTotal, currency)}
                    </span>
                  </div>
                </div>

                {/* 11. Sticky Thumb-Friendly Checkout Button */}
                <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl">
                  <button
                    onClick={handleOpenCheckout}
                    disabled={cart.length === 0}
                    className={`w-full min-h-[52px] px-4 rounded-2xl font-bold text-base flex items-center justify-between transition shadow-lg active:scale-[0.99] cursor-pointer ${
                      cart.length === 0
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Banknote className="w-5 h-5" />
                      <span>ชำระเงิน • คิดเงิน</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-black text-lg">
                      <span>{formatCurrency(cartTotals.grandTotal, currency)}</span>
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* MOBILE CATALOG VIEW (When user clicks 'สินค้า') */
              <div className="flex flex-col min-h-full p-3 space-y-3">
                {/* Search in catalog */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อสินค้า..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0 custom-scrollbar">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-blue-50/60 border border-slate-200'
                    }`}
                  >
                    ทั้งหมด ({products.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-blue-50/60 border border-slate-200'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Products Grid (2 columns on mobile) */}
                <div className="grid grid-cols-2 gap-2.5 pb-20">
                  {filteredProducts.map((product) => {
                    const isOutOfStock = product.stockQty <= 0;
                    const isLowStock = product.stockQty <= (product.minStockAlert || 10) && !isOutOfStock;
                    const isWholesaleActive = posMode === 'wholesale' || selectedCustomer?.type === 'wholesale';
                    const activeDisplayPrice = isWholesaleActive ? product.wholesalePrice : product.retailPrice;

                    return (
                      <div
                        key={product.id}
                        onClick={() => {
                          if (!isOutOfStock) {
                            addToCart(product, 1);
                            playScanSuccessSound();
                            showToast(`+1 ${product.name} เพิ่มลงตะกร้าแล้ว`, 'success');
                          }
                        }}
                        className={`bg-white rounded-2xl border p-2.5 flex flex-col justify-between transition select-none active:scale-[0.98] ${
                          isOutOfStock
                            ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50/50'
                            : 'cursor-pointer hover:border-blue-400 border-slate-200/90 shadow-2xs'
                        }`}
                      >
                        <div className="w-full h-20 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden relative mb-2 flex items-center justify-center">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Tag className="w-6 h-6 text-slate-300" />
                          )}
                          <span
                            className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-xs ${
                              isOutOfStock
                                ? 'bg-red-500 text-white'
                                : isLowStock
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-900/80 text-white'
                            }`}
                          >
                            {isOutOfStock ? 'หมด' : `${product.stockQty} ${product.unit}`}
                          </span>
                        </div>

                        <div className="space-y-0.5 min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 line-clamp-2 leading-snug">
                            {product.name}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{product.sku}</p>
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900">
                            {formatCurrency(activeDisplayPrice, currency)}
                          </span>
                          <button
                            disabled={isOutOfStock}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition shadow-2xs ${
                              isOutOfStock
                                ? 'bg-slate-200 text-slate-400'
                                : 'bg-blue-600 text-white active:scale-95'
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Floating Return to Cart Pill */}
                {cart.length > 0 && (
                  <div className="fixed bottom-4 left-4 right-4 z-30 pb-[env(safe-area-inset-bottom)]">
                    <button
                      onClick={() => setMobileSubTab('cart')}
                      className="w-full min-h-[50px] bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-between active:scale-[0.99] cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-white" />
                        <span>กลับไปที่ตะกร้า ({cartTotals.itemCount} ชิ้น)</span>
                      </div>
                      <div className="flex items-center gap-1 font-black text-white">
                        <span>{formatCurrency(cartTotals.grandTotal, currency)}</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* DESKTOP & TABLET CONTENT (hidden on < md, flex on >= md)      */}
          {/* ============================================================== */}
          <div className="hidden md:flex flex-1 flex-row overflow-hidden">
            {/* LEFT: Product Catalog Panel */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-3 md:p-4">
            {/* กล่องสแกนบาร์โค้ดเพิ่มสินค้าด่วน (Barcode Scanner Station) - Modern Minimalist */}
            <div className="bg-white rounded-2xl p-3.5 mb-3.5 border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
                {/* Title & Status Indicator */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                    <Barcode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs md:text-sm text-slate-900 flex items-center gap-2">
                      <span>กล่องสแกนบาร์โค้ดเพิ่มสินค้า</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        พร้อมสแกน
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      รองรับเครื่องสแกน USB / Bluetooth หรือกดปุ่มเปิดกล้องมือถือ/แท็บเล็ต
                    </span>
                  </div>
                </div>

                {/* Controls: Multiplier, Hardware Scanner Status, Diagnostic Tool, Camera, Auto-focus lock */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Live Hardware Scanner Indicator Badge */}
                  <button
                    type="button"
                    onClick={() => setIsDiagnosticModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                    title="เครื่องสแกนบาร์โค้ด USB / Bluetooth พร้อมรับคำสั่งทันที (คลิกเพื่อทดสอบ)"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="hidden lg:inline">สแกนเนอร์ USB/BT:</span>
                    <span>พร้อม</span>
                    {hardwareScannerState.scanCount > 0 && (
                      <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-md font-mono font-bold">
                        {hardwareScannerState.scanCount}
                      </span>
                    )}
                  </button>

                  {/* Multiplier / Quantity Picker */}
                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200 text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">จำนวน:</span>
                    {[1, 2, 5, 10].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setScanQuantity(qty)}
                        className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                          scanQuantity === qty
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        {qty}x
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={scanQuantity}
                      onChange={(e) => setScanQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-10 px-1 py-0.5 text-center text-xs bg-white border border-slate-200 rounded text-slate-900 font-mono font-bold"
                    />
                  </div>

                  {/* Diagnostic Suite Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setIsDiagnosticModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                    title="เปิดศูนย์ทดสอบและวินิจฉัยอุปกรณ์สแกนบาร์โค้ดทุกแพลตฟอร์ม"
                  >
                    <Cpu className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden sm:inline">ทดสอบสแกนเนอร์</span>
                  </button>

                  {/* Camera Scanner Button */}
                  <button
                    type="button"
                    onClick={() => setIsCameraScannerOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>เปิดกล้องสแกน</span>
                  </button>

                  {/* Auto-focus lock toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setAutoFocusScanner(!autoFocusScanner);
                      if (!autoFocusScanner) barcodeInputRef.current?.focus();
                    }}
                    title={autoFocusScanner ? 'เปิดล็อกโฟกัสสแกนเนอร์ตลอดเวลา' : 'ปิดล็อกโฟกัส'}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                      autoFocusScanner
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {autoFocusScanner ? <Lock className="w-3 h-3 text-blue-600" /> : <Unlock className="w-3 h-3 text-slate-400" />}
                    <span className="hidden sm:inline">{autoFocusScanner ? 'ล็อกเป้าสแกน' : 'ล็อกเป้า'}</span>
                  </button>
                </div>
              </div>

              {/* Main Barcode Scan Input Bar */}
              <div className="flex gap-2">
                <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
                  <div className="absolute left-3.5 top-3 flex items-center pointer-events-none text-slate-400">
                    <Barcode className="w-4 h-4" />
                  </div>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="ยิงบาร์โค้ดสินค้าที่นี่ (กด Enter เพื่อเพิ่มลงบิล)..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-10 pr-24 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl focus:outline-hidden focus:ring-3 focus:ring-blue-100 text-slate-900 placeholder:text-slate-400 font-mono tracking-wider transition"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่ม ({scanQuantity}x)</span>
                  </button>
                </form>

                {/* Keyword search input alongside */}
                <div className="relative w-44 sm:w-60 hidden md:block">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อสินค้า..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-7 py-2.5 text-xs bg-slate-50 hover:bg-white text-slate-900 rounded-xl border border-slate-200 focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-3 focus:ring-blue-100 font-medium transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Real-time Feedback Chip */}
              {lastScannedFeedback && (
                <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/70 px-3 py-1.5 rounded-xl text-xs text-emerald-800 animate-in fade-in">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-emerald-900">ล่าสุด:</span>
                    <span className="truncate font-medium">{lastScannedFeedback.name}</span>
                    <span className="bg-emerald-600 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0">
                      +{lastScannedFeedback.qty}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-mono shrink-0 pl-2">
                    {lastScannedFeedback.time}
                  </span>
                </div>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 shrink-0 custom-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-blue-50/60 border border-slate-200'
                }`}
              >
                ทั้งหมด ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-blue-50/60 border border-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto pr-1 pt-1 custom-scrollbar">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 p-8">
                  <AlertCircle className="w-10 h-10 mb-2 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">ไม่พบสินค้าในหมวดหมู่นี้</p>
                  <p className="text-xs text-slate-400 mt-0.5">ลองค้นหาด้วยคำอื่น หรือสแกนบาร์โค้ดเพิ่มสินค้าใหม่</p>
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
                        className={`bg-white rounded-2xl border p-3 flex flex-col justify-between transition group relative select-none ${
                          isOutOfStock
                            ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50/50'
                            : 'cursor-pointer hover:border-blue-400 hover:shadow-xs active:scale-[0.99] border-slate-200/90'
                        }`}
                      >
                        {/* Image / Thumbnail */}
                        <div className="w-full h-24 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden relative mb-2.5 flex items-center justify-center">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <Tag className="w-7 h-7 text-slate-300" />
                          )}

                          {/* Stock Badge */}
                          <span
                            className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs ${
                              isOutOfStock
                                ? 'bg-red-500 text-white'
                                : isLowStock
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-900/80 text-white'
                            }`}
                          >
                            {isOutOfStock ? 'หมด' : `${product.stockQty} ${product.unit}`}
                          </span>
                        </div>

                        {/* Title & SKU */}
                        <div className="space-y-0.5">
                          <h4 className="font-semibold text-xs text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition">
                            {product.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 font-mono">{product.sku}</p>
                        </div>

                        {/* Pricing details */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-end justify-between">
                          <div>
                            <div className="text-sm font-bold text-slate-900 tabular-nums">
                              {formatCurrency(activeDisplayPrice, currency)}
                            </div>
                            {posMode === 'retail' && product.wholesalePrice > 0 && (
                              <div className="text-[10px] text-emerald-600 font-medium tabular-nums">
                                ส่ง {formatCurrency(product.wholesalePrice, currency)} (≥{product.wholesaleMinQty})
                              </div>
                            )}
                          </div>
                          <button
                            disabled={isOutOfStock}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition shadow-xs cursor-pointer ${
                              isOutOfStock
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-slate-100 text-slate-700 group-hover:bg-blue-600 group-hover:text-white'
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
          <div className="w-full md:w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg z-10 shrink-0">
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
              {(cart.length > 0 || selectedCustomer || billDiscountPercent > 0 || billDiscountAmount > 0) && (
                <button
                  type="button"
                  onClick={() => setIsResetCartModalOpen(true)}
                  className="text-slate-500 hover:text-amber-700 font-semibold flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200 transition cursor-pointer"
                  title="รีเซ็ตสินค้าในตะกร้าและส่วนลดบิลนี้"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
                  <span>รีเซ็ตบิล</span>
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
            <div className="p-4 bg-white border-b border-slate-200 text-slate-900 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">เลือกลูกค้าสำหรับบิลนี้</h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
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

      {/* CAMERA BARCODE SCANNER MODAL */}
      <CameraBarcodeScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={(code) => processScannedBarcode(code, scanQuantity)}
        autoClose={true}
        continuous={false}
        title="กล้องสแกนบาร์โค้ดขายสินค้า (POS Universal Scanner)"
        existingProducts={products}
        onOpenDiagnostics={() => {
          setIsCameraScannerOpen(false);
          setIsDiagnosticModalOpen(true);
        }}
      />

      {/* BARCODE SCANNER DIAGNOSTIC & TESTING SUITE MODAL */}
      <BarcodeScannerDiagnosticModal
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        products={products}
        onAddToCart={(p, qty) => addToCart(p, qty)}
      />

      {/* QUICK ADD UNLISTED PRODUCT MODAL */}
      {isQuickAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">เพิ่มสินค้าด่วนจากบาร์โค้ด</h3>
                  <p className="text-[11px] text-blue-100">ยังไม่มีบาร์โค้ดนี้ในระบบ กรอกข้อมูลเพื่อเปิดขายได้ทันที</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickAddModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleQuickAddProduct} className="p-4 sm:p-5 space-y-3.5">
              {/* Barcode display */}
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-blue-900">
                  <Barcode className="w-4 h-4 text-blue-600" />
                  <span>รหัสบาร์โค้ด:</span>
                </div>
                <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                  {quickAddBarcode}
                </span>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อสินค้า <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="เช่น มาม่ารสต้มยำกุ้ง (ซอง)"
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">หมวดหมู่</label>
                  <select
                    value={quickAddCategoryId}
                    onChange={(e) => setQuickAddCategoryId(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">หน่วยนับ</label>
                  <input
                    type="text"
                    value={quickAddUnit}
                    onChange={(e) => setQuickAddUnit(e.target.value)}
                    placeholder="เช่น ชิ้น, แพ็ค, ลัง"
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Prices: Retail & Wholesale */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ราคาขายปลีก ({currency}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    placeholder="0"
                    value={quickAddRetailPrice}
                    onChange={(e) => setQuickAddRetailPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl font-bold text-blue-700 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ราคาขายส่ง ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={quickAddWholesalePrice}
                    onChange={(e) => setQuickAddWholesalePrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl font-bold text-emerald-700 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Cost Price & Stock Qty */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ราคาทุน ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={quickAddCostPrice}
                    onChange={(e) => setQuickAddCostPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-700 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    จำนวนสต็อกแรกเข้า
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={quickAddStockQty}
                    onChange={(e) => setQuickAddStockQty(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-700 focus:outline-hidden font-bold"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isQuickAdding}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>บันทึกและเพิ่มลงบิล</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET POS TERMINAL CONFIRMATION MODAL */}
      <ResetConfirmModal
        isOpen={isResetPOSModalOpen}
        onClose={() => setIsResetPOSModalOpen(false)}
        onConfirm={handleResetPOS}
        title="ยืนยันการรีเซ็ตหน้าขาย POS"
        description="คุณต้องการรีเซ็ตหน้าขาย POS กลับสู่สถานะเริ่มต้นหรือไม่? รายการสินค้าในตะกร้า ส่วนลด และลูกค้าที่เลือกจะถูกล้าง (ประวัติการขายในระบบจะไม่ถูกลบ)"
        detailBadge={
          cart.length > 0
            ? `สินค้าในตะกร้า ${cart.length} รายการ (${cartTotals.itemCount} ชิ้น) จะถูกล้าง`
            : undefined
        }
        confirmLabel="ยืนยันรีเซ็ตหน้าขาย"
      />

      {/* RESET CART / BILL CONFIRMATION MODAL */}
      <ResetConfirmModal
        isOpen={isResetCartModalOpen}
        onClose={() => setIsResetCartModalOpen(false)}
        onConfirm={handleResetCart}
        title="ยืนยันการรีเซ็ตตะกร้าสินค้า"
        description="คุณต้องการล้างสินค้าทั้งหมดในตะกร้า และรีเซ็ตส่วนลดบิลนี้ใช่หรือไม่?"
        detailBadge={
          cart.length > 0
            ? `สินค้าในตะกร้า ${cart.length} รายการ (${cartTotals.itemCount} ชิ้น)`
            : undefined
        }
        confirmLabel="ยืนยันล้างตะกร้า"
      />
    </div>
  );
};
