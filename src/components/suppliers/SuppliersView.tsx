import React, { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  Building,
  CreditCard,
  Package,
  X,
  Edit2,
  Trash2,
  CheckCircle,
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
import { Supplier, Product } from '../../types/pos';
import { formatCurrency, generatePoNumber } from '../../utils/formatters';

export const SuppliersView: React.FC = () => {
  const {
    suppliers,
    products,
    currency,
    receiveSupplierStock,
    showToast,
  } = useApp();

  const [search, setSearch] = useState<string>('');

  // Supplier Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    notes: '',
  });

  // Restock PO Modal
  const [isRestockModalOpen, setIsRestockModalOpen] = useState<boolean>(false);
  const [selectedSupplierForPO, setSelectedSupplierForPO] = useState<Supplier | null>(null);
  const [poLines, setPoLines] = useState<{ productId: string; qty: number; unitCost: number }[]>([]);
  const [poPaidAmount, setPoPaidAmount] = useState<number>(0);
  const [isSubmittingPO, setIsSubmittingPO] = useState<boolean>(false);

  // Pay Supplier Debt Modal
  const [payDebtSupplier, setPayDebtSupplier] = useState<Supplier | null>(null);
  const [payDebtAmount, setPayDebtAmount] = useState<number>(0);
  const [isSubmittingDebtPay, setIsSubmittingDebtPay] = useState<boolean>(false);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const q = search.toLowerCase().trim();
      return (
        !q ||
        s.companyName.toLowerCase().includes(q) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
      );
    });
  }, [suppliers, search]);

  const totalPayable = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (s.outstandingPayable || 0), 0);
  }, [suppliers]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      companyName: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      taxId: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData({
      companyName: s.companyName || '',
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      taxId: s.taxId || '',
      notes: s.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim()) {
      showToast('กรุณากรอกชื่อบริษัทผู้จำหน่าย', 'warning');
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const payload = {
        companyName: formData.companyName.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        taxId: formData.taxId.trim(),
        notes: formData.notes.trim(),
      };

      if (editingSupplier) {
        await updateDoc(doc(db, 'suppliers', editingSupplier.id), payload);
        showToast(`อัปเดตข้อมูลผู้จำหน่าย "${formData.companyName}" สำเร็จ`, 'success');
      } else {
        await setDoc(doc(collection(db, 'suppliers')), {
          ...payload,
          totalPurchased: 0,
          outstandingPayable: 0,
          createdAt: nowIso,
        });
        showToast(`เพิ่มผู้จำหน่าย "${formData.companyName}" สำเร็จ`, 'success');
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'suppliers');
    }
  };

  // Restock PO methods
  const handleOpenRestock = (s: Supplier) => {
    setSelectedSupplierForPO(s);
    setPoLines([
      {
        productId: products[0]?.id || '',
        qty: 10,
        unitCost: products[0]?.costPrice || 0,
      },
    ]);
    setPoPaidAmount(0);
    setIsRestockModalOpen(true);
  };

  const handleAddPoLine = () => {
    if (products.length === 0) return;
    setPoLines((prev) => [
      ...prev,
      {
        productId: products[0]?.id || '',
        qty: 10,
        unitCost: products[0]?.costPrice || 0,
      },
    ]);
  };

  const handleRemovePoLine = (index: number) => {
    setPoLines((prev) => prev.filter((_, i) => i !== index));
  };

  const poTotalAmount = useMemo(() => {
    return poLines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
  }, [poLines]);

  const handleConfirmRestockPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForPO || poLines.length === 0) return;

    try {
      setIsSubmittingPO(true);
      const poNum = generatePoNumber();
      await receiveSupplierStock(
        selectedSupplierForPO.id,
        poLines,
        poNum,
        poPaidAmount
      );
      setIsSubmittingPO(false);
      setIsRestockModalOpen(false);
    } catch (err) {
      setIsSubmittingPO(false);
      console.error(err);
    }
  };

  // Pay Supplier Debt
  const handleConfirmPaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payDebtSupplier || payDebtAmount <= 0) return;

    try {
      setIsSubmittingDebtPay(true);
      const nowIso = new Date().toISOString();
      const validAmount = Math.min(payDebtAmount, payDebtSupplier.outstandingPayable);

      const batch = writeBatch(db);
      const supRef = doc(db, 'suppliers', payDebtSupplier.id);
      batch.update(supRef, {
        outstandingPayable: Math.max(0, payDebtSupplier.outstandingPayable - validAmount),
      });

      const payRef = doc(collection(db, 'payments'));
      batch.set(payRef, {
        type: 'supplier_payable',
        amount: validAmount,
        method: 'transfer',
        partyType: 'supplier',
        partyId: payDebtSupplier.id,
        partyName: payDebtSupplier.companyName,
        notes: `จ่ายชำระหนี้ค่าสินค้าแก่ ${payDebtSupplier.companyName}`,
        createdAt: nowIso,
      });

      await batch.commit();
      showToast(`บันทึกจ่ายเงินให้ซัพพลายเออร์จำนวน ${validAmount.toLocaleString()} เรียบร้อยแล้ว`, 'success');
      setIsSubmittingDebtPay(false);
      setPayDebtSupplier(null);
    } catch (err) {
      setIsSubmittingDebtPay(false);
      handleFirestoreError(err, OperationType.WRITE, 'suppliers/pay_debt');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">จัดการผู้จำหน่ายและเจ้าหนี้ (Suppliers & Vendors)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกข้อมูลคู่ค้า สั่งซื้อสินค้าเข้าคลัง และบริหารยอดเงินที่ต้องชำระ (เจ้าหนี้การค้า)
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          เพิ่มผู้จำหน่ายใหม่
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            ผู้จำหน่าย / คู่ค้าทั้งหมด
          </span>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {suppliers.length} <span className="text-xs font-normal text-slate-400">บริษัท</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">คู่ค้าหลักในห่วงโซ่อุปทาน</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
            ยอดเงินที่ต้องชำระ (เจ้าหนี้การค้ารวม)
          </span>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {formatCurrency(totalPayable, currency)}
          </p>
          <p className="text-xs text-slate-400 mt-1">ยอดค้างจ่ายที่ต้องเคลียร์ให้ซัพพลายเออร์</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
            ยอดสั่งซื้อสินค้ารวมสะสม
          </span>
          <p className="text-2xl font-bold text-blue-700 mt-2">
            {formatCurrency(
              suppliers.reduce((sum, s) => sum + (s.totalPurchased || 0), 0),
              currency
            )}
          </p>
          <p className="text-xs text-slate-400 mt-1">ยอดซื้อสินค้าเข้าคลังทั้งหมด</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อบริษัท, ผู้ติดต่อ หรือเบอร์โทร..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3 px-4">ชื่อบริษัทผู้จำหน่าย</th>
                <th className="py-3 px-4">ผู้ติดต่อ</th>
                <th className="py-3 px-4">เบอร์โทรศัพท์</th>
                <th className="py-3 px-4 text-right">ยอดซื้อสะสม</th>
                <th className="py-3 px-4 text-right">ยอดค้างชำระ (เจ้าหนี้)</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Truck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">ไม่พบรายชื่อผู้จำหน่าย</p>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => {
                  const hasPayable = (s.outstandingPayable || 0) > 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800">{s.companyName}</p>
                        {s.address && <p className="text-[11px] text-slate-400 line-clamp-1">{s.address}</p>}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">{s.contactPerson || '-'}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs">{s.phone || '-'}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(s.totalPurchased, currency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasPayable ? (
                          <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            {formatCurrency(s.outstandingPayable, currency)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">ไม่มีหนี้ค้าง</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => handleOpenRestock(s)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                        >
                          + สั่งซื้อสินค้า (PO)
                        </button>
                        {hasPayable && (
                          <button
                            onClick={() => {
                              setPayDebtSupplier(s);
                              setPayDebtAmount(s.outstandingPayable || 0);
                            }}
                            className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold"
                          >
                            จ่ายชำระ
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-4 h-4" />
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

      {/* ADD/EDIT SUPPLIER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-800">
                {editingSupplier ? 'แก้ไขข้อมูลผู้จำหน่าย' : 'เพิ่มผู้จำหน่ายใหม่'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อบริษัทผู้จำหน่าย <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น บริษัท ไทยเบฟเวอเรจ หรือ ห้างหุ้นส่วนสมบูรณ์"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ผู้ติดต่อ / เซลล์</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมลติดต่อ</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">เลขประจำตัวผู้เสียภาษี</label>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ที่อยู่คลังสินค้า / สำนักงาน</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESTOCK PURCHASE ORDER MODAL */}
      {isRestockModalOpen && selectedSupplierForPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden p-5 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  สั่งซื้อและรับสินค้าเข้าสต็อก (PO Restock)
                </h3>
                <p className="text-xs text-slate-500">
                  ซัพพลายเออร์: <span className="font-semibold text-blue-700">{selectedSupplierForPO.companyName}</span>
                </p>
              </div>
              <button onClick={() => setIsRestockModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRestockPO} className="space-y-4">
              {/* Product Lines */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {poLines.map((line, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2">
                    <div className="flex-1">
                      <select
                        value={line.productId}
                        onChange={(e) => {
                          const prod = products.find((p) => p.id === e.target.value);
                          const updated = [...poLines];
                          updated[idx].productId = e.target.value;
                          if (prod) updated[idx].unitCost = prod.costPrice;
                          setPoLines(updated);
                        }}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-20">
                      <input
                        type="number"
                        min={1}
                        placeholder="จำนวน"
                        value={line.qty}
                        onChange={(e) => {
                          const updated = [...poLines];
                          updated[idx].qty = parseInt(e.target.value) || 1;
                          setPoLines(updated);
                        }}
                        className="w-full px-2 py-1.5 text-xs text-center font-bold bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        step="any"
                        min={0}
                        placeholder="ราคาทุน/หน่วย"
                        value={line.unitCost}
                        onChange={(e) => {
                          const updated = [...poLines];
                          updated[idx].unitCost = parseFloat(e.target.value) || 0;
                          setPoLines(updated);
                        }}
                        className="w-full px-2 py-1.5 text-xs text-right font-medium bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div className="w-24 text-right font-bold text-xs text-slate-800">
                      {formatCurrency(line.qty * line.unitCost, currency)}
                    </div>

                    {poLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePoLine(idx)}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddPoLine}
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                + เพิ่มรายการสินค้าที่สั่งซื้อ
              </button>

              {/* Totals & Payment */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center text-sm font-bold text-blue-900">
                  <span>ยอดสั่งซื้อรวมทั้งหมด:</span>
                  <span className="text-base">{formatCurrency(poTotalAmount, currency)}</span>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2 border-t border-blue-200/80">
                  <span className="font-semibold text-slate-700">จำนวนเงินที่จ่ายสด/โอนให้ผู้จำหน่ายทันที:</span>
                  <input
                    type="number"
                    min={0}
                    max={poTotalAmount}
                    value={poPaidAmount}
                    onChange={(e) => setPoPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-36 px-2 py-1 text-right font-bold bg-white border border-blue-300 rounded-lg"
                  />
                </div>

                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>ยอดค้างชำระ (เพิ่มเข้าเจ้าหนี้การค้า):</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(Math.max(0, poTotalAmount - poPaidAmount), currency)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPO}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  {isSubmittingPO ? 'กำลังบันทึกและเพิ่มสต็อก...' : 'ยืนยันสั่งซื้อและเพิ่มเข้าสต็อก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAY SUPPLIER DEBT MODAL */}
      {payDebtSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-800">จ่ายชำระเงินเจ้าหนี้</h3>
              <button onClick={() => setPayDebtSupplier(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-900 space-y-1">
              <p>ผู้จำหน่าย: <span className="font-bold">{payDebtSupplier.companyName}</span></p>
              <p>
                ยอดหนี้คงค้างที่ต้องชำระ: <span className="font-bold text-sm">{formatCurrency(payDebtSupplier.outstandingPayable, currency)}</span>
              </p>
            </div>

            <form onSubmit={handleConfirmPaySupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำนวนเงินที่จ่ายชำระ ({currency})
                </label>
                <input
                  type="number"
                  min={1}
                  max={payDebtSupplier.outstandingPayable}
                  required
                  value={payDebtAmount}
                  onChange={(e) => setPayDebtAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-lg font-bold bg-white border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayDebtSupplier(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDebtPay}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  {isSubmittingDebtPay ? 'กำลังบันทึก...' : 'ยืนยันการจ่ายเงิน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
