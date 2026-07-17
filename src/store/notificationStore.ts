import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

export interface AppNotification {
  id: string;
  tone: ToastTone;
  title: string;
  description: string;
  time: string;
  read: boolean;
  /** Optional in-app route to open when the notification is clicked. */
  href?: string;
}

interface NotificationStore {
  toasts: Toast[];
  notifications: AppNotification[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
  /** Replace the notification list (e.g. with alerts derived from the snapshot),
   *  preserving the read state of any notification whose id already exists. */
  setNotifications: (list: AppNotification[]) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  unreadCount: () => number;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Seed alerts mirror the kind of insights the dashboard surfaces. */
const SEED: AppNotification[] = [
  {
    id: uid(),
    tone: 'warning',
    title: 'Zero-dose burden above target',
    description: 'Zero-dose children at 13.8% nationally — target is <5%. Borno and Yobe driving the gap.',
    time: '2h ago',
    read: false,
  },
  {
    id: uid(),
    tone: 'error',
    title: 'Stock-out signal: Kaduna last mile',
    description: 'Vaccine stock-out flagged at last-mile facilities. Review Stock Status → cold-chain.',
    time: '5h ago',
    read: false,
  },
  {
    id: uid(),
    tone: 'success',
    title: 'Penta 3 coverage up 4.2 pts YoY',
    description: 'National Penta 3 coverage reached 86.4%, on track toward the 95% target.',
    time: '1d ago',
    read: true,
  },
];

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  toasts: [],
  notifications: SEED,
  toast: (t) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => get().dismiss(id), 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setNotifications: (list) =>
    set((s) => {
      // Preserve read state for notifications that persist across a re-derivation.
      const readIds = new Set(s.notifications.filter((n) => n.read).map((n) => n.id));
      return { notifications: list.map((n) => (readIds.has(n.id) ? { ...n, read: true } : n)) };
    }),
  removeNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  clearNotifications: () => set({ notifications: [] }),
  markAllRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  markRead: (id) =>
    set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
