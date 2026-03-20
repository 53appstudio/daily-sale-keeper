import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/

// =============================================================
// ⚠️  GitHub Pages デプロイ設定 — 変更・削除禁止
// -------------------------------------------------------------
// base の "/daily-sale-keeper/" はリポジトリ名と一致させること。
// 本番ビルド時にこのパスが全アセットの URL プレフィックスになる。
// "production" 条件を外したり "/" に変えると GitHub Pages で
// JS/CSS が 404 になりアプリが起動しなくなる。
// =============================================================
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/daily-sale-keeper/" : "/", // ⚠️ 変更禁止（CLAUDE.md 参照）
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
