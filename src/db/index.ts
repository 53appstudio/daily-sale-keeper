import Dexie, { type Table } from 'dexie';

export interface Department {
  id: string;
  name: string;
  defaultTaxCategory: 'standard' | 'reduced' | 'exempt' | 'other';
  sortOrder: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  time: string;
  departmentId: string;
  departmentName: string;
  amount: number;
  taxCategory: 'standard' | 'reduced' | 'exempt' | 'other';
  taxRate: number;
  taxExcludedAmount: number;
  taxAmount: number;
  paymentMethod: 'cash' | 'credit';
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaxRate {
  id: string;
  category: 'standard' | 'reduced' | 'exempt';
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
  transactions!: Table<Transaction>;
  taxRates!: Table<TaxRate>;
  settings!: Table<Setting>;

  constructor() {
    super('SimpleRegiDB');
    this.version(1).stores({
      departments: 'id, name, sortOrder',
      transactions: 'id, date, departmentId, createdAt',
      taxRates: 'id, category, effectiveFrom',
      settings: 'key',
    });
  }
}

export const db = new SimpleRegiDB();

// Seed initial tax rates
export async function seedInitialData() {
  const taxCount = await db.taxRates.count();
  if (taxCount === 0) {
    await db.taxRates.bulkAdd([
      {
        id: crypto.randomUUID(),
        category: 'standard',
        rate: 10,
        effectiveFrom: '2019-10-01',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        category: 'reduced',
        rate: 8,
        effectiveFrom: '2019-10-01',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        category: 'exempt',
        rate: 0,
        effectiveFrom: '2000-01-01',
        createdAt: new Date().toISOString(),
      },
    ]);
  }
}
