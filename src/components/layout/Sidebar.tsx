import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Settings, Bookmark, Trash2, ChevronRight } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { NAV_ITEMS, HOME_ITEM } from '@/app/navigation';
import { useSavedViewsStore } from '@/store/savedViewsStore';
import { useFilterStore } from '@/store/filterStore';
import { getDataSource } from '@/data/datasource';
import { cn } from '@/lib/cn';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const views = useSavedViewsStore((s) => s.views);
  const removeView = useSavedViewsStore((s) => s.remove);
  const applyFilter = useFilterStore((s) => s.apply);
  const navigate = useNavigate();
  const ds = getDataSource();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
      isActive ? 'bg-brand/12 text-brand-bright' : 'text-text-soft hover:bg-bg-elev-2 hover:text-text'
    );

  return (
    <div className="flex h-full flex-col bg-bg-elev">
      <div className="flex h-16 items-center border-b border-border-soft px-3">
        <Link
          to="/"
          onClick={onNavigate}
          aria-label="NPHCDA — go to landing page"
          title="Go to landing page"
          className="flex items-center rounded-lg px-2 py-1 transition-colors hover:bg-bg-elev-2"
        >
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavLink to={HOME_ITEM.to} className={linkClass} onClick={onNavigate}>
          <HOME_ITEM.icon size={17} className="flex-shrink-0" />
          <span className="flex-1">{HOME_ITEM.label}</span>
        </NavLink>

        <p className="px-3 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-wider text-muted-2">
          Dashboard
        </p>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass} onClick={onNavigate}>
            <item.icon size={17} className="flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
          </NavLink>
        ))}

        {views.length > 0 && (
          <div className="pt-4">
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-2">
              Saved views
            </p>
            {views.map((v) => (
              <div key={v.id} className="group flex items-center gap-1 rounded-lg pr-1 hover:bg-bg-elev-2">
                <button
                  onClick={() => {
                    applyFilter(v.filter);
                    navigate(v.page);
                    onNavigate?.();
                  }}
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
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-border-soft p-3">
        <NavLink to="/app/settings" className={linkClass} onClick={onNavigate}>
          <Settings size={17} />
          <span className="flex-1">Settings</span>
          <ChevronRight size={15} className="text-muted" />
        </NavLink>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-bg-elev-2 px-3 py-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              ds.meta.mode === 'mock' ? 'bg-warning' : 'bg-brand-bright'
            )}
          />
          <span className="text-[11px] font-medium text-muted">{ds.meta.label}</span>
        </div>
      </div>
    </div>
  );
}
