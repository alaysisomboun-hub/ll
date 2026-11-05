import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  writeBatch,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  db,
  auth,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from '../firebase';
import {
  Product,
  Category,
  Customer,
  Supplier,
  Sale,
  SaleItem,
  Expense,
  ExpenseCategory,
  Income,
  IncomeCategory,
  FinanceReset,
  InventoryTransaction,
  StoreSettings,
  UserProfile,
  UserRole,
  CartItem,
  Debt,
} from '../types/pos';
import { Language, translations, Translations } from '../utils/translations';
import { defaultSettings, checkAndSeedInitialData } from '../utils/seedData';
import { generateInvoiceNumber } from '../utils/formatters';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface AppContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  currency: 'LAK' | 'THB' | 'USD';
  setCurrency: (c: 'LAK' | 'THB' | 'USD') => void;
  settings: StoreSettings;
  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
  
  // Realtime Data
  products: Product[];
  categories: Category[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  expenses: Expense[];
  incomes: Income[];
  financeResets: FinanceReset[];
  transactions: InventoryTransaction[];
  users: UserProfile[];
  loading: boolean;

  // Active User / Auth & RBAC
  isAuthenticated: boolean;
  currentUser: UserProfile | null;
  loginWithEmail: (emailOrUsername: string, password: string, rememberMe?: boolean) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<UserProfile>;
  registerStaff: (data: { name: string; phone: string; email: string; password: string; inviteCode: string }) => Promise<UserProfile>;
  quickLoginAsRole: (role: UserRole) => Promise<UserProfile>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  switchUserRole: (role: UserRole) => void;
  canAccessTab: (tab: string) => boolean;
  canViewCosts: boolean;
  canManageSettings: boolean;
  canManageStaff: boolean;
  canVoidSales: boolean;

  // Cart / POS State
  cart: CartItem[];
  posMode: 'retail' | 'wholesale';
  setPosMode: (mode: 'retail' | 'wholesale') => void;
  selectedCustomer: Customer | null;
  setSelectedCustomer: (cust: Customer | null) => void;
  billDiscountPercent: number;
  setBillDiscountPercent: (pct: number) => void;
  billDiscountAmount: number;
  setBillDiscountAmount: (amt: number) => void;
  addToCart: (product: Product, quantity?: number) => void;
  updateCartItemQty: (productId: string, qty: number) => void;
  updateCartItemDiscount: (productId: string, discount: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotals: {
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;
    costTotal: number;
    profitTotal: number;
    itemCount: number;
  };
  completeSale: (payment: {
    method: 'cash' | 'transfer' | 'credit';
    amountPaid: number;
    notes?: string;
  }) => Promise<Sale>;
  voidSale: (saleId: string, reason: string) => Promise<void>;

  // Inventory actions
  adjustStock: (productId: string, change: number, type: 'in' | 'out' | 'adjustment', reason: string, refId?: string) => Promise<void>;
  receiveSupplierStock: (supplierId: string, items: { productId: string; qty: number; unitCost: number }[], poNumber: string, paidAmount: number) => Promise<void>;

  // Customer actions
  recordCustomerDebtPayment: (customerId: string, amount: number, method: 'cash' | 'transfer', notes?: string) => Promise<void>;

  // Finance & Expense actions
  recordIncome: (data: {
    title: string;
    amount: number;
    category: IncomeCategory | string;
    categoryName?: string;
    date: string;
    time?: string;
    paymentMethod: 'cash' | 'transfer';
    referenceId?: string;
    note?: string;
    isFromSales?: boolean;
  }) => Promise<void>;
  recordExpense: (data: {
    title: string;
    amount: number;
    category: ExpenseCategory;
    date: string;
    time?: string;
    paymentMethod: 'cash' | 'transfer';
    referenceId?: string;
    note?: string;
    receiptUrl?: string;
  }) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  recordFinanceReset: (reason: string, periodLabel?: string) => Promise<FinanceReset>;

  // Seeder
  seedDemoData: () => Promise<void>;

  // Toasts
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [language, setLanguage] = useState<Language>('th');
  const [currency, setCurrency] = useState<'LAK' | 'THB' | 'USD'>('THB');
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [loading, setLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Entity Lists
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [financeResets, setFinanceResets] = useState<FinanceReset[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // Cart & POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posMode, setPosMode] = useState<'retail' | 'wholesale'>('retail');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [billDiscountPercent, setBillDiscountPercent] = useState<number>(0);
  const [billDiscountAmount, setBillDiscountAmount] = useState<number>(0);

  // Authentication & Session State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('pos_user_session') || sessionStorage.getItem('pos_user_session');
      return !!stored;
    } catch {
      return false;
    }
  });

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem('pos_user_session') || sessionStorage.getItem('pos_user_session');
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // RBAC Permission Checkers
  const canAccessTab = (tab: string): boolean => {
    if (!currentUser) return false;
    const role = currentUser.role;
    if (role === 'owner') return true;
    if (role === 'admin') {
      return tab !== 'settings'; // Admin can access everything except core system settings
    }
    if (role === 'manager') {
      return ['dashboard', 'pos', 'products', 'inventory', 'customers', 'suppliers', 'reports'].includes(tab);
    }
    if (role === 'staff' || role === 'cashier') {
      return ['pos', 'customers'].includes(tab); // Staff only POS and customer lookup
    }
    return false;
  };

  const canViewCosts = currentUser?.role !== 'staff' && currentUser?.role !== 'cashier';
  const canManageSettings = currentUser?.role === 'owner';
  const canManageStaff = currentUser?.role === 'owner' || currentUser?.role === 'admin';
  const canVoidSales = currentUser?.role === 'owner' || currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // Navigation enforcement based on role
  const enforceTabAccess = (targetTab: string, role: UserRole) => {
    if (role === 'staff' || role === 'cashier') {
      setActiveTab('pos');
    } else {
      setActiveTab(targetTab === 'settings' && role !== 'owner' ? 'dashboard' : targetTab);
    }
  };

  // Switch role simulation (for Owner/Admin testing)
  const switchUserRole = (role: UserRole) => {
    const roleNames: Record<UserRole, string> = {
      owner: 'เจ้าของร้าน (Owner)',
      admin: 'ผู้ดูแลระบบ (Admin)',
      manager: 'ผู้จัดการ (Manager)',
      staff: 'พนักงานขาย (Staff)',
      cashier: 'พนักงานขาย (Staff)',
    };

    if (!currentUser) return;
    const updatedUser: UserProfile = {
      ...currentUser,
      role,
      displayName: currentUser.displayName || roleNames[role],
    };

    setCurrentUser(updatedUser);
    localStorage.setItem('pos_user_session', JSON.stringify(updatedUser));
    enforceTabAccess(activeTab, role);
    showToast(`เปลี่ยนสิทธิ์ผู้ใช้งานเป็น: ${roleNames[role]}`, 'info');
  };

  // Quick 1-Click Role Login for instant verification
  const quickLoginAsRole = async (role: UserRole): Promise<UserProfile> => {
    const roleProfiles: Record<UserRole, UserProfile> = {
      owner: {
        id: 'user_owner',
        email: 'alaysisomboun@gmail.com',
        displayName: 'คุณอาลัย (เจ้าของร้าน / Owner)',
        role: 'owner',
        phone: '089-123-4567',
        status: 'active',
      },
      admin: {
        id: 'user_admin',
        email: 'admin@store.pos',
        displayName: 'สมศักดิ์ สิทธิชัย (ผู้ดูแลระบบ / Admin)',
        role: 'admin',
        phone: '081-555-9988',
        status: 'active',
      },
      manager: {
        id: 'user_manager',
        email: 'manager@store.pos',
        displayName: 'วิภาวี เกียรติสกุล (ผู้จัดการ / Manager)',
        role: 'manager',
        phone: '084-333-2211',
        status: 'active',
      },
      staff: {
        id: 'user_staff',
        email: 'staff@store.pos',
        displayName: 'กานต์ดา บุญมี (พนักงานขาย / Staff)',
        role: 'staff',
        phone: '086-777-4433',
        status: 'active',
      },
      cashier: {
        id: 'user_staff',
        email: 'staff@store.pos',
        displayName: 'กานต์ดา บุญมี (พนักงานขาย / Staff)',
        role: 'staff',
        phone: '086-777-4433',
        status: 'active',
      },
    };

    const profile = { ...roleProfiles[role] };
    const nowIso = new Date().toISOString();
    profile.lastLoginAt = nowIso;

    setCurrentUser(profile);
    setIsAuthenticated(true);
    localStorage.setItem('pos_user_session', JSON.stringify(profile));

    // Update Firestore if possible
    try {
      await setDoc(doc(db, 'users', profile.id), profile, { merge: true });
    } catch {}

    // Post-login route requirement: Owner/Admin/Manager -> dashboard, Staff -> pos
    if (profile.role === 'staff' || profile.role === 'cashier') {
      setActiveTab('pos');
    } else {
      setActiveTab('dashboard');
    }

    showToast(`เข้าสู่ระบบสำเร็จในบทบาท: ${profile.displayName}`, 'success');
    return profile;
  };

  // Login With Email or Username
  const loginWithEmail = async (
    emailOrUsername: string,
    pass: string,
    rememberMe: boolean = true
  ): Promise<UserProfile> => {
    let targetEmail = emailOrUsername.trim().toLowerCase();
    if (!targetEmail.includes('@')) {
      targetEmail = `${targetEmail}@store.pos`;
    }

    const nowIso = new Date().toISOString();

    // Demo role users lookup
    const demoRoleUsers: Record<string, UserProfile> = {
      'owner@store.pos': {
        id: 'user_owner',
        email: 'alaysisomboun@gmail.com',
        displayName: 'คุณอาลัย (เจ้าของร้าน / Owner)',
        role: 'owner',
        phone: '089-123-4567',
        status: 'active',
      },
      'admin@store.pos': {
        id: 'user_admin',
        email: 'admin@store.pos',
        displayName: 'สมศักดิ์ สิทธิชัย (ผู้ดูแลระบบ / Admin)',
        role: 'admin',
        phone: '081-555-9988',
        status: 'active',
      },
      'manager@store.pos': {
        id: 'user_manager',
        email: 'manager@store.pos',
        displayName: 'วิภาวี เกียรติสกุล (ผู้จัดการ / Manager)',
        role: 'manager',
        phone: '084-333-2211',
        status: 'active',
      },
      'staff@store.pos': {
        id: 'user_staff',
        email: 'staff@store.pos',
        displayName: 'กานต์ดา บุญมี (พนักงานขาย / Staff)',
        role: 'staff',
        phone: '086-777-4433',
        status: 'active',
      },
      'alaysisomboun@gmail.com': {
        id: 'user_owner',
        email: 'alaysisomboun@gmail.com',
        displayName: 'คุณอาลัย (เจ้าของร้าน / Owner)',
        role: 'owner',
        phone: '089-123-4567',
        status: 'active',
      },
    };

    let resolvedProfile: UserProfile | null = null;

    // 1. Try Firebase Authentication
    try {
      const userCred = await signInWithEmailAndPassword(auth, targetEmail, pass);
      const uid = userCred.user.uid;
      const userDocRef = doc(db, 'users', uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        resolvedProfile = { id: snap.id, ...snap.data() } as UserProfile;
      } else {
        const isOwner = targetEmail === 'alaysisomboun@gmail.com';
        resolvedProfile = {
          id: uid,
          email: targetEmail,
          displayName: userCred.user.displayName || (isOwner ? 'เจ้าของร้าน (Owner)' : 'พนักงาน'),
          role: isOwner ? 'owner' : 'staff',
          status: 'active',
          createdAt: nowIso,
          updatedAt: nowIso,
          lastLoginAt: nowIso,
        };
        await setDoc(userDocRef, resolvedProfile, { merge: true });
      }
    } catch (fbAuthErr: any) {
      // 2. Fallback to Firestore users collection
      const foundInUsers = users.find(
        (u) =>
          u.email.toLowerCase() === targetEmail ||
          u.displayName.toLowerCase() === emailOrUsername.toLowerCase()
      );

      if (foundInUsers) {
        resolvedProfile = { ...foundInUsers };
      } else if (demoRoleUsers[targetEmail]) {
        resolvedProfile = { ...demoRoleUsers[targetEmail] };
      } else {
        throw new Error('ไม่พบบัญชีผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง');
      }
    }

    if (!resolvedProfile) {
      throw new Error('ไม่พบบัญชีผู้ใช้งานในระบบ');
    }

    // 3. Security Guard: Verify Active Status
    if (resolvedProfile.status === 'suspended') {
      throw new Error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าของร้าน (Owner)');
    }

    // 4. Update last login
    resolvedProfile.lastLoginAt = nowIso;
    try {
      await updateDoc(doc(db, 'users', resolvedProfile.id), {
        lastLoginAt: nowIso,
      });
    } catch {}

    // 5. Update state & storage
    setCurrentUser(resolvedProfile);
    setIsAuthenticated(true);
    if (rememberMe) {
      localStorage.setItem('pos_user_session', JSON.stringify(resolvedProfile));
    } else {
      sessionStorage.setItem('pos_user_session', JSON.stringify(resolvedProfile));
    }

    // 6. Role-based routing: Owner/Admin/Manager -> dashboard, Staff -> pos
    if (resolvedProfile.role === 'staff' || resolvedProfile.role === 'cashier') {
      setActiveTab('pos');
    } else {
      setActiveTab('dashboard');
    }

    showToast(`ยินดีต้อนรับ ${resolvedProfile.displayName} เข้าสู่ระบบ`, 'success');
    return resolvedProfile;
  };

  // Google Login
  const loginWithGoogle = async (): Promise<UserProfile> => {
    const cred = await signInWithPopup(auth, googleProvider);
    const user = cred.user;
    const nowIso = new Date().toISOString();
    const isOwner = user.email === 'alaysisomboun@gmail.com';

    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    let profile: UserProfile;
    if (snap.exists()) {
      profile = { id: snap.id, ...snap.data() } as UserProfile;
      if (profile.status === 'suspended') {
        await signOut(auth);
        throw new Error('บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อเจ้าของร้าน');
      }
      await updateDoc(userRef, { lastLoginAt: nowIso });
    } else {
      profile = {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || (isOwner ? 'เจ้าของร้าน (Owner)' : 'พนักงานขาย'),
        role: isOwner ? 'owner' : 'staff',
        phone: user.phoneNumber || '',
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso,
      };
      await setDoc(userRef, profile);
    }

    profile.lastLoginAt = nowIso;
    setCurrentUser(profile);
    setIsAuthenticated(true);
    localStorage.setItem('pos_user_session', JSON.stringify(profile));

    if (profile.role === 'staff' || profile.role === 'cashier') {
      setActiveTab('pos');
    } else {
      setActiveTab('dashboard');
    }

    showToast(`ยินดีต้อนรับ ${profile.displayName} เข้าสู่ระบบ`, 'success');
    return profile;
  };

  // Register Staff (Restricted to Authorized Store Code)
  const registerStaff = async (data: {
    name: string;
    phone: string;
    email: string;
    password: string;
    inviteCode: string;
  }): Promise<UserProfile> => {
    const expectedInviteCode = settings.staffInviteCode || 'POS2026';
    if (data.inviteCode !== expectedInviteCode) {
      throw new Error(
        'รหัสผ่านอนุญาตของร้านไม่ถูกต้อง! ห้ามบุคคลภายนอกสมัครเข้าใช้งานระบบ POS (กรุณาขอรหัสจากเจ้าของร้าน)'
      );
    }

    const nowIso = new Date().toISOString();
    let uid = 'staff_' + Date.now();

    try {
      const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
      uid = cred.user.uid;
    } catch (err: any) {
      if (err?.code !== 'auth/email-already-in-use') {
        console.warn('Firebase auth register fallback', err);
      }
    }

    const newProfile: UserProfile = {
      id: uid,
      email: data.email,
      displayName: data.name,
      role: 'staff',
      phone: data.phone,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso,
    };

    await setDoc(doc(db, 'users', uid), newProfile);
    setCurrentUser(newProfile);
    setIsAuthenticated(true);
    localStorage.setItem('pos_user_session', JSON.stringify(newProfile));
    setActiveTab('pos');
    showToast(`สมัครสมาชิกพนักงาน "${data.name}" เรียบร้อยแล้ว ยินดีต้อนรับสู่ระบบ POS`, 'success');
    return newProfile;
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn(err);
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('pos_user_session');
    sessionStorage.removeItem('pos_user_session');
    setActiveTab('dashboard');
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  };

  // Reset Password
  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
    showToast('ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณเรียบร้อยแล้ว', 'success');
  };

  // Initial connection and Realtime listeners
  useEffect(() => {
    testConnection();

    // 1. Settings listener
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'store_config'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as StoreSettings;
          setSettings(data);
          if (data.currency) setCurrency(data.currency);
          if (data.language) setLanguage(data.language);
        } else {
          // Auto-seed if brand new database
          checkAndSeedInitialData().then((res) => {
            if (res.seeded) {
              showToast('ระบบได้เริ่มต้นข้อมูลตัวอย่างและตั้งค่าร้านให้พร้อมใช้งานแล้ว', 'success');
            }
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/store_config')
    );

    // 2. Products listener
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        const list: Product[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Product);
        });
        setProducts(list);
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'products')
    );

    // 3. Categories listener
    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        const list: Category[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Category);
        });
        setCategories(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'categories')
    );

    // 4. Customers listener
    const unsubCustomers = onSnapshot(
      collection(db, 'customers'),
      (snap) => {
        const list: Customer[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Customer);
        });
        setCustomers(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'customers')
    );

    // 5. Suppliers listener
    const unsubSuppliers = onSnapshot(
      collection(db, 'suppliers'),
      (snap) => {
        const list: Supplier[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Supplier);
        });
        setSuppliers(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'suppliers')
    );

    // 6. Sales listener (extended limit for historical reports)
    const salesQuery = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(1500));
    const unsubSales = onSnapshot(
      salesQuery,
      (snap) => {
        const list: Sale[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Sale);
        });
        setSales(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'sales')
    );

    // 7. Expenses listener
    const expQuery = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(1000));
    const unsubExpenses = onSnapshot(
      expQuery,
      (snap) => {
        const list: Expense[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Expense);
        });
        setExpenses(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'expenses')
    );

    // 8. Incomes listener
    const incQuery = query(collection(db, 'incomes'), orderBy('createdAt', 'desc'), limit(1000));
    const unsubIncomes = onSnapshot(
      incQuery,
      (snap) => {
        const list: Income[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Income);
        });
        setIncomes(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'incomes')
    );

    // 9. Finance Resets listener
    const resetQuery = query(collection(db, 'finance_resets'), orderBy('createdAt', 'desc'), limit(100));
    const unsubResets = onSnapshot(
      resetQuery,
      (snap) => {
        const list: FinanceReset[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as FinanceReset);
        });
        setFinanceResets(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'finance_resets')
    );

    // 10. Transactions listener
    const txQuery = query(collection(db, 'inventory_transactions'), orderBy('createdAt', 'desc'), limit(500));
    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        const list: InventoryTransaction[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as InventoryTransaction);
        });
        setTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'inventory_transactions')
    );

    // 11. Users listener
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as UserProfile);
        });
        setUsers(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'users')
    );

    return () => {
      unsubSettings();
      unsubProducts();
      unsubCategories();
      unsubCustomers();
      unsubSuppliers();
      unsubSales();
      unsubExpenses();
      unsubIncomes();
      unsubResets();
      unsubTx();
      unsubUsers();
    };
  }, []);

  // Update Settings
  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    try {
      const merged = { ...settings, ...newSettings, updatedAt: new Date().toISOString() };
      await setDoc(doc(db, 'settings', 'store_config'), merged, { merge: true });
      setSettings(merged);
      if (newSettings.currency) setCurrency(newSettings.currency);
      if (newSettings.language) setLanguage(newSettings.language);
      showToast('บันทึกการตั้งค่าร้านค้าเรียบร้อยแล้ว', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/store_config');
    }
  };

  // Cart operations
  const recalculateItemPrice = (
    product: Product,
    quantity: number,
    mode: 'retail' | 'wholesale',
    cust: Customer | null
  ) => {
    // Determine if wholesale price applies:
    // 1. Explicit wholesale mode
    // 2. Wholesale customer selected
    // 3. Quantity satisfies wholesale minimum threshold
    const isWholesale =
      mode === 'wholesale' ||
      cust?.type === 'wholesale' ||
      (product.wholesaleMinQty > 0 && quantity >= product.wholesaleMinQty);

    const unitPrice = isWholesale ? (product.wholesalePrice || product.retailPrice) : product.retailPrice;
    const tier: 'retail' | 'wholesale' = isWholesale ? 'wholesale' : 'retail';

    return { unitPrice, tier };
  };

  const addToCart = (product: Product, addQty: number = 1) => {
    if (product.stockQty <= 0) {
      showToast(`สินค้า "${product.name}" หมดสต็อกแล้ว!`, 'error');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      const newQty = existing ? existing.quantity + addQty : addQty;

      if (newQty > product.stockQty) {
        showToast(`จำนวนสินค้าในสต็อกมีเพียง ${product.stockQty} ${product.unit}`, 'warning');
        return prev;
      }

      const { unitPrice, tier } = recalculateItemPrice(product, newQty, posMode, selectedCustomer);
      const discount = existing ? existing.discount : 0;
      const totalPrice = Math.max(0, newQty * unitPrice - discount);
      const totalCost = newQty * (product.costPrice || 0);
      const profit = totalPrice - totalCost;

      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: newQty,
                unitPrice,
                priceTier: tier,
                totalPrice,
                totalCost,
                profit,
              }
            : item
        );
      } else {
        return [
          ...prev,
          {
            product,
            quantity: newQty,
            unitPrice,
            priceTier: tier,
            discount: 0,
            totalPrice,
            totalCost,
            profit,
          },
        ];
      }
    });
  };

  const updateCartItemQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        if (qty > item.product.stockQty) {
          showToast(`คงเหลือสต็อกเพียง ${item.product.stockQty} ${item.product.unit}`, 'warning');
          return item;
        }

        const { unitPrice, tier } = recalculateItemPrice(item.product, qty, posMode, selectedCustomer);
        const totalPrice = Math.max(0, qty * unitPrice - item.discount);
        const totalCost = qty * (item.product.costPrice || 0);
        const profit = totalPrice - totalCost;

        return {
          ...item,
          quantity: qty,
          unitPrice,
          priceTier: tier,
          totalPrice,
          totalCost,
          profit,
        };
      })
    );
  };

  const updateCartItemDiscount = (productId: string, discount: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const validDiscount = Math.max(0, discount);
        const totalPrice = Math.max(0, item.quantity * item.unitPrice - validDiscount);
        const profit = totalPrice - item.totalCost;
        return {
          ...item,
          discount: validDiscount,
          totalPrice,
          profit,
        };
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setBillDiscountAmount(0);
    setBillDiscountPercent(0);
    setSelectedCustomer(null);
  };

  // Re-evaluate cart prices when posMode or selectedCustomer changes
  useEffect(() => {
    setCart((prev) =>
      prev.map((item) => {
        const { unitPrice, tier } = recalculateItemPrice(item.product, item.quantity, posMode, selectedCustomer);
        const totalPrice = Math.max(0, item.quantity * unitPrice - item.discount);
        const totalCost = item.quantity * (item.product.costPrice || 0);
        const profit = totalPrice - totalCost;
        return {
          ...item,
          unitPrice,
          priceTier: tier,
          totalPrice,
          totalCost,
          profit,
        };
      })
    );
  }, [posMode, selectedCustomer]);

  // Cart Totals calculation
  const cartTotals = React.useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const costTotal = cart.reduce((sum, item) => sum + item.totalCost, 0);

    let billDiscount = billDiscountAmount;
    if (billDiscountPercent > 0) {
      billDiscount += (subtotal * billDiscountPercent) / 100;
    }
    billDiscount = Math.min(billDiscount, subtotal);

    const discountedSubtotal = Math.max(0, subtotal - billDiscount);
    let taxTotal = 0;
    if (settings.isTaxEnabled && settings.taxRatePercent > 0) {
      taxTotal = (discountedSubtotal * settings.taxRatePercent) / 100;
    }

    const grandTotal = discountedSubtotal + taxTotal;
    // CRITICAL: Accurate profit calculation (Revenue - Total Cost - Bill Discount)
    const profitTotal = grandTotal - costTotal;
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    return {
      subtotal,
      discountTotal: billDiscount,
      taxTotal,
      grandTotal,
      costTotal,
      profitTotal,
      itemCount,
    };
  }, [cart, billDiscountAmount, billDiscountPercent, settings]);

  // Atomic Sale Checkout with Firestore Transaction
  const completeSale = async (payment: {
    method: 'cash' | 'transfer' | 'credit';
    amountPaid: number;
    notes?: string;
  }): Promise<Sale> => {
    if (cart.length === 0) {
      throw new Error('ไม่มีรายการสินค้าในตะกร้า');
    }

    const invoiceNumber = generateInvoiceNumber();
    const isCredit = payment.method === 'credit';
    const amountPaid = isCredit ? payment.amountPaid : Math.min(payment.amountPaid, cartTotals.grandTotal);
    const changeGiven = !isCredit && payment.amountPaid > cartTotals.grandTotal ? payment.amountPaid - cartTotals.grandTotal : 0;
    const debtAmount = isCredit ? Math.max(0, cartTotals.grandTotal - payment.amountPaid) : 0;

    const newSaleId = doc(collection(db, 'sales')).id;
    const nowIso = new Date().toISOString();

    const saleRecord: Sale = {
      id: newSaleId,
      invoiceNumber,
      customerId: selectedCustomer?.id || '',
      customerName: selectedCustomer ? selectedCustomer.name : 'ลูกค้าทั่วไป (Walk-in)',
      customerType: selectedCustomer?.type || 'retail',
      saleType: posMode,
      cashierId: currentUser?.id || 'cashier-1',
      cashierName: currentUser?.displayName || 'พนักงานขาย',
      subtotal: cartTotals.subtotal,
      discountAmount: cartTotals.discountTotal,
      discountPercent: billDiscountPercent,
      taxAmount: cartTotals.taxTotal,
      totalAmount: cartTotals.grandTotal,
      totalCost: cartTotals.costTotal,
      totalProfit: cartTotals.profitTotal,
      paymentMethod: payment.method,
      amountPaid: payment.amountPaid,
      changeGiven,
      paymentStatus: isCredit && debtAmount > 0 ? (payment.amountPaid > 0 ? 'partial' : 'unpaid') : 'paid',
      debtAmount,
      status: 'completed',
      itemCount: cartTotals.itemCount,
      notes: payment.notes || '',
      createdAt: nowIso,
      items: cart.map((item) => ({
        saleId: newSaleId,
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        unit: item.product.unit,
        quantity: item.quantity,
        costPrice: item.product.costPrice || 0,
        unitPrice: item.unitPrice,
        priceTier: item.priceTier,
        discount: item.discount,
        totalPrice: item.totalPrice,
        totalCost: item.totalCost,
        profit: item.profit,
        createdAt: nowIso,
      })),
    };

    try {
      // Execute Firestore Transaction for strict atomicity and stock deduction
      await runTransaction(db, async (transaction) => {
        // 1. Read and verify stock for all products
        const productUpdates: { ref: any; newStock: number; prevStock: number; prod: Product; itemQty: number }[] = [];

        for (const item of cart) {
          const prodRef = doc(db, 'products', item.product.id);
          const prodDoc = await transaction.get(prodRef);
          if (!prodDoc.exists()) {
            throw new Error(`ไม่พบสินค้า ${item.product.name}`);
          }
          const currentStock = prodDoc.data().stockQty || 0;
          if (currentStock < item.quantity) {
            throw new Error(`สินค้า "${item.product.name}" มีสต็อกคงเหลือไม่พอ (เหลือ ${currentStock})`);
          }
          productUpdates.push({
            ref: prodRef,
            prevStock: currentStock,
            newStock: currentStock - item.quantity,
            prod: item.product,
            itemQty: item.quantity,
          });
        }

        // 2. Perform stock deductions
        for (const update of productUpdates) {
          transaction.update(update.ref, {
            stockQty: update.newStock,
            updatedAt: nowIso,
          });

          // Log inventory transaction
          const txRef = doc(collection(db, 'inventory_transactions'));
          transaction.set(txRef, {
            productId: update.prod.id,
            productName: update.prod.name,
            sku: update.prod.sku,
            type: 'sale',
            quantityChange: -update.itemQty,
            previousStock: update.prevStock,
            newStock: update.newStock,
            referenceId: invoiceNumber,
            reason: `ขายสินค้า บิล #${invoiceNumber}`,
            performedBy: currentUser?.displayName || 'พนักงานขาย',
            createdAt: nowIso,
          });
        }

        // 3. Write Sale Document
        const saleRef = doc(db, 'sales', newSaleId);
        transaction.set(saleRef, saleRecord);

        // 4. Write Sale Items
        for (const item of saleRecord.items || []) {
          const itemRef = doc(collection(db, 'sale_items'));
          transaction.set(itemRef, item);
        }

        // 5. Update Customer if selected
        if (selectedCustomer) {
          const custRef = doc(db, 'customers', selectedCustomer.id);
          const custDoc = await transaction.get(custRef);
          if (custDoc.exists()) {
            const prevSpent = custDoc.data().totalSpent || 0;
            const prevOrders = custDoc.data().orderCount || 0;
            const prevDebt = custDoc.data().outstandingDebt || 0;

            transaction.update(custRef, {
              totalSpent: prevSpent + cartTotals.grandTotal,
              orderCount: prevOrders + 1,
              outstandingDebt: prevDebt + debtAmount,
              updatedAt: nowIso,
            });
          }

          // If debt was created, record in debts collection
          if (debtAmount > 0) {
            const debtRef = doc(collection(db, 'debts'));
            transaction.set(debtRef, {
              partyType: 'customer',
              partyId: selectedCustomer.id,
              partyName: selectedCustomer.name,
              invoiceOrPoNumber: invoiceNumber,
              originalAmount: debtAmount,
              paidAmount: 0,
              remainingAmount: debtAmount,
              status: 'unpaid',
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          }
        }

        // 6. Record payment log
        const paymentRef = doc(collection(db, 'payments'));
        transaction.set(paymentRef, {
          type: 'sale',
          amount: amountPaid,
          method: payment.method,
          referenceId: invoiceNumber,
          partyType: 'customer',
          partyId: selectedCustomer?.id || 'walk_in',
          partyName: selectedCustomer?.name || 'ลูกค้าทั่วไป',
          notes: `ชำระบิล #${invoiceNumber}`,
          createdAt: nowIso,
        });
      });

      showToast(`บันทึกการขายบิล #${invoiceNumber} สำเร็จ ตัดสต็อกเรียบร้อยแล้ว`, 'success');
      clearCart();
      return saleRecord;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales/checkout');
      throw error;
    }
  };

  // Void Sale and Restore Stock
  const voidSale = async (saleId: string, reason: string) => {
    try {
      const sale = sales.find((s) => s.id === saleId);
      if (!sale) throw new Error('ไม่พบบิลการขาย');
      if (sale.status === 'voided') throw new Error('บิลนี้ถูกยกเลิกไปแล้ว');

      const nowIso = new Date().toISOString();

      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', saleId);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error('ไม่พบบิล');

        // Restore stock for all products
        if (sale.items && sale.items.length > 0) {
          for (const item of sale.items) {
            const prodRef = doc(db, 'products', item.productId);
            const prodSnap = await transaction.get(prodRef);
            if (prodSnap.exists()) {
              const currentStock = prodSnap.data().stockQty || 0;
              const newStock = currentStock + item.quantity;
              transaction.update(prodRef, {
                stockQty: newStock,
                updatedAt: nowIso,
              });

              // Log inventory transaction (void_return)
              const txRef = doc(collection(db, 'inventory_transactions'));
              transaction.set(txRef, {
                productId: item.productId,
                productName: item.productName,
                sku: item.sku,
                type: 'void_return',
                quantityChange: item.quantity,
                previousStock: currentStock,
                newStock,
                referenceId: sale.invoiceNumber,
                reason: `ยกเลิกบิล #${sale.invoiceNumber}: ${reason}`,
                performedBy: currentUser?.displayName || 'พนักงาน',
                createdAt: nowIso,
              });
            }
          }
        }

        // Adjust customer totals if customer was linked
        if (sale.customerId) {
          const custRef = doc(db, 'customers', sale.customerId);
          const custSnap = await transaction.get(custRef);
          if (custSnap.exists()) {
            const prevSpent = custSnap.data().totalSpent || 0;
            const prevOrders = custSnap.data().orderCount || 0;
            const prevDebt = custSnap.data().outstandingDebt || 0;

            transaction.update(custRef, {
              totalSpent: Math.max(0, prevSpent - sale.totalAmount),
              orderCount: Math.max(0, prevOrders - 1),
              outstandingDebt: Math.max(0, prevDebt - sale.debtAmount),
              updatedAt: nowIso,
            });
          }
        }

        // Update sale status
        transaction.update(saleRef, {
          status: 'voided',
          voidReason: reason,
          updatedAt: nowIso,
        });
      });

      showToast(`ยกเลิกบิล #${sale.invoiceNumber} และคืนยอดสต็อกสินค้าแล้ว`, 'info');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sales/${saleId}`);
    }
  };

  // Adjust stock directly (In / Out / Count Adjustment)
  const adjustStock = async (
    productId: string,
    change: number,
    type: 'in' | 'out' | 'adjustment',
    reason: string,
    refId?: string
  ) => {
    try {
      const prod = products.find((p) => p.id === productId);
      if (!prod) throw new Error('ไม่พบสินค้า');

      const nowIso = new Date().toISOString();
      const prevStock = prod.stockQty;
      const newStock = type === 'adjustment' ? Math.max(0, change) : Math.max(0, prevStock + change);
      const actualChange = newStock - prevStock;

      const batch = writeBatch(db);
      const prodRef = doc(db, 'products', productId);
      batch.update(prodRef, {
        stockQty: newStock,
        updatedAt: nowIso,
      });

      const txRef = doc(collection(db, 'inventory_transactions'));
      batch.set(txRef, {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        type,
        quantityChange: actualChange,
        previousStock: prevStock,
        newStock,
        referenceId: refId || '',
        reason,
        performedBy: currentUser?.displayName || 'เจ้าหน้าที่คลัง',
        createdAt: nowIso,
      });

      await batch.commit();
      showToast(`ปรับปรุงสต็อก "${prod.name}" เป็น ${newStock} ${prod.unit} เรียบร้อย`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `inventory/${productId}`);
    }
  };

  // Receive Stock from Supplier
  const receiveSupplierStock = async (
    supplierId: string,
    items: { productId: string; qty: number; unitCost: number }[],
    poNumber: string,
    paidAmount: number
  ) => {
    try {
      const supplier = suppliers.find((s) => s.id === supplierId);
      if (!supplier) throw new Error('ไม่พบผู้จำหน่าย');

      const nowIso = new Date().toISOString();
      let totalAmount = 0;

      const batch = writeBatch(db);

      for (const item of items) {
        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          const prevStock = prod.stockQty;
          const newStock = prevStock + item.qty;
          totalAmount += item.qty * item.unitCost;

          const prodRef = doc(db, 'products', item.productId);
          batch.update(prodRef, {
            stockQty: newStock,
            costPrice: item.unitCost, // Update latest cost
            updatedAt: nowIso,
          });

          const txRef = doc(collection(db, 'inventory_transactions'));
          batch.set(txRef, {
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            type: 'in',
            quantityChange: item.qty,
            previousStock: prevStock,
            newStock,
            referenceId: poNumber,
            reason: `รับสินค้าจากซัพพลายเออร์ ${supplier.companyName} (PO: ${poNumber})`,
            performedBy: currentUser?.displayName || 'เจ้าหน้าที่จัดซื้อ',
            createdAt: nowIso,
          });
        }
      }

      const outstanding = Math.max(0, totalAmount - paidAmount);

      // Create purchase record
      const poRef = doc(collection(db, 'purchases'));
      batch.set(poRef, {
        poNumber,
        supplierId: supplier.id,
        supplierName: supplier.companyName,
        totalAmount,
        paidAmount,
        outstandingAmount: outstanding,
        paymentStatus: outstanding === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
        status: 'received',
        itemCount: items.reduce((acc, i) => acc + i.qty, 0),
        receivedDate: nowIso.split('T')[0],
        createdAt: nowIso,
      });

      // Update supplier purchase & payable totals
      const supRef = doc(db, 'suppliers', supplier.id);
      batch.update(supRef, {
        totalPurchased: (supplier.totalPurchased || 0) + totalAmount,
        outstandingPayable: (supplier.outstandingPayable || 0) + outstanding,
      });

      await batch.commit();
      showToast(`บันทึกรับสินค้าเข้าคลังจาก ${supplier.companyName} เรียบร้อยแล้ว`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'purchases');
    }
  };

  // Customer debt repayment
  const recordCustomerDebtPayment = async (
    customerId: string,
    amount: number,
    method: 'cash' | 'transfer',
    notes?: string
  ) => {
    try {
      const cust = customers.find((c) => c.id === customerId);
      if (!cust) throw new Error('ไม่พบลูกค้า');

      const nowIso = new Date().toISOString();
      const validAmount = Math.min(amount, cust.outstandingDebt);

      const batch = writeBatch(db);
      const custRef = doc(db, 'customers', customerId);
      batch.update(custRef, {
        outstandingDebt: Math.max(0, cust.outstandingDebt - validAmount),
        updatedAt: nowIso,
      });

      const payRef = doc(collection(db, 'payments'));
      batch.set(payRef, {
        type: 'debt_repayment',
        amount: validAmount,
        method,
        partyType: 'customer',
        partyId: cust.id,
        partyName: cust.name,
        notes: notes || `ชำระหนี้ค้าง`,
        createdAt: nowIso,
      });

      await batch.commit();
      showToast(`บันทึกการชำระหนี้จำนวน ${validAmount.toLocaleString()} สำเร็จ`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'payments/debt_repayment');
    }
  };

  // Record Income (manual or additional)
  const recordIncome = async (data: {
    title: string;
    amount: number;
    category: IncomeCategory | string;
    categoryName?: string;
    date: string;
    time?: string;
    paymentMethod: 'cash' | 'transfer';
    referenceId?: string;
    note?: string;
    isFromSales?: boolean;
  }) => {
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const docRef = doc(collection(db, 'incomes'));
      const record: Income = {
        id: docRef.id,
        title: data.title.trim(),
        amount: Number(data.amount) || 0,
        category: data.category,
        categoryName: data.categoryName,
        date: data.date || nowIso.split('T')[0],
        time: data.time || currentTimeStr,
        paymentMethod: data.paymentMethod || 'cash',
        referenceId: data.referenceId?.trim() || '',
        note: data.note?.trim() || '',
        isFromSales: data.isFromSales ?? false,
        recordedBy: currentUser?.displayName || 'เจ้าหน้าที่การเงิน',
        createdAt: nowIso,
      };
      await setDoc(docRef, record);
      showToast(`บันทึกรายรับ "${record.title}" สำเร็จ`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'incomes');
      throw err;
    }
  };

  // Record Expense
  const recordExpense = async (data: {
    title: string;
    amount: number;
    category: ExpenseCategory;
    date: string;
    time?: string;
    paymentMethod: 'cash' | 'transfer';
    referenceId?: string;
    note?: string;
    receiptUrl?: string;
  }) => {
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const docRef = doc(collection(db, 'expenses'));
      const record: Expense = {
        id: docRef.id,
        title: data.title.trim(),
        amount: Number(data.amount) || 0,
        category: data.category,
        date: data.date || nowIso.split('T')[0],
        time: data.time || currentTimeStr,
        paymentMethod: data.paymentMethod || 'cash',
        referenceId: data.referenceId?.trim() || '',
        note: data.note?.trim() || '',
        receiptUrl: data.receiptUrl?.trim() || '',
        recordedBy: currentUser?.displayName || 'เจ้าหน้าที่การเงิน',
        createdAt: nowIso,
      };
      await setDoc(docRef, record);
      showToast(`บันทึกรายจ่าย "${record.title}" สำเร็จ`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'expenses');
      throw err;
    }
  };

  // Delete Income (Admin/Owner only)
  const deleteIncome = async (id: string) => {
    if (currentUser?.role !== 'owner' && currentUser?.role !== 'admin') {
      showToast('เฉพาะเจ้าของร้านหรือผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบรายการได้', 'warning');
      return;
    }
    try {
      await deleteDoc(doc(db, 'incomes', id));
      showToast('ลบรายการรายรับเรียบร้อยแล้ว', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `incomes/${id}`);
    }
  };

  // Delete Expense (Admin/Owner only)
  const deleteExpense = async (id: string) => {
    if (currentUser?.role !== 'owner' && currentUser?.role !== 'admin') {
      showToast('เฉพาะเจ้าของร้านหรือผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบรายการได้', 'warning');
      return;
    }
    try {
      await deleteDoc(doc(db, 'expenses', id));
      showToast('ลบรายการรายจ่ายเรียบร้อยแล้ว', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `expenses/${id}`);
    }
  };

  // Record Finance Reset Checkpoint (Admin/Owner only - NEVER DELETES HISTORY)
  const recordFinanceReset = async (reason: string, periodLabel?: string): Promise<FinanceReset> => {
    if (currentUser?.role !== 'owner' && currentUser?.role !== 'admin') {
      throw new Error('เฉพาะสิทธิ์ Admin หรือ เจ้าของร้านเท่านั้นที่สามารถรีเซ็ตรอบบัญชีการเงินได้');
    }
    try {
      const nowIso = new Date().toISOString();
      const activeSales = sales.filter((s) => s.status === 'completed');
      const totalSalesRevenue = activeSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
      const extraIncomes = incomes.reduce((acc, i) => acc + (i.amount || 0), 0);
      const totalIncomeBefore = totalSalesRevenue + extraIncomes;
      const totalExpenseBefore = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
      const netProfitBefore = totalIncomeBefore - totalExpenseBefore;

      const cashSales = activeSales.filter(s => s.paymentMethod === 'cash').reduce((a, s) => a + s.totalAmount, 0);
      const cashIncomes = incomes.filter(i => i.paymentMethod === 'cash').reduce((a, i) => a + i.amount, 0);
      const cashExpenses = expenses.filter(e => e.paymentMethod === 'cash').reduce((a, e) => a + e.amount, 0);
      const cashBalanceBefore = (cashSales + cashIncomes) - cashExpenses;

      const transferSales = activeSales.filter(s => s.paymentMethod === 'transfer').reduce((a, s) => a + s.totalAmount, 0);
      const transferIncomes = incomes.filter(i => i.paymentMethod === 'transfer').reduce((a, i) => a + i.amount, 0);
      const transferExpenses = expenses.filter(e => e.paymentMethod === 'transfer').reduce((a, e) => a + e.amount, 0);
      const transferBalanceBefore = (transferSales + transferIncomes) - transferExpenses;

      const docRef = doc(collection(db, 'finance_resets'));
      const checkpoint: FinanceReset = {
        id: docRef.id,
        resetDate: nowIso,
        resetBy: currentUser?.displayName || 'ผู้ดูแลระบบ (Admin)',
        reason: reason.trim(),
        periodLabel: periodLabel || `รอบการเงิน ณ วันที่ ${nowIso.split('T')[0]}`,
        totalIncomeBefore,
        totalExpenseBefore,
        netProfitBefore,
        totalSalesCountBefore: activeSales.length,
        totalExpensesCountBefore: expenses.length,
        cashBalanceBefore,
        transferBalanceBefore,
        createdAt: nowIso,
      };
      await setDoc(docRef, checkpoint);
      showToast('บันทึกจุดตัดรอบการเงินและสำรองประวัติ (Checkpoint) สำเร็จ', 'success');
      return checkpoint;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'finance_resets');
      throw err;
    }
  };

  const seedDemoData = async () => {
    setLoading(true);
    const res = await checkAndSeedInitialData();
    setLoading(false);
    showToast(res.message, res.seeded ? 'success' : 'info');
  };

  const t = translations[language] || translations.th;

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        language,
        setLanguage,
        t,
        currency,
        setCurrency,
        settings,
        updateSettings,
        products,
        categories,
        customers,
        suppliers,
        sales,
        expenses,
        incomes,
        financeResets,
        transactions,
        users,
        loading,
        isAuthenticated,
        currentUser,
        loginWithEmail,
        loginWithGoogle,
        registerStaff,
        quickLoginAsRole,
        logout,
        resetPassword,
        switchUserRole,
        canAccessTab,
        canViewCosts,
        canManageSettings,
        canManageStaff,
        canVoidSales,
        cart,
        posMode,
        setPosMode,
        selectedCustomer,
        setSelectedCustomer,
        billDiscountPercent,
        setBillDiscountPercent,
        billDiscountAmount,
        setBillDiscountAmount,
        addToCart,
        updateCartItemQty,
        updateCartItemDiscount,
        removeFromCart,
        clearCart,
        cartTotals,
        completeSale,
        voidSale,
        adjustStock,
        receiveSupplierStock,
        recordCustomerDebtPayment,
        recordIncome,
        recordExpense,
        deleteIncome,
        deleteExpense,
        recordFinanceReset,
        seedDemoData,
        toasts,
        showToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
