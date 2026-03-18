import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/', label: 'レジ' },
  { path: '/journal', label: '日計' },
  { path: '/departments', label: '部門' },
  { path: '/tax-rates', label: '税率' },
  { path: '/settings', label: '設定' },
];

export function AppHeader() {
  const location = useLocation();

  return (
    <header className="bg-navy text-navy-foreground no-print">
      <div className="container flex items-center justify-between h-14 px-4">
        <h1 className="text-lg font-bold tracking-tight">シンプルレジ</h1>
        <nav className="flex gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150',
                location.pathname === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'text-navy-foreground/70 hover:text-navy-foreground hover:bg-navy-foreground/10'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
