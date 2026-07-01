import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { Modal } from '@/components/ui/Modal';
import { Badge, StatusPill } from '@/components/ui';
import { EChart } from '@/components/charts/EChart';
import { useChartTheme } from '@/components/charts/chartTheme';
import { horizontalBarOption, horizontalBarHeight, baseTooltip } from '@/components/charts/chartBase';
import {
  coverageStates,
  coverageNote,
  stateBreakdown,
  facilityBreakdown,
  stateSplit4Breakdown,
  heatColor,
  statusFor,
} from '@/data/calculations';
import { FD_DATA } from '@/data/mock/facilities';
import { cleanName, decodeHtml } from '@/lib/format';
import type { Indicator } from '@/data/types';

type View = 'state' | 'facility';

export function IndicatorModal({ indicator, onClose }: { indicator: Indicator | null; onClose: () => void }) {
  const [view, setView] = useState<View>('state');
  const theme = useChartTheme();

  const ind = indicator;
  const hasFacility = !!ind && (!!ind.split4 || (ind.disagg?.includes('facility') ?? false));
  const isGap = !!ind && (ind.tier === 3 || !(ind.pct > 0)) && !ind.split4;

  const statesList = ind ? coverageStates(ind) : [];
  const note = ind ? coverageNote(ind) : '';

  // Reset to state view whenever a new indicator opens.
  useMemo(() => setView('state'), [ind?.name]);

  const chart = useMemo<{ option: EChartsOption; height: number } | null>(() => {
    if (!ind || isGap) return null;
    if (ind.split4) {
      const rows = stateSplit4Breakdown(ind.split4);
      const labels = rows.map((r) => r.label);
      return {
        option: horizontalBarOption({
          theme,
          categories: labels,
          stacked: true,
          legend: true,
          series: [
            { name: 'L2', color: '#2E8B57', data: rows.map((r) => r.l2) },
            { name: 'L1', color: '#6FA888', data: rows.map((r) => r.l1) },
            { name: 'Partial', color: '#C9A227', data: rows.map((r) => r.partial) },
            { name: 'Non-functional', color: '#C2562C', data: rows.map((r) => r.nonfunc) },
          ],
        }),
        height: horizontalBarHeight(labels, { legend: true }),
      };
    }
    const data = stateBreakdown(ind.pct, statesList, ind.inverse);
    const labels = data.map((d) => d.label);
    const option = horizontalBarOption({
      theme,
      categories: labels,
      series: [
        {
          data: data.map((d) => d.value),
          colorFor: (v) => (ind.inverse ? heatColor(100 - v) : heatColor(v)),
        },
      ],
    });
    // Preserve the richer state tooltip (value + YoY change).
    option.tooltip = {
      ...baseTooltip(theme),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: any) => {
        const row = data[p[0].dataIndex];
        return `<b>${row.label}</b><br/>Value: ${row.value}%<br/>YoY: ${row.change >= 0 ? '+' : ''}${row.change}%`;
      },
    };
    return { option, height: horizontalBarHeight(labels) };
  }, [ind, isGap, statesList, theme]);

  if (!ind) return null;

  const facilityRows = ind.split4
    ? FD_DATA.slice().sort((a, b) => {
        const rank: Record<string, number> = { L2: 0, L1: 1, Partial: 2, 'Non-functional': 3 };
        return rank[a.status] - rank[b.status];
      })
    : facilityBreakdown(ind.pct, statesList, ind.inverse);

  return (
    <Modal
      open={!!ind}
      onClose={onClose}
      title={cleanName(ind.name)}
      subtitle={`${decodeHtml(ind.meta)} · Source: ${decodeHtml(ind.src)}`}
      size="max-w-4xl"
    >
      {note && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {note}
        </div>
      )}

      {isGap ? (
        <div className="rounded-lg border border-border bg-bg-elev-2 px-4 py-5 text-sm text-text-soft">
          <b className="text-text">No state-level breakdown yet.</b> This indicator is currently a data
          gap or a select-locations-only figure — see the indicator workbook's "Identified Data Gaps"
          sheet for what would close it.
        </div>
      ) : (
        <>
          {hasFacility && (
            <div className="mb-4 inline-flex rounded-lg border border-border bg-bg-elev-2 p-0.5">
              {(['state', 'facility'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    view === v ? 'bg-brand text-white' : 'text-muted hover:text-text'
                  }`}
                >
                  By {v}
                </button>
              ))}
            </div>
          )}

          {view === 'state' && chart && <EChart option={chart.option} height={chart.height} />}

          {view === 'facility' && (
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-bg-elev-2 text-left text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Facility</th>
                    <th className="px-3 py-2 font-semibold">LGA</th>
                    <th className="px-3 py-2 font-semibold">State</th>
                    {ind.split4 ? (
                      <>
                        <th className="px-3 py-2 font-semibold">Type</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2 text-right font-semibold">Value</th>
                        <th className="px-3 py-2 text-right font-semibold">YoY Δ</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {facilityRows.map((d: any, i) => (
                    <tr key={i} className="border-t border-border-soft">
                      <td className="px-3 py-2 text-muted">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-text">{d.facility ?? d.label}</td>
                      <td className="px-3 py-2 text-muted">{d.lga}</td>
                      <td className="px-3 py-2 text-muted">{d.state}</td>
                      {ind.split4 ? (
                        <>
                          <td className="px-3 py-2">
                            <Badge tone={d.type === 'CEmONC' ? 'info' : 'neutral'}>{d.type}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Badge tone={d.status === 'L2' ? 'good' : d.status === 'L1' ? 'mid' : 'poor'}>
                              {d.status}
                            </Badge>
                          </td>
                        </>
                      ) : (
                        <>
                          <td
                            className="px-3 py-2 text-right font-semibold"
                            style={{ color: ind.inverse ? heatColor(100 - d.value) : heatColor(d.value) }}
                          >
                            {d.value}%
                          </td>
                          <td className={`px-3 py-2 text-right font-medium ${d.change >= 0 ? 'text-brand-bright' : 'text-danger'}`}>
                            {d.change >= 0 ? '+' : ''}
                            {d.change}%
                          </td>
                          <td className="px-3 py-2">
                            <StatusPill status={statusFor(d.value, ind.inverse)} />
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
