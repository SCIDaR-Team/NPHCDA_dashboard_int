import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Skeleton } from '@/components/ui';
import { IndicatorCard } from '@/components/dashboard/IndicatorCard';
import { IndicatorModal } from '@/components/dashboard/IndicatorModal';
import {
  CAUSE_HOST_INDICATOR,
  CAUSE_INDICATOR_NAMES,
  CAUSE_CARD_TITLE,
} from '@/components/dashboard/indicatorViz';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { useRecentStore } from '@/store/recentStore';
import { BLOCK_DESCRIPTIONS } from '@/data/catalogue';
import { indicatorAnchorId, BLOCK_ROUTES } from '@/app/navigation';
import { effectiveIndicatorValue, goodnessFor, heatColor } from '@/data/calculations';
import { cleanName, decodeHtml } from '@/lib/format';
import type { BlockName, Indicator } from '@/data/types';

export function BlockPage({ block }: { block: BlockName }) {
  const ds = getDataSource();
  const { data: blocks, loading, error, reload } = useAsync(() => ds.getBlocks());
  const { data: sections } = useAsync(() => ds.getBlockSections());
  const { data: trends } = useAsync(() => ds.getTrendSeries());
  const filter = useFilterStore(pickFilter);
  const recordRecent = useRecentStore((s) => s.record);
  const location = useLocation();
  const [modalInd, setModalInd] = useState<Indicator | null>(null);

  // Open the deep-dive and remember the indicator in "recently viewed" (deep-linked
  // to its card on this thematic page).
  const openIndicator = (ind: Indicator) => {
    setModalInd(ind);
    recordRecent({
      id: `indicator:${ind.name}`,
      kind: 'indicator',
      label: cleanName(ind.name),
      href: `${BLOCK_ROUTES[block]}#${indicatorAnchorId(ind.name)}`,
    });
  };
  // Deep-link target (e.g. from an Overview KPI): once cards are rendered, scroll to
  // the matching indicator card and briefly ring-highlight it.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const hash = location.hash.replace(/^#/, '');
    if (!hash || loading || !blocks) return;
    const el = document.getElementById(hash);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(hash);
    const t = window.setTimeout(() => setHighlightId(null), 2200);
    return () => window.clearTimeout(t);
  }, [location.hash, loading, blocks]);

  const indicators = blocks?.[block] ?? [];
  const indByName = useMemo(() => {
    const m: Record<string, Indicator> = {};
    indicators.forEach((i) => (m[i.name] = i));
    return m;
  }, [indicators]);

  const sectionList = sections?.[block] ?? [['Indicators', indicators.map((i) => i.name)]];

  // Strongest / weakest indicator in the block by goodness (inverse-aware), across
  // the indicators that carry a real measurement. A quick scan of what's working
  // and what needs attention, straight in the header.
  const extremes = useMemo(() => {
    const list = blocks?.[block] ?? [];
    const graded = list
      .filter((i) => i.pct > 0 && !i.split4)
      .map((i) => ({ ind: i, goodness: goodnessFor({ inverse: i.inverse, pct: i.pct }) }));
    if (graded.length < 2) return null;
    const sorted = [...graded].sort((a, b) => b.goodness - a.goodness);
    return { best: sorted[0], worst: sorted[sorted.length - 1] };
  }, [blocks, block]);

  // Flat export rows (filter-aware values).
  const exportRows = useMemo(
    () =>
      indicators.map((ind) => {
        const eff = effectiveIndicatorValue(ind, filter);
        return {
          Indicator: cleanName(ind.name),
          Tier: ind.tier,
          Value: eff && !eff.outOfScope ? eff.value : ind.value,
          'Performance %': ind.pct,
          Source: ind.src,
        };
      }),
    [indicators, filter]
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title={block}
        subtitle={`${BLOCK_DESCRIPTIONS[block]} · Tier 1 = all states · Tier 2 = select locations · Tier 3 = not available yet`}
        actions={
          <span data-tour="block-export" className="inline-flex">
            <ExportMenu filename={`nphcda-${block.toLowerCase().replace(/\s+/g, '-')}`} rows={exportRows} />
          </span>
        }
      />

      {extremes && (
        <div className="mb-5 flex flex-wrap gap-2.5">
          <span data-tour="strongest" className="inline-flex">
            <ExtremeChip label="Strongest" entry={extremes.best} />
          </span>
          <span data-tour="needs-attention" className="inline-flex">
            <ExtremeChip label="Needs attention" entry={extremes.worst} />
          </span>
        </div>
      )}

      {loading ? (
        <div className="space-y-5">
          {Array.from({ length: 2 }).map((_, s) => (
            <div key={s} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-card" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div data-tour="indicators">
        {sectionList.map(([title, names]) => {
          // The three maternal-death cause shares collapse into ONE card hosted by
          // PPH — they share a denominator, so separate cards repeated the same
          // breakdown three times. The folded-in causes remain full indicators
          // everywhere else (scorecard, league, exports, search); only the card is
          // merged, and the deep dive splits back out per cause.
          const cards = names
            .map((n) => indByName[n])
            .filter(Boolean)
            .filter((ind) => ind.name === CAUSE_HOST_INDICATOR || !CAUSE_INDICATOR_NAMES.includes(ind.name));
          if (!cards.length) return null;
          const isGap = /gap/i.test(title);
          // This section is laid out as an even 2×2 grid (two charts per row).
          const twoUp = /functionality\s*&(amp;)?\s*infrastructure/i.test(title);
          const gridClass = twoUp
            ? 'grid gap-4 sm:grid-cols-2'
            : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';
          return (
            <SectionBlock key={title} title={decodeHtml(title)} tone={isGap ? 'warning' : 'brand'}>
              <div className={gridClass}>
                {cards.map((ind) => {
                  const id = indicatorAnchorId(ind.name);
                  return (
                    <IndicatorCard
                      key={ind.name}
                      indicator={ind}
                      onOpen={openIndicator}
                      siblings={indByName}
                      trends={trends}
                      disableWide={twoUp}
                      anchorId={id}
                      highlighted={highlightId === id}
                      titleOverride={ind.name === CAUSE_HOST_INDICATOR ? CAUSE_CARD_TITLE : undefined}
                    />
                  );
                })}
              </div>
            </SectionBlock>
          );
        })}
        </div>
      )}

      <IndicatorModal indicator={modalInd} onClose={() => setModalInd(null)} />
    </div>
  );
}

/** Compact header chip naming the strongest / weakest indicator in the block. */
function ExtremeChip({
  label,
  entry,
}: {
  label: string;
  entry: { ind: Indicator; goodness: number };
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-elev px-3 py-1.5 text-[12px] shadow-card">
      <span
        className="h-2 w-2 flex-shrink-0 rounded-full"
        style={{ background: heatColor(entry.goodness) }}
        aria-hidden
      />
      <span className="font-bold uppercase tracking-wide text-muted-2">{label}</span>
      <span className="max-w-[240px] truncate font-semibold text-text">{cleanName(entry.ind.name)}</span>
      <span className="font-bold tabular-nums text-text-soft">{decodeHtml(entry.ind.value)}</span>
    </span>
  );
}
