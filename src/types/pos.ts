export type UserRole = 'owner' | 'admin' | 'manager' | 'staff' | 'cashier';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  status: 'active' | 'suspended';
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  code?: string;
  description?: string;
  itemCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  unit: string;
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  wholesaleMinQty: number; // Quantity needed to automatically apply wholesale price
  stockQty: number;
  minStockAlert: number;
  imageUrl?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  priceTier: 'retail' | 'wholesale' | 'custom';
  unitPrice: number;
  discount: number;
  totalPrice: number;
  totalCost: number;
  profit: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName?: string;
  customerType?: 'retail' | 'wholesale';
  saleType: 'retail' | 'wholesale';
  cashierId: string;
  cashierName: string;
  subtotal: number;
  discountAmount: number;
  discountPercent?: number;
  taxAmount: number;
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  paymentMethod: 'cash' | 'transfer' | 'credit' | 'mixed';
  amountPaid: number;
  changeGiven: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  debtAmount: number;
  status: 'completed' | 'voided' | 'refunded';
  voidReason?: string;
  itemCount: number;
  notes?: string;
  createdAt: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id?: string;
  saleId: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  costPrice: number;
  unitPrice: number;
  priceTier: 'retail' | 'wholesale' | 'custom';
  discount: number;
  totalPrice: number;
  totalCost: number;
  profit: number;
  createdAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: 'retail' | 'wholesale';
  address?: string;
  totalSpent: number;
  orderCount: number;
  outstandingDebt: number;
  creditLimit?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  companyName: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  taxId?: string;
  totalPurchased: number;
  outstandingPayable: number;
  notes?: string;
  createdAt?: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  costPrice: number;
  totalCost: number;
}

export interface Purchase {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  status: 'received' | 'ordered' | 'cancelled';
  itemCount: number;
  items?: PurchaseItem[];
  receivedDate: string;
  notes?: string;
  createdAt: string;
}

export type InventoryTransactionType = 'in' | 'out' | 'sale' | 'void_return' | 'adjustment';

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: InventoryTransactionType;
  quantityChange: number; // positive or negative
  previousStock: number;
  newStock: number;
  referenceId?: string; // invoice or PO or adjustment note
  reason: string;
  performedBy: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'rent'
  | 'electricity'
  | 'water'
  | 'salary'
  | 'transport'
  | 'supplies'
  | 'maintenance'
  | 'other';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  paymentMethod: 'cash' | 'transfer';
  referenceId?: string;
  note?: string;
  receiptUrl?: string;
  recordedBy: string;
  createdAt: string;
}

export type IncomeCategory =
  | 'sales'
  | 'debt_collection'
  | 'service'
  | 'interest'
  | 'other';

export interface Income {
  id: string;
  category: IncomeCategory | string;
  categoryName?: string;
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  paymentMethod: 'cash' | 'transfer';
  referenceId?: string;
  recordedBy: string;
  note?: string;
  isFromSales?: boolean;
  createdAt: string;
}

export interface FinanceReset {
  id: string;
  resetDate: string;
  resetBy: string;
  reason: string;
  periodLabel?: string;
  totalIncomeBefore: number;
  totalExpenseBefore: number;
  netProfitBefore: number;
  totalSalesCountBefore: number;
  totalExpensesCountBefore: number;
  cashBalanceBefore: number;
  transferBalanceBefore: number;
  createdAt: string;
}

export interface Debt {
  id: string;
  partyType: 'customer' | 'supplier';
  partyId: string;
  partyName: string;
  invoiceOrPoNumber: string;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  status: 'unpaid' | 'partial' | 'cleared';
  createdAt: string;
  updatedAt?: string;
}

export interface PaymentRecord {
  id: string;
  type: 'sale' | 'debt_repayment' | 'supplier_payable' | 'expense';
  amount: number;
  method: 'cash' | 'transfer';
  referenceId?: string;
  partyType?: 'customer' | 'supplier' | 'store';
  partyId?: string;
  partyName?: string;
  notes?: string;
  createdAt: string;
}

export interface StoreSettings {
  id?: string;
  storeName: string;
  tagline: string;
  address: string;
  phone: string;
  taxId?: string;
  currency: 'LAK' | 'THB' | 'USD';
  currencySymbol: string;
  language: 'lo' | 'th' | 'vi' | 'en';
  taxRatePercent: number;
  isTaxEnabled: boolean;
  receiptFooterMessage: string;
  lowStockThresholdDefault: number;
  paperWidth: '58mm' | '80mm';
  staffInviteCode?: string;
  updatedAt?: string;
}
