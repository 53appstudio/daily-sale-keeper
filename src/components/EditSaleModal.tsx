import { useState, useEffect } from 'react';
import { db, type Sale, type SaleItem, type AuditLog } from '@/db';
import { calcLineTotal, type TaxMode } from '@/lib/tax';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Plus, Minus, Banknote, CreditCard, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

interface EditSaleModalProps {
  sale: Sale | null;
  items: SaleItem[];
  open: boolean;
  onClose: () => void;
}

/** SaleItemの編集用コピー */
interface EditItem {
  id: string;          // 既存アイテムのID（新規は空）
  isNew: boolean;
  departmentId: string;
  departmentName: string;
  unitPrice: number;
  quantity: number;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  taxCategory: SaleItem['taxCategory'];
  taxRate: number;
  taxMode: TaxMode;
}

export function EditSaleModal({ sale, items, open, onClose }: EditSaleModalProps) {
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // 部門一覧
  const departments = useLiveQuery(() => db.departments.orderBy('sortOrder').toArray()) ?? [];

  // sale/itemsが変わったら編集コピーを初期化
  useEffect(() => {
    if (!sale) return;
    setEditItems(items.map(i => ({
      id: i.id,
      isNew: false,
      departmentId: i.departmentId,
      departmentName: i.departmentName,
      unitPrice: i.unitPrice ?? 0,
      quantity: i.quantity ?? 1,
      netAmount: i.netAmount ?? 0,
      taxAmount: i.taxAmount ?? 0,
      // 旧データ互換：grossAmount がない場合は unitPrice*quantity で代替
      grossAmount: i.grossAmount ?? (i.unitPrice ?? 0) * (i.quantity ?? 1),
      taxCategory: i.taxCategory ?? 'standard',
      taxRate: i.taxRate ?? 0,
      // 旧データ互換：taxMode がない場合は sale の taxMode、それもなければ 'inclusive'
      taxMode: (i.taxMode ?? sale.taxMode ?? 'inclusive') as TaxMode,
    })));
    setPaymentMethod(sale.paymentMethod ?? 'cash');
  }, [sale, items]);

  // --- 集計 ---
  const grossTotal = editItems.reduce((s, i) => s + i.grossAmount, 0);
  const netTotal   = editItems.reduce((s, i) => s + i.netAmount, 0);
  const taxTotal   = editItems.reduce((s, i) => s + i.taxAmount, 0);

  // --- 単価変更 ---
  const handleUnitPriceChange = (idx: number, value: string) => {
    const price = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
    setEditItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const taxMode = (item.taxMode ?? 'inclusive') as TaxMode;
      const result = calcLineTotal(price, item.quantity, item.taxRate ?? 0, taxMode);
      return { ...item, unitPrice: price, taxMode, ...result };
    }));
  };

  // --- 個数変更 ---
  const handleQuantityChange = (idx: number, delta: number) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const qty = Math.max(1, item.quantity + delta);
      const taxMode = (item.taxMode ?? 'inclusive') as TaxMode;
      const result = calcLineTotal(item.unitPrice, qty, item.taxRate ?? 0, taxMode);
      return { ...item, quantity: qty, taxMode, ...result };
    }));
  };

  // --- 行削除 ---
  const handleRemoveItem = (idx: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  // --- 行追加（部門選択後） ---
  const handleAddItem = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    if (!dept) return;
    const taxMode: TaxMode = (sale?.taxMode ?? 'inclusive') as TaxMode;
    setEditItems(prev => [...prev, {
      id: '',
      isNew: true,
      departmentId: dept.id,
      departmentName: dept.name,
      unitPrice: 0,
      quantity: 1,
      netAmount: 0,
      taxAmount: 0,
      grossAmount: 0,
      taxCategory: dept.defaultTaxCategory,
      taxRate: 0,
      taxMode,
    }]);
  };

  // --- 会計まるごと削除 ---
  const handleDeleteSale = async () => {
    if (!sale?.id) return;
    setSaving(true);
    // 削除前スナップショットを保存
    const beforeItems = await db.saleItems.where('saleId').equals(sale.id).toArray();
    const log: AuditLog = {
      id: crypto.randomUUID(),
      action: 'delete',
      saleId: sale.id,
      saleDate: sale.date,
      saleTime: sale.time,
      beforeSnapshot: JSON.stringify({ sale, items: beforeItems }),
      afterSnapshot: '',
      operator: 'システム',
      createdAt: new Date().toISOString(),
    };
    await db.auditLogs.add(log);
    await db.saleItems.where('saleId').equals(sale.id).delete();
    await db.sales.delete(sale.id);
    setSaving(false);
    setConfirmDelete(false);
    onClose();
  };

  // --- 保存 ---
  const handleSave = async () => {
    if (!sale) return;
    setSaving(true);
    try {
      // 修正前スナップショットを保存
      const beforeItems = await db.saleItems.where('saleId').equals(sale.id).toArray();
      const afterSale = {
        ...sale,
        netTotal,
        taxTotal,
        grossTotal,
        paymentMethod,
      };
      const log: AuditLog = {
        id: crypto.randomUUID(),
        action: 'edit',
        saleId: sale.id,
        saleDate: sale.date,
        saleTime: sale.time,
        beforeSnapshot: JSON.stringify({ sale, items: beforeItems }),
        afterSnapshot: JSON.stringify({ sale: afterSale, items: editItems }),
        operator: 'システム',
        createdAt: new Date().toISOString(),
      };
      await db.auditLogs.add(log);

      // sale を更新
      await db.sales.update(sale.id, {
        netTotal,
        taxTotal,
        grossTotal,
        paymentMethod,
        // 掛売の場合は receivedAmount をリセット
        receivedAmount: paymentMethod === 'cash' ? sale.receivedAmount : grossTotal,
        changeAmount:   paymentMethod === 'cash' ? sale.changeAmount   : 0,
      });

      // 既存 saleItems を削除してから再登録
      await db.saleItems.where('saleId').equals(sale.id).delete();
      await db.saleItems.bulkAdd(editItems.map(item => ({
        id: item.id || crypto.randomUUID(),
        saleId: sale.id,
        departmentId: item.departmentId,
        departmentName: item.departmentName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        netAmount: item.netAmount,
        taxAmount: item.taxAmount,
        grossAmount: item.grossAmount,
        taxCategory: item.taxCategory,
        taxRate: item.taxRate,
        taxMode: item.taxMode,
      })));

      onClose();
    } finally {
      setSaving(false);
    }
  };

  // sale が null の場合は何もレンダリングしない（フックの後で行う）
  if (!sale) return null;

  // taxMode のフォールバック（旧データ互換）
  const saleTaxMode: TaxMode = (sale.taxMode ?? 'inclusive') as TaxMode;

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              会計修正　<span className="text-sm font-normal text-muted-foreground">{sale.date} {sale.time}</span>
            </DialogTitle>
          </DialogHeader>

          {/* 明細行 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">明細</Label>
            {editItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                明細がありません。下の「＋部門を追加」から追加してください。
              </p>
            )}
            {editItems.map((item, idx) => (
              <Card key={idx}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{item.departmentName}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => handleRemoveItem(idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* 単価入力 */}
                    <div>
                      <Label className="text-xs text-muted-foreground block mb-1">
                        単価（{item.taxMode === 'inclusive' ? '税込' : '税抜'}）
                      </Label>
                      <div className="flex items-center border rounded-md overflow-hidden">
                        <span className="px-2 text-sm text-muted-foreground bg-secondary">¥</span>
                        <input
                          type="number"
                          min={0}
                          value={item.unitPrice || ''}
                          onChange={e => handleUnitPriceChange(idx, e.target.value)}
                          className="flex-1 min-w-0 px-2 py-1.5 text-sm text-right outline-none bg-background"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {/* 個数 */}
                    <div>
                      <Label className="text-xs text-muted-foreground block mb-1">個数</Label>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"
                          onClick={() => handleQuantityChange(idx, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="flex-1 text-center font-bold tabular-nums text-sm">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"
                          onClick={() => handleQuantityChange(idx, +1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {/* 小計プレビュー */}
                  <div className="mt-2 text-xs text-muted-foreground text-right tabular-nums">
                    小計 ¥{item.grossAmount.toLocaleString()}
                    {item.taxAmount > 0 && <span className="ml-1">（税 ¥{item.taxAmount.toLocaleString()}）</span>}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* 行追加：部門ボタン */}
            {departments.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">＋ 部門を追加</Label>
                <div className="flex flex-wrap gap-1.5">
                  {departments.map(d => (
                    <Button key={d.id} variant="outline" size="sm" className="h-8 text-xs"
                      onClick={() => handleAddItem(d.id)}>
                      {d.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* 合計 */}
          <div className="space-y-1 text-sm">
            {saleTaxMode === 'exclusive' && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>税抜合計</span>
                  <span className="tabular-nums">¥{netTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>消費税</span>
                  <span className="tabular-nums">¥{taxTotal.toLocaleString()}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-base">
              <span>請求合計（税込）</span>
              <span className="tabular-nums">¥{grossTotal.toLocaleString()}</span>
            </div>
            {saleTaxMode === 'inclusive' && taxTotal > 0 && (
              <div className="text-xs text-muted-foreground text-right tabular-nums">
                （うち消費税 ¥{taxTotal.toLocaleString()}）
              </div>
            )}
          </div>

          <Separator />

          {/* 支払方法 */}
          <div>
            <Label className="text-xs text-muted-foreground block mb-2">支払方法</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                className="h-12 gap-2" onClick={() => setPaymentMethod('cash')}>
                <Banknote className="h-4 w-4" />現金
              </Button>
              <Button variant={paymentMethod === 'credit' ? 'default' : 'outline'}
                className="h-12 gap-2" onClick={() => setPaymentMethod('credit')}>
                <CreditCard className="h-4 w-4" />掛売
              </Button>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full h-12 text-base font-bold"
              onClick={handleSave}
              disabled={saving || editItems.length === 0}
            >
              {saving ? '保存中...' : '修正を保存'}
            </Button>
            <Button
              variant="destructive"
              className="w-full h-10 gap-2"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4" />この会計を削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認 */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>会計を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {sale.date} {sale.time} の会計（¥{sale.grossTotal?.toLocaleString()}）を削除します。
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSale}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
