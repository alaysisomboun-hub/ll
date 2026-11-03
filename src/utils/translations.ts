export type Language = 'lo' | 'th' | 'vi' | 'en';

export interface Translations {
  appName: string;
  appSubtitle: string;
  dashboard: string;
  pos: string;
  products: string;
  inventory: string;
  customers: string;
  suppliers: string;
  expenses: string;
  finance: string;
  reports: string;
  employees: string;
  settings: string;

  // POS
  wholesaleMode: string;
  retailMode: string;
  searchProduct: string;
  allCategories: string;
  cart: string;
  emptyCart: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  costTotal: string;
  estimatedProfit: string;
  pay: string;
  clearCart: string;
  checkout: string;
  paymentMethod: string;
  cash: string;
  transfer: string;
  creditDebt: string;
  amountReceived: string;
  change: string;
  selectCustomer: string;
  walkInCustomer: string;
  outOfStock: string;
  lowStock: string;
  inStock: string;
  applyWholesaleRule: string;

  // Inventory
  stockIn: string;
  stockOut: string;
  stockAdjustment: string;
  transactionHistory: string;
  currentStock: string;
  minAlert: string;
  movementType: string;
  reason: string;
  performedBy: string;

  // Common
  save: string;
  cancel: string;
  edit: string;
  delete: string;
  add: string;
  exportExcel: string;
  printReceipt: string;
  actions: string;
  status: string;
  date: string;
  success: string;
  error: string;
  viewHistory: string;
  confirm: string;
  filter: string;
  today: string;
  thisMonth: string;
  owner: string;
  manager: string;
  cashier: string;
}

export const translations: Record<Language, Translations> = {
  th: {
    appName: 'POS ขายส่งและขายปลีก',
    appSubtitle: 'Wholesale & Retail Management System',
    dashboard: 'แดชบอร์ดภาพรวม',
    pos: 'ระบบขาย (POS)',
    products: 'จัดการสินค้า',
    inventory: 'คลังสินค้า',
    customers: 'จัดการลูกค้า',
    suppliers: 'ผู้จำหน่าย/คู่ค้า',
    expenses: 'บันทึกรายจ่าย',
    finance: 'การเงินและบัญชี',
    reports: 'รายงานสรุปผล',
    employees: 'จัดการพนักงาน',
    settings: 'ตั้งค่าระบบ',

    wholesaleMode: 'โหมดขายส่ง (Wholesale)',
    retailMode: 'โหมดขายปลีก (Retail)',
    searchProduct: 'ค้นหาด้วยชื่อ, รหัส SKU หรือ บาร์โค้ด...',
    allCategories: 'ทุกหมวดหมู่',
    cart: 'รายการในตะกร้า',
    emptyCart: 'ยังไม่มีสินค้าในตะกร้า',
    subtotal: 'ยอดรวมสินค้า',
    discount: 'ส่วนลด',
    tax: 'ภาษี (VAT)',
    total: 'ยอดสุทธิที่ต้องชำระ',
    costTotal: 'ต้นทุนรวม',
    estimatedProfit: 'กำไรจากการขายบิลนี้',
    pay: 'ชำระเงิน',
    clearCart: 'ล้างตะกร้า',
    checkout: 'คิดเงิน / พิมพ์ใบเสร็จ',
    paymentMethod: 'วิธีชำระเงิน',
    cash: 'เงินสด',
    transfer: 'โอนเงิน / สแกน QR',
    creditDebt: 'ค้างชำระ / ติดหนี้',
    amountReceived: 'รับเงินมา',
    change: 'เงินทอน',
    selectCustomer: 'เลือกลูกค้า',
    walkInCustomer: 'ลูกค้าทั่วไป (Walk-in)',
    outOfStock: 'สินค้าหมดสต็อก',
    lowStock: 'สินค้าใกล้หมด',
    inStock: 'มีสินค้าในคลัง',
    applyWholesaleRule: 'ใช้ราคาส่งเมื่อซื้อครบจำนวน',

    stockIn: 'รับสินค้าเข้าคลัง',
    stockOut: 'เบิกสินค้าออก',
    stockAdjustment: 'ตรวจนับ/ปรับยอดสต็อก',
    transactionHistory: 'ประวัติการเคลื่อนไหวสต็อก',
    currentStock: 'คงเหลือในสต็อก',
    minAlert: 'จุดแจ้งเตือนขั้นต่ำ',
    movementType: 'ประเภทรายการ',
    reason: 'เหตุผล / หมายเหตุ',
    performedBy: 'ผู้ทำรายการ',

    save: 'บันทึกข้อมูล',
    cancel: 'ยกเลิก',
    edit: 'แก้ไข',
    delete: 'ลบ',
    add: 'เพิ่มข้อมูลใหม่',
    exportExcel: 'ส่งออก Excel',
    printReceipt: 'พิมพ์ใบเสร็จ',
    actions: 'จัดการ',
    status: 'สถานะ',
    date: 'วันที่และเวลา',
    success: 'ทำรายการสำเร็จ',
    error: 'เกิดข้อผิดพลาด',
    viewHistory: 'ดูประวัติ',
    confirm: 'ยืนยัน',
    filter: 'ตัวกรอง',
    today: 'วันนี้',
    thisMonth: 'เดือนนี้',
    owner: 'เจ้าของร้าน (Owner)',
    manager: 'ผู้จัดการ (Manager)',
    cashier: 'พนักงานขาย (Cashier)',
  },
  lo: {
    appName: 'POS ຂາຍສົ່ງ ແລະ ຂາຍຍ່ອຍ',
    appSubtitle: 'Wholesale & Retail Management System',
    dashboard: 'ໜ້າພາບລວມ',
    pos: 'ລະບົບຂາຍ (POS)',
    products: 'ຈັດການສິນຄ້າ',
    inventory: 'ສາງສິນຄ້າ',
    customers: 'ຈັດການລູກຄ້າ',
    suppliers: 'ຜູ້ສະໜອງສິນຄ້າ',
    expenses: 'ລາຍຈ່າຍ',
    finance: 'ການເງິນ ແລະ ບັນຊີ',
    reports: 'ລາຍງານ',
    employees: 'ພະນັກງານ',
    settings: 'ຕັ້ງຄ່າລະບົບ',

    wholesaleMode: 'ໂໝດຂາຍສົ່ງ (Wholesale)',
    retailMode: 'ໂໝດຂາຍຍ່ອຍ (Retail)',
    searchProduct: 'ຄົ້ນຫາຊື່, ລະຫັດ ຫຼື ບາໂຄ້ດ...',
    allCategories: 'ໝວດໝູ່ທັງໝົດ',
    cart: 'ກະຕ່າສິນຄ້າ',
    emptyCart: 'ບໍ່ມີສິນຄ້າໃນກະຕ່າ',
    subtotal: 'ຍອດລວມສິນຄ້າ',
    discount: 'ສ່ວນຫຼຸດ',
    tax: 'ອາກອນ (VAT)',
    total: 'ຍອດລວມສຸດທິ',
    costTotal: 'ຕົ້ນທຶນລວມ',
    estimatedProfit: 'ກຳໄລຂອງບິນນີ້',
    pay: 'ຊຳລະເງິນ',
    clearCart: 'ລ້າງກະຕ່າ',
    checkout: 'ຄິດໄລ່ເງິນ / ພິມໃບບິນ',
    paymentMethod: 'ວິທີຊຳລະເງິນ',
    cash: 'ເງິນສົດ',
    transfer: 'ໂອນເງິນ / QR',
    creditDebt: 'ຕິດໜີ້ / ຄ້າງຊຳລະ',
    amountReceived: 'ຮັບເງິນມາ',
    change: 'ເງິນທອນ',
    selectCustomer: 'ເລືອກລູກຄ້າ',
    walkInCustomer: 'ລູກຄ້າທົ່ວໄປ (Walk-in)',
    outOfStock: 'ສິນຄ້າໝົດສາງ',
    lowStock: 'ສິນຄ້າໃກ້ໝົດ',
    inStock: 'ມີສິນຄ້າພ້ອມຂາຍ',
    applyWholesaleRule: 'ປັບລາຄາສົ່ງເມື່ອຄົບຈຳນວນ',

    stockIn: 'ຮັບສິນຄ້າເຂົ້າສາງ',
    stockOut: 'ເບີກສິນຄ້າອອກ',
    stockAdjustment: 'ກວດນັບ / ປັບຍອດສາງ',
    transactionHistory: 'ປະຫວັດການເຄື່ອນໄຫວສາງ',
    currentStock: 'ຄົງເຫຼືອໃນສາງ',
    minAlert: 'ແຈ້ງເຕືອນຂັ້ນຕ່ຳ',
    movementType: 'ປະເພດລາຍການ',
    reason: 'ເຫດຜົນ',
    performedBy: 'ຜູ້ເຮັດລາຍການ',

    save: 'ບັນທຶກ',
    cancel: 'ຍົກເລີກ',
    edit: 'ແກ້ໄຂ',
    delete: 'ລຶບ',
    add: 'ເພີ່ມໃໝ່',
    exportExcel: 'ສົ່ງອອກ Excel',
    printReceipt: 'ພິມໃບບິນ',
    actions: 'ຈັດການ',
    status: 'ສະຖານະ',
    date: 'ວັນທີ ແລະ ເວລາ',
    success: 'ສຳເລັດ',
    error: 'ເກີດຂໍ້ຜິດພາດ',
    viewHistory: 'ເບິ່ງປະຫວັດ',
    confirm: 'ຢືນຢັນ',
    filter: 'ຕົວກັ່ນຕອງ',
    today: 'ມື້ນີ້',
    thisMonth: 'ເດືອນນີ້',
    owner: 'ເຈົ້າຂອງຮ້ານ (Owner)',
    manager: 'ຜູ້ຈັດການ (Manager)',
    cashier: 'ພະນັກງານຂາຍ (Cashier)',
  },
  vi: {
    appName: 'POS Quản Lý Bán Sỉ & Bán Lẻ',
    appSubtitle: 'Hệ thống Quản lý Bán hàng Chuyên nghiệp',
    dashboard: 'Tổng quan',
    pos: 'Điểm bán hàng (POS)',
    products: 'Quản lý Sản phẩm',
    inventory: 'Kho hàng',
    customers: 'Khách hàng',
    suppliers: 'Nhà cung cấp',
    expenses: 'Sổ Chi tiêu',
    finance: 'Tài chính & Lợi nhuận',
    reports: 'Báo cáo Thống kê',
    employees: 'Nhân viên',
    settings: 'Cài đặt Hệ thống',

    wholesaleMode: 'Chế độ Bán sỉ',
    retailMode: 'Chế độ Bán lẻ',
    searchProduct: 'Tìm kiếm tên, SKU, mã vạch...',
    allCategories: 'Tất cả danh mục',
    cart: 'Giỏ hàng',
    emptyCart: 'Chưa có sản phẩm trong giỏ',
    subtotal: 'Tổng tiền hàng',
    discount: 'Chiết khấu/Giảm giá',
    tax: 'Thuế (VAT)',
    total: 'Khách phải trả',
    costTotal: 'Tổng giá vốn',
    estimatedProfit: 'Lợi nhuận đơn này',
    pay: 'Thanh toán',
    clearCart: 'Làm rỗng giỏ',
    checkout: 'Thanh toán & In hóa đơn',
    paymentMethod: 'Phương thức thanh toán',
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản / Quét mã',
    creditDebt: 'Ghi nợ / Trả sau',
    amountReceived: 'Tiền khách đưa',
    change: 'Tiền thừa thối lại',
    selectCustomer: 'Chọn khách hàng',
    walkInCustomer: 'Khách vãng lai',
    outOfStock: 'Hết hàng',
    lowStock: 'Sắp hết hàng',
    inStock: 'Còn hàng trong kho',
    applyWholesaleRule: 'Áp dụng giá sỉ khi đủ số lượng',

    stockIn: 'Nhập kho hàng',
    stockOut: 'Xuất kho nội bộ',
    stockAdjustment: 'Kiểm kê / Cân bằng kho',
    transactionHistory: 'Lịch sử xuất nhập tồn',
    currentStock: 'Tồn kho hiện tại',
    minAlert: 'Mức báo tồn tối thiểu',
    movementType: 'Loại nghiệp vụ',
    reason: 'Lý do / Ghi chú',
    performedBy: 'Người thực hiện',

    save: 'Lưu thay đổi',
    cancel: 'Hủy bỏ',
    edit: 'Chỉnh sửa',
    delete: 'Xóa',
    add: 'Thêm mới',
    exportExcel: 'Xuất file Excel',
    printReceipt: 'In hóa đơn',
    actions: 'Thao tác',
    status: 'Trạng thái',
    date: 'Ngày giờ',
    success: 'Thành công',
    error: 'Có lỗi xảy ra',
    viewHistory: 'Xem lịch sử',
    confirm: 'Xác nhận',
    filter: 'Bộ lọc',
    today: 'Hôm nay',
    thisMonth: 'Tháng này',
    owner: 'Chủ cửa hàng (Owner)',
    manager: 'Quản lý (Manager)',
    cashier: 'Nhân viên thu ngân (Cashier)',
  },
  en: {
    appName: 'Wholesale & Retail POS',
    appSubtitle: 'Point of Sale & Inventory Management',
    dashboard: 'Dashboard',
    pos: 'POS Terminal',
    products: 'Products',
    inventory: 'Inventory & Stock',
    customers: 'Customers',
    suppliers: 'Suppliers',
    expenses: 'Expenses',
    finance: 'Finance & P&L',
    reports: 'Reports & Analytics',
    employees: 'Staff & Roles',
    settings: 'Settings',

    wholesaleMode: 'Wholesale Mode',
    retailMode: 'Retail Mode',
    searchProduct: 'Search by name, SKU or barcode...',
    allCategories: 'All Categories',
    cart: 'Shopping Cart',
    emptyCart: 'Cart is empty',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax (VAT)',
    total: 'Grand Total',
    costTotal: 'Total Cost',
    estimatedProfit: 'Estimated Profit',
    pay: 'Pay Now',
    clearCart: 'Clear Cart',
    checkout: 'Checkout / Print Receipt',
    paymentMethod: 'Payment Method',
    cash: 'Cash',
    transfer: 'Bank Transfer / QR',
    creditDebt: 'Customer Credit / Debt',
    amountReceived: 'Cash Received',
    change: 'Change Due',
    selectCustomer: 'Select Customer',
    walkInCustomer: 'Walk-in Customer',
    outOfStock: 'Out of Stock',
    lowStock: 'Low Stock Alert',
    inStock: 'In Stock',
    applyWholesaleRule: 'Auto wholesale pricing by quantity',

    stockIn: 'Receive Stock',
    stockOut: 'Issue Stock Out',
    stockAdjustment: 'Stock Audit / Adjustment',
    transactionHistory: 'Inventory Movement Logs',
    currentStock: 'Current Stock',
    minAlert: 'Min Stock Alert',
    movementType: 'Movement Type',
    reason: 'Reason / Note',
    performedBy: 'User',

    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    add: 'Add New',
    exportExcel: 'Export Excel',
    printReceipt: 'Print Receipt',
    actions: 'Actions',
    status: 'Status',
    date: 'Date & Time',
    success: 'Success',
    error: 'Error occurred',
    viewHistory: 'History',
    confirm: 'Confirm',
    filter: 'Filter',
    today: 'Today',
    thisMonth: 'This Month',
    owner: 'Store Owner',
    manager: 'Store Manager',
    cashier: 'Cashier',
  },
};
