import { useState } from 'react';
import { User, Palette, Check } from 'lucide-react';
import { SectionBlock, Button, Input, FieldLabel, Badge } from '@/components/ui';
import { useAuthStore } from '@/features/auth/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useNotificationStore } from '@/store/notificationStore';
import { PageHeader } from '@/components/dashboard/PageHeader';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const { theme, setTheme } = useThemeStore();
  const toast = useNotificationStore((s) => s.toast);

  const [name, setName] = useState(user?.name ?? '');
  const [role, setRole] = useState(user?.role ?? '');

  const saveProfile = () => {
    updateProfile({ name, role });
    toast({ tone: 'success', title: 'Profile updated' });
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile and appearance." />

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
      </div>
    </div>
  );
}
