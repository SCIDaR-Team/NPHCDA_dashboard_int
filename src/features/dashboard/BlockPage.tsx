import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionBlock, ErrorState, Skeleton } from '@/components/ui';
import { IndicatorCard } from '@/components/dashboard/IndicatorCard';
import { IndicatorModal } from '@/components/dashboard/IndicatorModal';
import { ExportMenu } from '@/components/dashboard/ExportMenu';
import { useAsync } from '@/hooks/useAsync';
import { getDataSource } from '@/data/datasource';
import { useFilterStore, pickFilter } from '@/store/filterStore';
import { BLOCK_DESCRIPTIONS } from '@/data/mock/indicators';
import { effectiveIndicatorValue } from '@/data/calculations';
import { cleanName, decodeHtml } from '@/lib/format';
import type { BlockName, Indicator } from '@/data/types';

export function BlockPage({ block }: { block: BlockName }) {
  const ds = getDataSource();
  const { data: blocks, loading, error, reload } = useAsync(() => ds.getBlocks());
  const { data: sections } = useAsync(() => ds.getBlockSections());
  const filter = useFilterStore(pickFilter);
  const [modalInd, setModalInd] = useState<Indicator | null>(null);

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
          return (
            <SectionBlock key={title} title={decodeHtml(title)} tone={isGap ? 'warning' : 'brand'}>
              <div className="grid auto-rows-min items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((ind) => (
                  <IndicatorCard key={ind.name} indicator={ind} onOpen={setModalInd} />
                ))}
              </div>
            </SectionBlock>
          );
        })
      )}

      <IndicatorModal indicator={modalInd} onClose={() => setModalInd(null)} />
    </div>
  );
}
