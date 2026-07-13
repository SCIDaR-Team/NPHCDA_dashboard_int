import {
  Activity,
  ClipboardList,
  Building2,
  Stethoscope,
  Database,
  Syringe,
  PackageCheck,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';
import { SectionBlock } from '@/components/ui';

interface SourceDash {
  name: string;
  desc: string;
  href?: string;
  icon: LucideIcon;
}

/** The seven linked source dashboards (mirrors the original HTML footer links). */
export const SOURCE_DASHBOARDS: SourceDash[] = [
  {
    name: 'SRH Dashboard',
    desc: 'Sexual and Reproductive Health indicators across 20 LGAs in 8 focus states.',
    href: 'https://srh-dashboard-updated.netlify.app/',
    icon: Activity,
  },
  {
    name: 'SFM Dashboard',
    desc: 'Service & Facility Monitoring survey data.',
    href: 'https://app.powerbi.com/view?r=eyJrIjoiZTk0YTRkZjctZGJmMi00NmZkLWEwMjMtN2UyODVlZWYzYzA3IiwidCI6ImNkMWMxYTAyLWUxNWUtNGE2NS1iNWJiLTllMjFhNWFmN2NlOSIsImMiOjl9',
    icon: ClipboardList,
  },
  {
    name: 'PFMO Dashboard',
    desc: 'Facility and Programme Monitoring Officer reports.',
    href: 'https://app.pfmo.ng/auth/login',
    icon: Building2,
  },
  {
    name: 'PHC Functionality Dashboard',
    desc: 'Facility status, Level 1 / Level 2 classification and functionality scoring.',
    href: 'https://phc.nphcda.gov.ng/login',
    icon: Stethoscope,
  },
  {
    name: 'NPHCDA DataHub',
    desc: 'DHIS-based national data warehouse.',
    href: 'https://nphcda-datahub.vercel.app/',
    icon: Database,
  },
  {
    name: 'Vaccine Financing Dashboard',
    desc: 'Alliance milestones, routine immunization coverage and financing.',
    icon: Syringe,
  },
  {
    name: 'Stock Management Dashboard',
    desc: 'Zonal store stock received, stock utilized and stock outcomes.',
    icon: PackageCheck,
  },
];

export function SourceDashboards() {
  return (
    <SectionBlock title="Drill into the detailed source dashboards">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SOURCE_DASHBOARDS.map((d) => {
          const disabled = !d.href;
          const Card = (
            <div
              className={`group flex h-full flex-col rounded-card border border-border bg-bg-elev p-4 shadow-card transition-all ${
                disabled ? 'opacity-60' : 'cursor-pointer hover:-translate-y-1 hover:border-brand/50 hover:shadow-card-hover'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/12 text-brand-bright">
                  <d.icon size={20} />
                </div>
                {disabled ? (
                  <span className="rounded-full bg-bg-elev-2 px-2 py-0.5 text-[11px] font-bold uppercase text-muted">
                    Coming soon
                  </span>
                ) : (
                  <ArrowUpRight size={18} className="text-muted transition-colors group-hover:text-brand-bright" />
                )}
              </div>
              <h3 className="mt-3 text-sm font-bold text-text">{d.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{d.desc}</p>
            </div>
          );
          return disabled ? (
            <div key={d.name} aria-label={`${d.name} — coming soon`}>{Card}</div>
          ) : (
            <a
              key={d.name}
              href={d.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${d.name} in a new tab`}
              className="block h-full rounded-card focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              {Card}
            </a>
          );
        })}
      </div>
    </SectionBlock>
  );
}
