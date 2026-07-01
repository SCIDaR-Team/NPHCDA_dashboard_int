import { useState } from 'react';
import { User, Palette, Database, Bookmark, Trash2, Check } from 'lucide-react';
import { SectionBlock, Button, Input, FieldLabel, Badge } from '@/components/ui';
import { useAuthStore } from '@/features/auth/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useSavedViewsStore } from '@/store/savedViewsStore';
import { useNotificationStore } from '@/store/notificationStore';
import { getDataSource } from '@/data/datasource';
import { PageHeader } from '@/components/dashboard/PageHeader';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const { theme, setTheme } = useThemeStore();
  const { views, remove } = useSavedViewsStore();
  const toast = useNotificationStore((s) => s.toast);
  const ds = getDataSource();

  const [name, setName] = useState(user?.name ?? '');
  const [role, setRole] = useState(user?.role ?? '');

  const saveProfile = () => {
    updateProfile({ name, role });
    toast({ tone: 'success', title: 'Profile updated' });
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, appearance and saved views." />

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionBlock title={<span className="flex items-center gap-2"><User size={16} /> Profile</span>}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
                style={{ background: user?.avatarColor }}
              >
                {name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
              </span>
              <div>
                <div className="text-sm font-bold text-text">{user?.email}</div>
                <Badge tone="brand" className="mt-1">{user?.role}</Badge>
              </div>
            </div>
            <div>
              <FieldLabel>Full name</FieldLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Role / title</FieldLabel>
              <Input value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <Button onClick={saveProfile}>
              <Check size={16} /> Save changes
            </Button>
          </div>
        </SectionBlock>

        <SectionBlock title={<span className="flex items-center gap-2"><Palette size={16} /> Appearance</span>}>
          <FieldLabel>Theme</FieldLabel>
          <div className="grid grid-cols-2 gap-3">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-xl border-2 p-4 text-left capitalize transition-all ${
                  theme === t ? 'border-brand bg-brand/8' : 'border-border hover:border-border'
                }`}
              >
                <div
                  className={`mb-3 h-12 rounded-lg border ${
                    t === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'
                  }`}
                />
                <span className="flex items-center justify-between text-sm font-semibold text-text">
                  {t} mode
                  {theme === t && <Check size={15} className="text-brand-bright" />}
                </span>
              </button>
            ))}
          </div>
        </SectionBlock>

        <SectionBlock title={<span className="flex items-center gap-2"><Database size={16} /> Data source</span>}>
          <div className="flex items-center gap-3 rounded-lg bg-bg-elev-2 p-4">
            <span className={`h-2.5 w-2.5 rounded-full ${ds.meta.mode === 'mock' ? 'bg-warning' : 'bg-brand-bright'}`} />
            <div>
              <div className="text-sm font-bold text-text">{ds.meta.label}</div>
              <div className="text-xs text-muted">
                {ds.meta.mode === 'mock'
                  ? 'Illustrative figures. Set VITE_DATA_SOURCE=api to connect a live backend.'
                  : 'Connected to the live API backend.'}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            All indicator names, tiers and calculations stay identical regardless of source — see
            <code className="mx-1 rounded bg-bg-elev-2 px-1">docs/DATA_INTEGRATION.md</code>.
          </p>
        </SectionBlock>

        <SectionBlock title={<span className="flex items-center gap-2"><Bookmark size={16} /> Saved views</span>}>
          {views.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              No saved views yet. Apply filters and use the bookmark button to save one.
            </p>
          ) : (
            <div className="space-y-2">
              {views.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg bg-bg-elev-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-text">{v.name}</div>
                    <div className="text-xs text-muted">{v.page.replace('/app/', '')}</div>
                  </div>
                  <button onClick={() => remove(v.id)} className="rounded p-1.5 text-muted hover:text-danger">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionBlock>
      </div>
    </div>
  );
}
