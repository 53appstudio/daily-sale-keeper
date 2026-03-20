# CLAUDE.md — daily-sale-keeper 開発ガイド

このファイルは Claude（AI アシスタント）がコードを編集・デプロイする際に従うべきルールをまとめたものです。

---

## プロジェクト概要

| 項目 | 値 |
|------|----|
| アプリ名 | シンプルレジ |
| リポジトリ | https://github.com/53appstudio/daily-sale-keeper |
| 公開 URL | https://53appstudio.github.io/daily-sale-keeper/ |
| フレームワーク | React + TypeScript + Vite |
| UI | shadcn/ui + Tailwind CSS |
| DB | Dexie.js（IndexedDB） |
| ルーター | react-router-dom v6（HashRouter） |

---

## GitHub Pages デプロイ ルール

### 必須設定（変更しないこと）

**vite.config.ts**
```ts
base: mode === "production" ? "/daily-sale-keeper/" : "/",
```
本番ビルド時のみ `/daily-sale-keeper/` をベースパスとして付与する。

**src/App.tsx**
```tsx
import { HashRouter } from "react-router-dom";
// BrowserRouter は絶対に使わない → GitHub Pages では 404 になる
```

**index.html**（ハッシュリダイレクト）
```html
<script>
  // ハッシュがない場合は /#/ へリダイレクト（GitHub Pages 用）
  if (!window.location.hash) {
    window.location.replace(window.location.href + '#/');
  }
</script>
```

### やってはいけないこと

| NG | OK |
|----|----|
| `<a href="/">` | `<Link to="/">` |
| `<BrowserRouter>` | `<HashRouter>` |
| `base: "/"` を本番で使う | `base: "/daily-sale-keeper/"` |
| `window.location.href = "/"` | `useNavigate()` を使う |

---

## デプロイ手順

### 1. ビルド
```bash
cd /home/user/webapp
npm run build
# → dist/ に成果物が生成される
```

### 2. gh-pages ブランチへ push
```bash
cd /tmp && rm -rf deploy_tmp && mkdir deploy_tmp && cd deploy_tmp
git init
git config credential.helper store   # ← 認証情報を引き継ぐ
git checkout -b gh-pages
cp -r /home/user/webapp/dist/. .
git add .
git commit -m "deploy: <変更内容の要約>"
git remote add origin https://github.com/53appstudio/daily-sale-keeper.git
git push -f origin gh-pages
```

> **注意**: `git remote add` の URL にトークンを直接埋め込まない。
> `git config credential.helper store` で `~/.git-credentials` から自動取得させる。

### 3. デプロイ確認
- GitHub リポジトリ → Settings → Pages → Source が `gh-pages` ブランチになっていること
- 数十秒後に https://53appstudio.github.io/daily-sale-keeper/ でアクセス確認

---

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動（port 8080）
npm run build    # 本番ビルド → dist/
npm run lint     # ESLint チェック
npm run test     # Vitest テスト実行
```

---

## ディレクトリ構成

```
src/
├── App.tsx              # ルーティング定義（HashRouter）
├── main.tsx             # エントリーポイント
├── db/
│   └── index.ts         # Dexie DB 定義・スキーマ・seedInitialData
├── lib/
│   └── tax.ts           # 税計算ユーティリティ（calcLineTotal 等）
├── pages/
│   ├── Index.tsx        # レジ入力・支払・完了フェーズ
│   ├── Journal.tsx      # 日計画面（CSV出力・印刷・修正履歴）
│   ├── Departments.tsx  # 部門管理
│   ├── TaxRates.tsx     # 税率管理
│   ├── Settings.tsx     # 設定（店舗情報・税モード・データ削除）
│   └── NotFound.tsx     # 404
├── components/
│   ├── AppHeader.tsx    # ナビゲーションヘッダー
│   ├── EditSaleModal.tsx# 日計の打ち間違い修正モーダル
│   ├── Receipt.tsx      # レシート表示コンポーネント
│   ├── NumericKeypad.tsx# テンキー UI
│   └── ui/              # shadcn/ui コンポーネント群
└── index.css            # グローバルスタイル・印刷用 CSS
```

---

## DB スキーマ（Dexie / IndexedDB）

| テーブル | 主なフィールド |
|----------|---------------|
| `departments` | id, name, defaultTaxCategory, sortOrder |
| `sales` | id, date, time, grossTotal, taxTotal, netTotal, taxMode, paymentMethod, receivedAmount, changeAmount |
| `saleItems` | id, saleId, departmentId, departmentName, unitPrice, quantity, netAmount, taxAmount, grossAmount, taxCategory, taxRate, taxMode |
| `taxRates` | id, category, rate, effectiveFrom |
| `settings` | key, value（storeName / storeAddress / storePhone / taxMode） |
| `auditLogs` | id, action, saleId, saleDate, saleTime, beforeSnapshot, afterSnapshot, operator, createdAt |

スキーマ変更時は `db/index.ts` の `version()` を必ずインクリメントする。

---

## 印刷・CSS ルール

- 印刷対象エリアは `.journal-print-area` クラスで囲む
- レシート印刷は `.receipt-area` クラスで囲む
- `no-print` クラスを付けた要素は印刷時に非表示になる
- 印刷前に `document.body.classList.add('journal-print-mode')` を付与し、印刷後に削除する
- CSS は `src/index.css` の `@media print` セクションで管理

---

## 支払方法の型

```ts
type PaymentMethod = 'cash' | 'credit' | 'refund';
// cash   = 現金
// credit = 掛売
// refund = 返金（grossTotal はマイナス値で保存）
```

---

## コミット・PR ルール

- ブランチ: `main` へ直接コミット・push
- コミットメッセージ形式: `type: 説明`
  - `feat:` 新機能
  - `fix:` バグ修正
  - `deploy:` デプロイのみのコミット
- 毎回コード変更後にビルドが通ることを確認してからコミットする
