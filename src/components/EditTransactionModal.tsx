import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { NumericKeypad } from '@/components/NumericKeypad';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { db, type Transaction, type Department } from '@/db';
import { calculateTax, type TaxCategory, TAX_CATEGORY_LABELS, getEffectiveTaxRate } from '@/lib/tax';
import { useLiveQuery } from 'dexie-react-hooks';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
}

export function EditTransactionModal({ transaction, open, onClose }: EditTransactionModalProps) {
  const departments = useLiveQuery(() => db.departments.orderBy('sortOrder').toArray()) ?? [];

  const [departmentId, setDepartmentId] = useState('');
  const [taxCategory, setTaxCategory] = useState<TaxCategory>('standard');
  const [amountStr, setAmountStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [showConfirm, setShowConfirm] = useState(false);
  const [taxRate, setTaxRate] = useState(10);

  useEffect(() => {
    if (transaction) {
      setDepartmentId(transaction.departmentId);
      setTaxCategory(transaction.taxCategory);
      setAmountStr(String(transaction.amount));
      setPaymentMethod(transaction.paymentMethod);
      setTaxRate(transaction.taxRate);
    }
  }, [transaction]);

  useEffect(() => {
    if (transaction) {
      getEffectiveTaxRate(taxCategory, transaction.date).then(setTaxRate);
    }
  }, [taxCategory, transaction]);

  if (!transaction) return null;

  const amount = parseInt(amountStr, 10) || 0;
  const { taxExcludedAmount, taxAmount } = calculateTax(amount, taxRate);
  const dept = departments.find((d) => d.id === departmentId);

  const handleSave = async () => {
    await db.transactions.update(transaction.id, {
      departmentId,
      departmentName: dept?.name ?? transaction.departmentName,
      amount,
      taxCategory,
      taxRate,
      taxExcludedAmount,
      taxAmount,
      paymentMethod,
      isEdited: true,
      updatedAt: new Date().toISOString(),
    });
    setShowConfirm(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>売上データの編集</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              登録日時：{transaction.date} {transaction.time}
            </p>

            <div className="space-y-2">
              <Label>部門</Label>
              <Select value={departmentId} onValueChange={(v) => {
                setDepartmentId(v);
                const d = departments.find((d) => d.id === v);
                if (d) setTaxCategory(d.defaultTaxCategory);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>税区分</Label>
              <RadioGroup
                value={taxCategory}
                onValueChange={(v) => setTaxCategory(v as TaxCategory)}
                className="flex gap-4"
              >
                {(['standard', 'reduced', 'exempt'] as const).map((cat) => (
                  <div key={cat} className="flex items-center gap-2">
                    <RadioGroupItem value={cat} id={`edit-tax-${cat}`} />
                    <Label htmlFor={`edit-tax-${cat}`} className="cursor-pointer">
                      {TAX_CATEGORY_LABELS[cat]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>金額（税込）</Label>
              <div className="text-2xl font-bold tabular-nums">
                ¥{amount.toLocaleString()} 円
              </div>
              <NumericKeypad value={amountStr} onChange={setAmountStr} />
              {amount > 0 && (
                <p className="text-sm text-muted-foreground tabular-nums">
                  税抜 ¥{taxExcludedAmount.toLocaleString()} ／ 消費税 ¥{taxAmount.toLocaleString()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>支払方法</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as 'cash' | 'credit')}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="cash" id="edit-pay-cash" />
                  <Label htmlFor="edit-pay-cash" className="cursor-pointer">現金</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="credit" id="edit-pay-credit" />
                  <Label htmlFor="edit-pay-credit" className="cursor-pointer">掛売</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>キャンセル</Button>
            <Button onClick={() => setShowConfirm(true)} disabled={amount < 1 || !departmentId}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>変更を保存しますか？</AlertDialogTitle>
            <AlertDialogDescription>売上データを上書き更新します。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave}>保存</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
