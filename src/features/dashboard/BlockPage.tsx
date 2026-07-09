import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Skeleton } from '@/components/ui';
import { IndicatorCard } from '@/components/dashboard/IndicatorCard';
import { IndicatorModal } from '@/components/dashboard/IndicatorModal';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { BLOCK_DESCRIPTIONS } from '@/data/catalogue';
import { indicatorAnchorId } from '@/app/navigation';
import { effectiveIndicatorValue } from '@/data/calculations';
import { cleanName, decodeHtml } from '@/lib/format';
import type { BlockName, Indicator } from '@/data/types';

export function BlockPage({ block }: { block: BlockName }) {
  const ds = getDataSource();
  const { data: blocks, loading, error, reload } = useAsync(() => ds.getBlocks());
  const { data: sections } = useAsync(() => ds.getBlockSections());
  const { data: trends } = useAsync(() => ds.getTrendSeries());
  const filter = useFilterStore(pickFilter);
  const location = useLocation();
  const [modalInd, setModalInd] = useState<Indicator | null>(null);
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
        actions={<ExportMenu filename={`nphcda-${block.toLowerCase().replace(/\s+/g, '-')}`} rows={exportRows} />}
      />

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
        sectionList.map(([title, names]) => {
          const cards = names.map((n) => indByName[n]).filter(Boolean);
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
                      onOpen={setModalInd}
                      siblings={indByName}
                      trends={trends}
                      disableWide={twoUp}
                      anchorId={id}
                      highlighted={highlightId === id}
                    />
                  );
                })}
              </div>
            </SectionBlock>
          );
        })
      )}

      <IndicatorModal indicator={modalInd} onClose={() => setModalInd(null)} />
    </div>
  );
}
