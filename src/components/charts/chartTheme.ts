import { useThemeStore } from '@/store/themeStore';

/** Resolve a CSS custom property (space-separated RGB channels) to "rgb(r,g,b)". */
export function cssVar(name: string, alpha = 1): string {
  if (typeof window === 'undefined') return '#888';
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return '#888';
  return alpha === 1 ? `rgb(${raw})` : `rgb(${raw} / ${alpha})`;
}

export interface ChartTheme {
  text: string;
  muted: string;
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  brand: string;
  palette: string[];
}

/** Reactive chart theme that updates whenever the app theme changes. */
export function useChartTheme(): ChartTheme {
  // Subscribe so charts re-render on theme toggle.
  const theme = useThemeStore((s) => s.theme);
  void theme;
  return {
    text: cssVar('--c-text'),
    muted: cssVar('--c-muted'),
    grid: cssVar('--c-border-soft'),
    axis: cssVar('--c-border'),
    tooltipBg: cssVar('--c-bg-elev'),
    tooltipBorder: cssVar('--c-border'),
    brand: cssVar('--c-green'),
    // Brand green first (primary category), then the fixed secondary palette —
    // kept in sync with src/components/charts/palette.ts.
    palette: [
      '#00A859',
      '#3D7BB5',
      '#C9A227',
      '#7A4FA8',
      '#C2562C',
      '#5B7089',
      '#2A9D8F',
      '#6FC69B',
      '#8a6d12',
    ],
  };
}
