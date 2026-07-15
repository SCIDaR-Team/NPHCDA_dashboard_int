import {
  Home,
  LayoutDashboard,
  HeartPulse,
  Package,
  Stethoscope,
  TrendingUp,
  Table2,
  LayoutGrid,
  ClipboardCheck,
  ListOrdered,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { BlockName } from '@/data/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** For block pages, the matching key in the `blocks` data. */
  block?: BlockName;
  description: string;
}

/**
 * The standalone Home entry page. It lives at the app root (outside the
 * dashboard shell) and is intentionally NOT listed in the sidebar navigation;
 * the shell's logo links back to it.
 */
export const HOME_ITEM: NavItem = {
  to: '/',
  label: 'Home',
  icon: Home,
  description: 'The platform entry point: overview, key metrics and dashboard sections.',
};

/** Single source of truth for navigation + routing of dashboard pages. */
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/app/overview',
    label: 'Overview',
    icon: LayoutDashboard,
    description: 'Top-level outcomes, coverage, system & trust indicators and the interactive state map.',
  },
  {
    to: '/app/readiness',
    label: 'Facility Readiness',
    icon: HeartPulse,
    block: 'Facility Readiness',
    description: 'Infrastructure, workforce, financing flows and governance/data systems.',
  },
  {
    to: '/app/stock',
    label: 'Stock Status',
    icon: Package,
    block: 'Stock Status',
    description: 'Tracer commodities, equipment, cold-chain and vaccine stock-out signals.',
  },
  {
    to: '/app/service',
    label: 'Service Delivery',
    icon: Stethoscope,
    block: 'Service Delivery',
    description: 'Uptake of RMNCAH+N services, maternal/child outcomes and health security.',
  },
  {
    to: '/app/trends',
    label: 'Trend Analysis',
    icon: TrendingUp,
    description: 'Monthly / quarterly / yearly comparison across any combination of indicators.',
  },
  {
    to: '/app/facilities',
    label: 'Facility Deepdive',
    icon: Table2,
    description: 'Searchable State → LGA → Facility matrix.',
  },
  {
    to: '/app/scorecard',
    label: 'Scorecard',
    icon: ClipboardCheck,
    description: 'National / state / LGA A–F grades and a traffic-light matrix of building-block sub-scores.',
  },
  {
    to: '/app/league',
    label: 'League Tables',
    icon: ListOrdered,
    description: 'Rank states, LGAs and facilities by composite or any indicator, with year-over-year movement.',
  },
  {
    to: '/app/data-quality',
    label: 'Data Quality',
    icon: ShieldCheck,
    description: 'Completeness, timeliness, missing data, small samples and outliers across every indicator.',
  },
  {
    to: '/app/sources',
    label: 'Source Dashboards',
    icon: LayoutGrid,
    description: 'The seven linked source dashboards feeding this platform.',
  },
];

export const BLOCK_ROUTES: Record<BlockName, string> = {
  'Facility Readiness': '/app/readiness',
  'Stock Status': '/app/stock',
  'Service Delivery': '/app/service',
};

/** Stable DOM anchor id for an indicator card, so a link (e.g. an Overview KPI)
 *  can deep-link to the specific indicator on its thematic page. Derived from the
 *  raw indicator name — both the linker and the target must pass the same name. */
export const indicatorAnchorId = (name: string): string =>
  'ind-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
