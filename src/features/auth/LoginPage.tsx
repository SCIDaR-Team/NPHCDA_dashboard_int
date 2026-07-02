import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, Mail, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { Button, Input, FieldLabel } from '@/components/ui';
import { ThemeToggle } from '@/components/layout/TopbarMenus';
import { useAuthStore } from './authStore';
import { DEMO_CREDENTIALS } from './MockAuthProvider';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, status, error, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/app/home';

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await login({ email, password });
    if (ok) navigate(from, { replace: true });
  };

  const fillDemo = () => {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
  };

  const loading = status === 'loading';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-10">
      {/* Animated gradient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(0,168,89,0.45), transparent 65%)' }}
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(16,196,110,0.35), transparent 65%)' }}
          animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              'linear-gradient(rgb(var(--c-border-soft) / 0.5) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-border-soft) / 0.5) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(circle at 50% 40%, black, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 40%, black, transparent 75%)',
          }}
        />
      </div>

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-5">
        <Link
          to="/"
          aria-label="Back to landing page"
          className="flex items-center gap-2 text-sm font-semibold text-text-soft transition-colors hover:text-text"
        >
          <LogoMark size={28} />
          <span className="hidden sm:inline">NPHCDA Dashboard</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Unified card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="rounded-[20px] border border-border/70 bg-bg-elev/70 p-8 shadow-pop backdrop-blur-xl sm:p-10">
          {/* Floating brand mark */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 16 }}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #10C46E, #007A45)' }}
          >
            <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden>
              <path d="M22.5 8h-5v9.5H8v5h9.5V32h5v-9.5H32v-5h-9.5V8Z" fill="#fff" />
            </svg>
          </motion.div>

          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-bright">
              <ShieldCheck size={12} /> Secure sign-in
            </span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-text">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted">Access the PHC performance workspace.</p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <FieldLabel htmlFor="email">Email address</FieldLabel>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="you@nphcda.gov.ng"
                  className="bg-bg-elev/60 pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="bg-bg-elev/60 pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger"
              >
                <AlertCircle size={15} /> {error}
              </motion.div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && <ArrowRight size={18} />}
            </Button>
          </form>

          <button
            type="button"
            onClick={fillDemo}
            className="mt-5 flex w-full items-center gap-2 rounded-lg border border-dashed border-brand/40 bg-brand/5 px-4 py-3 text-left text-xs text-text-soft transition-colors hover:bg-brand/10"
          >
            <Sparkles size={16} className="flex-shrink-0 text-brand-bright" />
            <span>
              <strong className="text-text">Demo credentials</strong> — {DEMO_CREDENTIALS.email} /{' '}
              {DEMO_CREDENTIALS.password}. Click to autofill.
            </span>
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          <Link to="/" className="font-semibold text-brand-bright hover:underline">
            ← Back to Landing Page
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
