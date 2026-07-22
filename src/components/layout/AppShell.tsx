import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, ListFilter, Search, X, Clock, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { FilterDrawer } from './FilterDrawer';
import { GlobalSearch } from './GlobalSearch';
import { ThemeToggle, NotificationsMenu } from './TopbarMenus';
import { HelpButton } from './HelpCenter';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { NAV_ITEMS } from '@/app/navigation';
import { useFilterStore } from '@/store/filterStore';
import { useFilterUrlSync } from '@/hooks/useFilterUrlSync';
import { useThemeStore } from '@/store/themeStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useRecentStore } from '@/store/recentStore';
import { useUiStore } from '@/store/uiStore';
import { Badge, Tooltip } from '@/components/ui';
import { scopeLabel } from '@/data/calculations';
import { deriveAlerts } from '@/data/alerts';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { formatDate, relativeTime } from '@/lib/freshness';
import { cn } from '@/lib/cn';
import { TOPBAR_ICON_BTN, TOPBAR_LEAD_ICON } from './topbarStyles';

export function AppShell() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Collapsing the nav rail to icons hands its width back to the page.
  const navCollapsed = useUiStore((s) => s.navCollapsed);
  const toggleNav = useUiStore((s) => s.toggleNav);
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
  const { data: blocks } = useAsync(() => ds.getBlocks());

  // Populate the notification centre with alerts derived from the real snapshot
  // (below-target indicators, failing states, data gaps, freshness). Read state of
  // any surviving notification is preserved across re-derivations by the store.
  const setNotifications = useNotificationStore((s) => s.setNotifications);
  useEffect(() => {
    if (blocks) setNotifications(deriveAlerts(blocks, snapMeta ?? null));
  }, [blocks, snapMeta, setNotifications]);

  const current = NAV_ITEMS.find((n) => location.pathname.startsWith(n.to));

  // Track recently-viewed pages (indicator/facility visits are recorded from their
  // own components). Facility profile paths are dynamic, so they're skipped here.
  const recordRecent = useRecentStore((s) => s.record);
  useEffect(() => {
    if (current) recordRecent({ id: current.to, kind: 'page', label: current.label, href: current.to });
  }, [current, recordRecent]);

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
      {/* Desktop sidebar — collapses to an icon-only rail */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden border-r border-border transition-[width] duration-300 ease-out lg:block',
          navCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <Sidebar collapsed={navCollapsed} />
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

      {/* Main column — its left offset tracks the rail, so collapsing the nav hands
          192px back to the page. Charts follow via their ResizeObserver. */}
      <div
        className={cn(
          'transition-[padding-left] duration-300 ease-out',
          navCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-bg-elev/90 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setMobileNav(true)}
            className={cn(TOPBAR_ICON_BTN, 'lg:hidden')}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <button
            onClick={toggleNav}
            data-tour="collapse"
            aria-expanded={!navCollapsed}
            aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            className={cn(TOPBAR_ICON_BTN, 'hidden lg:flex')}
          >
            {navCollapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
          </button>

          <button
            onClick={() => setFilterOpen(true)}
            data-tour="filters"
            aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}
            className="relative flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-text-soft transition-colors hover:bg-bg-elev-2 hover:text-text"
          >
            <ListFilter size={16} className={TOPBAR_LEAD_ICON} />
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
                <span data-tour="freshness" className="mr-1 hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted xl:flex">
                  <Clock size={14} className="text-brand-bright" />
                  <span className="hidden 2xl:inline">Data as of</span> {formatDate(snapMeta.generatedAt)}
                  <span className="text-muted-2">· {relativeTime(snapMeta.generatedAt)}</span>
                </span>
              </Tooltip>
            )}
            <button
              onClick={() => setSearchOpen(true)}
              data-tour="search"
              aria-label="Search (Ctrl or Cmd + K)"
              className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted transition-colors hover:bg-bg-elev-2 hover:text-text"
            >
              <Search size={16} className={TOPBAR_LEAD_ICON} />
              <span className="hidden lg:inline">Search…</span>
              <kbd className="hidden rounded border border-border px-1 text-[11px] lg:inline">⌘K</kbd>
            </button>
            <span data-tour="help" className="inline-flex">
              <HelpButton />
            </span>
            <span data-tour="notifications" className="inline-flex">
              <NotificationsMenu />
            </span>
            <span data-tour="display" className="inline-flex items-center gap-1">
              <ThemeToggle />
            </span>
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
      <OnboardingTour />
    </div>
  );
}
