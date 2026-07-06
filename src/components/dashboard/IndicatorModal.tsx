import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { Modal } from '@/components/ui/Modal';
import { StatusPill, Select } from '@/components/ui';
import { EChart } from '@/components/charts/EChart';
import { useChartTheme } from '@/components/charts/chartTheme';
import { horizontalBarOption, horizontalBarHeight, baseTooltip } from '@/components/charts/chartBase';
import { coverageNote, heatColor, statusFor, stateMeasures, facilityMeasures, SMALL_N } from '@/data/calculations';
import { functionalStatusStateSplits, FUNCTIONAL_STATUS_INDICATOR, HIDE_ZERO_DISTRIBUTION_INDICATORS, parseFacilityKey } from '@/data/scopedEngine';
import { getDataSource } from '@/data/datasource';
import { useAsync } from '@/hooks/useAsync';
import { cleanName, decodeHtml } from '@/lib/format';
import type { Indicator } from '@/data/types';

type View = 'state' | 'facility';
type RecvFilter = 'all' | 'received' | 'none';

const BHCPF_FUNDS_INDICATOR = 'Total BHCPF funds received vs. expected';

/** Segment colours for the functional-status stacked bar / facility badges. */
const STATUS_COLORS: Record<string, string> = {
  L2: '#2E8B57',
  L1: '#6FA888',
  Partial: '#C9A227',
  'Non-functional': '#C2562C',
};

/** The real headline number behind a measurement's display string — the FIRST
 *  number (so denominators after "/" are ignored), honouring a leading currency
 *  symbol and an m/bn/k magnitude suffix (e.g. "₦16m received" → 16,000,000).
 *  Falls back to the goodness pct when the value isn't numeric. Used for ranking +
 *  bar length so counts, rates and amounts read honestly — not a 0-100 proxy. */
function magnitudeOf(display: string, pct: number): number {
  const s = String(display).replace(/,/g, '');
  const m = s.match(/-?\d+(?:\.\d+)?/); // first number, even behind a "₦"/"$" prefix
  if (!m) return pct;
  let n = parseFloat(m[0]);
  const after = s.slice((m.index ?? 0) + m[0].length);
  if (/^\s*bn/i.test(after)) n *= 1e9;
  else if (/^\s*m/i.test(after)) n *= 1e6;
  else if (/^\s*k/i.test(after)) n *= 1e3;
  return n;
}

/** Round a bar-axis maximum up to a clean bound (percent stays 0-100). */
function niceMax(v: number): number {
  if (v <= 100) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

/** Compact axis tick label (20000000 → "20m", 1500 → "1.5k"); plain under 1,000. */
function compactAxis(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${+(v / 1e9).toFixed(1)}bn`;
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `${+(v / 1e3).toFixed(1)}k`;
  return String(v);
}

/**
 * Indicator deep-dive: real per-state and per-facility breakdowns straight from
 * the ETL disaggregation (no synthetic figures). Scopes with no measurement are
 * simply absent; a small-sample flag is shown where n is low.
 */
export function IndicatorModal({ indicator, onClose }: { indicator: Indicator | null; onClose: () => void }) {
  const [view, setView] = useState<View>('state');
  const [facilityState, setFacilityState] = useState('');
  const [recvFilter, setRecvFilter] = useState<RecvFilter>('all');
  const theme = useChartTheme();
  const ds = getDataSource();
  const { data: facilities } = useAsync(() => ds.getFacilities());
  const ind = indicator;

  const isFunctional = ind?.name === FUNCTIONAL_STATUS_INDICATOR;
  const isBhcpfFunds = ind?.name === BHCPF_FUNDS_INDICATOR;
  // A Good/Fair/Poor pill only makes sense for percent-graded indicators — not
  // counts, ₦ amounts, rates (neutral pct) or the categorical functional status.
  const showStatus = !!ind && !isFunctional && /^\s*[+-]?\d[\d.,]*%/.test(String(ind.value));

  // Reset the view + facility filters whenever a new indicator opens.
  useMemo(() => {
    setView('state');
    setFacilityState('');
    setRecvFilter('all');
  }, [ind?.name]);

  // Ranked descending by the real magnitude so every chart/table reads top-to-bottom
  // largest → smallest, even for count/rate indicators (colour still encodes
  // goodness via `value`/inverse, below).
  const stateRows = useMemo(() => {
    if (!ind) return [] as { label: string; value: number; magnitude: number; display: string; n?: number }[];
    const hideZero = HIDE_ZERO_DISTRIBUTION_INDICATORS.has(ind.name);
    return Object.entries(stateMeasures(ind.name))
      .map(([label, m]) => ({ label, value: m.pct, magnitude: m.num ?? magnitudeOf(m.value, m.pct), display: m.value, n: m.n }))
      .filter((r) => !hideZero || r.magnitude > 0) // MAMII activity indicators: list only states with real activity
      .sort((a, b) => b.magnitude - a.magnitude);
  }, [ind?.name, facilities]);

  const facilityRows = useMemo(() => {
    if (!ind) return [] as { facility: string; state: string; lga: string; value: number; magnitude: number; display: string; n?: number }[];
    const facMap = new Map((facilities ?? []).map((f) => [f.facility, f]));
    const hideZero = HIDE_ZERO_DISTRIBUTION_INDICATORS.has(ind.name);
    // Keys are state|lga|facility (see parseFacilityKey) so same-named facilities in
    // different states stay distinct; fall back to the roster only if a segment is blank.
    return Object.entries(facilityMeasures(ind.name))
      .map(([key, m]) => {
        const { state: kState, lga: kLga, facility } = parseFacilityKey(key);
        const f = facMap.get(facility);
        const state = kState || f?.state || '—';
        const lga = kLga || f?.lga || '—';
        return { facility, state, lga, value: m.pct, magnitude: m.num ?? magnitudeOf(m.value, m.pct), display: m.value, n: m.n };
      })
      .filter((r) => !hideZero || r.magnitude > 0) // MAMII activity indicators: list only facilities with real activity
      .sort((a, b) => b.magnitude - a.magnitude);
  }, [ind?.name, facilities]);

  // Distinct states present in the facility breakdown, for the facility-view filter.
  const facilityStateOptions = useMemo(
    () => Array.from(new Set(facilityRows.map((r) => r.state).filter((s) => s && s !== '—'))).sort(),
    [facilityRows]
  );
  const visibleFacilityRows = useMemo(() => {
    let rows = facilityState ? facilityRows.filter((r) => r.state === facilityState) : facilityRows;
    if (isBhcpfFunds && recvFilter !== 'all') {
      rows = rows.filter((r) => (recvFilter === 'received' ? r.magnitude > 0 : r.magnitude <= 0));
    }
    return rows;
  }, [facilityRows, facilityState, isBhcpfFunds, recvFilter]);

  const hasFacility = facilityRows.length > 0;
  const isGap = !ind || !(ind.pct > 0) || stateRows.length === 0;
  const note = ind ? coverageNote(ind) : '';

  const chart = useMemo<{ option: EChartsOption; height: number } | null>(() => {
    if (!ind || isGap) return null;

    // Facility functional status: a STACKED bar per state so a state with a mix of
    // L2/L1/partial/non-functional facilities shows the full composition, not just
    // one summary bar.
    if (isFunctional) {
      const splits = functionalStatusStateSplits();
      const labels = splits.map((s) => s.state);
      const seg = (name: string, key: 'l2' | 'l1' | 'partial' | 'nonfunc', color: string) => ({
        name,
        color,
        data: splits.map((s) => s[key]),
      });
      const option = horizontalBarOption({
        theme,
        categories: labels,
        max: 100,
        stacked: true,
        legend: true,
        series: [
          seg('L2', 'l2', STATUS_COLORS.L2),
          seg('L1', 'l1', STATUS_COLORS.L1),
          seg('Partial', 'partial', STATUS_COLORS.Partial),
          seg('Non-functional', 'nonfunc', STATUS_COLORS['Non-functional']),
        ],
      });
      return { option, height: horizontalBarHeight(labels, { legend: true }) };
    }

    const labels = stateRows.map((r) => r.label);
    const magnitudes = stateRows.map((r) => r.magnitude);
    const max = niceMax(Math.max(0, ...magnitudes));
    const option = horizontalBarOption({
      theme,
      categories: labels,
      max,
      axisValueFormatter: compactAxis,
      // Bar length = the real magnitude (count / percent / rate / amount); colour
      // keeps encoding goodness from each row's pct (inverse-aware), decoupled from length.
      series: [
        {
          data: magnitudes,
          colorFor: (_v, i) => {
            const r = stateRows[i];
            return ind.inverse ? heatColor(100 - r.value) : heatColor(r.value);
          },
        },
      ],
    });
    option.tooltip = {
      ...baseTooltip(theme),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: any) => {
        const row = stateRows[p[0].dataIndex];
        return `<b>${row.label}</b><br/>${row.display}${row.n != null ? `<br/>n = ${row.n}${row.n < SMALL_N ? ' (small sample)' : ''}` : ''}`;
      },
    };
    return { option, height: horizontalBarHeight(labels) };
  }, [ind, isGap, isFunctional, stateRows, theme]);

  if (!ind) return null;

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
          <b className="text-text">No breakdown available.</b> This indicator has no live source yet, or
          the current data has no state-level detail to disaggregate — see the indicator workbook's
          "Identified Data Gaps" sheet for what would close it.
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
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-text-soft">Filter by state</label>
                <Select
                  className="h-9 w-52"
                  value={facilityState}
                  onChange={(e) => setFacilityState(e.target.value)}
                  options={[
                    { value: '', label: `All states (${facilityRows.length})` },
                    ...facilityStateOptions.map((s) => ({ value: s, label: s })),
                  ]}
                />
                {isBhcpfFunds && (
                  <Select
                    className="h-9 w-48"
                    value={recvFilter}
                    onChange={(e) => setRecvFilter(e.target.value as RecvFilter)}
                    options={[
                      { value: 'all', label: 'Received or not' },
                      { value: 'received', label: 'Received funds' },
                      { value: 'none', label: 'Did not receive' },
                    ]}
                  />
                )}
                <span className="text-xs text-muted">
                  {visibleFacilityRows.length} facilit{visibleFacilityRows.length === 1 ? 'y' : 'ies'}
                </span>
              </div>
              <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-bg-elev-2 text-left text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">Facility</th>
                      <th className="px-3 py-2 font-semibold">LGA</th>
                      <th className="px-3 py-2 font-semibold">State</th>
                      {isFunctional ? (
                        <th className="px-3 py-2 font-semibold">Status</th>
                      ) : (
                        <>
                          <th className="px-3 py-2 text-right font-semibold">Value</th>
                          {showStatus && <th className="px-3 py-2 font-semibold">Status</th>}
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFacilityRows.map((d, i) => (
                      <tr key={i} className="border-t border-border-soft">
                        <td className="px-3 py-2 text-muted">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-text">{d.facility}</td>
                        <td className="px-3 py-2 text-muted">{d.lga}</td>
                        <td className="px-3 py-2 text-muted">{d.state}</td>
                        {isFunctional ? (
                          <td className="px-3 py-2">
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                              style={{
                                background: `${STATUS_COLORS[d.display] ?? '#888'}22`,
                                color: STATUS_COLORS[d.display] ?? theme.muted,
                              }}
                            >
                              {d.display}
                            </span>
                          </td>
                        ) : (
                          <>
                            <td
                              className="px-3 py-2 text-right font-semibold"
                              style={{ color: ind.inverse ? heatColor(100 - d.value) : heatColor(d.value) }}
                            >
                              {d.display}
                            </td>
                            {showStatus && (
                              <td className="px-3 py-2">
                                <StatusPill status={statusFor(d.value, ind.inverse)} />
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
