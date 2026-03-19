import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SaleItem, type Department } from '@/db';
import { seedInitialData } from '@/db';
import { calculateTax, getEffectiveTaxRate, type TaxCategory } from '@/lib/tax';
import { AppHeader } from '@/components/AppHeader';
import { NumericKeypad } from '@/components/NumericKeypad';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Trash2, ShoppingCart, CreditCard, Banknote, CheckCircle2 } from 'lucide-react';

// 画面フェーズ
type Phase = 'input' | 'payment' | 'complete';

// カート内アイテム（未確定）
interface CartItem {
  tempId: string;
  departmentId: string;
  departmentName: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  taxCategory: TaxCategory;
  taxRate: number;
  taxExcludedAmount: number;
  taxAmount: number;
}

export default function RegisterPage() {
  const today = new Date().toISOString().split('T')[0];
  const departments = useLiveQuery(() => db.departments.orderBy('sortOrder').toArray()) ?? [];

  // フェーズ管理
  const [phase, setPhase] = useState<Phase>('input');

  // 入力フェーズの状態
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [qtyStr, setQtyStr] = useState('1');
  const [inputMode, setInputMode] = useState<'price' | 'qty'>('price');
  const [taxRate, setTaxRate] = useState(10);

  // カート
  const [cart, setCart] = useState<CartItem[]>([]);

  // 支払フェーズの状態
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [receivedStr, setReceivedStr] = useState('');

  // 完了フェーズの状態
  const [lastChange, setLastChange] = useState(0);

  useEffect(() => { seedInitialData(); }, []);

  // 部門初期選択
  useEffect(() => {
    if (departments.length > 0 && !selectedDeptId) {
      setSelectedDeptId(departments[0].id);
    }
  }, [departments, selectedDeptId]);

  // 部門変更時に税率更新
  useEffect(() => {
    const dept = departments.find(d => d.id === selectedDeptId);
    if (dept) {
      getEffectiveTaxRate(dept.defaultTaxCategory, today).then(setTaxRate);
    }
  }, [selectedDeptId, departments, today]);

  const price = parseInt(priceStr, 10) || 0;
  const qty = parseInt(qtyStr, 10) || 1;
  const subtotal = cart.reduce((s, i) => s + i.amount, 0);
  const totalTax = cart.reduce((s, i) => s + i.taxAmount, 0);
  const received = parseInt(receivedStr, 10) || 0;
  const change = received - subtotal;

  // useLiveQuery は非同期のため初回は空配列 → departments[0] をフォールバックで使う
  const effectiveDeptId = selectedDeptId || departments[0]?.id || '';
  const selectedDept = departments.find(d => d.id === effectiveDeptId);

  // カートに追加
  const handleAddToCart = () => {
    if (price < 1 || !effectiveDeptId) return;
    const amount = price * qty;
    const dept = departments.find(d => d.id === effectiveDeptId);
    const taxCat: TaxCategory = dept?.defaultTaxCategory ?? 'standard';
    const { taxExcludedAmount, taxAmount } = calculateTax(amount, taxRate);
    // selectedDeptId 未設定なら確定させる
    if (!selectedDeptId && effectiveDeptId) setSelectedDeptId(effectiveDeptId);
    setCart(prev => [...prev, {
      tempId: crypto.randomUUID(),
      departmentId: effectiveDeptId,
      departmentName: dept?.name ?? '不明',
      unitPrice: price,
      quantity: qty,
      amount,
      taxCategory: taxCat,
      taxRate,
      taxExcludedAmount,
      taxAmount,
    }]);
    setPriceStr('');
    setQtyStr('1');
    setInputMode('price');
  };

  // カートから削除
  const handleRemoveFromCart = (tempId: string) => {
    setCart(prev => prev.filter(i => i.tempId !== tempId));
  };

  // 小計→支払へ
  const handleToPayment = () => {
    if (cart.length === 0) return;
    setPaymentMethod('cash');
    setReceivedStr('');
    setPhase('payment');
  };

  // 会計確定
  const handleConfirmPayment = async () => {
    const now = new Date();
    const saleId = crypto.randomUUID();
    const receivedAmount = paymentMethod === 'cash' ? received : subtotal;
    const changeAmount = paymentMethod === 'cash' ? Math.max(0, change) : 0;

    await db.sales.add({
      id: saleId,
      date: today,
      time: now.toTimeString().slice(0, 5),
      subtotal,
      totalTax,
      paymentMethod,
      receivedAmount,
      changeAmount,
      createdAt: now.toISOString(),
    });

    await db.saleItems.bulkAdd(cart.map(item => ({
      id: crypto.randomUUID(),
      saleId,
      departmentId: item.departmentId,
      departmentName: item.departmentName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      amount: item.amount,
      taxCategory: item.taxCategory,
      taxRate: item.taxRate,
      taxExcludedAmount: item.taxExcludedAmount,
      taxAmount: item.taxAmount,
    })));

    setLastChange(changeAmount);
    setCart([]);
    setPhase('complete');
  };

  // 次の顧客へ
  const handleNext = () => {
    setPriceStr('');
    setQtyStr('1');
    setInputMode('price');
    setPhase('input');
  };

  // ===== 入力フェーズ =====
  if (phase === 'input') {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container px-3 py-4 max-w-lg mx-auto">

          {/* 部門選択ボタン */}
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
                {/* 価格 */}
                <button
                  className={`rounded-lg p-3 text-left border-2 transition-colors ${inputMode === 'price' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}`}
                  onClick={() => setInputMode('price')}
                >
                  <div className="text-xs text-muted-foreground mb-1">単価（税込）</div>
                  <div className="text-2xl font-bold tabular-nums">
                    ¥{price.toLocaleString()}
                  </div>
                </button>
                {/* 個数 */}
                <button
                  className={`rounded-lg p-3 text-left border-2 transition-colors ${inputMode === 'qty' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}`}
                  onClick={() => setInputMode('qty')}
                >
                  <div className="text-xs text-muted-foreground mb-1">個数</div>
                  <div className="text-2xl font-bold tabular-nums">{qty}</div>
                </button>
              </div>

              {/* 小計表示 */}
              {price > 0 && (
                <div className="text-center text-sm text-muted-foreground mb-3">
                  小計: <span className="font-semibold text-foreground">¥{(price * qty).toLocaleString()}</span>
                  　税率: {taxRate}%
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
                      <span className="text-muted-foreground w-5">{idx + 1}.</span>
                      <span className="flex-1 font-medium">{item.departmentName}</span>
                      <span className="tabular-nums text-muted-foreground mr-2">
                        ¥{item.unitPrice.toLocaleString()} × {item.quantity}
                      </span>
                      <span className="tabular-nums font-semibold w-20 text-right">
                        ¥{item.amount.toLocaleString()}
                      </span>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 ml-1 text-destructive shrink-0"
                        onClick={() => handleRemoveFromCart(item.tempId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between items-center font-bold text-base">
                  <span>合計</span>
                  <span className="tabular-nums">¥{subtotal.toLocaleString()}</span>
                </div>
                <div className="text-xs text-muted-foreground text-right tabular-nums">
                  （消費税 ¥{totalTax.toLocaleString()}）
                </div>
              </CardContent>
            </Card>
          )}

          {/* 小計ボタン */}
          <Button
            className="w-full h-14 text-lg font-bold"
            variant="default"
            onClick={handleToPayment}
            disabled={cart.length === 0}
          >
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
                    <span className="tabular-nums">¥{item.unitPrice.toLocaleString()} × {item.quantity} = <span className="font-semibold">¥{item.amount.toLocaleString()}</span></span>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="flex justify-between font-bold text-xl">
                <span>合　計</span>
                <span className="tabular-nums">¥{subtotal.toLocaleString()}</span>
              </div>
              <div className="text-xs text-muted-foreground text-right">（消費税 ¥{totalTax.toLocaleString()}）</div>
            </CardContent>
          </Card>

          {/* 支払方法 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              variant={paymentMethod === 'cash' ? 'default' : 'outline'}
              className="h-16 text-base gap-2 flex-col"
              onClick={() => setPaymentMethod('cash')}
            >
              <Banknote className="h-5 w-5" />
              現　金
            </Button>
            <Button
              variant={paymentMethod === 'credit' ? 'default' : 'outline'}
              className="h-16 text-base gap-2 flex-col"
              onClick={() => setPaymentMethod('credit')}
            >
              <CreditCard className="h-5 w-5" />
              掛　売
            </Button>
          </div>

          {/* 現金の場合：預かり金入力 */}
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
                {/* クイック金額 */}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {[1000, 2000, 5000, 10000].map(v => (
                    <Button key={v} variant="outline" className="h-9 text-xs"
                      onClick={() => setReceivedStr(String(Math.ceil(subtotal / v) * v))}>
                      {v >= 10000 ? '1万' : v >= 5000 ? '5千' : v >= 2000 ? '2千' : '千'}円
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-12" onClick={() => setPhase('input')}>
              ← 戻る
            </Button>
            <Button
              className="h-12 text-base font-bold"
              onClick={handleConfirmPayment}
              disabled={paymentMethod === 'cash' && (received < subtotal)}
            >
              {paymentMethod === 'cash' ? '現　計' : '掛　計'}
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
      <main className="container px-3 py-4 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <CheckCircle2 className="h-20 w-20 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">会計完了</h2>
        {lastChange > 0 && (
          <div className="text-center mb-4">
            <p className="text-muted-foreground text-sm">おつり</p>
            <p className="text-4xl font-bold tabular-nums text-green-600">¥{lastChange.toLocaleString()}</p>
          </div>
        )}
        {paymentMethod === 'credit' && (
          <div className="mb-4">
            <Badge variant="secondary" className="text-base px-4 py-1">掛売</Badge>
          </div>
        )}
        <Button className="w-full h-14 text-lg font-bold mt-4" onClick={handleNext}>
          次のお客様
        </Button>
      </main>
    </div>
  );
}
