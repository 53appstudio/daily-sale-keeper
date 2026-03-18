import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function TaxRatesPage() {
  const { toast } = useToast();
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [newStandard, setNewStandard] = useState('');
  const [newReduced, setNewReduced] = useState('');
  const [newOther, setNewOther] = useState('');
  const [newEffectiveDate, setNewEffectiveDate] = useState('');

  const taxRates = useLiveQuery(() => db.taxRates.toArray()) ?? [];

  const today = new Date().toISOString().split('T')[0];

  // Get current effective rates
  const getCurrentRate = (category: string) => {
    const rates = taxRates
      .filter((r) => r.category === category && r.effectiveFrom <= today)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    return rates[0]?.rate ?? (category === 'standard' ? 10 : category === 'reduced' ? 8 : 0);
  };

  // Get history grouped by effectiveFrom
  const historyDates = [...new Set(
    taxRates.filter((r) => r.category !== 'exempt').map((r) => r.effectiveFrom)
  )].sort((a, b) => b.localeCompare(a));

  const handleApply = async () => {
    const stdRate = parseInt(newStandard, 10);
    const redRate = parseInt(newReduced, 10);
    const othRate = parseInt(newOther, 10);

    if (isNaN(stdRate) || stdRate < 0 || stdRate > 100 || isNaN(redRate) || redRate < 0 || redRate > 100 || isNaN(othRate) || othRate < 0 || othRate > 100) {
      toast({ title: '税率は0〜100の整数で入力してください', variant: 'destructive' });
      return;
    }
    if (!newEffectiveDate) {
      toast({ title: '適用開始日を入力してください', variant: 'destructive' });
      return;
    }

    await db.taxRates.bulkAdd([
      {
        id: crypto.randomUUID(),
        category: 'standard',
        rate: stdRate,
        effectiveFrom: newEffectiveDate,
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        category: 'reduced',
        rate: redRate,
        effectiveFrom: newEffectiveDate,
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        category: 'other',
        rate: othRate,
        effectiveFrom: newEffectiveDate,
        createdAt: new Date().toISOString(),
      },
    ]);

    setShowChangeDialog(false);
    setNewStandard('');
    setNewReduced('');
    setNewOther('');
    setNewEffectiveDate('');
    toast({ title: '税率を更新しました' });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container px-4 py-6 max-w-2xl">
        <h2 className="text-xl font-bold mb-6">税率管理</h2>

        <Card className="mb-6">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold">■ 現在の税率</h3>
            <div className="space-y-2 tabular-nums">
              <div className="flex justify-between py-2 px-3 rounded bg-secondary/50">
                <span>標準税率</span><span className="font-semibold">{getCurrentRate('standard')}％</span>
              </div>
              <div className="flex justify-between py-2 px-3 rounded bg-secondary/50">
                <span>軽減税率</span><span className="font-semibold">{getCurrentRate('reduced')}％</span>
              </div>
              <div className="flex justify-between py-2 px-3 rounded bg-secondary/50">
                <span>非課税</span><span className="font-semibold text-muted-foreground">0％（変更不可）</span>
              </div>
              <div className="flex justify-between py-2 px-3 rounded bg-secondary/50">
                <span>その他</span><span className="font-semibold">{getCurrentRate('other')}％</span>
              </div>
            </div>
            <Button onClick={() => {
              setNewStandard(String(getCurrentRate('standard')));
              setNewReduced(String(getCurrentRate('reduced')));
              setNewOther(String(getCurrentRate('other')));
              setShowChangeDialog(true);
            }}>
              税率を変更する
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold">■ 税率変更履歴</h3>
            {historyDates.length === 0 ? (
              <p className="text-muted-foreground text-sm">履歴がありません</p>
            ) : (
              <div className="space-y-2 text-sm tabular-nums">
                {historyDates.map((date) => {
                  const std = taxRates.find((r) => r.category === 'standard' && r.effectiveFrom === date);
                  const red = taxRates.find((r) => r.category === 'reduced' && r.effectiveFrom === date);
                  const oth = taxRates.find((r) => r.category === 'other' && r.effectiveFrom === date);
                  return (
                    <div key={date} className="py-2 px-3 rounded bg-secondary/50">
                      {date}〜　標準{std?.rate ?? '?'}% ／ 軽減{red?.rate ?? 'なし'}% ／ その他{oth?.rate ?? '?'}%
                    </div>
                  );
                })}
              </div>
            )}
            <Separator />
            <p className="text-xs text-muted-foreground">
              ※ 税率を変更しても過去の売上データの税額は変更されません（記録時の税率で保持）
            </p>
          </CardContent>
        </Card>
      </main>

      <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>税率変更</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>適用開始日</Label>
              <Input type="date" value={newEffectiveDate} onChange={(e) => setNewEffectiveDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>標準税率（％）</Label>
              <Input type="number" min={0} max={100} value={newStandard} onChange={(e) => setNewStandard(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>軽減税率（％）</Label>
              <Input type="number" min={0} max={100} value={newReduced} onChange={(e) => setNewReduced(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>その他税率（％）</Label>
              <Input type="number" min={0} max={100} value={newOther} onChange={(e) => setNewOther(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">※ 過去の売上には影響しません</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangeDialog(false)}>キャンセル</Button>
            <Button onClick={handleApply}>適用</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
