import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, Trash2, Clock, HeartPulse, Building2, FileText, ChevronDown } from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { SIDEBAR_NAV, isNavGroup, type NavItem, type NavGroup } from '@/app/navigation';
import { useSavedViewsStore } from '@/store/savedViewsStore';
import { useRecentStore, type RecentKind } from '@/store/recentStore';
import { useFilterStore } from '@/store/filterStore';
import { useUiStore } from '@/store/uiStore';
import { getDataSource } from '@/data/datasource';
import { cn } from '@/lib/cn';

const recentIcon: Record<RecentKind, typeof Clock> = {
  page: FileText,
  indicator: HeartPulse,
  facility: Building2,
};

/** Row geometry shared by every rail entry — centred to a 40px square when collapsed. */
const rowClass = (collapsed: boolean, active: boolean) =>
  cn(
    'group flex items-center rounded-lg text-sm font-medium transition-colors',
    collapsed ? 'h-10 w-10 justify-center' : 'gap-3 px-3 py-2.5',
    active ? 'bg-brand/12 text-brand-bright' : 'text-text-soft hover:bg-bg-elev-2 hover:text-text'
  );

/** Section heading; collapses to a hairline rule so the rail keeps its rhythm. */
function SectionLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  if (collapsed) return <div className="mx-auto my-2 h-px w-6 bg-border-soft" />;
  return (
    <p className="flex items-center gap-1.5 px-3 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-2">
      {children}
    </p>
  );
}

/**
 * Hover flyout listing a group's pages while the rail is collapsed — there's no
 * room to expand inline at 64px. Rendered in a portal so the nav's `overflow-y`
 * can't clip it. Clicking the trigger instead expands the whole rail.
 */
function RailFlyout({
  group,
  active,
  onNavigate,
  onExpand,
}: {
  group: NavGroup;
  active: boolean;
  onNavigate?: () => void;
  onExpand: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.top, left: r.right });
    setOpen(true);
  };

  return (
    <div ref={ref} onMouseEnter={show} onMouseLeave={() => setOpen(false)}>
      <button
        onClick={onExpand}
        title={group.label}
        aria-label={group.label}
        className={cn(rowClass(true, active), 'mx-auto')}
      >
        <group.icon size={18} className="flex-shrink-0" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              // No gap between trigger and panel — the padding lives inside, so the
              // pointer never crosses a dead zone that would dismiss the flyout.
              className="fixed z-[120] pl-2"
              style={{ top: pos.top, left: pos.left }}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.14 }}
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
            >
              <div className="w-60 rounded-xl border border-border bg-bg-elev-2 p-1.5 shadow-pop">
                <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-2">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className={({ isActive }) => rowClass(false, isActive)}
                  >
                    <item.icon size={16} className="flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

/**
 * A collapsible sidebar section. Collapsed by default, so its pages stay out of
 * the way until asked for — but it auto-expands when the active route lives
 * inside it, so the current page is never hidden from the user.
 */
function NavGroupSection({
  group,
  collapsed,
  onNavigate,
}: {
  group: NavGroup;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const open = useUiStore((s) => !!s.openNavGroups[group.label]);
  const toggle = useUiStore((s) => s.toggleNavGroup);
  const setOpen = useUiStore((s) => s.setNavGroupOpen);
  const setNavCollapsed = useUiStore((s) => s.setNavCollapsed);
  const holdsActive = group.items.some((i) => location.pathname.startsWith(i.to));

  useEffect(() => {
    if (holdsActive) setOpen(group.label, true);
  }, [holdsActive, group.label, setOpen]);

  if (collapsed) {
    return (
      <RailFlyout
        group={group}
        active={holdsActive}
        onNavigate={onNavigate}
        onExpand={() => {
          setNavCollapsed(false);
          setOpen(group.label, true);
        }}
      />
    );
  }

  return (
    <div>
      <button
        onClick={() => toggle(group.label)}
        aria-expanded={open}
        title={group.description}
        className={cn(rowClass(false, holdsActive && !open), 'w-full')}
      >
        <group.icon size={17} className="flex-shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          size={15}
          className={cn('flex-shrink-0 text-muted-2 transition-transform', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-[26px] mt-1 space-y-1 border-l border-border-soft pl-2">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => rowClass(false, isActive)}
                  onClick={onNavigate}
                >
                  <item.icon size={16} className="flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItemLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) => cn(rowClass(collapsed, isActive), collapsed && 'mx-auto')}
    >
      <item.icon size={collapsed ? 18 : 17} className="flex-shrink-0" />
      {!collapsed && <span className="flex-1">{item.label}</span>}
    </NavLink>
  );
}

export function Sidebar({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  /** Icon-only rail. Never set for the mobile drawer, which is always full width. */
  collapsed?: boolean;
}) {
  const views = useSavedViewsStore((s) => s.views);
  const removeView = useSavedViewsStore((s) => s.remove);
  const recent = useRecentStore((s) => s.items);
  const applyFilter = useFilterStore((s) => s.apply);
  const navigate = useNavigate();
  const ds = getDataSource();

  return (
    <div className="flex h-full flex-col bg-bg-elev">
      <div
        className={cn(
          'flex h-16 items-center border-b border-border-soft',
          collapsed ? 'justify-center px-2' : 'px-3'
        )}
      >
        <Link
          to="/"
          onClick={onNavigate}
          aria-label="NPHCDA — go to home"
          title="Go to home"
          className={cn(
            'flex items-center rounded-lg transition-colors hover:bg-bg-elev-2',
            collapsed ? 'p-1' : 'px-2 py-1'
          )}
        >
          {collapsed ? <LogoMark size={30} /> : <Logo />}
        </Link>
      </div>

      <nav
        data-tour="nav"
        className={cn('flex-1 space-y-1 overflow-y-auto overflow-x-hidden py-4', collapsed ? 'px-2' : 'px-3')}
      >
        <SectionLabel collapsed={collapsed}>Dashboard</SectionLabel>
        {SIDEBAR_NAV.map((entry) =>
          isNavGroup(entry) ? (
            <NavGroupSection key={entry.label} group={entry} collapsed={collapsed} onNavigate={onNavigate} />
          ) : (
            <NavItemLink key={entry.to} item={entry} collapsed={collapsed} onNavigate={onNavigate} />
          )
        )}

        {views.length > 0 && (
          <div className="pt-4">
            <SectionLabel collapsed={collapsed}>Saved views</SectionLabel>
            {views.map((v) => {
              const open = () => {
                applyFilter(v.filter);
                navigate(v.page);
                onNavigate?.();
              };
              return collapsed ? (
                <button
                  key={v.id}
                  onClick={open}
                  title={v.name}
                  aria-label={v.name}
                  className={cn(rowClass(true, false), 'mx-auto')}
                >
                  <Bookmark size={16} className="flex-shrink-0 text-brand-bright" />
                </button>
              ) : (
                <div key={v.id} className="group flex items-center gap-1 rounded-lg pr-1 hover:bg-bg-elev-2">
                  <button
                    onClick={open}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-text-soft hover:text-text"
                  >
                    <Bookmark size={15} className="flex-shrink-0 text-brand-bright" />
                    <span className="truncate">{v.name}</span>
                  </button>
                  <button
                    onClick={() => removeView(v.id)}
                    className="hidden flex-shrink-0 rounded p-1 text-muted hover:text-danger group-hover:block"
                    aria-label="Remove view"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {recent.filter((r) => r.kind !== 'page').length > 0 && (
          <div className="pt-4">
            <SectionLabel collapsed={collapsed}>
              <Clock size={12} /> Recently viewed
            </SectionLabel>
            {recent
              .filter((r) => r.kind !== 'page')
              .slice(0, 6)
              .map((r) => {
                const Icon = recentIcon[r.kind];
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      navigate(r.href);
                      onNavigate?.();
                    }}
                    title={r.label}
                    aria-label={collapsed ? r.label : undefined}
                    className={cn(
                      collapsed
                        ? cn(rowClass(true, false), 'mx-auto')
                        : 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-text-soft transition-colors hover:bg-bg-elev-2 hover:text-text'
                    )}
                  >
                    <Icon size={collapsed ? 16 : 15} className="flex-shrink-0 text-muted-2" />
                    {!collapsed && <span className="truncate">{r.label}</span>}
                  </button>
                );
              })}
          </div>
        )}
      </nav>

      <div className={cn('border-t border-border-soft', collapsed ? 'p-2' : 'p-3')}>
        <div
          className={cn(
            'flex items-center rounded-lg bg-bg-elev-2',
            collapsed ? 'h-10 w-10 justify-center' : 'gap-2 px-3 py-2'
          )}
          title={collapsed ? ds.meta.label : undefined}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              ds.meta.mode === 'mock' ? 'bg-warning' : 'bg-brand-bright'
            )}
          />
          {!collapsed && <span className="text-[12px] font-medium text-muted">{ds.meta.label}</span>}
        </div>
      </div>
    </div>
  );
}
