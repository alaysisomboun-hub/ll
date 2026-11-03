import React, { useState } from 'react';
import {
  Store,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  KeyRound,
  ShieldCheck,
  Shield,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  HelpCircle,
  LogIn,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types/pos';

export const LoginView: React.FC = () => {
  const {
    loginWithEmail,
    loginWithGoogle,
    registerStaff,
    resetPassword,
    quickLoginAsRole,
    settings,
    currency,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login Form
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  // Register Form
  const [regName, setRegName] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [regInviteCode, setRegInviteCode] = useState<string>('');

  // Status & UI
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotStatus, setForgotStatus] = useState<string>('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMessage('กรุณากรอก Username/Email และรหัสผ่าน');
      return;
    }

    try {
      setIsLoading(true);
      await loginWithEmail(loginIdentifier.trim(), loginPassword, rememberMe);
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      const msg = err?.message || '';
      if (msg.includes('user-not-found') || msg.includes('invalid-credential') || msg.includes('wrong-password')) {
        setErrorMessage('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      } else if (msg.includes('suspended')) {
        setErrorMessage('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าของร้าน (Owner)');
      } else if (msg.includes('too-many-requests')) {
        setErrorMessage('มีการพยายามเข้าสู่ระบบผิดพลาดหลายครั้ง กรุณารอสักครู่แล้วลองใหม่');
      } else {
        setErrorMessage(msg || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง');
      }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!regName.trim() || !regEmail.trim() || !regPhone.trim() || !regPassword) {
      setErrorMessage('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    const expectedInviteCode = settings.staffInviteCode || 'POS2026';
    if (regInviteCode.trim() !== expectedInviteCode) {
      setErrorMessage(
        'รหัสผ่านอนุญาตของร้านไม่ถูกต้อง! ห้ามบุคคลภายนอกสมัครเข้าใช้งานระบบ POS (กรุณาขอรหัสจากเจ้าของร้าน)'
      );
      return;
    }

    try {
      setIsLoading(true);
      await registerStaff({
        name: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim(),
        password: regPassword,
        inviteCode: regInviteCode.trim(),
      });
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      const msg = err?.message || '';
      if (msg.includes('email-already-in-use')) {
        setErrorMessage('อีเมลนี้ถูกใช้งานในระบบแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ');
      } else {
        setErrorMessage(msg || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    try {
      setIsLoading(true);
      await loginWithGoogle();
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'การเข้าสู่ระบบด้วย Google ไม่สำเร็จ');
    }
  };

  const handleQuickDemoLogin = async (role: UserRole) => {
    setErrorMessage('');
    try {
      setIsLoading(true);
      await quickLoginAsRole(role);
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'ไม่สามารถเข้าสู่ระบบทดสอบได้');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    try {
      await resetPassword(forgotEmail.trim());
      setForgotStatus('ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณเรียบร้อยแล้ว กรุณาตรวจสอบกล่องจดหมาย');
    } catch (err: any) {
      setForgotStatus('ไม่สามารถส่งลิงก์ได้: ' + (err?.message || 'โปรดตรวจสอบอีเมล'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
      {/* Background Glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-xl z-10 flex flex-col items-center">
        {/* Main Card */}
        <div className="w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          {/* Top Brand Header */}
          <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-800 p-6 md:p-8 text-white text-center relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white text-blue-800 shadow-xl shadow-blue-900/40 mb-3 mx-auto">
              <Store className="w-9 h-9" />
            </div>

            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
              {settings.storeName || 'POS Wholesale & Retail'}
            </h1>
            <p className="text-xs md:text-sm text-blue-100 mt-1 max-w-md mx-auto">
              ระบบบริหารจัดการร้านค้าขายส่งและขายปลีกระดับมืออาชีพ
            </p>
          </div>

          {/* Tab Navigation: Login vs Register */}
          <div className="flex border-b border-slate-200 bg-slate-50/80">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage('');
              }}
              className={`flex-1 py-3 text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 ${
                activeTab === 'login'
                  ? 'border-blue-600 text-blue-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn className="w-4 h-4" />
              เข้าสู่ระบบ (Sign In)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMessage('');
              }}
              className={`flex-1 py-3 text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 ${
                activeTab === 'register'
                  ? 'border-blue-600 text-blue-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              สมัครสมาชิกพนักงาน (Staff Register)
            </button>
          </div>

          <div className="p-6 md:p-8">
            {/* Error Message Box */}
            {errorMessage && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span className="leading-snug font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Success Message Box */}
            {successMessage && (
              <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                <span className="leading-snug font-medium">{successMessage}</span>
              </div>
            )}

            {activeTab === 'login' ? (
              /* LOGIN FORM */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Username or Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Username หรือ อีเมลผู้ใช้งาน
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="เช่น owner@store.pos หรือ alaysisomboun@gmail.com"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-medium transition"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">รหัสผ่าน (Password)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotStatus('');
                        setIsForgotModalOpen(true);
                      }}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-medium transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Toggle */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded-xs focus:ring-blue-500"
                    />
                    <span>จดจำการเข้าสู่ระบบบนอุปกรณ์นี้</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังตรวจสอบข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>เข้าสู่ระบบ (Sign In)</span>
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="relative my-4 flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    หรือทดสอบสิทธิ์ผู้ใช้งาน (4 Roles)
                  </span>
                </div>

                {/* Quick 1-Click Role Logins for testing */}
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500 text-center font-medium">
                    คลิกเพื่อทดสอบระบบตามระดับสิทธิ์ผู้ใช้งานทันที:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('owner')}
                      className="p-2.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold flex items-center gap-2 transition text-left cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                      <div>
                        <div className="leading-tight">👑 เจ้าของร้าน</div>
                        <span className="text-[10px] text-purple-600 font-normal">สิทธิ์สูงสุด ทุกเมนู</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('admin')}
                      className="p-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold flex items-center gap-2 transition text-left cursor-pointer"
                    >
                      <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <div className="leading-tight">🛡️ ผู้ดูแลระบบ</div>
                        <span className="text-[10px] text-blue-600 font-normal">จัดการคลัง/รายงาน</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('manager')}
                      className="p-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold flex items-center gap-2 transition text-left cursor-pointer"
                    >
                      <User className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <div className="leading-tight">👔 ผู้จัดการ</div>
                        <span className="text-[10px] text-indigo-600 font-normal">คุมสต็อก/การขาย</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('staff')}
                      className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold flex items-center gap-2 transition text-left cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="leading-tight">🛒 พนักงานขาย</div>
                        <span className="text-[10px] text-emerald-600 font-normal">ขาย POS (ไม่เห็นทุน)</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Google Sign In option */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>เข้าสู่ระบบด้วย Google Account</span>
                  </button>
                </div>
              </form>
            ) : (
              /* REGISTRATION FORM (Protected with Store Authorization Code) */
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {/* Authorization Invite Code Protection Banner */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>ระบบป้องกันการสมัครจากบุคคลภายนอก</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    เฉพาะพนักงานที่ได้รับรหัสผ่านอนุญาตจากเจ้าของร้านจึงจะสามารถสมัครเข้าใช้งานได้ (รหัสเริ่มต้นของร้านคือ <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-900">{settings.staffInviteCode || 'POS2026'}</code>)
                  </p>
                </div>

                {/* Store Passcode */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสผ่านอนุญาตของร้าน (Store Authorization Code) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="ใส่รหัสผ่านที่ได้รับจากเจ้าของร้าน (เช่น POS2026)"
                      value={regInviteCode}
                      onChange={(e) => setRegInviteCode(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 font-mono font-bold text-blue-900"
                    />
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อและนามสกุล <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="เช่น สมศักดิ์ มีสุข"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      placeholder="08x-xxx-xxxx"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    อีเมล (ใช้เป็นบัญชีเข้าสู่ระบบ) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="staff@store.pos"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Password & Confirm */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      รหัสผ่าน (ขั้นต่ำ 6 ตัว) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ยืนยันรหัสผ่าน <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Register Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังสร้างบัญชีพนักงาน...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>ยืนยันการสมัครสมาชิกพนักงาน</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Security & System Info Footer */}
        <div className="text-center mt-5 text-slate-400 text-xs space-y-1">
          <p className="flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>เชื่อมต่อระบบความปลอดภัย Firebase Authentication & Cloud Firestore</span>
          </p>
          <p className="text-[11px] text-slate-300">
            Wholesale & Retail POS Management System • High-Security Architecture
          </p>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800">รีเซ็ตรหัสผ่าน (Reset Password)</h3>
              <button
                onClick={() => setIsForgotModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              กรุณากรอกอีเมลของคุณ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังกล่องจดหมายผ่าน Firebase Authentication
            </p>

            {forgotStatus && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
                {forgotStatus}
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมลผู้ใช้งาน</label>
                <input
                  type="email"
                  required
                  placeholder="name@store.pos"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  ปิด
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  ส่งลิงก์รีเซ็ต
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
