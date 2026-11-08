import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  AlertTriangle,
  Barcode,
  Layers,
  Percent,
  X,
  Check,
  RefreshCw,
  ExternalLink,
  Camera,
  Sparkles,
  CheckCircle2,
  FolderPlus,
  Folder,
  RotateCcw,
  Cpu,
} from 'lucide-react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useApp } from '../../context/AppContext';
import { Product, Category } from '../../types/pos';
import {
  formatCurrency,
  formatNumber,
  generateSku,
  generateBarcode,
} from '../../utils/formatters';
import { CameraBarcodeScannerModal } from '../common/CameraBarcodeScannerModal';
import { BarcodeScannerDiagnosticModal } from '../common/BarcodeScannerDiagnosticModal';
import { CategoryModal } from './CategoryModal';
import { ResetConfirmModal } from '../common/ResetConfirmModal';
import { playScanSuccessSound, playScanErrorSound } from '../../utils/audio';

export const ProductsView: React.FC = () => {
  const { products, categories, currency, showToast, currentUser, canViewCosts, t, systemNames } = useApp();

  // Active units configured in System Name Management
  const activeUnits = useMemo(() => {
    const units = Array.isArray(systemNames?.units)
      ? systemNames.units.filter((u) => u.isEnabled !== false).map((u) => u.name)
      : [];
    return units.length > 0 ? units : ['ชิ้น', 'แพ็ก', 'กล่อง', 'ลัง', 'โหล', 'ถุง', 'ขวด', 'กก.'];
  }, [systemNames?.units]);

  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);

  // Reset Modals State
  const [isResetFiltersModalOpen, setIsResetFiltersModalOpen] = useState<boolean>(false);
  const [isResetFormModalOpen, setIsResetFormModalOpen] = useState<boolean>(false);

  // Reset Filters & Search Handler
  const handleResetFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setStockFilter('all');
    showToast('รีเซ็ตช่องค้นหาและตัวกรองสินค้าเรียบร้อยแล้ว', 'info');
  };

  // Reset Product Form Handler
  const handleResetForm = () => {
    if (editingProduct) {
      setFormData({
        sku: editingProduct.sku || '',
        barcode: editingProduct.barcode || '',
        name: editingProduct.name || '',
        categoryId: editingProduct.categoryId || '',
        unit: editingProduct.unit || 'ชิ้น',
        costPrice: editingProduct.costPrice || 0,
        retailPrice: editingProduct.retailPrice || 0,
        wholesalePrice: editingProduct.wholesalePrice || 0,
        wholesaleMinQty: editingProduct.wholesaleMinQty || 5,
        stockQty: editingProduct.stockQty || 0,
        minStockAlert: editingProduct.minStockAlert || 10,
        imageUrl: editingProduct.imageUrl || '',
        description: editingProduct.description || '',
        isActive: editingProduct.isActive !== false,
      });
    } else {
      setFormData({
        sku: generateSku(),
        barcode: generateBarcode(),
        name: '',
        categoryId: categories[0]?.id || '',
        unit: 'ชิ้น',
        costPrice: 0,
        retailPrice: 0,
        wholesalePrice: 0,
        wholesaleMinQty: 5,
        stockQty: 0,
        minStockAlert: 10,
        imageUrl: '',
        description: '',
        isActive: true,
      });
    }
    showToast('รีเซ็ตข้อมูลในแบบฟอร์มเรียบร้อยแล้ว', 'info');
  };

  // Barcode Scanner Integration
  const [scanBarcodeInput, setScanBarcodeInput] = useState<string>('');
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);
  const [cameraModalTarget, setCameraModalTarget] = useState<'search' | 'form'>('search');
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState<boolean>(false);
  const [scannedMatchResult, setScannedMatchResult] = useState<Product | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    categoryId: '',
    unit: 'ชิ้น',
    costPrice: 0,
    retailPrice: 0,
    wholesalePrice: 0,
    wholesaleMinQty: 5,
    stockQty: 0,
    minStockAlert: 10,
    imageUrl: '',
    description: '',
    isActive: true,
  });

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filtered list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q));

      let matchStock = true;
      if (stockFilter === 'out_of_stock') {
        matchStock = p.stockQty <= 0;
      } else if (stockFilter === 'low_stock') {
        matchStock = p.stockQty <= (p.minStockAlert || 10) && p.stockQty > 0;
      } else if (stockFilter === 'in_stock') {
        matchStock = p.stockQty > (p.minStockAlert || 10);
      }

      return matchCat && matchSearch && matchStock;
    });
  }, [products, selectedCategory, search, stockFilter]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      sku: generateSku(),
      barcode: '',
      name: '',
      categoryId: categories[0]?.id || '',
      unit: 'ชิ้น',
      costPrice: 0,
      retailPrice: 0,
      wholesalePrice: 0,
      wholesaleMinQty: 5,
      stockQty: 20,
      minStockAlert: 5,
      imageUrl: '',
      description: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // Open Modal with specific Scanned Barcode prefilled
  const handleOpenAddWithBarcode = (scannedCode: string) => {
    setEditingProduct(null);
    setFormData({
      sku: 'SKU-' + (scannedCode.slice(-6) || Date.now().toString().slice(-6)),
      barcode: scannedCode.trim(),
      name: '',
      categoryId: categories[0]?.id || '',
      unit: 'ชิ้น',
      costPrice: 0,
      retailPrice: 0,
      wholesalePrice: 0,
      wholesaleMinQty: 5,
      stockQty: 25,
      minStockAlert: 5,
      imageUrl: '',
      description: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // Handle barcode scanned from top bar
  const handleScanToSearchOrAdd = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    const matched = products.find(
      (p) =>
        p.barcode === code ||
        p.sku.toLowerCase() === code.toLowerCase() ||
        p.name.toLowerCase() === code.toLowerCase()
    );

    if (matched) {
      playScanSuccessSound();
      setSearch(code);
      setScannedMatchResult(matched);
      showToast(`พบสินค้า "${matched.name}" ตรงกับบาร์โค้ดในระบบ`, 'success');
    } else {
      playScanErrorSound();
      setScannedMatchResult(null);
      showToast(`ไม่พบรหัส "${code}" ในระบบ เปิดฟอร์มเพิ่มสินค้าใหม่ให้ทันที`, 'info');
      handleOpenAddWithBarcode(code);
    }
    setScanBarcodeInput('');
  };

  // Open Modal for Edit
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      sku: p.sku || '',
      barcode: p.barcode || '',
      name: p.name || '',
      categoryId: p.categoryId || '',
      unit: p.unit || 'ชิ้น',
      costPrice: p.costPrice || 0,
      retailPrice: p.retailPrice || 0,
      wholesalePrice: p.wholesalePrice || 0,
      wholesaleMinQty: p.wholesaleMinQty || 5,
      stockQty: p.stockQty || 0,
      minStockAlert: p.minStockAlert || 10,
      imageUrl: p.imageUrl || '',
      description: p.description || '',
      isActive: p.isActive !== false,
    });
    setIsModalOpen(true);
  };

  // Calculate live margin
  const marginPercent = useMemo(() => {
    if (formData.retailPrice <= 0) return 0;
    return (((formData.retailPrice - formData.costPrice) / formData.retailPrice) * 100).toFixed(1);
  }, [formData.retailPrice, formData.costPrice]);

  const wholesaleMarginPercent = useMemo(() => {
    if (formData.wholesalePrice <= 0) return 0;
    return (((formData.wholesalePrice - formData.costPrice) / formData.wholesalePrice) * 100).toFixed(1);
  }, [formData.wholesalePrice, formData.costPrice]);

  // Duplicate Barcode Check (excluding current product being edited)
  const duplicateProduct = useMemo(() => {
    const rawBarcode = formData.barcode.trim();
    if (!rawBarcode) return null;
    return (
      products.find(
        (p) =>
          p.barcode === rawBarcode &&
          (!editingProduct || p.id !== editingProduct.id)
      ) || null
    );
  }, [formData.barcode, products, editingProduct]);

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('กรุณากรอกชื่อสินค้า', 'warning');
      return;
    }

    if (duplicateProduct) {
      showToast(
        `รหัสบาร์โค้ด "${formData.barcode}" ซ้ำกับสินค้า "${duplicateProduct.name}" ที่มีอยู่แล้วในระบบ`,
        'error'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const cat = categories.find((c) => c.id === formData.categoryId);
      const nowIso = new Date().toISOString();

      const productPayload = {
        sku: formData.sku.trim() || generateSku(),
        barcode: formData.barcode.trim() || generateBarcode(),
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        categoryName: cat?.name || 'ทั่วไป',
        unit: formData.unit.trim() || 'ชิ้น',
        costPrice: Number(formData.costPrice) || 0,
        retailPrice: Number(formData.retailPrice) || 0,
        wholesalePrice: Number(formData.wholesalePrice) || Number(formData.retailPrice) || 0,
        wholesaleMinQty: Number(formData.wholesaleMinQty) || 1,
        stockQty: Number(formData.stockQty) || 0,
        minStockAlert: Number(formData.minStockAlert) || 5,
        imageUrl: formData.imageUrl.trim(),
        description: formData.description.trim(),
        isActive: formData.isActive,
        updatedAt: nowIso,
      };

      if (editingProduct) {
        // Update
        const ref = doc(db, 'products', editingProduct.id);
        await updateDoc(ref, productPayload);
        showToast(`อัปเดตสินค้า "${formData.name}" เรียบร้อยแล้ว`, 'success');
      } else {
        // Create new
        const ref = doc(collection(db, 'products'));
        await setDoc(ref, {
          ...productPayload,
          createdAt: nowIso,
        });
        showToast(`เพิ่มสินค้า "${formData.name}" เข้าสู่ระบบเรียบร้อย`, 'success');
      }

      setIsSubmitting(false);
      setIsModalOpen(false);
    } catch (err) {
      setIsSubmitting(false);
      handleFirestoreError(err, OperationType.WRITE, 'products');
    }
  };

  // Delete product
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'products', deleteTarget.id));
      showToast(`ลบสินค้า "${deleteTarget.name}" เรียบร้อยแล้ว`, 'info');
      setDeleteTarget(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${deleteTarget.id}`);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">จัดการข้อมูลสินค้าและราคา</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            กำหนดราคาปลีก-ส่ง, บาร์โค้ด, หมวดหมู่สินค้า, จุดสั่งซื้อ และสต็อกคงเหลือ
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100/80 text-blue-700 border border-blue-200/90 active:scale-95 text-xs md:text-sm font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-blue-600" />
            <span>+ เพิ่มหมวดหมู่</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มสินค้าใหม่</span>
          </button>
        </div>
      </div>

      {/* กล่องสแกนบาร์โค้ดเพิ่มสินค้าและตรวจสอบสต็อก (Barcode Quick Scanner) - Clean Minimalist */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
              <span>กล่องสแกนบาร์โค้ดสินค้า (Barcode Quick Scanner)</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                พร้อมสแกน
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              ยิงบาร์โค้ดเพื่อค้นหา/แก้ไขสินค้าทันที หากยังไม่มีรหัสนี้ในระบบจะเปิดฟอร์มเพิ่มสินค้าใหม่ให้อัตโนมัติ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleScanToSearchOrAdd(scanBarcodeInput);
            }}
            className="relative flex-1 sm:w-80"
          >
            <Barcode className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ยิงบาร์โค้ดหรือพิมพ์รหัสที่นี่..."
              value={scanBarcodeInput}
              onChange={(e) => setScanBarcodeInput(e.target.value)}
              className="w-full pl-9 pr-20 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition"
            />
            <button
              type="submit"
              className="absolute right-1 top-1 bottom-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg transition cursor-pointer"
            >
              ค้นหา/เพิ่ม
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setCameraModalTarget('search');
              setIsCameraModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer shrink-0"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">เปิดกล้องสแกน</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDiagnosticModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer shrink-0"
            title="เปิดศูนย์ทดสอบสแกนเนอร์"
          >
            <Cpu className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline">ทดสอบสแกนเนอร์</span>
          </button>
        </div>
      </div>

      {/* Match Result Alert / Quick Action Banner */}
      {scannedMatchResult && (
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                <span>{scannedMatchResult.name}</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono">
                  {scannedMatchResult.barcode || scannedMatchResult.sku}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700">
                ราคาปลีก: {formatCurrency(scannedMatchResult.retailPrice, currency)} | ราคาส่ง: {formatCurrency(scannedMatchResult.wholesalePrice, currency)} | คงเหลือ: {scannedMatchResult.stockQty} {scannedMatchResult.unit}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenEdit(scannedMatchResult)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition"
            >
              แก้ไขข้อมูลสินค้านี้
            </button>
            <button
              type="button"
              onClick={() => {
                setScannedMatchResult(null);
                setSearch('');
              }}
              className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อสินค้า, รหัส SKU, หรือบาร์โค้ด..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Category Filter Dropdown */}
          <div className="w-full md:w-56">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
            >
              <option value="all">ทุกหมวดหมู่สินค้า ({products.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div className="w-full md:w-48">
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
            >
              <option value="all">สถานะสต็อกทั้งหมด</option>
              <option value="in_stock">พร้อมขาย (สต็อกปกติ)</option>
              <option value="low_stock">ใกล้หมด (Low Stock)</option>
              <option value="out_of_stock">หมดสต็อก (Out of Stock)</option>
            </select>
          </div>

          {/* Reset Filters Button */}
          {(search !== '' || selectedCategory !== 'all' || stockFilter !== 'all') && (
            <button
              type="button"
              onClick={() => setIsResetFiltersModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100/80 text-amber-800 border border-amber-200/90 rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer shrink-0"
              title="ล้างข้อความค้นหาและตัวกรองสินค้าทั้งหมด"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>รีเซ็ตตัวกรอง</span>
            </button>
          )}
        </div>

        {/* Category Quick Filter Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-0.5 custom-scrollbar border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Folder className="w-3.5 h-3.5" />
            <span>หมวดหมู่:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            ทั้งหมด ({products.length})
          </button>
          {categories.map((c) => {
            const count = products.filter((p) => p.categoryId === c.id).length;
            const isSelected = selectedCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <span>{c.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer text-blue-700 hover:bg-blue-50 border border-blue-200/90 flex items-center gap-1 shrink-0 ml-1"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>+ จัดการหมวดหมู่</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3 px-4">รูปภาพ</th>
                <th className="py-3 px-4">รหัส / บาร์โค้ด</th>
                <th className="py-3 px-4">ชื่อสินค้า</th>
                <th className="py-3 px-4">หมวดหมู่</th>
                <th className="py-3 px-4 text-right">ราคาทุน</th>
                <th className="py-3 px-4 text-right">ราคาขายปลีก</th>
                <th className="py-3 px-4 text-right">ราคาขายส่ง</th>
                <th className="py-3 px-4 text-center">คงเหลือในคลัง</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">ไม่พบสินค้าในระบบ</p>
                    <p className="text-xs">คลิกที่ปุ่ม "เพิ่มสินค้าใหม่" เพื่อเริ่มต้นบันทึกข้อมูลสินค้า</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOutOfStock = p.stockQty <= 0;
                  const isLow = p.stockQty <= (p.minStockAlert || 10) && !isOutOfStock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      {/* Image */}
                      <td className="py-3 px-4 w-14">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Tag className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* SKU / Barcode */}
                      <td className="py-3 px-4">
                        <p className="font-mono font-bold text-blue-700 text-xs">{p.sku}</p>
                        <p className="font-mono text-[11px] text-slate-400">{p.barcode || '-'}</p>
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        <p className="line-clamp-1">{p.name}</p>
                        <span className="text-[11px] text-slate-400 font-normal">หน่วย: {p.unit}</span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {p.categoryName || 'ทั่วไป'}
                      </td>

                      {/* Cost */}
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {canViewCosts ? formatCurrency(p.costPrice, currency) : '***'}
                      </td>

                      {/* Retail Price */}
                      <td className="py-3 px-4 text-right font-bold text-slate-800">
                        {formatCurrency(p.retailPrice, currency)}
                      </td>

                      {/* Wholesale Price */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-emerald-700">
                          {formatCurrency(p.wholesalePrice, currency)}
                        </div>
                        <span className="text-[10px] text-slate-400">ขั้นต่ำ {p.wholesaleMinQty} {p.unit}</span>
                      </td>

                      {/* Stock Level */}
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

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="แก้ไขสินค้า"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {(currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="ลบสินค้า"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col my-8">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">
                  {editingProduct ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่ลงในระบบ'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[80vh] custom-scrollbar">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อสินค้า <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ข้าวหอมมะลิ 5 กก. หรือ น้ำดื่มสิงห์ 600 มล."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* SKU & Barcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">รหัสสินค้า (SKU)</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, sku: generateSku() })}
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> สุ่มรหัส
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl font-mono focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">รหัสบาร์โค้ด (Barcode)</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCameraModalTarget('form');
                          setIsCameraModalOpen(true);
                        }}
                        className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition cursor-pointer"
                      >
                        <Camera className="w-2.5 h-2.5" /> สแกนด้วยกล้อง
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, barcode: generateBarcode() })}
                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <RefreshCw className="w-2.5 h-2.5" /> สุ่มบาร์โค้ด
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Barcode className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ยิงบาร์โค้ด หรือกดสแกนด้วยกล้อง..."
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className={`w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border rounded-xl font-mono focus:outline-hidden focus:ring-2 ${
                        duplicateProduct
                          ? 'border-amber-400 focus:ring-amber-400 bg-amber-50/40 text-amber-950 font-bold'
                          : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    />
                  </div>

                  {/* Duplicate Barcode Warning Banner */}
                  {duplicateProduct && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-bold">สินค้านี้มีอยู่ในระบบแล้ว (Barcode ซ้ำ):</span>
                        <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                          ชื่อสินค้า: <span className="font-bold">{duplicateProduct.name}</span> (SKU: {duplicateProduct.sku}, หมวด: {duplicateProduct.categoryName})
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(duplicateProduct)}
                            className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-50 cursor-pointer shadow-2xs"
                          >
                            แก้ไขสินค้านี้แทน
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, barcode: generateBarcode() })}
                            className="text-[10px] text-slate-600 hover:text-slate-800 underline cursor-pointer"
                          >
                            สุ่มรหัสใหม่
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Valid Unique Barcode Confirmation */}
                  {formData.barcode && !duplicateProduct && (
                    <div className="mt-1 text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>รหัสบาร์โค้ดพร้อมบันทึก (ตรวจสอบแล้ว ไม่ซ้ำกับสินค้าอื่นในระบบ)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      หมวดหมู่สินค้า <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <FolderPlus className="w-3 h-3" />
                      <span>+ เพิ่มหมวดหมู่</span>
                    </button>
                  </div>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      หน่วยนับสินค้า
                    </label>
                    <span className="text-[10px] text-slate-400">เลือกหรือพิมพ์เองได้</span>
                  </div>
                  <input
                    type="text"
                    list="system-units-list"
                    placeholder="เช่น ชิ้น, ลัง, แพ็ก, กล่อง"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                  />
                  <datalist id="system-units-list">
                    {activeUnits.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                  <div className="flex flex-wrap gap-1 mt-1.5 max-h-16 overflow-y-auto">
                    {activeUnits.slice(0, 8).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setFormData({ ...formData, unit: u })}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition ${
                          formData.unit === u
                            ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* PRICING ROW: Cost, Retail, Wholesale & Margins */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-blue-600" />
                  โครงสร้างราคาและกำไรต่อหน่วย
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ราคาทุน (Cost) <span className="text-red-500">*</span>
                    </label>
                    {canViewCosts ? (
                      <input
                        type="number"
                        step="any"
                        min={0}
                        required
                        value={formData.costPrice}
                        onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-hidden"
                      />
                    ) : (
                      <div className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-500">
                        *** (สงวนสิทธิ์)
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">ราคาขายปลีก</label>
                      {canViewCosts && (
                        <span className="text-[10px] text-emerald-600 font-bold">มาร์จิ้น: {marginPercent}%</span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      required
                      value={formData.retailPrice}
                      onChange={(e) => setFormData({ ...formData, retailPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl font-bold text-blue-700 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">ราคาขายส่ง</label>
                      {canViewCosts && (
                        <span className="text-[10px] text-emerald-600 font-bold">มาร์จิ้น: {wholesaleMarginPercent}%</span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      required
                      value={formData.wholesalePrice}
                      onChange={(e) => setFormData({ ...formData, wholesalePrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl font-bold text-emerald-700 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    จำนวนขั้นต่ำเพื่อได้ราคาส่งอัตโนมัติ (Wholesale Min Quantity)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.wholesaleMinQty}
                    onChange={(e) => setFormData({ ...formData, wholesaleMinQty: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    * เมื่อลูกค้าสั่งสินค้านี้ถึงจำนวนที่กำหนด ระบบจะปรับเป็นราคาส่งให้อัตโนมัติแม้จะอยู่ในโหมดขายปลีก
                  </p>
                </div>
              </div>

              {/* STOCK QUANTITY & ALERTS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    จำนวนสินค้าปัจจุบันในสต็อก
                  </label>
                  <input
                    type="number"
                    value={formData.stockQty}
                    onChange={(e) => setFormData({ ...formData, stockQty: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl font-bold focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    จุดแจ้งเตือนสินค้าใกล้หมด (Min Alert)
                  </label>
                  <input
                    type="number"
                    value={formData.minStockAlert}
                    onChange={(e) => setFormData({ ...formData, minStockAlert: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Image URL & Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL ลิงก์รูปภาพสินค้า (Image URL)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รายละเอียด / บันทึกเพิ่มเติม
                </label>
                <textarea
                  rows={2}
                  placeholder="รายละเอียดของสินค้า หรือตำแหน่งจัดวางในร้าน"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded-xs"
                />
                <label htmlFor="isActiveToggle" className="text-xs font-semibold text-slate-700">
                  เปิดใช้งานสินค้านี้ (แสดงในหน้าขาย POS)
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="p-4 bg-slate-50 -mx-5 -mb-5 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsResetFormModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-800 text-xs font-semibold transition cursor-pointer"
                  title="ล้างข้อมูลที่กำลังกรอกในแบบฟอร์ม"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
                  <span>รีเซ็ตฟอร์ม</span>
                </button>

                <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 text-xs md:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-initial px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs md:text-sm font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกสินค้าลงฐานข้อมูล'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-2 text-red-600 font-bold">
              <AlertTriangle className="w-5 h-5" />
              <h3>ยืนยันการลบสินค้า</h3>
            </div>
            <p className="text-xs text-slate-600">
              คุณแน่ใจหรือไม่ว่าต้องการลบสินค้า <span className="font-bold text-slate-900">"{deleteTarget.name}"</span>?
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA BARCODE SCANNER MODAL */}
      <CameraBarcodeScannerModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onScan={(code) => {
          const cleanCode = String(code).trim();
          if (cameraModalTarget === 'form') {
            setFormData((prev) => ({ ...prev, barcode: cleanCode }));
            showToast(`สแกนรหัสบาร์โค้ด "${cleanCode}" ใส่ช่อง Barcode สำเร็จ`, 'success');
          } else {
            handleScanToSearchOrAdd(cleanCode);
          }
        }}
        continuous={false}
        title={
          cameraModalTarget === 'form'
            ? 'สแกนบาร์โค้ดใส่ฟอร์มสินค้า (Add Product Scanner)'
            : 'กล้องสแกนค้นหาหรือเพิ่มสินค้าใหม่'
        }
        showDebugInfo={true}
        currentFormBarcode={formData.barcode}
        existingProducts={products}
        onOpenDiagnostics={() => {
          setIsCameraModalOpen(false);
          setIsDiagnosticModalOpen(true);
        }}
      />

      {/* BARCODE SCANNER DIAGNOSTIC & TESTING SUITE MODAL */}
      <BarcodeScannerDiagnosticModal
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        products={products}
      />

      {/* CATEGORY MANAGEMENT MODAL */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoryCreated={(newCat) => {
          setFormData((prev) => ({ ...prev, categoryId: newCat.id }));
          setSelectedCategory(newCat.id);
        }}
      />

      {/* RESET FILTERS & SEARCH MODAL */}
      <ResetConfirmModal
        isOpen={isResetFiltersModalOpen}
        onClose={() => setIsResetFiltersModalOpen(false)}
        onConfirm={handleResetFilters}
        title="ยืนยันการรีเซ็ตตัวกรอง"
        description="คุณต้องการล้างคำค้นหาและคืนค่าตัวกรองหมวดหมู่และสถานะสต็อกเป็นค่าเริ่มต้นใช่หรือไม่?"
        confirmLabel="ยืนยันรีเซ็ตตัวกรอง"
      />

      {/* RESET PRODUCT FORM MODAL */}
      <ResetConfirmModal
        isOpen={isResetFormModalOpen}
        onClose={() => setIsResetFormModalOpen(false)}
        onConfirm={handleResetForm}
        title="ยืนยันการรีเซ็ตฟอร์มสินค้า"
        description={
          editingProduct
            ? `คุณต้องการยกเลิกการแก้ไขและคืนค่าข้อมูลของสินค้า "${editingProduct.name}" กลับเป็นข้อมูลเดิมใช่หรือไม่? (ข้อมูลที่บันทึกไว้ในระบบจะไม่สูญหาย)`
            : 'คุณต้องการล้างข้อมูลที่กำลังกรอกในแบบฟอร์มเพื่อเริ่มต้นกรอกใหม่ใช่หรือไม่?'
        }
        confirmLabel="ยืนยันรีเซ็ตฟอร์ม"
      />
    </div>
  );
};
