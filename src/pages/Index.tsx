import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { seedInitialData } from '@/db';
import { calcLineTotal, getEffectiveTaxRate, type TaxCategory, type TaxMode } from '@/lib/tax';
import { AppHeader } from '@/components/AppHeader';
import { NumericKeypad } from '@/components/NumericKeypad';
import { Receipt } from '@/components/Receipt';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Trash2, ShoppingCart, CreditCard, Banknote, CheckCircle2, Printer, RotateCcw } from 'lucide-react';

type Phase = 'input' | 'payment' | 'complete';

interface CartItem {
  tempId: string;
  departmentId: string;
  departmentName: string;
  unitPrice: number;    // 入力単価（内税=税込, 外税=税抜）
  quantity: number;
  netAmount: number;    // 税抜小計
  taxAmount: number;    // 消費税額
  grossAmount: number;  // 税込小計（請求額）
  taxCategory: TaxCategory;
  taxRate: number;
  taxMode: TaxMode;
}

// 確定済み会計データ（完了フェーズで使用）
interface CompletedSale {
  cart: CartItem[];
  grossTotal: number;
  netTotal: number;
  taxTotal: number;
  paymentMethod: 'cash' | 'credit' | 'refund';
  receivedAmount: number;
  changeAmount: number;
  date: string;
  time: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  taxMode: TaxMode;
}

export default function RegisterPage() {
  const today = new Date().toISOString().split('T')[0];
  const departments = useLiveQuery(() => db.departments.orderBy('sortOrder').toArray()) ?? [];

  // 設定読み込み
  const taxModeSetting = useLiveQuery(() => db.settings.get('taxMode'));
  const storeNameSetting = useLiveQuery(() => db.settings.get('storeName'));
  const storeAddressSetting = useLiveQuery(() => db.settings.get('storeAddress'));
  const storePhoneSetting = useLiveQuery(() => db.settings.get('storePhone'));
  const taxMode: TaxMode = (taxModeSetting?.value as TaxMode) ?? 'inclusive';
  const storeName = storeNameSetting?.value ?? 'シンプルレジ';
  const storeAddress = storeAddressSetting?.value ?? '';
  const storePhone = storePhoneSetting?.value ?? '';

  const [phase, setPhase] = useState<Phase>('input');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [qtyStr, setQtyStr] = useState('1');
  const [inputMode, setInputMode] = useState<'price' | 'qty'>('price');
  const [taxRate, setTaxRate] = useState(10);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'refund'>('cash');
  const [receivedStr, setReceivedStr] = useState('');
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => { seedInitialData(); }, []);

  // 部門初期選択
  const effectiveDeptId = selectedDeptId || departments[0]?.id || '';
  useEffect(() => {
    const dept = departments.find(d => d.id === effectiveDeptId);
    if (dept) getEffectiveTaxRate(dept.defaultTaxCategory, today).then(setTaxRate);
  }, [effectiveDeptId, departments, today]);

  // --- 計算値 ---
  const price = parseInt(priceStr, 10) || 0;
  const qty   = parseInt(qtyStr, 10)  || 1;

  // プレビュー：カートに追加する前の1行分
  const preview = price > 0 ? calcLineTotal(price, qty, taxRate, taxMode) : null;

  // カート合計
  const grossTotal = cart.reduce((s, i) => s + i.grossAmount, 0);
  const netTotal   = cart.reduce((s, i) => s + i.netAmount, 0);
  const taxTotal   = cart.reduce((s, i) => s + i.taxAmount, 0);

  // 支払
  const received = parseInt(receivedStr, 10) || 0;
  const change   = received - grossTotal;

  // カートに追加
  const handleAddToCart = () => {
    if (price < 1 || !effectiveDeptId) return;
    const dept = departments.find(d => d.id === effectiveDeptId);
    const taxCat: TaxCategory = dept?.defaultTaxCategory ?? 'standard';
    const result = calcLineTotal(price, qty, taxRate, taxMode);
    if (!selectedDeptId && effectiveDeptId) setSelectedDeptId(effectiveDeptId);
    setCart(prev => [...prev, {
      tempId: crypto.randomUUID(),
      departmentId: effectiveDeptId,
      departmentName: dept?.name ?? '不明',
      unitPrice: price,
      quantity: qty,
      ...result,
      taxCategory: taxCat,
      taxRate,
      taxMode,
    }]);
    setPriceStr('');
    setQtyStr('1');
    setInputMode('price');
  };

  const handleRemoveFromCart = (tempId: string) => {
    setCart(prev => prev.filter(i => i.tempId !== tempId));
  };

  const handleToPayment = () => {
    if (cart.length === 0) return;
    setPaymentMethod('cash');
    setReceivedStr('');
    setPhase('payment');
  };

  const handleConfirmPayment = async () => {
    const now = new Date();
    const saleId = crypto.randomUUID();
    // 返金の場合は金額をマイナスに反転
    const sign = paymentMethod === 'refund' ? -1 : 1;
    const signedGross = grossTotal * sign;
    const signedNet   = netTotal   * sign;
    const signedTax   = taxTotal   * sign;
    const receivedAmount = paymentMethod === 'cash' ? received : signedGross;
    const changeAmount   = paymentMethod === 'cash' ? Math.max(0, change) : 0;

    await db.sales.add({
      id: saleId,
      date: today,
      time: now.toTimeString().slice(0, 5),
      netTotal:   signedNet,
      taxTotal:   signedTax,
      grossTotal: signedGross,
      taxMode,
      paymentMethod,
      receivedAmount,
      changeAmount,
      createdAt: now.toISOString(),
    });

    // saleItems も返金時はマイナスで保存
    await db.saleItems.bulkAdd(cart.map(item => ({
      id: crypto.randomUUID(),
      saleId,
      departmentId: item.departmentId,
      departmentName: item.departmentName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      netAmount:   item.netAmount   * sign,
      taxAmount:   item.taxAmount   * sign,
      grossAmount: item.grossAmount * sign,
      taxCategory: item.taxCategory,
      taxRate: item.taxRate,
      taxMode: item.taxMode,
    })));

    setCompletedSale({
      cart: [...cart],
      grossTotal: signedGross,
      netTotal:   signedNet,
      taxTotal:   signedTax,
      paymentMethod,
      receivedAmount,
      changeAmount,
      date: today,
      time: now.toTimeString().slice(0, 5),
      storeName,
      storeAddress,
      storePhone,
      taxMode,
    });
    setCart([]);
    setPhase('complete');
  };

  const handleNext = () => {
    setPriceStr('');
    setQtyStr('1');
    setInputMode('price');
    setShowReceipt(false);
    setCompletedSale(null);
    setPhase('input');
  };

  // ===== 入力フェーズ =====
  if (phase === 'input') {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container px-3 py-4 max-w-lg mx-auto">

          {/* 消費税モードバッジ */}
          <div className="flex justify-end mb-2">
            <Badge variant={taxMode === 'inclusive' ? 'secondary' : 'outline'} className="text-xs">
              {taxMode === 'inclusive' ? '内税（税込入力）' : '外税（税抜入力）'}
            </Badge>
          </div>

          {/* 部門選択 */}
          <div className="mb-3">
            <Label className="text-xs text-muted-foreground mb-1 block">部門</Label>
            <div className="flex flex-wrap gap-2">
              {departments.map(d => (
                <Button
                  key={d.id}
                  variant={effectiveDeptId === d.id ? 'default' : 'outline'}
                  className="h-10 px-4 text-sm font-medium"
                  onClick={() => setSelectedDeptId(d.id)}
                >
                  {d.name}
                </Button>
              ))}
              {departments.length === 0 && (
                <p className="text-sm text-muted-foreground">「部門」画面で部門を追加してください</p>
              )}
            </div>
          </div>

          {/* 価格・個数入力 */}
          <Card className="mb-3">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  className={`rounded-lg p-3 text-left border-2 transition-colors ${inputMode === 'price' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}`}
                  onClick={() => setInputMode('price')}
                >
                  <div className="text-xs text-muted-foreground mb-1">
                    単価（{taxMode === 'inclusive' ? '税込' : '税抜'}）
                  </div>
                  <div className="text-2xl font-bold tabular-nums">¥{price.toLocaleString()}</div>
                </button>
                <button
                  className={`rounded-lg p-3 text-left border-2 transition-colors ${inputMode === 'qty' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}`}
                  onClick={() => setInputMode('qty')}
                >
                  <div className="text-xs text-muted-foreground mb-1">個数</div>
                  <div className="text-2xl font-bold tabular-nums">{qty}</div>
                </button>
              </div>

              {/* 入力プレビュー */}
              {preview && (
                <div className="rounded-lg bg-secondary/40 px-3 py-2 mb-3 text-sm tabular-nums">
                  {taxMode === 'inclusive' ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">税込小計</span>
                      <span className="font-semibold">¥{preview.grossAmount.toLocaleString()}
                        <span className="text-xs text-muted-foreground ml-1">（税 ¥{preview.taxAmount.toLocaleString()}）</span>
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">税抜小計</span>
                        <span>¥{preview.netAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">消費税 {taxRate}%</span>
                        <span>¥{preview.taxAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-0.5">
                        <span>税込小計</span>
                        <span>¥{preview.grossAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <NumericKeypad
                value={inputMode === 'price' ? priceStr : qtyStr}
                onChange={v => {
                  if (inputMode === 'price') setPriceStr(v);
                  else setQtyStr(v === '' ? '' : String(Math.min(999, parseInt(v, 10) || 0)));
                }}
              />

              <Button
                className="w-full h-12 mt-3 text-base font-bold"
                onClick={handleAddToCart}
                disabled={price < 1 || departments.length === 0}
              >
                カートに追加
              </Button>
            </CardContent>
          </Card>

          {/* カート */}
          {cart.length > 0 && (
            <Card className="mb-3">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="font-semibold text-sm">明細 ({cart.length}件)</span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {cart.map((item, idx) => (
                    <div key={item.tempId} className="flex items-center justify-between py-1.5 px-2 rounded bg-secondary/40 text-sm">
                      <span className="text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                      <span className="flex-1 font-medium truncate">{item.departmentName}</span>
                      <span className="tabular-nums text-muted-foreground text-xs mr-1">
                        ¥{item.unitPrice.toLocaleString()}×{item.quantity}
                      </span>
                      <span className="tabular-nums font-semibold w-20 text-right shrink-0">
                        ¥{item.grossAmount.toLocaleString()}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 ml-1 text-destructive shrink-0"
                        onClick={() => handleRemoveFromCart(item.tempId)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Separator className="my-3" />
                {taxMode === 'exclusive' && (
                  <div className="space-y-1 text-sm mb-2">
                    <div className="flex justify-between text-muted-foreground">
                      <span>税抜合計</span>
                      <span className="tabular-nums">¥{netTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>消費税</span>
                      <span className="tabular-nums">¥{taxTotal.toLocaleString()}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center font-bold text-base">
                  <span>請求合計（税込）</span>
                  <span className="tabular-nums">¥{grossTotal.toLocaleString()}</span>
                </div>
                {taxMode === 'inclusive' && (
                  <div className="text-xs text-muted-foreground text-right tabular-nums">
                    （うち消費税 ¥{taxTotal.toLocaleString()}）
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Button className="w-full h-14 text-lg font-bold" onClick={handleToPayment} disabled={cart.length === 0}>
            小　計　→　お会計へ
          </Button>
        </main>
      </div>
    );
  }

  // ===== 支払フェーズ =====
  if (phase === 'payment') {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container px-3 py-4 max-w-lg mx-auto">
          <Card className="mb-4">
            <CardContent className="p-4">
              <h2 className="font-bold text-base mb-3">明細確認</h2>
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {cart.map((item, idx) => (
                  <div key={item.tempId} className="flex justify-between text-sm py-1">
                    <span className="text-muted-foreground">{idx + 1}. {item.departmentName}</span>
                    <span className="tabular-nums text-xs">
                      ¥{item.unitPrice.toLocaleString()}×{item.quantity} =
                      <span className="font-semibold ml-1">¥{item.grossAmount.toLocaleString()}</span>
                    </span>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              {taxMode === 'exclusive' && (
                <div className="space-y-1 text-sm mb-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>税抜合計</span><span className="tabular-nums">¥{netTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>消費税</span><span className="tabular-nums">¥{taxTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between font-bold text-xl">
                <span>請求合計</span>
                <span className="tabular-nums">¥{grossTotal.toLocaleString()}</span>
              </div>
              {taxMode === 'inclusive' && (
                <div className="text-xs text-muted-foreground text-right">（うち消費税 ¥{taxTotal.toLocaleString()}）</div>
              )}
            </CardContent>
          </Card>

          {/* 支払方法 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Button variant={paymentMethod === 'cash' ? 'default' : 'outline'} className="h-16 text-base gap-2 flex-col"
              onClick={() => setPaymentMethod('cash')}>
              <Banknote className="h-5 w-5" />現　金
            </Button>
            <Button variant={paymentMethod === 'credit' ? 'default' : 'outline'} className="h-16 text-base gap-2 flex-col"
              onClick={() => setPaymentMethod('credit')}>
              <CreditCard className="h-5 w-5" />掛　売
            </Button>
            <Button variant={paymentMethod === 'refund' ? 'destructive' : 'outline'} className="h-16 text-sm gap-1.5 flex-col"
              onClick={() => setPaymentMethod('refund')}>
              <RotateCcw className="h-5 w-5" />返　金
            </Button>
          </div>

          {/* 返金：説明表示 */}
          {paymentMethod === 'refund' && (
            <Card className="mb-4 border-destructive/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-destructive mb-1">
                  <RotateCcw className="h-4 w-4" />
                  <span className="font-bold text-sm">返金モード</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  カート内の金額をマイナスで日計に計上します。<br />
                  「返計」ボタンで確定してください。
                </p>
                <div className="mt-2 text-center font-bold text-destructive text-xl tabular-nums">
                  −¥{grossTotal.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 現金：預かり金入力 */}
          {paymentMethod === 'cash' && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <Label className="text-sm mb-2 block">預かり金</Label>
                <div className={`text-3xl font-bold tabular-nums text-center py-3 rounded-lg mb-3 ${change >= 0 && received > 0 ? 'bg-green-50 text-green-700' : 'bg-secondary'}`}>
                  ¥{received.toLocaleString()}
                </div>
                {received > 0 && (
                  <div className="text-center mb-3">
                    <span className="text-sm text-muted-foreground">おつり: </span>
                    <span className={`text-xl font-bold tabular-nums ${change >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      ¥{change.toLocaleString()}
                    </span>
                  </div>
                )}
                <NumericKeypad value={receivedStr} onChange={setReceivedStr} />
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {[1000, 2000, 5000, 10000].map(v => (
                    <Button key={v} variant="outline" className="h-9 text-xs"
                      onClick={() => setReceivedStr(String(Math.ceil(grossTotal / v) * v))}>
                      {v >= 10000 ? '1万' : v >= 5000 ? '5千' : v >= 2000 ? '2千' : '千'}円
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-12" onClick={() => setPhase('input')}>← 戻る</Button>
            <Button
              className={`h-12 text-base font-bold ${paymentMethod === 'refund' ? 'bg-destructive hover:bg-destructive/90 text-white' : ''}`}
              onClick={handleConfirmPayment}
              disabled={paymentMethod === 'cash' && received < grossTotal}>
              {paymentMethod === 'cash' ? '現　計' : paymentMethod === 'refund' ? '返　計' : '掛　計'}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ===== 完了フェーズ =====
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container px-3 py-4 max-w-lg mx-auto">
        {showReceipt && completedSale ? (
          // レシート表示
          <div>
            <Receipt sale={completedSale} />
            <div className="grid grid-cols-2 gap-3 mt-4 no-print">
              <Button variant="outline" className="h-12 gap-2" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />プリンター選択 / 印刷
              </Button>
              <Button className="h-12" onClick={handleNext}>次のお客様</Button>
            </div>
          </div>
        ) : (
          // 完了サマリー
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <CheckCircle2 className="h-20 w-20 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">会計完了</h2>
            {completedSale?.paymentMethod === 'cash' && completedSale.changeAmount > 0 && (
              <div className="text-center mb-4">
                <p className="text-muted-foreground text-sm">おつり</p>
                <p className="text-4xl font-bold tabular-nums text-green-600">¥{completedSale.changeAmount.toLocaleString()}</p>
              </div>
            )}
            {completedSale?.paymentMethod === 'credit' && (
              <Badge variant="secondary" className="text-base px-4 py-1 mb-4">掛売</Badge>
            )}
            {completedSale?.paymentMethod === 'refund' && (
              <div className="text-center mb-4">
                <Badge variant="destructive" className="text-base px-4 py-1 mb-1">返金</Badge>
                <p className="text-2xl font-bold tabular-nums text-destructive">
                  −¥{Math.abs(completedSale.grossTotal).toLocaleString()}
                </p>
              </div>
            )}
            <div className="w-full space-y-3 mt-2">
              <Button variant="outline" className="w-full h-12 gap-2" onClick={() => setShowReceipt(true)}>
                <Printer className="h-4 w-4" />レシートを表示 / 印刷
              </Button>
              <Button className="w-full h-14 text-lg font-bold" onClick={handleNext}>
                次のお客様
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
