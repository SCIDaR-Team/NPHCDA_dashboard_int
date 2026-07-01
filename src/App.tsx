import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { useThemeStore } from '@/store/themeStore';
import { Toaster } from '@/components/ui/Toaster';
import { LandingPage } from '@/features/landing/LandingPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { HomePage } from '@/features/dashboard/HomePage';
import { OverviewPage } from '@/features/dashboard/OverviewPage';
import { BlockPage } from '@/features/dashboard/BlockPage';
import { TrendPage } from '@/features/dashboard/TrendPage';
import { FacilityDeepdivePage } from '@/features/dashboard/FacilityDeepdivePage';
import { SourceDashboardsPage } from '@/features/dashboard/SourceDashboardsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

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
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="readiness" element={<BlockPage block="Facility Readiness" />} />
          <Route path="stock" element={<BlockPage block="Stock Status" />} />
          <Route path="service" element={<BlockPage block="Service Delivery" />} />
          <Route path="trends" element={<TrendPage />} />
          <Route path="facilities" element={<FacilityDeepdivePage />} />
          <Route path="sources" element={<SourceDashboardsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
