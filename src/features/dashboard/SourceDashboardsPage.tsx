import { PageHeader } from '@/components/dashboard/PageHeader';
import { SourceDashboards } from '@/components/dashboard/SourceDashboards';

export function SourceDashboardsPage() {
  return (
    <div>
      <PageHeader
        title="Detailed Source Dashboards"
        subtitle="The central access point for every linked source dashboard feeding this platform. Each card opens the underlying system in a new tab."
      />
      <SourceDashboards />
    </div>
  );
}
