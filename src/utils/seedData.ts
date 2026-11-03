import {
  collection,
  writeBatch,
  doc,
  getDocs,
  limit,
  query,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Category, Customer, Supplier, Expense, StoreSettings, UserProfile } from '../types/pos';

export const initialCategories: Omit<Category, 'id'>[] = [
  { name: 'เครื่องดื่มและน้ำอัดลม', code: 'BEV', description: 'น้ำเปล่า ชา กาแฟ น้ำอัดลม เบียร์', itemCount: 6 },
  { name: 'ข้าวสารและอาหารแห้ง', code: 'DRY', description: 'ข้าวหอมมะลิ บะหมี่กึ่งสำเร็จรูป ปลากระป๋อง', itemCount: 5 },
  { name: 'ขนมและของขบเคี้ยว', code: 'SNK', description: 'มันฝรั่งทอด บิสกิต ลูกอม ขนมขบเคี้ยว', itemCount: 4 },
  { name: 'ของใช้ในครัวเรือน', code: 'HSE', description: 'น้ำยาล้างจาน ผงซักฟอก สบู่ แชมพู', itemCount: 4 },
  { name: 'เครื่องเขียนและอุปกรณ์', code: 'STA', description: 'สมุด ปากกา เทปกาว กล่องพัสดุ', itemCount: 3 },
];

export const initialProducts: (Omit<Product, 'id'> & { categoryCode: string })[] = [
  {
    sku: 'BEV-001',
    barcode: '8850123000018',
    name: 'น้ำดื่มสิงห์ 600 มล. (แพ็ค 12 ขวด)',
    categoryCode: 'BEV',
    categoryId: '',
    categoryName: 'เครื่องดื่มและน้ำอัดลม',
    unit: 'แพ็ค',
    costPrice: 48,
    retailPrice: 65,
    wholesalePrice: 53,
    wholesaleMinQty: 5,
    stockQty: 85,
    minStockAlert: 15,
    imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80',
    description: 'น้ำดื่มสะอาดบริสุทธิ์ ขนาด 600 มล. แพ็คละ 12 ขวด สำหรับขายปลีกและส่ง',
    isActive: true,
  },
  {
    sku: 'BEV-002',
    barcode: '8850123000025',
    name: 'โค้ก ออริจินัล 325 มล. (ถาด 24 กระป๋อง)',
    categoryCode: 'BEV',
    categoryId: '',
    categoryName: 'เครื่องดื่มและน้ำอัดลม',
    unit: 'ถาด',
    costPrice: 280,
    retailPrice: 360,
    wholesalePrice: 310,
    wholesaleMinQty: 3,
    stockQty: 42,
    minStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80',
    description: 'โค้กกระป๋องยอดนิยม ขนาด 325 มล. บรรจุ 24 กระป๋องต่อถาด',
    isActive: true,
  },
  {
    sku: 'BEV-003',
    barcode: '8850123000032',
    name: 'กาแฟเบอร์ดี้ โรบัสต้า (ลัง 30 กระป๋อง)',
    categoryCode: 'BEV',
    categoryId: '',
    categoryName: 'เครื่องดื่มและน้ำอัดลม',
    unit: 'ลัง',
    costPrice: 360,
    retailPrice: 450,
    wholesalePrice: 395,
    wholesaleMinQty: 2,
    stockQty: 28,
    minStockAlert: 8,
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80',
    description: 'กาแฟปรุงสำเร็จพร้อมดื่ม เข้มข้นกลมกล่อม',
    isActive: true,
  },
  {
    sku: 'DRY-001',
    barcode: '8850123000049',
    name: 'ข้าวหอมมะลิแท้ 100% ตราฉัตรทอง (ถุง 5 กก.)',
    categoryCode: 'DRY',
    categoryId: '',
    categoryName: 'ข้าวสารและอาหารแห้ง',
    unit: 'ถุง',
    costPrice: 195,
    retailPrice: 250,
    wholesalePrice: 215,
    wholesaleMinQty: 10,
    stockQty: 60,
    minStockAlert: 12,
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80',
    description: 'ข้าวหอมมะลิคัดพิเศษ หอม นุ่ม เมล็ดยาวขาวสะอาด',
    isActive: true,
  },
  {
    sku: 'DRY-002',
    barcode: '8850123000056',
    name: 'มาม่า บะหมี่กึ่งสำเร็จรูป รสต้มยำกุ้ง (กล่อง 30 ซอง)',
    categoryCode: 'DRY',
    categoryId: '',
    categoryName: 'ข้าวสารและอาหารแห้ง',
    unit: 'กล่อง',
    costPrice: 165,
    retailPrice: 210,
    wholesalePrice: 180,
    wholesaleMinQty: 5,
    stockQty: 75,
    minStockAlert: 15,
    imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=80',
    description: 'มาม่ารสยอดนิยม ต้มยำกุ้งน้ำข้น บรรจุกล่อง 30 ซอง',
    isActive: true,
  },
  {
    sku: 'DRY-003',
    barcode: '8850123000063',
    name: 'น้ำมันพืช มรกต ปาล์ม 1 ลิตร (ลัง 12 ขวด)',
    categoryCode: 'DRY',
    categoryId: '',
    categoryName: 'ข้าวสารและอาหารแห้ง',
    unit: 'ลัง',
    costPrice: 480,
    retailPrice: 600,
    wholesalePrice: 520,
    wholesaleMinQty: 3,
    stockQty: 18,
    minStockAlert: 6,
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80',
    description: 'น้ำมันปาล์มสำหรับทอด ผัด กรอบ อร่อย ไม่เหม็นหืน',
    isActive: true,
  },
  {
    sku: 'SNK-001',
    barcode: '8850123000070',
    name: 'เลย์ มันฝรั่งแท้ รสคลาสสิค (แพ็ค 6 ซอง)',
    categoryCode: 'SNK',
    categoryId: '',
    categoryName: 'ขนมและของขบเคี้ยว',
    unit: 'แพ็ค',
    costPrice: 110,
    retailPrice: 150,
    wholesalePrice: 125,
    wholesaleMinQty: 4,
    stockQty: 40,
    minStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=80',
    description: 'มันฝรั่งทอดกรอบ รสคลาสสิค แผ่นเรียบ กรอบอร่อย',
    isActive: true,
  },
  {
    sku: 'HSE-001',
    barcode: '8850123000087',
    name: 'น้ำยาล้างจาน ซันไลต์ เลมอน 500 มล. (แพ็ค 3 ถุง)',
    categoryCode: 'HSE',
    categoryId: '',
    categoryName: 'ของใช้ในครัวเรือน',
    unit: 'แพ็ค',
    costPrice: 65,
    retailPrice: 89,
    wholesalePrice: 72,
    wholesaleMinQty: 6,
    stockQty: 50,
    minStockAlert: 12,
    imageUrl: 'https://images.unsplash.com/photo-1585751119414-ef2636f8aede?w=400&auto=format&fit=crop&q=80',
    description: 'ขจัดคราบมัน สะอาด ไร้กลิ่นคาว ชนิดถุงเติมประหยัด',
    isActive: true,
  },
  {
    sku: 'HSE-002',
    barcode: '8850123000094',
    name: 'ผงซักฟอก บรีสเอกเซล คลีนคอมฟอร์ท (ถุง 2.4 กก.)',
    categoryCode: 'HSE',
    categoryId: '',
    categoryName: 'ของใช้ในครัวเรือน',
    unit: 'ถุง',
    costPrice: 145,
    retailPrice: 189,
    wholesalePrice: 160,
    wholesaleMinQty: 4,
    stockQty: 4, // Intentionally low for warning check
    minStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&auto=format&fit=crop&q=80',
    description: 'สูตรเข้มข้น พลังซักเหนือชั้น ซักสะอาด กลิ่นหอมติดทนนาน',
    isActive: true,
  },
  {
    sku: 'STA-001',
    barcode: '8850123000100',
    name: 'เทปกาวปิดกล่อง OPP ใส 2 นิ้ว 100 หลา (แถว 6 ม้วน)',
    categoryCode: 'STA',
    categoryId: '',
    categoryName: 'เครื่องเขียนและอุปกรณ์',
    unit: 'แถว',
    costPrice: 120,
    retailPrice: 175,
    wholesalePrice: 138,
    wholesaleMinQty: 5,
    stockQty: 32,
    minStockAlert: 8,
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
    description: 'เทปใสเนื้อเหนียว กาวแน่น สำหรับแพ็คกล่องพัสดุและใช้งานทั่วไป',
    isActive: true,
  },
];

export const initialCustomers: Omit<Customer, 'id'>[] = [
  {
    name: 'ร้านค้าชำเจ๊พร (ตลาดสดเทศบาล)',
    phone: '081-234-5678',
    type: 'wholesale',
    address: '124 หมู่ 2 ต.ในเมือง อ.เมือง จ.นครพนม',
    totalSpent: 148500,
    orderCount: 18,
    outstandingDebt: 12500,
    creditLimit: 30000,
    notes: 'ลูกค้าขายส่งประจำ ชำระเครดิตทุกวันศุกร์',
  },
  {
    name: 'มินิมาร์ทสมบูรณ์ทรัพย์',
    phone: '089-987-6543',
    type: 'wholesale',
    address: '88/4 ถ.มิตรภาพ ต.หนองหอย อ.เมือง จ.ขอนแก่น',
    totalSpent: 285000,
    orderCount: 32,
    outstandingDebt: 0,
    creditLimit: 50000,
    notes: 'ลูกค้าเกรด A โอนเงินตรงเวลาทุกครั้ง',
  },
  {
    name: 'คุณสมชาย ใจดี',
    phone: '086-555-1234',
    type: 'retail',
    address: '55 ซอย 7 ถนนสุขุมวิท กรุงเทพฯ',
    totalSpent: 4200,
    orderCount: 6,
    outstandingDebt: 0,
    creditLimit: 0,
    notes: 'ลูกค้าประจำบ้านใกล้ร้าน',
  },
  {
    name: 'ร้านขายของชำ บัวหลวงพาณิชย์',
    phone: '084-332-1199',
    type: 'wholesale',
    address: '201 หมู่ 5 ต.ท่าบ่อ อ.ท่าบ่อ จ.หนองคาย',
    totalSpent: 96400,
    orderCount: 12,
    outstandingDebt: 8400,
    creditLimit: 20000,
    notes: 'สั่งซื้อเครื่องดื่มและข้าวสารเป็นประจำ',
  },
];

export const initialSuppliers: Omit<Supplier, 'id'>[] = [
  {
    companyName: 'บริษัท ไทยเบฟเวอเรจ ดิสทริบิวชั่น จำกัด',
    contactPerson: 'คุณธวัชชัย (ฝ่ายขายภาคกลาง)',
    phone: '02-785-5555',
    email: 'contact@thaibev.com',
    address: '14 ถนนวิภาวดีรังสิต แขวงจอมพล เขตจตุจักร กรุงเทพฯ',
    taxId: '0107546000342',
    totalPurchased: 450000,
    outstandingPayable: 25000,
    notes: 'ส่งของทุกวันอังคารและพฤหัสบดี เครดิต 30 วัน',
  },
  {
    companyName: 'บริษัท ซีพี คอนซูเมอร์ โพรดักส์ จำกัด',
    contactPerson: 'คุณรัตนา ประจำศูนย์กระจายสินค้า',
    phone: '02-800-9000',
    email: 'support@cpconsumer.com',
    address: '313 อาคารซี.พี.ทาวเวอร์ ถ.สีลม บางรัก กรุงเทพฯ',
    taxId: '0105531023451',
    totalPurchased: 320000,
    outstandingPayable: 0,
    notes: 'ซัพพลายเออร์ข้าวสารและเครื่องปรุงอาหารแห้ง',
  },
  {
    companyName: 'บริษัท ยูนิลีเวอร์ ไทย เทรดดิ้ง จำกัด',
    contactPerson: 'คุณมานพ สายส่งสินค้าอุปโภค',
    phone: '02-554-2000',
    email: 'orders@unilever.co.th',
    address: '161 ถ.พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ',
    taxId: '0105509004562',
    totalPurchased: 210000,
    outstandingPayable: 15400,
    notes: 'ผงซักฟอก สบู่ น้ำยาล้างจาน ของใช้ในบ้าน',
  },
];

export const initialExpenses: Omit<Expense, 'id'>[] = [
  {
    category: 'rent',
    title: 'ค่าเช่าอาคารร้านค้า ประจำเดือน',
    amount: 18000,
    date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    paymentMethod: 'transfer',
    note: 'โอนเข้าบัญชีเจ้าของอาคาร ธ.กสิกรไทย',
    recordedBy: 'เจ้าของร้าน',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    category: 'electricity',
    title: 'ค่าไฟฟ้าประจำเดือน (การไฟฟ้านครหลวง)',
    amount: 4650,
    date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
    paymentMethod: 'transfer',
    note: 'ค่าไฟตู้แช่เครื่องดื่มและไฟหน้าร้าน',
    recordedBy: 'เจ้าของร้าน',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    category: 'salary',
    title: 'เงินเดือนพนักงานแคชเชียร์และจัดเรียงสินค้า',
    amount: 15000,
    date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    paymentMethod: 'transfer',
    note: 'เงินเดือนงวดสิ้นเดือน',
    recordedBy: 'เจ้าของร้าน',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    category: 'supplies',
    title: 'ซื้อถุงพลาสติกหูหิ้วและม้วนกระดาษความร้อนพิมพ์ใบเสร็จ',
    amount: 1250,
    date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    paymentMethod: 'cash',
    note: 'กระดาษความร้อน 80mm จำนวน 2 ลัง และถุงหิ้วไซส์ใหญ่',
    recordedBy: 'พนักงานขาย',
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

export const defaultSettings: StoreSettings = {
  storeName: 'พีพี ค้าส่ง-ค้าปลีก (PP Wholesale & Retail)',
  tagline: 'ศูนย์รวมสินค้าอุปโภคบริโภค ราคาส่ง-ราคาปลีก ครบวงจร',
  address: '168/9 หมู่ 3 ถนนเศรษฐกิจ ตำบลท่าทราย อำเภอเมือง จังหวัดสมุทรสาคร 74000',
  phone: '089-123-4567, 034-889-990',
  taxId: '0105566012345',
  currency: 'THB',
  currencySymbol: '฿',
  language: 'th',
  taxRatePercent: 7,
  isTaxEnabled: true,
  receiptFooterMessage: 'ขอบพระคุณทุกท่านที่มาอุดหนุน / ยินดีต้อนรับเสมอ',
  lowStockThresholdDefault: 10,
  paperWidth: '80mm',
};

export async function checkAndSeedInitialData(): Promise<{ seeded: boolean; message: string }> {
  try {
    const productsSnap = await getDocs(query(collection(db, 'products'), limit(1)));
    if (!productsSnap.empty) {
      return { seeded: false, message: 'ฐานข้อมูลมีข้อมูลอยู่แล้ว ไม่จำเป็นต้องลงข้อมูลซ้ำ' };
    }

    const batch = writeBatch(db);

    // 1. Settings
    const settingRef = doc(db, 'settings', 'store_config');
    batch.set(settingRef, {
      ...defaultSettings,
      updatedAt: new Date().toISOString(),
    });

    // 2. Categories
    const categoryIdMap: Record<string, string> = {};
    for (const cat of initialCategories) {
      const catRef = doc(collection(db, 'categories'));
      categoryIdMap[cat.code || ''] = catRef.id;
      batch.set(catRef, {
        ...cat,
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Products
    for (const prod of initialProducts) {
      const prodRef = doc(collection(db, 'products'));
      const catId = categoryIdMap[prod.categoryCode] || '';
      batch.set(prodRef, {
        sku: prod.sku,
        barcode: prod.barcode,
        name: prod.name,
        categoryId: catId,
        categoryName: prod.categoryName,
        unit: prod.unit,
        costPrice: prod.costPrice,
        retailPrice: prod.retailPrice,
        wholesalePrice: prod.wholesalePrice,
        wholesaleMinQty: prod.wholesaleMinQty,
        stockQty: prod.stockQty,
        minStockAlert: prod.minStockAlert,
        imageUrl: prod.imageUrl,
        description: prod.description,
        isActive: prod.isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 4. Customers
    for (const cust of initialCustomers) {
      const custRef = doc(collection(db, 'customers'));
      batch.set(custRef, {
        ...cust,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 5. Suppliers
    for (const sup of initialSuppliers) {
      const supRef = doc(collection(db, 'suppliers'));
      batch.set(supRef, {
        ...sup,
        createdAt: new Date().toISOString(),
      });
    }

    // 6. Expenses
    for (const exp of initialExpenses) {
      const expRef = doc(collection(db, 'expenses'));
      batch.set(expRef, exp);
    }

    // 7. Initial Admin User
    const adminUserRef = doc(db, 'users', 'admin_owner');
    batch.set(adminUserRef, {
      email: 'alaysisomboun@gmail.com',
      displayName: 'ผู้จัดการ/เจ้าของร้าน (Owner)',
      role: 'owner',
      phone: '089-123-4567',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await batch.commit();
    return { seeded: true, message: 'ลงข้อมูลตัวอย่าง สินค้า ลูกค้า ซัพพลายเออร์ และการตั้งค่าลง Firestore เรียบร้อยแล้ว!' };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedData');
    return { seeded: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}
