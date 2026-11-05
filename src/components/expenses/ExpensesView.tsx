import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Calendar,
  DollarSign,
  PieChart,
  Tag,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Trash2,
} from 'lucide-react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useApp } from '../../context/AppContext';
import { Expense, ExpenseCategory } from '../../types/pos';
import { formatCurrency, formatDateOnly } from '../../utils/formatters';

const categoryLabels: Record<ExpenseCategory, string> = {
  rent: 'ค่าเช่าร้าน/อาคาร',
  electricity: 'ค่าไฟฟ้า',
  water: 'ค่าน้ำประปา',
  salary: 'เงินเดือนพนักงาน',
  transport: 'ค่าขนส่ง/น้ำมัน',
  supplies: 'อุปกรณ์และของใช้ในร้าน',
  maintenance: 'ค่าซ่อมบำรุง',
  other: 'ค่าใช้จ่ายอื่นๆ',
};

export const ExpensesView: React.FC = () => {
  const { expenses, currency, showToast, currentUser } = useApp();

  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [formData, setFormData] = useState<{
    category: ExpenseCategory;
    title: string;
    amount: number;
    date: string;
    time: string;
    paymentMethod: 'cash' | 'transfer';
    referenceId: string;
    note: string;
    receiptUrl: string;
  }>({
    category: 'electricity',
    title: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    time: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
    paymentMethod: 'transfer',
    referenceId: '',
    note: '',
    receiptUrl: '',
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchCat = selectedCategory === 'all' || e.category === selectedCategory;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        e.title.toLowerCase().includes(q) ||
        (e.note && e.note.toLowerCase().includes(q)) ||
        categoryLabels[e.category]?.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [expenses, selectedCategory, search]);

  const totalExpenseAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredExpenses]);

  // Breakdown by category
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      map[e.category] = (map[e.category] || 0) + (e.amount || 0);
    }
    return Object.entries(map).map(([cat, amt]) => ({
      category: cat as ExpenseCategory,
      label: categoryLabels[cat as ExpenseCategory] || cat,
      amount: amt,
      percent: totalExpenseAmount > 0 ? ((amt / totalExpenseAmount) * 100).toFixed(1) : '0',
    }));
  }, [expenses, totalExpenseAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || formData.amount <= 0) {
      showToast('กรุณาระบุชื่อรายการและจำนวนเงินที่ถูกต้อง', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date();
      const nowIso = now.toISOString();
      const timeVal = formData.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const ref = doc(collection(db, 'expenses'));
      await setDoc(ref, {
        category: formData.category,
        title: formData.title.trim(),
        amount: Number(formData.amount),
        date: formData.date,
        time: timeVal,
        paymentMethod: formData.paymentMethod,
        referenceId: formData.referenceId.trim(),
        note: formData.note.trim(),
        receiptUrl: formData.receiptUrl.trim(),
        recordedBy: currentUser?.displayName || 'พนักงาน',
        createdAt: nowIso,
      });

      showToast(`บันทึกรายจ่าย "${formData.title}" เรียบร้อยแล้ว`, 'success');
      setIsSubmitting(false);
      setIsModalOpen(false);
      setFormData({
        category: 'electricity',
        title: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        time: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
        paymentMethod: 'transfer',
        referenceId: '',
        note: '',
        receiptUrl: '',
      });
    } catch (err) {
      setIsSubmitting(false);
      handleFirestoreError(err, OperationType.WRITE, 'expenses');
    }
  };

  const handleDeleteExpense = async (id: string, title: string) => {
    if (!confirm(`คุณต้องการลบรายการรายจ่าย "${title}" หรือไม่?`)) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      showToast(`ลบรายการรายจ่ายสำเร็จ`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `expenses/${id}`);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">บันทึกรายจ่ายและต้นทุนร้าน (Expenses)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ค่าเช่า ค่าไฟ ค่าน้ำ เงินเดือนพนักงาน และค่าใช้จ่ายดำเนินงานทั่วไป
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          บันทึกรายจ่ายใหม่
        </button>
      </div>

      {/* KPI & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total Expense Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              รวมรายจ่ายทั้งหมดที่แสดง
            </span>
            <p className="text-3xl font-extrabold text-red-600 mt-2">
              {formatCurrency(totalExpenseAmount, currency)}
            </p>
            <p className="text-xs text-slate-400 mt-1">ทั้งหมด {filteredExpenses.length} รายการ</p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>จ่ายเงินสด:</span>
            <span className="font-bold">
              {formatCurrency(
                filteredExpenses
                  .filter((e) => e.paymentMethod === 'cash')
                  .reduce((sum, e) => sum + e.amount, 0),
                currency
              )}
            </span>
          </div>
        </div>

        {/* Categories Distribution */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="font-bold text-sm text-slate-800 mb-3">การกระจายตัวของรายจ่ายตามหมวดหมู่</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {categoryBreakdown.map((item) => (
              <div key={item.category} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[11px] text-slate-500 truncate">{item.label}</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">
                  {formatCurrency(item.amount, currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อรายการรายจ่าย หรือหมายเหตุ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
          />
        </div>

        <div className="w-full sm:w-64">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
          >
            <option value="all">ทุกหมวดหมู่รายจ่าย</option>
            {Object.entries(categoryLabels).map(([catKey, label]) => (
              <option key={catKey} value={catKey}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3 px-4">วันที่</th>
                <th className="py-3 px-4">หมวดหมู่</th>
                <th className="py-3 px-4">รายการรายจ่าย</th>
                <th className="py-3 px-4 text-right">จำนวนเงิน</th>
                <th className="py-3 px-4">วิธีชำระ</th>
                <th className="py-3 px-4">ผู้บันทึก</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">ไม่มีข้อมูลรายจ่าย</p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                      {formatDateOnly(exp.date)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {categoryLabels[exp.category] || exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{exp.title}</p>
                      {exp.note && <p className="text-[11px] text-slate-400">{exp.note}</p>}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-red-600">
                      -{formatCurrency(exp.amount, currency)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {exp.paymentMethod === 'cash' ? 'เงินสด' : 'โอนเงิน'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{exp.recordedBy || 'พนักงาน'}</td>
                    <td className="py-3 px-4 text-center">
                      {currentUser?.role === 'owner' && (
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.title)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* ADD EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-800">บันทึกรายจ่ายใหม่</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">หมวดหมู่รายจ่าย</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                >
                  {Object.entries(categoryLabels).map(([catKey, label]) => (
                    <option key={catKey} value={catKey}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อรายการ / รายละเอียดรายจ่าย <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ค่าไฟประจำเดือน, ค่าถุงพลาสติก 2 ลัง"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    จำนวนเงิน ({currency}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="any"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs md:text-sm font-bold bg-white border border-slate-300 rounded-xl focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">วันที่จ่าย</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">วิธีจ่ายเงิน</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentMethod: 'transfer' })}
                    className={`py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                      formData.paymentMethod === 'transfer'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    โอนเงิน
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentMethod: 'cash' })}
                    className={`py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                      formData.paymentMethod === 'cash'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    เงินสด
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">หมายเหตุ / อ้างอิงใบเสร็จ</label>
                <input
                  type="text"
                  placeholder="เช่น เลขที่บิล หรือรายละเอียดเพิ่มเติม"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
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
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรายจ่าย'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
