import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from './authStore';
import { Spinner } from '@/components/ui';

/** Gates the dashboard behind authentication; preserves the intended destination. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const booted = useAuthStore((s) => s.booted);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  // Still resolving the persisted session.
  if (!booted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner size={28} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
