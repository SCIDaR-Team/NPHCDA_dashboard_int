import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Sun, Moon, Settings, User as UserIcon, CheckCheck, Contrast, Trash2, BellOff, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/store/themeStore';
import { useNotificationStore } from '@/store/notificationStore';
import { Drawer } from '@/components/ui/Drawer';
import { useAuthStore } from '@/features/auth/authStore';
import { cn } from '@/lib/cn';
import { TOPBAR_ICON_BTN, TOPBAR_ICON_BTN_ON } from './topbarStyles';

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  return (
    <button
      onClick={toggle}
      title="Toggle light / dark mode"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={TOPBAR_ICON_BTN}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

/** Toggles the colour-blind-safe (viridis) performance heat scale app-wide. */
export function ColorBlindToggle() {
  const on = useThemeStore((s) => s.colorBlindSafe);
  const toggle = useThemeStore((s) => s.toggleColorBlindSafe);
  return (
    <button
      onClick={toggle}
      title={on ? 'Colour-blind-safe scale: on' : 'Colour-blind-safe scale: off'}
      aria-label={on ? 'Disable colour-blind-safe scale' : 'Enable colour-blind-safe scale'}
      aria-pressed={on}
      className={cn(TOPBAR_ICON_BTN, on && TOPBAR_ICON_BTN_ON)}
    >
      <Contrast size={18} />
    </button>
  );
}

function useOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return ref;
}

const toneDot: Record<string, string> = {
  success: 'bg-brand-bright',
  error: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
};

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markRead = useNotificationStore((s) => s.markRead);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const ref = useOutside(() => setOpen(false));
  const navigate = useNavigate();
  const count = unreadCount();

  const openItem = (id: string, href?: string) => {
    markRead(id);
    setOpen(false);
    if (href) navigate(href);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(TOPBAR_ICON_BTN, 'relative')}
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
            {count}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-card border border-border bg-bg-elev shadow-pop"
          >
            <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <span className="text-sm font-bold text-text">Notifications</span>
              {notifications.length > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-bright hover:underline"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted">
                  <BellOff size={20} className="text-muted-2" />
                  <span className="text-sm">You're all caught up.</span>
                </div>
              ) : (
                notifications.slice(0, 5).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openItem(n.id, n.href)}
                    className="flex w-full gap-3 border-b border-border-soft px-4 py-3 text-left transition-colors last:border-0 hover:bg-bg-elev-2"
                  >
                    <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${toneDot[n.tone]}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${n.read ? 'font-medium text-text-soft' : 'font-bold text-text'}`}>
                          {n.title}
                        </span>
                        <span className="flex-shrink-0 text-[11px] text-muted">{n.time}</span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.description}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => {
                setOpen(false);
                setCenterOpen(true);
              }}
              className="block w-full border-t border-border-soft px-4 py-2.5 text-center text-xs font-bold text-brand-bright transition-colors hover:bg-bg-elev-2"
            >
              View all notifications
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <NotificationCenter
        open={centerOpen}
        onClose={() => setCenterOpen(false)}
        onOpenItem={(id, href) => {
          markRead(id);
          setCenterOpen(false);
          if (href) navigate(href);
        }}
      />
    </div>
  );
}

/** Full notification centre — the complete alert list with all/unread filtering,
 *  per-item dismiss and bulk actions, in a slide-over drawer. */
function NotificationCenter({
  open,
  onClose,
  onOpenItem,
}: {
  open: boolean;
  onClose: () => void;
  onOpenItem: (id: string, href?: string) => void;
}) {
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const clearNotifications = useNotificationStore((s) => s.clearNotifications);
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const shown = useMemo(
    () => (tab === 'unread' ? notifications.filter((n) => !n.read) : notifications),
    [notifications, tab]
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      width={400}
      title="Notification centre"
      subtitle="Alerts derived from the current data snapshot"
      footer={
        notifications.length > 0 && (
          <div className="flex items-center justify-between">
            <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs font-semibold text-brand-bright hover:underline">
              <CheckCheck size={14} /> Mark all read
            </button>
            <button onClick={clearNotifications} className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-danger">
              <Trash2 size={14} /> Clear all
            </button>
          </div>
        )
      }
    >
      <div className="mb-3 inline-flex rounded-lg border border-border bg-bg-elev p-0.5">
        {(['all', 'unread'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
              tab === t ? 'bg-brand text-white' : 'text-muted hover:text-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted">
          <Inbox size={22} className="text-muted-2" />
          <span className="text-sm">{tab === 'unread' ? 'No unread notifications.' : 'No notifications.'}</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((n) => (
            <li
              key={n.id}
              className={`group rounded-lg border px-3 py-2.5 ${n.read ? 'border-border-soft bg-bg-elev' : 'border-border bg-bg-elev-2/50'}`}
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${toneDot[n.tone]}`} />
                <button onClick={() => onOpenItem(n.id, n.href)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm ${n.read ? 'font-medium text-text-soft' : 'font-bold text-text'}`}>{n.title}</span>
                    <span className="flex-shrink-0 text-[11px] text-muted">{n.time}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.description}</p>
                  {n.href && <span className="mt-1 inline-block text-[11px] font-semibold text-brand-bright">Open →</span>}
                </button>
                <button
                  onClick={() => removeNotification(n.id)}
                  aria-label="Dismiss notification"
                  className="rounded p-0.5 text-muted-2 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const ref = useOutside(() => setOpen(false));

  if (!user) return null;
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Account menu — ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-bg-elev-2"
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: user.avatarColor }}
        >
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-bold leading-tight text-text">{user.name}</span>
          <span className="block text-[11px] leading-tight text-muted">{user.role}</span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-card border border-border bg-bg-elev shadow-pop"
          >
            <div className="border-b border-border-soft px-4 py-3">
              <div className="text-sm font-bold text-text">{user.name}</div>
              <div className="truncate text-xs text-muted">{user.email}</div>
            </div>
            <div className="p-1.5">
              <MenuRow icon={UserIcon} label="Profile & settings" onClick={() => { navigate('/app/settings'); setOpen(false); }} />
              <MenuRow icon={Settings} label="Preferences" onClick={() => { navigate('/app/settings'); setOpen(false); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Bell;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-bg-elev-2 ${
        danger ? 'text-danger' : 'text-text-soft hover:text-text'
      }`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}
