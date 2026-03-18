import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction, type Department } from '@/db';
import { seedInitialData } from '@/db';
import { calculateTax, getEffectiveTaxRate, formatTaxLabel, type TaxCategory, TAX_CATEGORY_LABELS } from '@/lib/tax';
import { AppHeader } from '@/components/AppHeader';
import { NumericKeypad } from '@/components/NumericKeypad';
import { EditTransactionModal } from '@/components/EditTransactionModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Pencil, Trash2 } from 'lucide-react';

export default function RegisterPage() {
  const today = new Date().toISOString().split('T')[0];

  const departments = useLiveQuery(() => db.departments.orderBy('sortOrder').toArray()) ?? [];
  const todayTransactions = useLiveQuery(
    () => db.transactions.where('date').equals(today).toArray(),
    [today]
  ) ?? [];

  const [departmentId, setDepartmentId] = useState('');
  const [taxCategory, setTaxCategory] = useState<TaxCategory>('standard');
  const [amountStr, setAmountStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [taxRate, setTaxRate] = useState(10);
  const [standardRate, setStandardRate] = useState(10);
  const [reducedRate, setReducedRate] = useState(8);
  const [otherRate, setOtherRate] = useState(0);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  useEffect(() => {
    seedInitialData();
  }, []);

  // Set default department
  useEffect(() => {
    if (departments.length > 0 && !departmentId) {
      setDepartmentId(departments[0].id);
      setTaxCategory(departments[0].defaultTaxCategory);
    }
  }, [departments, departmentId]);

  // Load all rates for labels
  useEffect(() => {
    getEffectiveTaxRate('standard', today).then(setStandardRate);
    getEffectiveTaxRate('reduced', today).then(setReducedRate);
    getEffectiveTaxRate('other', today).then(setOtherRate);
  }, [today]);

  // Update tax rate when category changes
  useEffect(() => {
    getEffectiveTaxRate(taxCategory, today).then(setTaxRate);
  }, [taxCategory, today]);

  const amount = parseInt(amountStr, 10) || 0;
  const { taxExcludedAmount, taxAmount } = calculateTax(amount, taxRate);

  const handleDepartmentChange = (id: string) => {
    setDepartmentId(id);
    const dept = departments.find((d) => d.id === id);
    if (dept) setTaxCategory(dept.defaultTaxCategory);
  };

  const handleRegister = async () => {
    if (amount < 1 || !departmentId) return;
    const dept = departments.find((d) => d.id === departmentId);
    const now = new Date();
    const tx: Transaction = {
      id: crypto.randomUUID(),
      date: today,
      time: now.toTimeString().slice(0, 5),
      departmentId,
      departmentName: dept?.name ?? '不明',
      amount,
      taxCategory,
      taxRate,
      taxExcludedAmount,
      taxAmount,
      paymentMethod,
      isEdited: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await db.transactions.add(tx);
    setAmountStr('');
    setPaymentMethod('cash');
  };

  const handleDelete = async () => {
    if (deletingTxId) {
      await db.transactions.delete(deletingTxId);
      setDeletingTxId(null);
    }
  };

  const sortedTx = [...todayTransactions].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  );

  const totalAmount = todayTransactions.reduce((s, t) => s + t.amount, 0);
  const totalTax = todayTransactions.reduce((s, t) => s + t.taxAmount, 0);
  const cashTotal = todayTransactions.filter((t) => t.paymentMethod === 'cash').reduce((s, t) => s + t.amount, 0);
  const creditTotal = todayTransactions.filter((t) => t.paymentMethod === 'credit').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <Label>部門</Label>
                <Select value={departmentId} onValueChange={handleDepartmentChange}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="部門を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {departments.length === 0 && (
                  <p className="text-sm text-muted-foreground">部門管理画面で部門を追加してください</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>税区分</Label>
                <RadioGroup
                  value={taxCategory}
                  onValueChange={(v) => setTaxCategory(v as TaxCategory)}
                  className="flex gap-3"
                >
                  {(['standard', 'reduced', 'exempt'] as const).map((cat) => (
                    <div key={cat} className="flex items-center gap-2">
                      <RadioGroupItem value={cat} id={`tax-${cat}`} />
                      <Label htmlFor={`tax-${cat}`} className="cursor-pointer text-sm">
                        {cat === 'standard' ? `${standardRate}%` : cat === 'reduced' ? `${reducedRate}%(軽減)` : '非課税'}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>金額（税込）</Label>
                <div className="text-3xl font-bold tabular-nums text-center py-3 bg-secondary rounded-lg">
                  ¥{amount.toLocaleString()}
                </div>
                {amount > 0 && (
                  <p className="text-sm text-muted-foreground text-center tabular-nums">
                    税抜 ¥{taxExcludedAmount.toLocaleString()} ／ 消費税 ¥{taxAmount.toLocaleString()}
                  </p>
                )}
                <NumericKeypad value={amountStr} onChange={setAmountStr} />
              </div>

              <div className="space-y-2">
                <Label>支払方法</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as 'cash' | 'credit')}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="cash" id="pay-cash" />
                    <Label htmlFor="pay-cash" className="cursor-pointer">現金</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="credit" id="pay-credit" />
                    <Label htmlFor="pay-credit" className="cursor-pointer">掛売</Label>
                  </div>
                </RadioGroup>
              </div>

              <Button
                className="w-full h-14 text-lg font-bold transition-transform duration-150 active:scale-95"
                onClick={handleRegister}
                disabled={amount < 1 || !departmentId}
              >
                登 録
              </Button>
            </CardContent>
          </Card>

          {/* Today's History */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">本日の入力履歴</h2>
              <Separator className="mb-4" />

              {sortedTx.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  本日の取引はまだありません
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {sortedTx.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/50 text-sm"
                    >
                      <div className="flex-1 tabular-nums">
                        <span className="text-muted-foreground">{tx.time}</span>{' '}
                        <span className="font-medium">{tx.departmentName}</span>{' '}
                        <span className="font-semibold">¥{tx.amount.toLocaleString()}</span>
                        <span className="text-muted-foreground">(税¥{tx.taxAmount.toLocaleString()})</span>{' '}
                        <span className="text-muted-foreground">{formatTaxLabel(tx.taxCategory, tx.taxRate)}</span>{' '}
                        <span>{tx.paymentMethod === 'cash' ? '現金' : '掛売'}</span>
                        {tx.isEdited && <span className="ml-1 text-primary" title="編集済み">✏</span>}
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0">
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditingTx(tx)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setDeletingTxId(tx.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="my-4" />
              <div className="space-y-1 tabular-nums font-medium">
                <p>本日合計：¥{totalAmount.toLocaleString()}（税合計 ¥{totalTax.toLocaleString()}）</p>
                <p className="text-sm text-muted-foreground">
                  （現金 ¥{cashTotal.toLocaleString()} ／ 掛売 ¥{creditTotal.toLocaleString()}）
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <EditTransactionModal
        transaction={editingTx}
        open={!!editingTx}
        onClose={() => setEditingTx(null)}
      />

      <AlertDialog open={!!deletingTxId} onOpenChange={(o) => !o && setDeletingTxId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取引を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>この操作は元に戻せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
