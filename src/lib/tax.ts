import { db, type TaxRate } from '@/db';

export type TaxCategory = 'standard' | 'reduced' | 'exempt' | 'other';

export const TAX_CATEGORY_LABELS: Record<TaxCategory, string> = {
  standard: '標準税率',
  reduced: '軽減税率',
  exempt: '非課税',
  other: 'その他',
};

export const TAX_CATEGORY_SHORT: Record<TaxCategory, string> = {
  standard: '10%',
  reduced: '8%(軽減)',
  exempt: '非課税',
  other: 'その他',
};

/**
 * Get the effective tax rate for a category on a given date.
 */
export async function getEffectiveTaxRate(
  category: TaxCategory,
  date: string
): Promise<number> {
  if (category === 'exempt') return 0;

  const rates = await db.taxRates
    .where('category')
    .equals(category)
    .toArray();

  const effective = rates
    .filter((r) => r.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  return effective.length > 0 ? effective[0].rate : category === 'standard' ? 10 : category === 'reduced' ? 8 : 0;
}

/**
 * Get current tax rates (for today).
 */
export async function getCurrentTaxRates(): Promise<Record<TaxCategory, number>> {
  const today = new Date().toISOString().split('T')[0];
  const [standard, reduced] = await Promise.all([
    getEffectiveTaxRate('standard', today),
    getEffectiveTaxRate('reduced', today),
  ]);
  return { standard, reduced, exempt: 0 };
}

/**
 * Calculate tax breakdown from tax-inclusive amount.
 * Tax-excluded amount is ceil'd, tax amount is floor'd (industry convention).
 */
export function calculateTax(amountIncTax: number, taxRate: number) {
  if (taxRate === 0) {
    return { taxExcludedAmount: amountIncTax, taxAmount: 0 };
  }
  const taxExcludedAmount = Math.ceil(amountIncTax / (1 + taxRate / 100));
  const taxAmount = amountIncTax - taxExcludedAmount;
  return { taxExcludedAmount, taxAmount };
}

/**
 * Format tax category display with current rate.
 */
export function formatTaxLabel(category: TaxCategory, rate: number): string {
  if (category === 'exempt') return '非課税';
  if (category === 'reduced') return `${rate}%(軽減)`;
  return `${rate}%`;
}
