import { db } from '@/db';

export type TaxCategory = 'standard' | 'reduced' | 'exempt' | 'other';
export type TaxMode = 'inclusive' | 'exclusive'; // 内税 | 外税

export const TAX_CATEGORY_LABELS: Record<TaxCategory, string> = {
  standard: '標準税率',
  reduced:  '軽減税率',
  exempt:   '非課税',
  other:    'その他',
};

/** DBから有効な税率を取得 */
export async function getEffectiveTaxRate(
  category: TaxCategory,
  date: string
): Promise<number> {
  if (category === 'exempt') return 0;
  const rates = await db.taxRates.where('category').equals(category).toArray();
  const effective = rates
    .filter(r => r.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return effective.length > 0
    ? effective[0].rate
    : category === 'standard' ? 10 : category === 'reduced' ? 8 : 0;
}

/**
 * 税計算のコア
 *
 * 【内税モード (inclusive)】
 *   入力値 = 税込金額
 *   税抜  = ceil(税込 / (1 + rate/100))
 *   税額  = 税込 - 税抜
 *   請求額 = 税込（変わらない）
 *
 * 【外税モード (exclusive)】
 *   入力値 = 税抜金額
 *   税額  = floor(税抜 × rate/100)  ※切り捨て（一般的な外税計算）
 *   税込  = 税抜 + 税額
 *   請求額 = 税込
 *
 * 戻り値は常に { netAmount, taxAmount, grossAmount } の3点セット
 *   netAmount   = 税抜金額
 *   taxAmount   = 消費税額
 *   grossAmount = 税込金額（= 請求金額）
 */
export function calcTax(
  inputAmount: number,
  taxRate: number,
  taxMode: TaxMode
): { netAmount: number; taxAmount: number; grossAmount: number } {
  if (taxRate === 0) {
    return { netAmount: inputAmount, taxAmount: 0, grossAmount: inputAmount };
  }

  if (taxMode === 'inclusive') {
    // 内税：入力 = 税込
    const netAmount   = Math.ceil(inputAmount / (1 + taxRate / 100));
    const taxAmount   = inputAmount - netAmount;
    return { netAmount, taxAmount, grossAmount: inputAmount };
  } else {
    // 外税：入力 = 税抜
    const taxAmount   = Math.floor(inputAmount * taxRate / 100);
    const grossAmount = inputAmount + taxAmount;
    return { netAmount: inputAmount, taxAmount, grossAmount };
  }
}

/** 単価×個数をまとめて計算（内税/外税対応） */
export function calcLineTotal(
  unitPrice: number,
  quantity: number,
  taxRate: number,
  taxMode: TaxMode
): { netAmount: number; taxAmount: number; grossAmount: number } {
  // 内税: 単価×個数してから税計算（端数は合計で1回）
  // 外税: 単価×個数してから税計算
  return calcTax(unitPrice * quantity, taxRate, taxMode);
}

/** 設定からtaxModeを読み込む */
export async function getTaxMode(): Promise<TaxMode> {
  const s = await db.settings.get('taxMode');
  return (s?.value === 'exclusive') ? 'exclusive' : 'inclusive';
}

/** 税表示ラベル */
export function taxModeLabel(mode: TaxMode): string {
  return mode === 'inclusive' ? '内税' : '外税';
}

export function formatTaxLabel(category: TaxCategory, rate: number, mode: TaxMode): string {
  const modeStr = taxModeLabel(mode);
  if (category === 'exempt') return '非課税';
  if (category === 'reduced') return `${rate}%軽減(${modeStr})`;
  if (category === 'other')   return `${rate}%(${modeStr})`;
  return `${rate}%(${modeStr})`;
}
