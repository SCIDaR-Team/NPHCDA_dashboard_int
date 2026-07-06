import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { useThemeStore } from '@/store/themeStore';
import { Toaster } from '@/components/ui/Toaster';
// NOTE: LandingPage and LoginPage (and the ProtectedRoute auth gate) are
// intentionally retained in the codebase but removed from the active routing.
// The Home page is now the application's single entry point. Re-import and
// re-add the routes below to restore the landing / authentication flow.
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/features/dashboard/HomePage';
import { OverviewPage } from '@/features/dashboard/OverviewPage';
import { BlockPage } from '@/features/dashboard/BlockPage';
import { TrendPage } from '@/features/dashboard/TrendPage';
import { FacilityDeepdivePage } from '@/features/dashboard/FacilityDeepdivePage';
import { SourceDashboardsPage } from '@/features/dashboard/SourceDashboardsPage';
// NOTE: SettingsPage is retained in the codebase but removed from the active
// routing/navigation. Re-add the route below to restore it.

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    bootstrap();
    // Ensure the persisted theme class is applied on first paint.
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
  }, [bootstrap, theme]);

  return (
    <>
      <Routes>
        {/* Home is a standalone entry page (its own chrome, no dashboard shell). */}
        <Route path="/" element={<HomePage />} />

        {/* The dashboard shell — Home lives outside it and links in here. */}
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="/app/overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="readiness" element={<BlockPage block="Facility Readiness" />} />
          <Route path="stock" element={<BlockPage block="Stock Status" />} />
          <Route path="service" element={<BlockPage block="Service Delivery" />} />
          <Route path="trends" element={<TrendPage />} />
          <Route path="facilities" element={<FacilityDeepdivePage />} />
          <Route path="sources" element={<SourceDashboardsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
