import type { TaxMode } from '@/lib/tax';

interface CartItem {
  tempId: string;
  departmentName: string;
  unitPrice: number;
  quantity: number;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  taxRate: number;
  taxMode: TaxMode;
}

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

interface ReceiptProps {
  sale: CompletedSale;
}

function fmt(n: number) {
  return '¥' + n.toLocaleString();
}

export function Receipt({ sale }: ReceiptProps) {
  const { cart, grossTotal, netTotal, taxTotal, paymentMethod,
          receivedAmount, changeAmount, date, time, storeName,
          storeAddress, storePhone, taxMode } = sale;

  const dateLabel = date.replace(/-/g, '/');

  return (
    <div className="receipt-area font-mono text-sm bg-white text-black mx-auto"
         style={{ width: '100%', maxWidth: '320px', padding: '16px 12px' }}>

      {/* ヘッダー */}
      <div className="text-center mb-3">
        <div className="text-lg font-bold">{storeName || 'シンプルレジ'}</div>
        {storeAddress && (
          <div className="text-xs mt-0.5 text-gray-600">{storeAddress}</div>
        )}
        {storePhone && (
          <div className="text-xs text-gray-600">TEL: {storePhone}</div>
        )}
        <div className="text-xs mt-1">{dateLabel}　{time}</div>
        <div className="text-xs text-gray-500">{taxMode === 'inclusive' ? '内税（税込）' : '外税（税抜＋消費税）'}</div>
      </div>

      <div className="border-t border-dashed border-gray-400 my-2" />

      {/* 明細 */}
      <div className="space-y-1 mb-2">
        {cart.map((item, idx) => (
          <div key={item.tempId}>
            <div className="flex justify-between">
              <span className="truncate flex-1 mr-2">{idx + 1}. {item.departmentName}</span>
              <span className="shrink-0">{fmt(item.grossAmount)}</span>
            </div>
            <div className="text-xs text-gray-500 pl-3 flex justify-between">
              <span>
                {taxMode === 'inclusive' ? '税込' : '税抜'}
                {fmt(item.unitPrice)} × {item.quantity}
                {item.taxRate > 0 ? `　消費税${item.taxRate}%` : '　非課税'}
              </span>
              {taxMode === 'exclusive' && item.taxRate > 0 && (
                <span>税 {fmt(item.taxAmount)}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2" />

      {/* 合計 */}
      <div className="space-y-1 mb-2">
        {taxMode === 'exclusive' && (
          <>
            <div className="flex justify-between text-sm">
              <span>税抜合計</span>
              <span className="tabular-nums">{fmt(netTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>消費税</span>
              <span className="tabular-nums">{fmt(taxTotal)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-bold text-base">
          <span>合　計</span>
          <span className="tabular-nums">{fmt(grossTotal)}</span>
        </div>
        {taxMode === 'inclusive' && taxTotal > 0 && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>（うち消費税</span>
            <span className="tabular-nums">{fmt(taxTotal)}）</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2" />

      {/* 支払 */}
      <div className="space-y-1 mb-2">
        {paymentMethod === 'cash' ? (
          <>
            <div className="flex justify-between text-sm">
              <span>お預り</span>
              <span className="tabular-nums">{fmt(receivedAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span>おつり</span>
              <span className="tabular-nums">{fmt(changeAmount)}</span>
            </div>
          </>
        ) : paymentMethod === 'refund' ? (
          <div className="flex justify-between text-sm font-bold text-red-600">
            <span>返　金</span>
            <span className="tabular-nums">{fmt(grossTotal)}</span>
          </div>
        ) : (
          <div className="flex justify-between text-sm font-bold">
            <span>掛　売</span>
            <span className="tabular-nums">{fmt(grossTotal)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-gray-400 my-3" />

      {/* フッター */}
      <div className="text-center text-xs text-gray-500">
        ありがとうございました
      </div>
      {(storeAddress || storePhone) && (
        <div className="text-center text-xs text-gray-400 mt-1 space-y-0.5">
          {storeAddress && <div>{storeAddress}</div>}
          {storePhone && <div>TEL: {storePhone}</div>}
        </div>
      )}
    </div>
  );
}
