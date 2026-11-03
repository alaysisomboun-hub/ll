import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  CreditCard,
  History,
  CheckCircle,
  X,
  Edit2,
  Trash2,
  Banknote,
  QrCode,
  AlertCircle,
} from 'lucide-react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types/pos';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export const CustomersView: React.FC = () => {
  const {
    customers,
    sales,
    currency,
    recordCustomerDebtPayment,
    showToast,
    currentUser,
  } = useApp();

  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'wholesale' | 'retail' | 'debt'>('all');

  // Customer Modal (Add/Edit)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    type: 'wholesale' as 'wholesale' | 'retail',
    address: '',
    creditLimit: 0,
    notes: '',
  });

  // Debt Payment Modal
  const [debtPaymentCustomer, setDebtPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Detail Drawer
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<Customer | null>(null);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q));

      let matchType = true;
      if (typeFilter === 'wholesale') matchType = c.type === 'wholesale';
      if (typeFilter === 'retail') matchType = c.type === 'retail';
      if (typeFilter === 'debt') matchType = (c.outstandingDebt || 0) > 0;

      return matchSearch && matchType;
    });
  }, [customers, search, typeFilter]);

  const totalOutstanding = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.outstandingDebt || 0), 0);
  }, [customers]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      type: 'wholesale',
      address: '',
      creditLimit: 20000,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name || '',
      phone: c.phone || '',
      type: c.type || 'wholesale',
      address: c.address || '',
      creditLimit: c.creditLimit || 0,
      notes: c.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('กรุณากรอกชื่อลูกค้า', 'warning');
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        type: formData.type,
        address: formData.address.trim(),
        creditLimit: Number(formData.creditLimit) || 0,
        notes: formData.notes.trim(),
        updatedAt: nowIso,
      };

      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), payload);
        showToast(`อัปเดตข้อมูลลูกค้า "${formData.name}" สำเร็จ`, 'success');
      } else {
        await setDoc(doc(collection(db, 'customers')), {
          ...payload,
          totalSpent: 0,
          orderCount: 0,
          outstandingDebt: 0,
          createdAt: nowIso,
        });
        showToast(`เพิ่มลูกค้า "${formData.name}" สำเร็จ`, 'success');
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'customers');
    }
  };

  const handleOpenPayDebt = (c: Customer) => {
    setDebtPaymentCustomer(c);
    setPaymentAmount(c.outstandingDebt || 0);
    setPaymentMethod('cash');
    setPaymentNotes('รับชำระหนี้ค้าง');
  };

  const handleConfirmDebtPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtPaymentCustomer || paymentAmount <= 0) return;

    try {
      setIsSubmittingPayment(true);
      await recordCustomerDebtPayment(
        debtPaymentCustomer.id,
        paymentAmount,
        paymentMethod,
        paymentNotes
      );
      setIsSubmittingPayment(false);
      setDebtPaymentCustomer(null);
    } catch (err) {
      setIsSubmittingPayment(false);
      console.error(err);
    }
  };

  // Bills for selected customer
  const customerBills = useMemo(() => {
    if (!selectedCustomerDetail) return [];
    return sales.filter((s) => s.customerId === selectedCustomerDetail.id);
  }, [sales, selectedCustomerDetail]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">จัดการข้อมูลลูกค้าและลูกหนี้ (Customers & Debts)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกประวัติการซื้อ ยอดสะสม วงเงินเครดิต และการชำระหนี้ค้าง
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          เพิ่มลูกค้าใหม่
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            จำนวนลูกค้าทั้งหมด
          </span>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {customers.length} <span className="text-xs font-normal text-slate-400">ราย</span>
          </p>
          <div className="flex gap-3 text-xs text-slate-500 mt-1">
            <span>ขายส่ง: {customers.filter((c) => c.type === 'wholesale').length}</span>
            <span>ขายปลีก: {customers.filter((c) => c.type === 'retail').length}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
            ยอดหนี้ค้างชำระรวม (ลูกหนี้การค้า)
          </span>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {formatCurrency(totalOutstanding, currency)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {customers.filter((c) => (c.outstandingDebt || 0) > 0).length} รายที่มีหนี้คงค้าง
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            ยอดซื้อสะสมจากลูกค้า
          </span>
          <p className="text-2xl font-bold text-emerald-700 mt-2">
            {formatCurrency(
              customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0),
              currency
            )}
          </p>
          <p className="text-xs text-slate-400 mt-1">ยอดซื้อของลูกค้ารวมทุกบิล</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทรศัพท์, หรือที่อยู่..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'wholesale', 'retail', 'debt'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                typeFilter === f
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'all'
                ? 'ลูกค้าทั้งหมด'
                : f === 'wholesale'
                ? 'ลูกค้าขายส่ง'
                : f === 'retail'
                ? 'ลูกค้าขายปลีก'
                : 'เฉพาะผู้มีหนี้ค้าง'}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3 px-4">ชื่อลูกค้า</th>
                <th className="py-3 px-4">ประเภท</th>
                <th className="py-3 px-4">เบอร์โทรศัพท์</th>
                <th className="py-3 px-4 text-right">ยอดซื้อสะสม</th>
                <th className="py-3 px-4 text-center">จำนวนบิล</th>
                <th className="py-3 px-4 text-right">ยอดหนี้ค้างชำระ</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">ไม่พบรายชื่อลูกค้า</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const hasDebt = (c.outstandingDebt || 0) > 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setSelectedCustomerDetail(c)}
                          className="font-bold text-slate-800 hover:text-blue-600 text-left transition"
                        >
                          {c.name}
                        </button>
                        {c.address && (
                          <p className="text-[11px] text-slate-400 line-clamp-1">{c.address}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            c.type === 'wholesale'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {c.type === 'wholesale' ? 'ขายส่ง' : 'ขายปลีก'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs">{c.phone || '-'}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(c.totalSpent, currency)}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 font-mono">
                        {c.orderCount || 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasDebt ? (
                          <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            {formatCurrency(c.outstandingDebt, currency)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">ไม่มีหนี้</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap space-x-1.5">
                        {hasDebt && (
                          <button
                            onClick={() => handleOpenPayDebt(c)}
                            className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs transition"
                          >
                            รับชำระหนี้
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedCustomerDetail(c)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                        >
                          ประวัติ
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
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

      {/* ADD/EDIT CUSTOMER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-800">
                {editingCustomer ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อ-นามสกุล / ชื่อร้านค้า <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ร้านสมบูรณ์การค้า หรือ คุณสมศักดิ์"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="081-xxx-xxxx"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ประเภทลูกค้า</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'wholesale' })}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      formData.type === 'wholesale'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    📦 ขายส่ง (Wholesale)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'retail' })}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      formData.type === 'retail'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🛒 ขายปลีก (Retail)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วงเงินเครดิตสูงสุด (Credit Limit)
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ที่อยู่จัดส่ง / ที่ตั้ง</label>
                <textarea
                  rows={2}
                  placeholder="ที่อยู่ร้านค้า หรือบ้านเลขที่"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">หมายเหตุ</label>
                <input
                  type="text"
                  placeholder="เช่น กำหนดชำระทุกสิ้นเดือน"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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

      {/* DEBT REPAYMENT MODAL */}
      {debtPaymentCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-amber-700 font-bold">
                <CreditCard className="w-5 h-5" />
                <h3 className="text-sm">รับชำระหนี้ค้างจากลูกค้า</h3>
              </div>
              <button onClick={() => setDebtPaymentCustomer(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p>
                ลูกค้า: <span className="font-bold">{debtPaymentCustomer.name}</span>
              </p>
              <p>
                ยอดหนี้คงค้างปัจจุบัน:{' '}
                <span className="font-bold text-red-600 text-sm">
                  {formatCurrency(debtPaymentCustomer.outstandingDebt, currency)}
                </span>
              </p>
            </div>

            <form onSubmit={handleConfirmDebtPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำนวนเงินที่รับชำระ ({currency})
                </label>
                <input
                  type="number"
                  min={1}
                  max={debtPaymentCustomer.outstandingDebt}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-lg font-bold bg-white border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">วิธีรับชำระ</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                      paymentMethod === 'cash'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    เงินสด
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                      paymentMethod === 'transfer'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    โอนเงิน / สแกน
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">หมายเหตุการชำระ</label>
                <input
                  type="text"
                  placeholder="เช่น ชำระบิลค้างงวดสัปดาห์ที่แล้ว"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDebtPaymentCustomer(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  {isSubmittingPayment ? 'กำลังบันทึก...' : 'ยืนยันรับชำระหนี้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER DETAIL & HISTORY DRAWER */}
      {selectedCustomerDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col p-5 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-slate-800">{selectedCustomerDetail.name}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedCustomerDetail.type === 'wholesale'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {selectedCustomerDetail.type === 'wholesale' ? 'ลูกค้าขายส่ง' : 'ลูกค้าขายปลีก'}
                </span>
              </div>
              <button
                onClick={() => setSelectedCustomerDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-500">ยอดซื้อสะสม</span>
                <p className="text-base font-bold text-slate-800">
                  {formatCurrency(selectedCustomerDetail.totalSpent, currency)}
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-[10px] text-amber-700 font-semibold">ยอดหนี้ค้างชำระ</span>
                <p className="text-base font-bold text-amber-700">
                  {formatCurrency(selectedCustomerDetail.outstandingDebt, currency)}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5 pb-3 border-b border-slate-200">
              <p>
                <span className="font-semibold text-slate-700">เบอร์โทร:</span> {selectedCustomerDetail.phone}
              </p>
              <p>
                <span className="font-semibold text-slate-700">ที่อยู่:</span> {selectedCustomerDetail.address || '-'}
              </p>
              <p>
                <span className="font-semibold text-slate-700">วงเงินเครดิต:</span>{' '}
                {formatCurrency(selectedCustomerDetail.creditLimit || 0, currency)}
              </p>
            </div>

            {/* Purchase History */}
            <div className="mt-4 flex-1">
              <h4 className="font-bold text-xs text-slate-700 mb-2">ประวัติการซื้อ ({customerBills.length} บิล)</h4>
              <div className="space-y-2">
                {customerBills.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">ยังไม่มีประวัติการซื้อบิล</p>
                ) : (
                  customerBills.map((b) => (
                    <div key={b.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-blue-700 font-mono">#{b.invoiceNumber}</span>
                        <span>{formatCurrency(b.totalAmount, currency)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>{formatDateTime(b.createdAt)}</span>
                        <span>ชำระด้วย: {b.paymentMethod}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
