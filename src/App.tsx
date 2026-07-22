import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { useThemeStore } from '@/store/themeStore';
import { Toaster } from '@/components/ui/Toaster';
import { Spinner } from '@/components/ui';
// NOTE: LandingPage and LoginPage (and the ProtectedRoute auth gate) are
// intentionally retained in the codebase but removed from the active routing.
// The Home page is now the application's single entry point. Re-import and
// re-add the routes below to restore the landing / authentication flow.
import { AppShell } from '@/components/layout/AppShell';
// Route-level code-splitting: each page (and its heavy chart / export deps) is
// fetched on demand, so the initial bundle stays small. Named exports are mapped
// to the default that React.lazy expects.
const HomePage = lazy(() => import('@/features/dashboard/HomePage').then((m) => ({ default: m.HomePage })));
const OverviewPage = lazy(() => import('@/features/dashboard/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const ScorecardPage = lazy(() => import('@/features/dashboard/ScorecardPage').then((m) => ({ default: m.ScorecardPage })));
const LeagueTablesPage = lazy(() => import('@/features/dashboard/LeagueTablesPage').then((m) => ({ default: m.LeagueTablesPage })));
const DataQualityPage = lazy(() => import('@/features/dashboard/DataQualityPage').then((m) => ({ default: m.DataQualityPage })));
const FacilityProfilePage = lazy(() => import('@/features/dashboard/FacilityProfilePage').then((m) => ({ default: m.FacilityProfilePage })));
const EquityPage = lazy(() => import('@/features/dashboard/EquityPage').then((m) => ({ default: m.EquityPage })));
const ComparePage = lazy(() => import('@/features/dashboard/ComparePage').then((m) => ({ default: m.ComparePage })));
const HelpPage = lazy(() => import('@/features/dashboard/HelpPage').then((m) => ({ default: m.HelpPage })));
const BlockPage = lazy(() => import('@/features/dashboard/BlockPage').then((m) => ({ default: m.BlockPage })));
const TrendPage = lazy(() => import('@/features/dashboard/TrendPage').then((m) => ({ default: m.TrendPage })));
const FacilityDeepdivePage = lazy(() =>
  import('@/features/dashboard/FacilityDeepdivePage').then((m) => ({ default: m.FacilityDeepdivePage }))
);
const SourceDashboardsPage = lazy(() =>
  import('@/features/dashboard/SourceDashboardsPage').then((m) => ({ default: m.SourceDashboardsPage }))
);
// NOTE: SettingsPage is retained in the codebase but removed from the active
// routing/navigation. Re-add the route below to restore it.

/** Full-viewport fallback while a lazily-loaded route chunk is fetched. */
function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

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
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Home is a standalone entry page (its own chrome, no dashboard shell). */}
          <Route path="/" element={<HomePage />} />

          {/* The dashboard shell — Home lives outside it and links in here. */}
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="scorecard" element={<ScorecardPage />} />
            <Route path="league" element={<LeagueTablesPage />} />
            <Route path="data-quality" element={<DataQualityPage />} />
            {/* Drill-through destination (not in the sidebar) — reached from the
                Facility Deepdive matrix and the facility league table. */}
            <Route path="facility/:key" element={<FacilityProfilePage />} />
            <Route path="equity" element={<EquityPage />} />
            <Route path="compare" element={<ComparePage />} />
            {/* Full help guide — reached from the top-bar “?” quick-help drawer,
                intentionally not listed in the sidebar navigation. */}
            <Route path="help" element={<HelpPage />} />
            <Route path="readiness" element={<BlockPage block="Facility Readiness" />} />
            <Route path="stock" element={<BlockPage block="Stock Status" />} />
            <Route path="service" element={<BlockPage block="Service Delivery" />} />
            <Route path="trends" element={<TrendPage />} />
            <Route path="facilities" element={<FacilityDeepdivePage />} />
            <Route path="sources" element={<SourceDashboardsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
