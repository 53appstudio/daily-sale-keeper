// =============================================================
// ⚠️  ルーター設定 — 変更禁止（CLAUDE.md 参照）
// -------------------------------------------------------------
// HashRouter を必ず使うこと。BrowserRouter に変えると
// GitHub Pages でリロード時に 404 エラーになる。
// リンクは必ず <Link to="/"> を使い、<a href="/"> は使わない。
// =============================================================
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom"; // ⚠️ BrowserRouter は使わない
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import Journal from "./pages/Journal";
import Departments from "./pages/Departments";
import TaxRates from "./pages/TaxRates";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <HashRouter> {/* ⚠️ GitHub Pages 用: BrowserRouter に変えない */}
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/tax-rates" element={<TaxRates />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
// HashRouter は URL に # を使ってルーティングする（例: /#/, /#/journal）
// サーバーサイドの設定不要なので GitHub Pages で正常動作する

export default App;
