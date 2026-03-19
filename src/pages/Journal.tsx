import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Sale, type SaleItem } from '@/db';
import { AppHeader } from '@/components/AppHeader';
import { EditSaleModal } from '@/components/EditSaleModal';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Printer, Pencil } from 'lucide-react';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function JournalPage() {
  const today = new Date().toISOString().split('T')[0];
  const [targetDate, setTargetDate] = useState(today);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const sales = useLiveQuery(
    () => db.sales.where('date').equals(targetDate).toArray(),
    [targetDate]
  ) ?? [];

  // 対象日の明細のみ取得（全件取得しない）
  const saleIds = new Set(sales.map(s => s.id));
  const items = useLiveQuery(
    async () => {
      if (saleIds.size === 0) return [];
      const all = await db.saleItems.toArray();
      return all.filter(i => saleIds.has(i.saleId));
    },
    [targetDate, sales.length]
  ) ?? [];

  // 編集モーダル用の明細（クリックした sale の id で取得）
  const editingItems = useLiveQuery(
    async () => {
      if (!editingSale?.id) return [];
      return db.saleItems.where('saleId').equals(editingSale.id).toArray();
    },
    [editingSale?.id]
  ) ?? [];

  // --- 集計（grossTotal/taxTotal フィールドを使用）---
  const customerCount = sales.length;
  const grossTotal  = sales.reduce((s, x) => s + (x.grossTotal ?? 0), 0);
  const taxTotal    = sales.reduce((s, x) => s + (x.taxTotal  ?? 0), 0);
  const cashTotal   = sales.filter(x => x.paymentMethod === 'cash').reduce((s, x) => s + (x.grossTotal ?? 0), 0);
  const creditTotal = sales.filter(x => x.paymentMethod === 'credit').reduce((s, x) => s + (x.grossTotal ?? 0), 0);

  // 部門別集計
  const deptMap = new Map<string, { name: string; grossAmount: number; taxAmount: number }>();
  for (const item of items) {
    const key = item.departmentId || item.departmentName;
    const existing = deptMap.get(key);
    const gross = item.grossAmount ?? item.unitPrice * item.quantity; // 旧データ互換
    const tax   = item.taxAmount ?? 0;
    if (existing) {
      existing.grossAmount += gross;
      existing.taxAmount   += tax;
    } else {
      deptMap.set(key, { name: item.departmentName, grossAmount: gross, taxAmount: tax });
    }
  }
  const deptSummary = Array.from(deptMap.values()).sort((a, b) => b.grossAmount - a.grossAmount);

  const moveDate = (days: number) => {
    const d = new Date(targetDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setTargetDate(d.toISOString().split('T')[0]);
  };

  const sortedSales = [...sales].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

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
            {targetDate === today && <div className="text-xs text-primary font-medium">本日</div>}
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
            {/* 日計サマリー */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <h2 className="font-bold text-base mb-3 text-center">日　計</h2>
                <Separator className="mb-4" />

                {/* 顧客数 */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">顧客数</span>
                  <span className="text-2xl font-bold tabular-nums">
                    {customerCount}<span className="text-base font-normal ml-1">名</span>
                  </span>
                </div>

                <Separator className="my-3" />

                {/* 部門別 */}
                <div className="space-y-2 mb-3">
                  <div className="text-sm font-semibold text-muted-foreground mb-1">部門別売上</div>
                  {deptSummary.map(dept => (
                    <div key={dept.name} className="flex justify-between items-center py-1.5 px-3 rounded-md bg-secondary/40">
                      <span className="font-medium">{dept.name}</span>
                      <div className="text-right">
                        <div className="tabular-nums font-semibold">¥{dept.grossAmount.toLocaleString()}</div>
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
                    <div className="text-2xl font-bold tabular-nums">¥{grossTotal.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">消費税 ¥{taxTotal.toLocaleString()}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 顧客別明細 */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">顧客別明細</h3>
                  <span className="text-xs text-muted-foreground">✏ 行をタップで編集</span>
                </div>
                <div className="space-y-3">
                  {sortedSales.map((sale, idx) => {
                    const sItems = items.filter(i => i.saleId === sale.id);
                    const sGross = sale.grossTotal ?? 0;
                    return (
                      <div key={sale.id} className="border rounded-lg overflow-hidden">
                        {/* ヘッダー行 */}
                        <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
                          <span className="text-sm font-semibold">
                            No.{idx + 1}　{sale.time}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {sale.paymentMethod === 'cash' ? '現金' : '掛売'}
                            </span>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-primary"
                              onClick={() => setEditingSale(sale)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {/* 明細行 */}
                        <div className="px-3 py-2 space-y-0.5">
                          {sItems.map(item => {
                            const gross = item.grossAmount ?? item.unitPrice * item.quantity;
                            const tax   = item.taxAmount ?? 0;
                            return (
                              <div key={item.id} className="flex justify-between text-xs text-muted-foreground py-0.5">
                                <span>{item.departmentName}</span>
                                <span className="tabular-nums">
                                  ¥{item.unitPrice.toLocaleString()} × {item.quantity} = ¥{gross.toLocaleString()}
                                  {tax > 0 && <span className="ml-1">(税¥{tax.toLocaleString()})</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {/* フッター */}
                        <div className="px-3 py-2 border-t">
                          <div className="flex justify-between text-sm font-bold">
                            <span>小計</span>
                            <span className="tabular-nums">¥{sGross.toLocaleString()}</span>
                          </div>
                          {sale.paymentMethod === 'cash' && sale.changeAmount > 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>おつり</span>
                              <span className="tabular-nums">¥{sale.changeAmount.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Button variant="outline" className="w-full gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />印刷
            </Button>
          </>
        )}
      </main>

      {/* 編集モーダル */}
      <EditSaleModal
        sale={editingSale}
        items={editingItems}
        open={!!editingSale}
        onClose={() => setEditingSale(null)}
      />
    </div>
  );
}
