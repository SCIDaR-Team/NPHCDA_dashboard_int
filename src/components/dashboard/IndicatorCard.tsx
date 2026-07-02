import { Info, ChevronRight, Inbox, EyeOff } from 'lucide-react';
import { Card, Badge, Tooltip } from '@/components/ui';
import { RingProgress } from '@/components/charts/RingProgress';
import { CompositeBreakdownChart } from '@/components/charts/CompositeBreakdownChart';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import {
  effectiveIndicatorValue,
  effectiveSplit4,
  goodnessFor,
  barColorFor,
  statusFor,
  looksLikePercent,
} from '@/data/calculations';
import { DEFINITIONS, TIER_LABELS } from '@/data/mock/indicators';
import { cleanName, decodeHtml } from '@/lib/format';
import type { Indicator } from '@/data/types';

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

export function IndicatorCard({ indicator, onOpen }: { indicator: Indicator; onOpen: (i: Indicator) => void }) {
  const filter = useFilterStore(pickFilter);
  const ind = indicator;

  const hasDrill = ind.tier !== 3 && ind.pct > 0 && !ind.split4;
  const isBreakdown = !!(ind.info && DEFINITIONS[ind.info] && DEFINITIONS[ind.info].items);
  const eff = !ind.split4 && !isBreakdown ? effectiveIndicatorValue(ind, filter) : null;
  const split = ind.split4 ? effectiveSplit4(ind, filter) : null;

  const outOfScope = eff?.outOfScope || split?.outOfScope;
  const displayValue = outOfScope ? '—' : eff?.value ?? decodeHtml(ind.value);
  const displayPct = eff && !eff.outOfScope && eff.pct !== undefined ? eff.pct : ind.pct;
  const displayInd = { inverse: ind.inverse, pct: displayPct };
  const goodness = goodnessFor(displayInd);
  const isGap = !ind.split4 && !isBreakdown && (ind.tier === 3 || ind.pct <= 0);
  const scopeActive = !!(filter.state || filter.zone || filter.donor);

  const splitData = ind.split4 ? (split && !split.outOfScope ? split : ind.split4) : null;
  const isDonut =
    !ind.split4 && !isBreakdown && ind.pct > 0 && !outOfScope && (looksLikePercent(displayValue) || !!eff);

  const clickable = hasDrill || !!ind.split4;
  const showValue = !ind.split4 && !isBreakdown && !isGap && !outOfScope;
  // Chart-bearing cards get more horizontal room so bars/labels aren't cramped.
  const wide = isBreakdown || !!ind.split4;
  // Explanations longer than roughly one line stay out of the card body — the
  // Info tooltip already carries the full text, so the card height stays uniform.
  const metaText = decodeHtml(ind.meta);
  const showMeta = metaText.length <= 70;

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
          {(ind.info || true) && (
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
          )}
        </div>
        <Badge tone={tierTone[ind.tier]} className="flex-shrink-0">
          {TIER_LABELS[ind.tier]}
        </Badge>
      </div>

      {showValue && (
        <div className="mt-2.5 flex items-end gap-2">
          <span className="text-[26px] font-extrabold leading-none text-text">{displayValue}</span>
          {isDonut && (
            <Badge tone={statusFor(displayPct, ind.inverse).level} className="mb-0.5">
              {statusFor(displayPct, ind.inverse).label}
            </Badge>
          )}
        </div>
      )}

      {/* Body variant */}
      <div className="mt-3">
        {isGap ? (
          <EmptyMini kind="gap" />
        ) : ind.split4 ? (
          splitData ? (
            <div>
              <div className="flex h-3 overflow-hidden rounded-full">
                <span style={{ width: `${splitData.l2}%`, background: '#2E8B57' }} />
                <span style={{ width: `${splitData.l1}%`, background: '#6FA888' }} />
                <span style={{ width: `${splitData.partial}%`, background: '#C9A227' }} />
                <span style={{ width: `${splitData.nonfunc}%`, background: '#C2562C' }} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px] text-muted">
                <span><b className="text-[#34a76b]">■</b> L2 {splitData.l2}%</span>
                <span><b className="text-[#6FA888]">■</b> L1 {splitData.l1}%</span>
                <span><b className="text-[#C9A227]">■</b> Partial {splitData.partial}%</span>
                <span><b className="text-[#C2562C]">■</b> Non-func {splitData.nonfunc}%</span>
              </div>
            </div>
          ) : (
            <EmptyMini kind="scope" />
          )
        ) : isBreakdown ? (
          <CompositeBreakdownChart items={DEFINITIONS[ind.info!].items!} />
        ) : outOfScope ? (
          <EmptyMini kind="scope" />
        ) : isDonut ? (
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

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <div className="flex items-center gap-1.5">
          {ind.coverage && covLabel[ind.coverage] && (
            <span className="rounded-full bg-bg-elev-2 px-2 py-0.5 text-[9.5px] font-bold uppercase text-muted">
              {covLabel[ind.coverage]}
            </span>
          )}
          {scopeActive && (eff || split) && !outOfScope && (
            <span className="text-[10px] font-semibold text-brand-bright">Scoped</span>
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

/** Consistent, intentional empty state for data gaps / out-of-scope cards. */
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
