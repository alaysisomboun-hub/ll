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
  KeyRound,
  Lock,
  Mail,
  Phone,
  Clock,
  AlertCircle,
  Copy,
  CheckCheck,
  Power,
  RotateCw,
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
import { formatDate } from '../../utils/formatters';

export const EmployeesView: React.FC = () => {
  const {
    users,
    currentUser,
    switchUserRole,
    showToast,
    resetPassword,
    settings,
    updateSettings,
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);
  const [resettingUser, setResettingUser] = useState<UserProfile | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [editingInviteCode, setEditingInviteCode] = useState<boolean>(false);
  const [newInviteCode, setNewInviteCode] = useState<string>(settings.staffInviteCode || 'POS2026');

  const [formData, setFormData] = useState<{
    displayName: string;
    email: string;
    role: UserRole;
    phone: string;
    status: 'active' | 'suspended';
  }>({
    displayName: '',
    email: '',
    role: 'staff',
    phone: '',
    status: 'active',
  });

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      displayName: '',
      email: '',
      role: 'staff',
      phone: '',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: UserProfile) => {
    // Security check: Admin cannot change owner's role
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

    // Security check: If current user is Admin, they cannot promote anyone to Owner or alter Owner's role
    if (currentUser?.role === 'admin') {
      if (editingUser?.role === 'owner' && formData.role !== 'owner') {
        showToast('ผู้ดูแลระบบ (Admin) ไม่สามารถเปลี่ยนสิทธิ์ของเจ้าของร้านได้', 'error');
        return;
      }
      if (formData.role === 'owner' && editingUser?.role !== 'owner') {
        showToast('ผู้ดูแลระบบ (Admin) ไม่สามารถแต่งตั้งเจ้าของร้านคนใหม่ได้', 'error');
        return;
      }
    }

    try {
      const nowIso = new Date().toISOString();
      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.id), {
          displayName: formData.displayName.trim(),
          email: formData.email.trim().toLowerCase(),
          role: formData.role,
          phone: formData.phone.trim(),
          status: formData.status,
          updatedAt: nowIso,
        });
        showToast(`อัปเดตข้อมูลพนักงาน "${formData.displayName}" สำเร็จ`, 'success');
      } else {
        const ref = doc(collection(db, 'users'));
        await setDoc(ref, {
          displayName: formData.displayName.trim(),
          email: formData.email.trim().toLowerCase(),
          role: formData.role,
          phone: formData.phone.trim(),
          status: formData.status,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        showToast(`เพิ่มพนักงาน "${formData.displayName}" ในระบบสำเร็จ`, 'success');
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    }
  };

  // Toggle user status (Active vs Suspended)
  const handleToggleStatus = async (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      showToast('ไม่สามารถระงับบัญชีของตนเองที่กำลังใช้งานอยู่ได้', 'warning');
      return;
    }
    if (currentUser?.role === 'admin' && user.role === 'owner') {
      showToast('ผู้ดูแลระบบ (Admin) ไม่สามารถระงับบัญชีของเจ้าของร้านได้', 'error');
      return;
    }

    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'users', user.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
      showToast(
        nextStatus === 'active'
          ? `เปิดใช้งานบัญชี "${user.displayName}" เรียบร้อย`
          : `ระงับการใช้งานบัญชี "${user.displayName}" เรียบร้อย`,
        nextStatus === 'active' ? 'success' : 'warning'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
    }
  };

  // Send password reset
  const handleTriggerPasswordReset = async (user: UserProfile) => {
    try {
      await resetPassword(user.email);
      showToast(`ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง ${user.email} สำเร็จ`, 'success');
      setResettingUser(null);
    } catch (err) {
      showToast('ไม่สามารถส่งคำขอรีเซ็ตรหัสผ่านได้ โปรดตรวจสอบอีเมล', 'error');
    }
  };

  // Delete user
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmUser) return;

    if (deleteConfirmUser.id === currentUser?.id) {
      showToast('ไม่สามารถลบบัญชีของตนเองที่กำลังล็อกอินอยู่ได้', 'error');
      setDeleteConfirmUser(null);
      return;
    }

    if (currentUser?.role === 'admin' && deleteConfirmUser.role === 'owner') {
      showToast('ผู้ดูแลระบบ (Admin) ไม่สามารถลบบัญชีของเจ้าของร้านได้', 'error');
      setDeleteConfirmUser(null);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', deleteConfirmUser.id));
      showToast(`ลบบัญชี "${deleteConfirmUser.displayName}" สำเร็จ`, 'info');
      setDeleteConfirmUser(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${deleteConfirmUser.id}`);
    }
  };

  // Save new store invite passcode
  const handleSaveInviteCode = async () => {
    if (!newInviteCode.trim()) {
      showToast('กรุณากรอกรหัสเชิญพนักงาน', 'warning');
      return;
    }
    await updateSettings({ staffInviteCode: newInviteCode.trim().toUpperCase() });
    setEditingInviteCode(false);
    showToast('อัปเดตรหัสผ่านสำหรับสมัครสมาชิกพนักงานเรียบร้อย', 'success');
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(settings.staffInviteCode || 'POS2026');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    showToast('คัดลอกรหัสเชิญเรียบร้อย', 'info');
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return {
          label: 'เจ้าของร้าน (Owner)',
          className: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: ShieldCheck,
        };
      case 'admin':
        return {
          label: 'ผู้ดูแลระบบ (Admin)',
          className: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          icon: Shield,
        };
      case 'manager':
        return {
          label: 'ผู้จัดการร้าน (Manager)',
          className: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: UserCheck,
        };
      case 'staff':
      case 'cashier':
      default:
        return {
          label: 'พนักงานขาย (Staff)',
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: UserCog,
        };
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-blue-600" />
            <span>จัดการพนักงานและสิทธิ์การใช้งาน (Employees & Roles)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ระบบแบ่งสิทธิ์ 4 ระดับ: เจ้าของร้าน (Owner), ผู้ดูแลระบบ (Admin), ผู้จัดการ (Manager), และพนักงานขาย (Staff)
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

      {/* Staff Invitation Code Banner - Clean Minimalist */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <span>รหัสความปลอดภัยสำหรับสมัครสมาชิกพนักงาน (Staff Passcode)</span>
          </div>
          <p className="text-xs text-slate-400 pl-8">
            จำกัดให้เฉพาะพนักงานที่ทราบรหัสนี้เท่านั้นที่จะสามารถสมัครสมาชิกได้ เพื่อป้องกันบุคคลภายนอกเข้าถึงระบบ
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
          {editingInviteCode ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newInviteCode}
                onChange={(e) => setNewInviteCode(e.target.value)}
                className="px-3 py-1.5 bg-white text-slate-900 border border-slate-300 font-mono font-bold text-sm rounded-lg focus:outline-hidden w-28 text-center uppercase"
                placeholder="POS2026"
              />
              <button
                onClick={handleSaveInviteCode}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                บันทึก
              </button>
              <button
                onClick={() => setEditingInviteCode(false)}
                className="px-2 py-1.5 text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <>
              <div className="px-3 py-1 bg-white rounded-lg border border-slate-200">
                <span className="font-mono font-bold text-slate-800 tracking-widest text-sm">
                  {settings.staffInviteCode || 'POS2026'}
                </span>
              </div>
              <button
                onClick={copyInviteCode}
                className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-600 transition cursor-pointer"
                title="คัดลอกรหัสผ่าน"
              >
                {copiedCode ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
              {(currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
                <button
                  onClick={() => {
                    setNewInviteCode(settings.staffInviteCode || 'POS2026');
                    setEditingInviteCode(true);
                  }}
                  className="px-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition font-medium cursor-pointer"
                >
                  แก้ไขรหัส
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick Role Simulation Switcher (4 Roles) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              สลับบทบาทสำหรับทดสอบระบบ POS (Active Role Switcher)
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-base font-bold text-slate-800">{currentUser?.displayName}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                {currentUser?.role}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['owner', 'admin', 'manager', 'staff'] as const).map((r) => {
              const isActive = currentUser?.role === r;
              return (
                <button
                  key={r}
                  onClick={() => switchUserRole(r)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500 ring-offset-1'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {r === 'owner' && <ShieldCheck className="w-4 h-4 text-purple-300" />}
                  {r === 'admin' && <Shield className="w-4 h-4 text-indigo-300" />}
                  {r === 'manager' && <UserCheck className="w-4 h-4 text-blue-300" />}
                  {r === 'staff' && <UserCog className="w-4 h-4 text-emerald-300" />}
                  <span>
                    {r === 'owner' ? 'เจ้าของร้าน' : r === 'admin' ? 'แอดมิน' : r === 'manager' ? 'ผู้จัดการ' : 'พนักงาน'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Staff List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-bold text-sm text-slate-800">รายชื่อบัญชีผู้ใช้งาน ({users.length} บัญชี)</h3>
            <p className="text-xs text-slate-500">จัดการข้อมูล ปรับระดับสิทธิ์ รีเซ็ตรหัสผ่าน และเปิด/ปิดการใช้งาน</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                <th className="py-3 px-4">อีเมล / ข้อมูลติดต่อ</th>
                <th className="py-3 px-4">ระดับสิทธิ์ (Role)</th>
                <th className="py-3 px-4">เข้าสู่ระบบล่าสุด</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const badge = getRoleBadge(u.role);
                const isCurrentUser = u.id === currentUser?.id;
                const isOwnerAccount = u.role === 'owner';
                const canModify =
                  currentUser?.role === 'owner' ||
                  (currentUser?.role === 'admin' && !isOwnerAccount);

                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {u.displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{u.displayName}</span>
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.2 text-[10px] bg-blue-600 text-white rounded-md font-medium">
                                บัญชีคุณ
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">ID: {u.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700 font-mono text-xs">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{u.email}</span>
                      </div>
                      {u.phone && (
                        <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px] mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{u.phone}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.className}`}
                      >
                        <badge.icon className="w-3.5 h-3.5" />
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-600">
                      {u.lastLoginAt ? (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatDate(u.lastLoginAt)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">ยังไม่เคยเข้าสู่ระบบ</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        disabled={!canModify || isCurrentUser}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        } ${(!canModify || isCurrentUser) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={
                          isCurrentUser
                            ? 'ไม่สามารถระงับบัญชีที่กำลังใช้งานอยู่'
                            : !canModify
                            ? 'ไม่มีสิทธิ์ปรับสถานะเจ้าของร้าน'
                            : 'คลิกเพื่อเปิด/ปิดการใช้งาน'
                        }
                      >
                        <Power className="w-3 h-3" />
                        <span>{u.status === 'active' ? 'ใช้งานปกติ' : 'ระงับใช้งาน'}</span>
                      </button>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(u)}
                          disabled={!canModify}
                          className={`p-1.5 rounded-lg transition ${
                            canModify
                              ? 'text-blue-600 hover:bg-blue-50'
                              : 'text-slate-300 cursor-not-allowed'
                          }`}
                          title={canModify ? 'แก้ไขข้อมูล' : 'ไม่มีสิทธิ์แก้ไขเจ้าของร้าน'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={() => setResettingUser(u)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="ส่งลิงก์รีเซ็ตรหัสผ่าน"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setDeleteConfirmUser(u)}
                          disabled={!canModify || isCurrentUser}
                          className={`p-1.5 rounded-lg transition ${
                            canModify && !isCurrentUser
                              ? 'text-rose-600 hover:bg-rose-50'
                              : 'text-slate-300 cursor-not-allowed'
                          }`}
                          title={
                            isCurrentUser
                              ? 'ไม่สามารถลบบัญชีตนเอง'
                              : !canModify
                              ? 'Admin ไม่สามารถลบ Owner'
                              : 'ลบบัญชี'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Matrix (4 Levels) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="mb-4">
          <h3 className="font-bold text-base text-slate-800">
            ตารางสิทธิ์การเข้าถึงข้อมูลตามบทบาท 4 ระดับ (Role-Based Access Control)
          </h3>
          <p className="text-xs text-slate-500">
            ระบบตรวจสอบสิทธิ์ระดับความปลอดภัยทั้งหน้าบ้าน (Frontend Guards) และฐานข้อมูล Firestore Security Rules
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-2.5 px-3">ฟังก์ชันการทำงาน / สิทธิ์</th>
                <th className="py-2.5 px-3 text-center">เจ้าของร้าน (Owner)</th>
                <th className="py-2.5 px-3 text-center">ผู้ดูแลระบบ (Admin)</th>
                <th className="py-2.5 px-3 text-center">ผู้จัดการ (Manager)</th>
                <th className="py-2.5 px-3 text-center">พนักงานขาย (Staff)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-2 px-3 font-medium">เข้าหน้าขาย POS & ค้นหาสินค้า & พิมพ์ใบเสร็จ</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">ดูประวัติรายการขายของตนเอง</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">ดูราคาทุนและผลกำไร (Cost & Profit Margin)</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-slate-300">✗ (ซ่อน)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">จัดการสินค้าและสต็อกคลัง (Products & Inventory)</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">จัดการข้อมูลลูกค้า & ซัพพลายเออร์ & ค่าใช้จ่าย</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">รายงานยอดขายและวิเคราะห์กำไร-ขาดทุน</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">ยกเลิกบิลขายและคืนสินค้า (Void Sale)</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">จัดการบัญชีพนักงาน & เปิด/ปิดบัญชี</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓ (จำกัด)</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-medium">ตั้งค่าระบบร้านค้าและรหัสเชิญพนักงาน</td>
                <td className="py-2 px-3 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
                <td className="py-2 px-3 text-center text-slate-300">✗</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT EMPLOYEE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-800">
                {editingUser ? 'แก้ไขบัญชีพนักงาน' : 'เพิ่มบัญชีพนักงานใหม่'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อ-นามสกุล <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น มานะ ขยันขาย (พนักงานขาย)"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  อีเมลสำหรับเข้าสู่ระบบ <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="mana.staff@store.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ระดับสิทธิ์การใช้งาน (Role) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3.5 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="staff">พนักงานขายหน้าร้าน (Staff / Cashier)</option>
                  <option value="manager">ผู้จัดการร้าน (Manager)</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                  {currentUser?.role === 'owner' && (
                    <option value="owner">เจ้าของร้าน (Owner)</option>
                  )}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {formData.role === 'staff' && '• เข้าได้เฉพาะหน้าขาย POS และประวัติของตนเอง ไม่สามารถดูราคาทุนได้'}
                  {formData.role === 'manager' && '• ตรวจสอบสต็อก, จัดการการขาย และดูรายงานสรุปยอดขายได้'}
                  {formData.role === 'admin' && '• จัดการสินค้า สต็อก ลูกค้า ซัพพลายเออร์ และรายงานทั้งหมด'}
                  {formData.role === 'owner' && '• สิทธิ์สูงสุด เข้าถึงทุกฟังก์ชันรวมถึงการตั้งค่าร้านค้า'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="text"
                  placeholder="08x-xxx-xxxx"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">สถานะบัญชี</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'suspended' })}
                  className="w-full px-3.5 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                >
                  <option value="active">ใช้งานปกติ (Active)</option>
                  <option value="suspended">ระงับการใช้งาน (Suspended)</option>
                </select>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  {editingUser ? 'บันทึกการแก้ไข' : 'สร้างบัญชีพนักงาน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="font-bold text-base text-slate-800">ยืนยันการลบบัญชีผู้ใช้</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี <span className="font-bold text-slate-800">"{deleteConfirmUser.displayName}"</span> ({deleteConfirmUser.email}) ออกจากระบบ? การกระทำนี้ไม่สามารถยกเลิกได้
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <KeyRound className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-bold text-base text-slate-800">รีเซ็ตรหัสผ่านบัญชี</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ระบบจะส่งอีเมลพร้อมลิงก์ตั้งรหัสผ่านใหม่ไปยัง:
              <br />
              <span className="font-bold font-mono text-slate-800 block mt-1">{resettingUser.email}</span>
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResettingUser(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleTriggerPasswordReset(resettingUser)}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                ส่งลิงก์รีเซ็ต
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
