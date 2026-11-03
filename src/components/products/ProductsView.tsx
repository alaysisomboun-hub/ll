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

export const ProductsView: React.FC = () => {
  const { products, categories, currency, showToast, currentUser, canViewCosts, t } = useApp();

  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
      barcode: generateBarcode(),
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

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('กรุณากรอกชื่อสินค้า', 'warning');
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
            กำหนดราคาปลีก-ส่ง, บาร์โค้ด, จุดสั่งซื้อ และสต็อกคงเหลือ
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มสินค้าใหม่</span>
        </button>
      </div>

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
              className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
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
              className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
            >
              <option value="all">สถานะสต็อกทั้งหมด</option>
              <option value="in_stock">พร้อมขาย (สต็อกปกติ)</option>
              <option value="low_stock">ใกล้หมด (Low Stock)</option>
              <option value="out_of_stock">หมดสต็อก (Out of Stock)</option>
            </select>
          </div>
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
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, barcode: generateBarcode() })}
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> สุ่มบาร์โค้ด
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl font-mono focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หมวดหมู่สินค้า
                  </label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หน่วยนับสินค้า
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ชิ้น, ลัง, แพ็ค, ถุง, กก."
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                  />
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
              <div className="p-4 bg-slate-50 -mx-5 -mb-5 border-t border-slate-200 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs md:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs md:text-sm font-bold shadow-md transition disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกสินค้าลงฐานข้อมูล'}
                </button>
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
    </div>
  );
};
