import {
  Home,
  LayoutDashboard,
  HeartPulse,
  Package,
  Stethoscope,
  TrendingUp,
  Table2,
  LayoutGrid,
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

/** The Home hub — shown in the sidebar but excluded from the "sections" grid on Home itself. */
export const HOME_ITEM: NavItem = {
  to: '/app/home',
  label: 'Home',
  icon: Home,
  description: 'Your central hub: quick navigation, key metrics and linked dashboards.',
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
