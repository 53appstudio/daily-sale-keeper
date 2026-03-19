import Dexie, { type Table } from 'dexie';
import type { TaxMode } from '@/lib/tax';

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
  saleId: string;
  departmentId: string;
  departmentName: string;
  unitPrice: number;      // 入力単価（内税モード=税込単価、外税モード=税抜単価）
  quantity: number;
  netAmount: number;      // 税抜小計
  taxAmount: number;      // 消費税額
  grossAmount: number;    // 税込小計（請求額）
  taxCategory: 'standard' | 'reduced' | 'exempt' | 'other';
  taxRate: number;
  taxMode: TaxMode;       // 'inclusive'=内税 | 'exclusive'=外税
}

// 1顧客=1会計
export interface Sale {
  id: string;
  date: string;
  time: string;
  netTotal: number;       // 税抜合計
  taxTotal: number;       // 消費税合計
  grossTotal: number;     // 税込合計（請求額）
  taxMode: TaxMode;       // この会計時点のモード
  paymentMethod: 'cash' | 'credit';
  receivedAmount: number;
  changeAmount: number;
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

// 修正・削除履歴ログ
export interface AuditLog {
  id: string;
  action: 'edit' | 'delete';   // 'edit'=修正, 'delete'=削除
  saleId: string;               // 対象会計ID
  saleDate: string;             // 対象会計の日付
  saleTime: string;             // 対象会計の時刻
  beforeSnapshot: string;       // 修正前のJSON（Sale + SaleItems）
  afterSnapshot: string;        // 修正後のJSON（削除時は空文字）
  operator: string;             // 操作者（将来拡張用、現在は'システム'）
  createdAt: string;            // 操作日時
}

class SimpleRegiDB extends Dexie {
  departments!: Table<Department>;
  saleItems!: Table<SaleItem>;
  sales!: Table<Sale>;
  taxRates!: Table<TaxRate>;
  settings!: Table<Setting>;
  auditLogs!: Table<AuditLog>;

  constructor() {
    super('SimpleRegiDB');
    // version 2 → 既存スキーマ（後方互換のため残す）
    this.version(2).stores({
      departments: 'id, name, sortOrder',
      saleItems: 'id, saleId, departmentId',
      sales: 'id, date, createdAt',
      taxRates: 'id, category, effectiveFrom',
      settings: 'key',
    });
    // version 3 → taxMode フィールド追加
    this.version(3).stores({
      departments: 'id, name, sortOrder',
      saleItems: 'id, saleId, departmentId',
      sales: 'id, date, createdAt',
      taxRates: 'id, category, effectiveFrom',
      settings: 'key',
    });
    // version 4 → auditLogs テーブル追加
    this.version(4).stores({
      departments: 'id, name, sortOrder',
      saleItems: 'id, saleId, departmentId',
      sales: 'id, date, createdAt',
      taxRates: 'id, category, effectiveFrom',
      settings: 'key',
      auditLogs: 'id, saleId, saleDate, createdAt',
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
