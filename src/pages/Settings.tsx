import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Download, Upload, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const APP_VERSION = '2.0.0';

export default function SettingsPage() {
  const { toast } = useToast();
  const storeName = useLiveQuery(() => db.settings.get('storeName').then((s) => s?.value ?? '')) ?? '';
  const [storeNameInput, setStoreNameInput] = useState('');
  const [storeNameLoaded, setStoreNameLoaded] = useState(false);
  const [showDeleteStep1, setShowDeleteStep1] = useState(false);
  const [showDeleteStep2, setShowDeleteStep2] = useState(false);

  // Sync input with DB value
  if (!storeNameLoaded && storeName !== undefined) {
    setStoreNameInput(storeName);
    setStoreNameLoaded(true);
  }

  const handleSaveStoreName = async () => {
    const name = storeNameInput.trim();
    if (name.length > 30) {
      toast({ title: '店舗名は30文字以内です', variant: 'destructive' });
      return;
    }
    await db.settings.put({ key: 'storeName', value: name });
    toast({ title: '店舗名を保存しました' });
  };

  const handleExportAll = async () => {
    const transactions = await db.transactions.toArray();
    if (transactions.length === 0) {
      toast({ title: 'エクスポートするデータがありません', variant: 'destructive' });
      return;
    }
    const header = '日付,時刻,部門,金額(税込),税区分,税率,税抜金額,消費税額,支払方法,編集済み';
    const rows = transactions
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((tx) =>
        [
          tx.date, tx.time, tx.departmentName, tx.amount,
          tx.taxCategory === 'standard' ? '標準税率' : tx.taxCategory === 'reduced' ? '軽減税率' : '非課税',
          tx.taxRate, tx.taxExcludedAmount, tx.taxAmount,
          tx.paymentMethod === 'cash' ? '現金' : '掛売',
          tx.isEdited ? '○' : '',
        ].join(',')
      );
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${transactions.length}件のデータをエクスポートしました` });
  };

  const handleImportAll = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split('\n').slice(1).filter((l) => l.trim());
      const taxCatMap: Record<string, 'standard' | 'reduced' | 'exempt'> = {
        '標準税率': 'standard', '軽減税率': 'reduced', '非課税': 'exempt',
      };
      const payMap: Record<string, 'cash' | 'credit'> = { '現金': 'cash', '掛売': 'credit' };
      let count = 0;
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length < 9) continue;
        const [date, time, deptName, amountStr, taxCatStr, taxRateStr, taxExStr, taxAmtStr, payStr, editedStr] = parts;
        const amount = parseInt(amountStr, 10);
        if (isNaN(amount) || amount < 1) continue;
        await db.transactions.add({
          id: crypto.randomUUID(),
          date: date.trim(),
          time: time.trim(),
          departmentId: '',
          departmentName: deptName.trim(),
          amount,
          taxCategory: taxCatMap[taxCatStr.trim()] ?? 'standard',
          taxRate: parseInt(taxRateStr, 10) || 10,
          taxExcludedAmount: parseInt(taxExStr, 10) || 0,
          taxAmount: parseInt(taxAmtStr, 10) || 0,
          paymentMethod: payMap[payStr.trim()] ?? 'cash',
          isEdited: editedStr?.trim() === '○',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        count++;
      }
      toast({ title: `${count}件のデータをインポートしました` });
    };
    input.click();
  };

  const handleDeleteAll = async () => {
    await db.transactions.clear();
    await db.departments.clear();
    await db.settings.clear();
    setShowDeleteStep2(false);
    setStoreNameInput('');
    toast({ title: '全データを削除しました' });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container px-4 py-6 max-w-2xl">
        <h2 className="text-xl font-bold mb-6">設定</h2>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">店舗名</h3>
              <div className="flex gap-3">
                <Input
                  value={storeNameInput}
                  onChange={(e) => setStoreNameInput(e.target.value)}
                  placeholder="日計ジャーナルに表示される店舗名"
                  maxLength={30}
                  className="flex-1"
                />
                <Button onClick={handleSaveStoreName}>保存</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">データ管理</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="gap-2" onClick={handleExportAll}>
                  <Download className="h-4 w-4" /> 全データCSVエクスポート
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleImportAll}>
                  <Upload className="h-4 w-4" /> CSVインポート
                </Button>
              </div>
              <Separator />
              <Button variant="destructive" className="gap-2" onClick={() => setShowDeleteStep1(true)}>
                <Trash2 className="h-4 w-4" /> データ全削除
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2">アプリ情報</h3>
              <p className="text-sm text-muted-foreground">シンプルレジ v{APP_VERSION}</p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Delete step 1 */}
      <AlertDialog open={showDeleteStep1} onOpenChange={setShowDeleteStep1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>データを全削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>すべての売上データ・部門・設定が削除されます。この操作は元に戻せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDeleteStep1(false); setShowDeleteStep2(true); }}>
              次へ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete step 2 */}
      <AlertDialog open={showDeleteStep2} onOpenChange={setShowDeleteStep2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか？（最終確認）</AlertDialogTitle>
            <AlertDialogDescription>この操作は取り消せません。すべてのデータが完全に失われます。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground">
              全削除を実行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
