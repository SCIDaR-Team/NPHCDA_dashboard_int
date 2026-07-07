import { Info, ChevronRight, Inbox, EyeOff } from 'lucide-react';
import { Card, Badge, Tooltip } from '@/components/ui';
import { RingProgress } from '@/components/charts/RingProgress';
import { IndicatorViz, vizFor, isWideViz, vizEmbedsValue } from '@/components/dashboard/indicatorViz';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import {
  effectiveIndicatorValue,
  effectiveSplit4,
  goodnessFor,
  barColorFor,
  statusFor,
  looksLikePercent,
} from '@/data/calculations';
import { DEFINITIONS, TIER_LABELS } from '@/data/catalogue';
import { cleanName, decodeHtml } from '@/lib/format';
import type { Indicator, TrendSeries } from '@/data/types';

const tierTone: Record<number, 'good' | 'mid' | 'neutral'> = { 1: 'good', 2: 'mid', 3: 'neutral' };
const covLabel: Record<string, string> = { srh8: '8 SRH states', sfm: 'SFM states', lcb: '8 LCB states' };

function CompositeTooltip({ infoKey }: { infoKey: string }) {
  const def = DEFINITIONS[infoKey];
  if (!def) return null;
  return (
    <div className="space-y-1.5">
      <div className="font-bold text-text">
        {def.title}
        {def.composite !== undefined && (
          <span className="ml-1 font-normal text-muted">({def.composite}% meet ALL)</span>
        )}
      </div>
      {def.text ? (
        <div className="leading-relaxed" dangerouslySetInnerHTML={{ __html: decodeHtml(def.text) }} />
      ) : (
        <>
          <div className="text-muted">{def.note}</div>
          {def.items?.map(([name, missing]) => (
            <div key={name} className="flex justify-between gap-3">
              <span>{decodeHtml(name)}</span>
              <span className="font-semibold text-danger">{missing}%</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export function IndicatorCard({
  indicator,
  onOpen,
  siblings = {},
  trends = null,
  disableWide = false,
}: {
  indicator: Indicator;
  onOpen: (i: Indicator) => void;
  /** All indicators on the page — cross-indicator context (funnel, pipeline, cause donuts). */
  siblings?: Record<string, Indicator>;
  trends?: TrendSeries | null;
  /** Force single-column width even for wide charts (e.g. an even 2×2 section grid). */
  disableWide?: boolean;
}) {
  const filter = useFilterStore(pickFilter);
  const ind = indicator;
  const spec = vizFor(ind.name);

  const hasDrill = ind.tier !== 3 && ind.pct > 0 && !ind.split4;
  const eff = !ind.split4 ? effectiveIndicatorValue(ind, filter) : null;
  const split = ind.split4 ? effectiveSplit4(ind, filter) : null;

  const outOfScope = eff?.outOfScope || split?.outOfScope;
  const displayValue = outOfScope ? '—' : eff?.value ?? decodeHtml(ind.value);
  const displayPct = eff && !eff.outOfScope && eff.pct !== undefined ? eff.pct : ind.pct;
  const displayInd = { inverse: ind.inverse, pct: displayPct };
  const goodness = goodnessFor(displayInd);
  const isGap = !ind.split4 && (ind.tier === 3 || ind.pct <= 0);
  const scopeActive = !!(
    filter.state ||
    filter.zone ||
    filter.donor ||
    filter.lga ||
    filter.ward ||
    filter.facilityType ||
    filter.facility ||
    filter.year ||
    filter.month
  );

  const splitData = ind.split4 ? (split && !split.outOfScope ? split : ind.split4) : null;
  const isPercentValue = looksLikePercent(displayValue);

  // The redesigned per-indicator chart renders at national scope; under an active
  // filter the card falls back to the compact scoped display so a national
  // distribution is never mislabelled as a scoped one (split4 stays scoped-aware).
  const showViz = !!spec && !isGap && !outOfScope && !scopeActive && !ind.split4;
  const showGhost = !!spec && isGap;

  const clickable = hasDrill || !!ind.split4;
  const showValue =
    !ind.split4 &&
    !isGap &&
    !outOfScope &&
    !(showViz && vizEmbedsValue(ind.name));
  // Chart-bearing cards get more horizontal room so bars/labels aren't cramped —
  // unless the section pins them to an even grid (disableWide).
  const wide = !disableWide && (!!ind.split4 || (showViz && isWideViz(ind.name)));
  // Explanations longer than roughly one line stay out of the card body — the
  // Info tooltip already carries the full text, so the card height stays uniform.
  const metaText = decodeHtml(ind.meta);
  const showMeta = metaText.length <= 70;
  const valueSize = String(displayValue).length > 16 ? 'text-[17px]' : 'text-[26px]';

  return (
    <Card
      hover={clickable}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${cleanName(ind.name)} — open deep dive` : undefined}
      className={`group flex h-full flex-col p-4 ${clickable ? 'cursor-pointer' : ''} ${wide ? 'sm:col-span-2' : ''}`}
      onClick={() => clickable && onOpen(ind)}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(ind);
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5">
          <h3 className="text-[13px] font-bold leading-snug text-text">{cleanName(ind.name)}</h3>
          <span onClick={(e) => e.stopPropagation()}>
            <Tooltip
              wide
              content={
                ind.info ? (
                  <CompositeTooltip infoKey={ind.info} />
                ) : (
                  <span className="leading-relaxed">{decodeHtml(ind.meta)}</span>
                )
              }
            >
              <Info size={13} className="mt-0.5 flex-shrink-0 text-muted hover:text-brand-bright" />
            </Tooltip>
          </span>
        </div>
        <Badge tone={tierTone[ind.tier]} className="flex-shrink-0">
          {TIER_LABELS[ind.tier]}
        </Badge>
      </div>

      {showValue && (
        <div className="mt-2.5 flex items-end gap-2">
          <span className={`${valueSize} font-extrabold leading-none text-text`}>{displayValue}</span>
          {isPercentValue && displayPct > 0 && (
            <Badge tone={statusFor(displayPct, ind.inverse).level} className="mb-0.5">
              {statusFor(displayPct, ind.inverse).label}
            </Badge>
          )}
        </div>
      )}

      {/* Body: the indicator's selected visualization (see INDICATOR_VIZ_REDESIGN.md).
          flex-1 + justify-center makes the chart the centred hero of the card. */}
      <div className="mt-3 flex min-h-[140px] flex-1 flex-col justify-center">
        {ind.split4 ? (
          splitData && spec ? (
            <IndicatorViz indicator={ind} spec={spec} siblings={siblings} trends={trends} split={splitData} />
          ) : (
            <EmptyMini kind="scope" />
          )
        ) : showGhost ? (
          <IndicatorViz indicator={ind} spec={spec!} ghost siblings={siblings} trends={trends} />
        ) : isGap ? (
          <EmptyMini kind="gap" />
        ) : outOfScope ? (
          <EmptyMini kind="scope" />
        ) : showViz ? (
          <IndicatorViz indicator={ind} spec={spec!} siblings={siblings} trends={trends} />
        ) : isPercentValue && displayPct > 0 ? (
          <div className="flex items-center gap-2">
            <RingProgress pct={goodness} size={42} />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elev-3">
              <div className="h-full rounded-full" style={{ width: `${Math.max(goodness, 3)}%`, background: barColorFor(displayInd) }} />
            </div>
          </div>
        ) : (
          <div className="h-2 overflow-hidden rounded-full bg-bg-elev-3">
            <div className="h-full rounded-full" style={{ width: `${Math.max(goodness, 3)}%`, background: barColorFor(displayInd) }} />
          </div>
        )}
      </div>

      {showMeta && <p className="mt-2.5 text-[11px] leading-relaxed text-muted">{metaText}</p>}

      <div className="flex items-center justify-between gap-2 pt-3">
        <div className="flex items-center gap-1.5">
          {ind.coverage && covLabel[ind.coverage] && (
            <span className="rounded-full bg-bg-elev-2 px-2 py-0.5 text-[9.5px] font-bold uppercase text-muted">
              {covLabel[ind.coverage]}
            </span>
          )}
          {scopeActive && (eff || split) && !outOfScope && (
            <span className="text-[10px] font-semibold text-brand-bright">Scoped</span>
          )}
          {eff && !eff.outOfScope && eff.smallN && (
            <span
              className="text-[10px] font-semibold text-warning"
              title={`Small sample${eff.n != null ? ` (n = ${eff.n})` : ''} — interpret with caution`}
            >
              small n{eff.n != null ? ` = ${eff.n}` : ''}
            </span>
          )}
        </div>
        {clickable && (
          <span className="flex items-center gap-0.5 text-[11px] font-semibold text-brand-bright opacity-0 transition-opacity group-hover:opacity-100">
            Deep dive <ChevronRight size={13} />
          </span>
        )}
      </div>
    </Card>
  );
}

/** Consistent, intentional empty state for out-of-scope / unmapped gaps. */
function EmptyMini({ kind }: { kind: 'gap' | 'scope' }) {
  const Icon = kind === 'gap' ? Inbox : EyeOff;
  const title = kind === 'gap' ? 'Data not yet available' : 'Out of scope';
  const msg =
    kind === 'gap'
      ? 'Not yet collected for this indicator.'
      : 'No data for the current filter selection.';
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg-elev-2/40 px-3 py-5 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-elev-2 text-muted">
        <Icon size={16} />
      </div>
      <div>
        <div className="text-xs font-bold text-text">{title}</div>
        <div className="mt-0.5 text-[10.5px] leading-snug text-muted">{msg}</div>
      </div>
    </div>
  );
}
