import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { db } from '@/db';
import { formatTaxLabel, type TaxCategory } from '@/lib/tax';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Printer, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function JournalPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const storeName = useLiveQuery(
    () => db.settings.get('storeName').then((s) => s?.value ?? ''),
    []
  ) ?? '';

  const transactions = useLiveQuery(
    () => db.transactions.where('date').equals(dateStr).toArray(),
    [dateStr]
  ) ?? [];

  const departments = useLiveQuery(() => db.departments.toArray()) ?? [];

  const sorted = [...transactions].sort((a, b) => a.time.localeCompare(b.time));

  // Department summary
  const deptSummary = new Map<string, { count: number; total: number }>();
  transactions.forEach((tx) => {
    const cur = deptSummary.get(tx.departmentName) ?? { count: 0, total: 0 };
    deptSummary.set(tx.departmentName, { count: cur.count + 1, total: cur.total + tx.amount });
  });

  // Payment method summary
  const cashTotal = transactions.filter((t) => t.paymentMethod === 'cash').reduce((s, t) => s + t.amount, 0);
  const creditTotal = transactions.filter((t) => t.paymentMethod === 'credit').reduce((s, t) => s + t.amount, 0);

  // Tax summary
  const taxSummary = new Map<string, { amount: number; tax: number }>();
  transactions.forEach((tx) => {
    const key = tx.taxCategory;
    const cur = taxSummary.get(key) ?? { amount: 0, tax: 0 };
    taxSummary.set(key, { amount: cur.amount + tx.amount, tax: cur.tax + tx.taxAmount });
  });

  const totalAmount = transactions.reduce((s, t) => s + t.amount, 0);
  const totalTax = transactions.reduce((s, t) => s + t.taxAmount, 0);

  const handlePrint = () => window.print();

  const handleCsvExport = () => {
    const header = '日付,時刻,部門,金額(税込),税区分,税率,税抜金額,消費税額,支払方法,編集済み';
    const rows = sorted.map((tx) =>
      [
        tx.date,
        tx.time,
        tx.departmentName,
        tx.amount,
        tx.taxCategory === 'standard' ? '標準税率' : tx.taxCategory === 'reduced' ? '軽減税率' : '非課税',
        tx.taxRate,
        tx.taxExcludedAmount,
        tx.taxAmount,
        tx.paymentMethod === 'cash' ? '現金' : '掛売',
        tx.isEdited ? '○' : '',
      ].join(',')
    );
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const taxCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = { standard: '標準税率', reduced: '軽減税率', exempt: '非課税' };
    return labels[cat] ?? cat;
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container px-4 py-6">
        <div className="flex items-center gap-4 mb-6 no-print">
          <h2 className="text-xl font-bold">日計ジャーナル</h2>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, 'yyyy-MM-dd')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <Card className="print-area max-w-2xl mx-auto shadow-md">
          <CardContent className="p-6 space-y-6">
            <div className="text-center">
              <p className="text-lg font-bold">{storeName || '店舗名未設定'} 日計ジャーナル</p>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, 'yyyy年M月d日（E）', { locale: ja })}
              </p>
            </div>

            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">この日の取引データはありません</p>
            ) : (
              <>
                {/* Department summary */}
                <div>
                  <h3 className="font-semibold mb-2">■ 部門別集計</h3>
                  <div className="space-y-1 tabular-nums text-sm">
                    {Array.from(deptSummary.entries()).map(([name, data]) => (
                      <div key={name} className="flex justify-between">
                        <span>{name}</span>
                        <span>{data.count}件　¥{data.total.toLocaleString()}</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>合計</span>
                      <span>{transactions.length}件　¥{totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Payment summary */}
                <div>
                  <h3 className="font-semibold mb-2">■ 支払方法別</h3>
                  <div className="space-y-1 tabular-nums text-sm">
                    <div className="flex justify-between"><span>現金</span><span>¥{cashTotal.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>掛売</span><span>¥{creditTotal.toLocaleString()}</span></div>
                  </div>
                </div>

                {/* Tax summary */}
                <div>
                  <h3 className="font-semibold mb-2">■ 消費税集計</h3>
                  <div className="space-y-1 tabular-nums text-sm">
                    {Array.from(taxSummary.entries()).map(([cat, data]) => (
                      <div key={cat} className="flex justify-between">
                        <span>{taxCategoryLabel(cat)}</span>
                        <span>¥{data.amount.toLocaleString()} (税¥{data.tax.toLocaleString()})</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>税込総合計</span><span>¥{totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>うち消費税合計</span><span>¥{totalTax.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Transaction details */}
                <div>
                  <h3 className="font-semibold mb-2">■ 取引明細</h3>
                  <div className="space-y-1 tabular-nums text-sm">
                    {sorted.map((tx) => (
                      <div key={tx.id} className="flex justify-between">
                        <span>
                          {tx.time} {tx.departmentName} ¥{tx.amount.toLocaleString()} {formatTaxLabel(tx.taxCategory, tx.taxRate)} {tx.paymentMethod === 'cash' ? '現金' : '掛売'}
                          {tx.isEdited && ' ✏'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4 mt-6 no-print">
          <Button variant="outline" className="gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> 印刷
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleCsvExport} disabled={transactions.length === 0}>
            <Download className="h-4 w-4" /> CSV出力
          </Button>
        </div>
      </main>
    </div>
  );
}
