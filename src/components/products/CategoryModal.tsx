import React, { useState, useMemo, useEffect } from 'react';
import {
  FolderPlus,
  Folder,
  Edit2,
  Trash2,
  X,
  Check,
  Search,
  AlertCircle,
  Package,
  Layers,
  Sparkles,
  Info,
  RotateCcw,
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
import { Category } from '../../types/pos';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated?: (newCategory: Category) => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onCategoryCreated,
}) => {
  const { categories, products, showToast } = useApp();

  // Form state
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Search filter inside modal
  const [searchCategory, setSearchCategory] = useState<string>('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Reset form when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setEditingCategory(null);
      setErrorMessage('');
      setSearchCategory('');
      setDeleteTarget(null);
    }
  }, [isOpen]);

  // Product counts per category
  const productCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      if (p.categoryId) {
        counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
      }
    }
    return counts;
  }, [products]);

  // Filtered categories in list
  const filteredCategories = useMemo(() => {
    const q = searchCategory.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, searchCategory]);

  if (!isOpen) return null;

  // Handle edit selection
  const handleSelectEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setErrorMessage('');
  };

  // Reset edit form to add mode
  const handleResetForm = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setErrorMessage('');
  };

  // Submit Add or Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setErrorMessage('กรุณาระบุชื่อหมวดหมู่');
      return;
    }

    // Duplicate Check (Case-insensitive & trimmed)
    const isDuplicate = categories.some((c) => {
      const isSameName = c.name.trim().toLowerCase() === cleanName.toLowerCase();
      if (editingCategory) {
        return isSameName && c.id !== editingCategory.id;
      }
      return isSameName;
    });

    if (isDuplicate) {
      const msg = `มีหมวดหมู่ชื่อ "${cleanName}" อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`;
      setErrorMessage(msg);
      showToast(msg, 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      const nowIso = new Date().toISOString();

      if (editingCategory) {
        // Update existing category
        const catRef = doc(db, 'categories', editingCategory.id);
        await updateDoc(catRef, {
          name: cleanName,
          description: description.trim(),
          updatedAt: nowIso,
        });

        // If category name changed, synchronously update all products in this category so categoryName stays in sync
        if (editingCategory.name !== cleanName) {
          const matchedProducts = products.filter((p) => p.categoryId === editingCategory.id);
          if (matchedProducts.length > 0) {
            const batch = writeBatch(db);
            matchedProducts.forEach((p) => {
              const prodRef = doc(db, 'products', p.id);
              batch.update(prodRef, { categoryName: cleanName, updatedAt: nowIso });
            });
            await batch.commit();
          }
        }

        showToast(`แก้ไขหมวดหมู่ "${cleanName}" เรียบร้อยแล้ว`, 'success');
        handleResetForm();
      } else {
        // Create new category
        const newRef = doc(collection(db, 'categories'));
        const newCategory: Category = {
          id: newRef.id,
          name: cleanName,
          description: description.trim(),
          itemCount: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        await setDoc(newRef, newCategory);
        showToast(`เพิ่มหมวดหมู่ "${cleanName}" สำเร็จแล้ว`, 'success');

        if (onCategoryCreated) {
          onCategoryCreated(newCategory);
        }

        handleResetForm();
      }
    } catch (err) {
      handleFirestoreError(
        err,
        editingCategory ? OperationType.UPDATE : OperationType.CREATE,
        'categories'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      const catId = deleteTarget.id;
      const catName = deleteTarget.name;

      // Check if products belong to this category
      const affectedProducts = products.filter((p) => p.categoryId === catId);
      if (affectedProducts.length > 0) {
        // Re-assign affected products to 'ทั่วไป' (general)
        const batch = writeBatch(db);
        const nowIso = new Date().toISOString();
        affectedProducts.forEach((p) => {
          const prodRef = doc(db, 'products', p.id);
          batch.update(prodRef, {
            categoryId: '',
            categoryName: 'สินค้าทั่วไป',
            updatedAt: nowIso,
          });
        });
        await batch.commit();
      }

      await deleteDoc(doc(db, 'categories', catId));
      showToast(`ลบหมวดหมู่ "${catName}" สำเร็จ`, 'info');

      // If we were editing this category, reset the form
      if (editingCategory?.id === catId) {
        handleResetForm();
      }
      setDeleteTarget(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `categories/${deleteTarget.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">
                จัดการหมวดหมู่สินค้า (Product Categories)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เพิ่ม แก้ไข ลบ และจัดกลุ่มสินค้าให้ค้นหาและขายง่าย
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {/* Add / Edit Form Card */}
          <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/90 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <h4 className="font-semibold text-xs sm:text-sm text-slate-800">
                  {editingCategory ? (
                    <span>
                      กำลังแก้ไข: <strong className="text-blue-700">{editingCategory.name}</strong>
                    </span>
                  ) : (
                    'เพิ่มหมวดหมู่สินค้าใหม่ (Add Category)'
                  )}
                </h4>
              </div>
              {editingCategory && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer"
                >
                  ยกเลิกการแก้ไข / เพิ่มใหม่
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Category Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อหมวดหมู่ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น เครื่องดื่ม, อาหารแห้ง, ขนมขบเคี้ยว, ของใช้ทั่วไป..."
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className={`w-full px-3.5 py-2 text-xs md:text-sm bg-white border rounded-xl focus:outline-hidden transition ${
                    errorMessage
                      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                  }`}
                />
                {errorMessage && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รายละเอียดหมวดหมู่ <span className="text-slate-400 font-normal">(ไม่บังคับ)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="คำอธิบายสั้นๆ หรือสินค้าตัวอย่างในหมวดหมู่นี้..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none transition"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1">
                {(name || description || editingCategory) ? (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-amber-800 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded-xl transition cursor-pointer"
                    title="ล้างข้อมูลในฟอร์ม"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
                    <span>รีเซ็ตฟอร์ม</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim()}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>{editingCategory ? 'อัปเดตหมวดหมู่' : 'บันทึกหมวดหมู่'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Existing Categories List */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-slate-500" />
                <h4 className="font-semibold text-xs sm:text-sm text-slate-800">
                  รายการหมวดหมู่ทั้งหมด ({categories.length} หมวดหมู่)
                </h4>
              </div>

              {/* Search Category */}
              {categories.length > 3 && (
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาหมวดหมู่..."
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
              )}
            </div>

            {/* List Table / Cards */}
            {filteredCategories.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Folder className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">
                  {searchCategory ? 'ไม่พบหมวดหมู่ที่ตรงกับการค้นหา' : 'ยังไม่มีหมวดหมู่สินค้าในระบบ'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  กรอกชื่อหมวดหมู่ด้านบนแล้วกด "บันทึก" เพื่อเริ่มต้น
                </p>
              </div>
            ) : (
              <div className="border border-slate-200/90 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {filteredCategories.map((cat) => {
                  const pCount = productCountMap[cat.id] || 0;
                  const isCurrentEditing = editingCategory?.id === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 transition ${
                        isCurrentEditing ? 'bg-blue-50/60' : 'hover:bg-slate-50/80 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            isCurrentEditing
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <Folder className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs sm:text-sm text-slate-800 truncate">
                              {cat.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 tabular-nums shrink-0">
                              {pCount} รายการสินค้า
                            </span>
                          </div>
                          {cat.description && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {cat.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelectEdit(cat)}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            isCurrentEditing
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'
                          }`}
                          title="แก้ไขหมวดหมู่นี้"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cat)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="ลบหมวดหมู่นี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>หมวดหมู่จะซิงค์แบบเรียลไทม์กับหน้า POS และจุดขายทันที</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Delete Confirmation Popup */}
      {deleteTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-bold text-base text-slate-900">ยืนยันการลบหมวดหมู่</h4>
              <p className="text-xs text-slate-600">
                คุณต้องการลบหมวดหมู่{' '}
                <strong className="text-red-600">"{deleteTarget.name}"</strong> ออกจากระบบใช่หรือไม่?
              </p>
              {productCountMap[deleteTarget.id] > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 text-left mt-2 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    มีสินค้าจำนวน <strong>{productCountMap[deleteTarget.id]} รายการ</strong>{' '}
                    อยู่ในหมวดหมู่นี้ สินค้าเหล่านี้จะถูกเปลี่ยนเป็น "สินค้าทั่วไป"
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'ยืนยันการลบ'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
