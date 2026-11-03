import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  collection,
  doc,
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
import { db, auth, handleFirestoreError, OperationType, testConnection } from '../firebase';
import {
  Product,
  Category,
  Customer,
  Supplier,
  Sale,
  SaleItem,
  Expense,
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
  transactions: InventoryTransaction[];
  users: UserProfile[];
  loading: boolean;

  // Active User / Role
  currentUser: UserProfile;
  switchUserRole: (role: UserRole) => void;

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
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // Cart & POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posMode, setPosMode] = useState<'retail' | 'wholesale'>('retail');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [billDiscountPercent, setBillDiscountPercent] = useState<number>(0);
  const [billDiscountAmount, setBillDiscountAmount] = useState<number>(0);

  // Active User Profile
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: 'user_owner_demo',
    email: 'alaysisomboun@gmail.com',
    displayName: 'เจ้าของร้าน (Owner)',
    role: 'owner',
    status: 'active',
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

  const switchUserRole = (role: UserRole) => {
    const roleNames: Record<UserRole, string> = {
      owner: 'เจ้าของร้าน (Owner)',
      manager: 'ผู้จัดการ (Manager)',
      cashier: 'พนักงานขาย (Cashier)',
    };
    setCurrentUser((prev) => ({
      ...prev,
      role,
      displayName: roleNames[role],
    }));
    showToast(`เปลี่ยนสิทธิ์ผู้ใช้งานเป็น: ${roleNames[role]}`, 'info');
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

    // 6. Sales listener
    const salesQuery = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(500));
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
    const expQuery = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(300));
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

    // 8. Transactions listener
    const txQuery = query(collection(db, 'inventory_transactions'), orderBy('createdAt', 'desc'), limit(300));
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

    // 9. Users listener
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
      cashierId: currentUser.id,
      cashierName: currentUser.displayName,
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
            performedBy: currentUser.displayName,
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
                performedBy: currentUser.displayName,
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
        performedBy: currentUser.displayName,
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
            performedBy: currentUser.displayName,
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
        transactions,
        users,
        loading,
        currentUser,
        switchUserRole,
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
