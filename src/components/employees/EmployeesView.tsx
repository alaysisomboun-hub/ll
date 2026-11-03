import React, { useState } from 'react';
import {
  UserCog,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Edit2,
  Trash2,
  Check,
  X,
  UserCheck,
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
import { UserProfile, UserRole } from '../../types/pos';

export const EmployeesView: React.FC = () => {
  const { users, currentUser, switchUserRole, showToast } = useApp();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState<{
    displayName: string;
    email: string;
    role: UserRole;
    phone: string;
    status: 'active' | 'suspended';
  }>({
    displayName: '',
    email: '',
    role: 'cashier',
    phone: '',
    status: 'active',
  });

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      displayName: '',
      email: '',
      role: 'cashier',
      phone: '',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: UserProfile) => {
    setEditingUser(u);
    setFormData({
      displayName: u.displayName,
      email: u.email,
      role: u.role,
      phone: u.phone || '',
      status: u.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName.trim() || !formData.email.trim()) {
      showToast('กรุณากรอกชื่อและอีเมลพนักงาน', 'warning');
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.id), {
          ...formData,
          updatedAt: nowIso,
        });
        showToast(`อัปเดตข้อมูลพนักงาน "${formData.displayName}" สำเร็จ`, 'success');
      } else {
        const ref = doc(collection(db, 'users'));
        await setDoc(ref, {
          ...formData,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        showToast(`เพิ่มพนักงาน "${formData.displayName}" สำเร็จ`, 'success');
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">จัดการพนักงานและสิทธิ์การใช้งาน (Employees & Roles)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            กำหนดระดับสิทธิ์: เจ้าของร้าน (Owner), ผู้จัดการ (Manager), และพนักงานขาย (Cashier)
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          เพิ่มพนักงานใหม่
        </button>
      </div>

      {/* Quick Role Simulation Switcher */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-blue-300 font-semibold uppercase tracking-wider">
              สลับบทบาทสำหรับทดสอบระบบ (Active Role Switcher)
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold">{currentUser.displayName}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 text-white">
                {currentUser.role}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {(['owner', 'manager', 'cashier'] as const).map((r) => (
              <button
                key={r}
                onClick={() => switchUserRole(r)}
                className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition flex items-center gap-1.5 ${
                  currentUser.role === r
                    ? 'bg-white text-blue-950 shadow-md scale-105'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {r === 'owner' && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                {r === 'manager' && <Shield className="w-4 h-4 text-blue-300" />}
                {r === 'cashier' && <UserCheck className="w-4 h-4 text-amber-300" />}
                <span>{r === 'owner' ? 'เจ้าของร้าน' : r === 'manager' ? 'ผู้จัดการ' : 'แคชเชียร์'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-800">รายชื่อบัญชีผู้ใช้งาน ({users.length} บัญชี)</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                <th className="py-3 px-4">อีเมล</th>
                <th className="py-3 px-4">เบอร์โทร</th>
                <th className="py-3 px-4">ระดับสิทธิ์ (Role)</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-bold text-slate-800">{u.displayName}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-xs">{u.email}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-xs">{u.phone || '-'}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        u.role === 'owner'
                          ? 'bg-purple-100 text-purple-800'
                          : u.role === 'manager'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {u.role === 'owner' ? 'เจ้าของร้าน (Owner)' : u.role === 'manager' ? 'ผู้จัดการ (Manager)' : 'พนักงานขาย (Cashier)'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        u.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {u.status === 'active' ? 'ใช้งานปกติ' : 'ระงับใช้งาน'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center space-x-1.5">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="font-bold text-base text-slate-800 mb-3">ตารางสิทธิ์การเข้าถึงข้อมูลตามบทบาท (Permissions Matrix)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-2.5 px-3">ฟังก์ชันการทำงาน</th>
                <th className="py-2.5 px-3 text-center">เจ้าของร้าน (Owner)</th>
                <th className="py-2.5 px-3 text-center">ผู้จัดการ (Manager)</th>
                <th className="py-2.5 px-3 text-center">พนักงานขาย (Cashier)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-2 px-3 font-medium">ขายสินค้าหน้าร้าน (POS) & พิมพ์ใบเสร็จ</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">ดูประวัติบิล และค้นหาข้อมูลลูกค้า</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">ยกเลิกบิลขายและคืนสต็อก (Void/Refund)</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">แก้ไขราคาปลีก-ส่ง และเพิ่มสินค้าใหม่</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">ดูราคาทุนและผลกำไรของร้าน</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">สั่งซื้อสินค้าและปรับปรุงยอดคลัง (Inventory Audit)</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">ตั้งค่าร้านค้า สกุลเงิน ภาษา และใบเสร็จ</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD/EDIT EMPLOYEE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-800">
                {editingUser ? 'แก้ไขบัญชีพนักงาน' : 'เพิ่มบัญชีพนักงานใหม่'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อ-นามสกุล <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมชาย มีสุข (แคชเชียร์ 1)"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  อีเมล <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="staff@store.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ระดับสิทธิ์</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                >
                  <option value="cashier">พนักงานขาย / แคชเชียร์ (Cashier)</option>
                  <option value="manager">ผู้จัดการร้าน (Manager)</option>
                  <option value="owner">เจ้าของร้าน (Owner / Admin)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="text"
                  placeholder="08x-xxx-xxxx"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
    </div>
  );
};
