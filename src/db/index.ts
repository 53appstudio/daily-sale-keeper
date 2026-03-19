import Dexie, { type Table } from 'dexie';

export interface Department {
  id: string;
  name: string;
  defaultTaxCategory: 'standard' | 'reduced' | 'exempt' | 'other';
  sortOrder: number;
  createdAt: string;
}

// 1明細行（商品1点）
export interface SaleItem {
  id: string;
  saleId: string;       // どの会計に属するか
  departmentId: string;
  departmentName: string;
  unitPrice: number;    // 単価（税込）
  quantity: number;     // 個数
  amount: number;       // 小計 = unitPrice × quantity
  taxCategory: 'standard' | 'reduced' | 'exempt' | 'other';
  taxRate: number;
  taxExcludedAmount: number;
  taxAmount: number;
}

// 1顧客=1会計
export interface Sale {
  id: string;
  date: string;         // YYYY-MM-DD
  time: string;         // HH:mm
  subtotal: number;     // 合計（税込）
  totalTax: number;     // 消費税合計
  paymentMethod: 'cash' | 'credit';
  receivedAmount: number;  // 預かり金（現金時）
  changeAmount: number;    // おつり（現金時）
  createdAt: string;
}

export interface TaxRate {
  id: string;
  category: 'standard' | 'reduced' | 'exempt' | 'other';
  rate: number;
  effectiveFrom: string;
  createdAt: string;
}

export interface Setting {
  key: string;
  value: string;
}

class SimpleRegiDB extends Dexie {
  departments!: Table<Department>;
  saleItems!: Table<SaleItem>;
  sales!: Table<Sale>;
  taxRates!: Table<TaxRate>;
  settings!: Table<Setting>;

  constructor() {
    super('SimpleRegiDB');
    this.version(2).stores({
      departments: 'id, name, sortOrder',
      saleItems: 'id, saleId, departmentId',
      sales: 'id, date, createdAt',
      taxRates: 'id, category, effectiveFrom',
      settings: 'key',
    });
  }
}

export const db = new SimpleRegiDB();

// 初期データ（税率）
export async function seedInitialData() {
  const taxCount = await db.taxRates.count();
  if (taxCount === 0) {
    await db.taxRates.bulkAdd([
      { id: crypto.randomUUID(), category: 'standard', rate: 10, effectiveFrom: '2019-10-01', createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), category: 'reduced',  rate: 8,  effectiveFrom: '2019-10-01', createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), category: 'exempt',   rate: 0,  effectiveFrom: '2000-01-01', createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), category: 'other',    rate: 0,  effectiveFrom: '2000-01-01', createdAt: new Date().toISOString() },
    ]);
  }
}
