import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Sun, Moon, LogOut, Settings, User as UserIcon, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/store/themeStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/features/auth/authStore';

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  return (
    <button
      onClick={toggle}
      title="Toggle light / dark mode"
      className="flex h-9 w-9 items-center justify-center rounded-lg text-text-soft transition-colors hover:bg-bg-elev-2 hover:text-text"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
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
  const { notifications, markAllRead, markRead, unreadCount } = useNotificationStore();
  const ref = useOutside(() => setOpen(false));
  const count = unreadCount();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-soft transition-colors hover:bg-bg-elev-2 hover:text-text"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
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
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-semibold text-brand-bright hover:underline"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className="flex w-full gap-3 border-b border-border-soft px-4 py-3 text-left transition-colors last:border-0 hover:bg-bg-elev-2"
                >
                  <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${toneDot[n.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${n.read ? 'font-medium text-text-soft' : 'font-bold text-text'}`}>
                        {n.title}
                      </span>
                      <span className="flex-shrink-0 text-[10px] text-muted">{n.time}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
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
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-bg-elev-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: user.avatarColor }}
        >
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-bold leading-tight text-text">{user.name}</span>
          <span className="block text-[10px] leading-tight text-muted">{user.role}</span>
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
              <MenuRow
                icon={LogOut}
                label="Sign out"
                danger
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
              />
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
