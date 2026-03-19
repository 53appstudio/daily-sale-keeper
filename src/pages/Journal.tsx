import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function JournalPage() {
  const today = new Date().toISOString().split('T')[0];
  const [targetDate, setTargetDate] = useState(today);

  const sales = useLiveQuery(
    () => db.sales.where('date').equals(targetDate).toArray(),
    [targetDate]
  ) ?? [];

  const saleItems = useLiveQuery(
    () => db.saleItems.toArray(),
    []
  ) ?? [];

  // 対象日の明細だけ
  const saleIds = new Set(sales.map(s => s.id));
  const items = saleItems.filter(i => saleIds.has(i.saleId));

  // 集計
  const customerCount = sales.length;
  const totalAmount = sales.reduce((s, x) => s + x.subtotal, 0);
  const totalTax = sales.reduce((s, x) => s + x.totalTax, 0);
  const cashTotal = sales.filter(x => x.paymentMethod === 'cash').reduce((s, x) => s + x.subtotal, 0);
  const creditTotal = sales.filter(x => x.paymentMethod === 'credit').reduce((s, x) => s + x.subtotal, 0);

  // 部門別集計
  const deptMap = new Map<string, { name: string; amount: number; taxAmount: number }>();
  for (const item of items) {
    const existing = deptMap.get(item.departmentId);
    if (existing) {
      existing.amount += item.amount;
      existing.taxAmount += item.taxAmount;
    } else {
      deptMap.set(item.departmentId, {
        name: item.departmentName,
        amount: item.amount,
        taxAmount: item.taxAmount,
      });
    }
  }
  const deptSummary = Array.from(deptMap.values()).sort((a, b) => b.amount - a.amount);

  // 日付移動
  const moveDate = (days: number) => {
    const d = new Date(targetDate);
    d.setDate(d.getDate() + days);
    setTargetDate(d.toISOString().split('T')[0]);
  };

  // 印刷
  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container px-3 py-4 max-w-lg mx-auto">

        {/* 日付ナビ */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="icon" onClick={() => moveDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <div className="text-lg font-bold">{formatDate(targetDate)}</div>
            {targetDate === today && (
              <div className="text-xs text-primary font-medium">本日</div>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={() => moveDate(1)} disabled={targetDate >= today}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {customerCount === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              この日の売上データはありません
            </CardContent>
          </Card>
        ) : (
          <>
            {/* サマリーカード */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <h2 className="font-bold text-base mb-3 text-center">日　計</h2>
                <Separator className="mb-4" />

                {/* 顧客数 */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">顧客数</span>
                  <span className="text-2xl font-bold tabular-nums">{customerCount}<span className="text-base font-normal ml-1">名</span></span>
                </div>

                <Separator className="my-3" />

                {/* 部門別 */}
                <div className="space-y-2 mb-3">
                  <div className="text-sm font-semibold text-muted-foreground mb-1">部門別売上</div>
                  {deptSummary.map(dept => (
                    <div key={dept.name} className="flex justify-between items-center py-1.5 px-3 rounded-md bg-secondary/40">
                      <span className="font-medium">{dept.name}</span>
                      <div className="text-right">
                        <div className="tabular-nums font-semibold">¥{dept.amount.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">税 ¥{dept.taxAmount.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-3" />

                {/* 支払方法別 */}
                <div className="space-y-1 mb-3">
                  <div className="text-sm font-semibold text-muted-foreground mb-1">支払方法別</div>
                  <div className="flex justify-between py-1 px-3">
                    <span className="text-muted-foreground">現金</span>
                    <span className="tabular-nums font-medium">¥{cashTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 px-3">
                    <span className="text-muted-foreground">掛売</span>
                    <span className="tabular-nums font-medium">¥{creditTotal.toLocaleString()}</span>
                  </div>
                </div>

                <Separator className="my-3" />

                {/* 総計 */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-lg font-bold">総　計</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums">¥{totalAmount.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">消費税 ¥{totalTax.toLocaleString()}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 顧客別明細 */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-3 text-muted-foreground">顧客別明細</h3>
                <div className="space-y-3">
                  {sales
                    .slice()
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                    .map((sale, idx) => {
                      const sItems = items.filter(i => i.saleId === sale.id);
                      return (
                        <div key={sale.id} className="border rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-semibold">No.{idx + 1}　{sale.time}</span>
                            <span className="text-xs text-muted-foreground">
                              {sale.paymentMethod === 'cash' ? '現金' : '掛売'}
                            </span>
                          </div>
                          {sItems.map(item => (
                            <div key={item.id} className="flex justify-between text-xs text-muted-foreground pl-2 py-0.5">
                              <span>{item.departmentName}</span>
                              <span className="tabular-nums">¥{item.unitPrice.toLocaleString()} × {item.quantity} = ¥{item.amount.toLocaleString()}</span>
                            </div>
                          ))}
                          <Separator className="my-1.5" />
                          <div className="flex justify-between text-sm font-bold">
                            <span>小計</span>
                            <span className="tabular-nums">¥{sale.subtotal.toLocaleString()}</span>
                          </div>
                          {sale.paymentMethod === 'cash' && sale.changeAmount > 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>おつり</span>
                              <span className="tabular-nums">¥{sale.changeAmount.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            <Button variant="outline" className="w-full gap-2" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              印刷
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
