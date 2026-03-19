import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { type TaxMode } from '@/lib/tax';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const APP_VERSION = '3.0.0';

export default function SettingsPage() {
  const { toast } = useToast();

  // 店舗名
  const storeNameSetting = useLiveQuery(() => db.settings.get('storeName'));
  const [storeNameInput, setStoreNameInput] = useState('');
  useEffect(() => {
    if (storeNameSetting !== undefined) {
      setStoreNameInput(storeNameSetting?.value ?? '');
    }
  }, [storeNameSetting]);

  // 内税/外税
  const taxModeSetting = useLiveQuery(() => db.settings.get('taxMode'));
  const [taxMode, setTaxMode] = useState<TaxMode>('inclusive');
  useEffect(() => {
    if (taxModeSetting !== undefined) {
      setTaxMode((taxModeSetting?.value as TaxMode) ?? 'inclusive');
    }
  }, [taxModeSetting]);

  const [showDeleteStep1, setShowDeleteStep1] = useState(false);
  const [showDeleteStep2, setShowDeleteStep2] = useState(false);

  const handleSaveStoreName = async () => {
    const name = storeNameInput.trim();
    if (name.length > 30) {
      toast({ title: '店舗名は30文字以内です', variant: 'destructive' });
      return;
    }
    await db.settings.put({ key: 'storeName', value: name });
    toast({ title: '店舗名を保存しました' });
  };

  const handleTaxModeChange = async (mode: TaxMode) => {
    setTaxMode(mode);
    await db.settings.put({ key: 'taxMode', value: mode });
    toast({ title: `${mode === 'inclusive' ? '内税（税込入力）' : '外税（税抜入力）'}に変更しました` });
  };

  const handleDeleteAll = async () => {
    await db.sales.clear();
    await db.saleItems.clear();
    await db.departments.clear();
    await db.taxRates.clear();
    await db.settings.clear();
    setShowDeleteStep2(false);
    setStoreNameInput('');
    setTaxMode('inclusive');
    toast({ title: '全データを削除しました' });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container px-4 py-6 max-w-2xl">
        <h2 className="text-xl font-bold mb-6">設定</h2>

        <div className="space-y-6">
          {/* 店舗名 */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">店舗名</h3>
              <div className="flex gap-3">
                <Input
                  value={storeNameInput}
                  onChange={e => setStoreNameInput(e.target.value)}
                  placeholder="レシートや日計に表示される店舗名"
                  maxLength={30}
                  className="flex-1"
                />
                <Button onClick={handleSaveStoreName}>保存</Button>
              </div>
            </CardContent>
          </Card>

          {/* 消費税モード */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">消費税モード</h3>
              <p className="text-sm text-muted-foreground">
                レジ画面で入力する金額が「税込」か「税抜」かを選択します。
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleTaxModeChange('inclusive')}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    taxMode === 'inclusive'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="font-bold text-base mb-1">内税（税込入力）</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    入力した金額がそのまま請求額になります。<br />
                    例: ¥1,100 入力 → 請求 ¥1,100
                  </div>
                  <div className="mt-2 text-xs text-primary font-medium">
                    {taxMode === 'inclusive' ? '✓ 現在の設定' : ''}
                  </div>
                </button>
                <button
                  onClick={() => handleTaxModeChange('exclusive')}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    taxMode === 'exclusive'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="font-bold text-base mb-1">外税（税抜入力）</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    入力金額に消費税が加算されて請求額になります。<br />
                    例: ¥1,000 入力 → 請求 ¥1,100
                  </div>
                  <div className="mt-2 text-xs text-primary font-medium">
                    {taxMode === 'exclusive' ? '✓ 現在の設定' : ''}
                  </div>
                </button>
              </div>
              <div className={`rounded-lg p-3 text-sm ${taxMode === 'inclusive' ? 'bg-blue-50 text-blue-800' : 'bg-orange-50 text-orange-800'}`}>
                {taxMode === 'inclusive'
                  ? '現在: 内税モード — 入力金額 = 税込価格（消費税は内包されています）'
                  : '現在: 外税モード — 入力金額 = 税抜価格（消費税が別途加算されます）'}
              </div>
            </CardContent>
          </Card>

          {/* データ管理 */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">データ管理</h3>
              <Separator />
              <Button variant="destructive" className="gap-2" onClick={() => setShowDeleteStep1(true)}>
                <Trash2 className="h-4 w-4" /> 全データ削除
              </Button>
            </CardContent>
          </Card>

          {/* アプリ情報 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2">アプリ情報</h3>
              <p className="text-sm text-muted-foreground">シンプルレジ v{APP_VERSION}</p>
            </CardContent>
          </Card>
        </div>
      </main>

      <AlertDialog open={showDeleteStep1} onOpenChange={setShowDeleteStep1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>データを全削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>売上・部門・設定がすべて削除されます。元に戻せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDeleteStep1(false); setShowDeleteStep2(true); }}>次へ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteStep2} onOpenChange={setShowDeleteStep2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか？（最終確認）</AlertDialogTitle>
            <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground">全削除を実行</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
