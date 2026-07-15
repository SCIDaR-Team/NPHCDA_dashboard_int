import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, SlidersHorizontal, Search, X, Clock } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { FilterDrawer } from './FilterDrawer';
import { GlobalSearch } from './GlobalSearch';
import { ThemeToggle, ColorBlindToggle } from './TopbarMenus';
import { NAV_ITEMS } from '@/app/navigation';
import { useFilterStore } from '@/store/filterStore';
import { useFilterUrlSync } from '@/hooks/useFilterUrlSync';
import { useThemeStore } from '@/store/themeStore';
import { Badge, Tooltip } from '@/components/ui';
import { scopeLabel } from '@/data/calculations';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { formatDate, relativeTime } from '@/lib/freshness';

export function AppShell() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  const filter = useFilterStore();
  const activeCount = filter.activeCount();
  // Keep the global filter scope reflected in the URL (shareable deep links).
  useFilterUrlSync();
  // The CVD preference is baked into memoised chart options (via heatColor), so a
  // plain re-render wouldn't recolour them. Keying the routed subtree on it forces
  // a full remount → every chart/table/map recomputes with the new scale at once.
  const colorBlindSafe = useThemeStore((s) => s.colorBlindSafe);

  const ds = getDataSource();
  const { data: snapMeta } = useAsync(() => ds.getSnapshotMeta());

  const current = NAV_ITEMS.find((n) => location.pathname.startsWith(n.to));

  // Close mobile nav on route change.
  useEffect(() => setMobileNav(false), [location.pathname]);

  // Cmd/Ctrl+K opens search.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const scope = scopeLabel(filter);

  return (
    <div className="min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border lg:block">
        <Sidebar />
      </aside>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNav(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border lg:hidden"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              <button
                onClick={() => setMobileNav(false)}
                aria-label="Close navigation"
                className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-muted hover:bg-bg-elev-2 hover:text-text"
              >
                <X size={18} />
              </button>
              <Sidebar onNavigate={() => setMobileNav(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-bg-elev/90 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setMobileNav(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-soft hover:bg-bg-elev-2 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <button
            onClick={() => setFilterOpen(true)}
            aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}
            className="relative flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-text-soft transition-colors hover:bg-bg-elev-2 hover:text-text"
          >
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>

          <div className="ml-1 hidden min-w-0 md:block">
            <h1 className="truncate text-[15px] font-bold text-text">{current?.label ?? 'Dashboard'}</h1>
          </div>

          {scope && (
            <Badge tone="brand" className="hidden lg:inline-flex">
              Scoped: {scope}
            </Badge>
          )}

          <div className="ml-auto flex items-center gap-1">
            {snapMeta?.generatedAt && (
              <Tooltip
                content={`Snapshot generated ${formatDate(snapMeta.generatedAt)}${
                  snapMeta.period?.to ? ` · data through ${snapMeta.period.to}` : ''
                }`}
              >
                <span className="mr-1 hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted xl:flex">
                  <Clock size={14} className="text-muted-2" />
                  <span className="hidden 2xl:inline">Data as of</span> {formatDate(snapMeta.generatedAt)}
                  <span className="text-muted-2">· {relativeTime(snapMeta.generatedAt)}</span>
                </span>
              </Tooltip>
            )}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search (Ctrl or Cmd + K)"
              className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted transition-colors hover:bg-bg-elev-2 hover:text-text"
            >
              <Search size={16} />
              <span className="hidden lg:inline">Search…</span>
              <kbd className="hidden rounded border border-border px-1 text-[11px] lg:inline">⌘K</kbd>
            </button>
            <ColorBlindToggle />
            <ThemeToggle />
          </div>
        </header>

        {/* Routed page */}
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <motion.div
            key={`${location.pathname}-${colorBlindSafe ? 'cvd' : 'std'}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      <FilterDrawer open={filterOpen} onClose={() => setFilterOpen(false)} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
