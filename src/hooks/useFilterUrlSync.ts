import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFilterStore, pickFilter, EMPTY_FILTER } from '@/store/filterStore';
import type { FilterState } from '@/data/types';

/**
 * Two-way sync between the global filter scope and the URL querystring, so a
 * scoped view (e.g. `?state=Kano&source=SRH`) is a shareable deep link.
 *
 *  - On first mount, any filter keys present in the URL hydrate the store.
 *  - Thereafter, every store change is written back to the URL with `replace`
 *    (no history spam), serialising only the non-empty keys.
 *
 * Mounted once, from the app shell.
 */
const FILTER_KEYS = Object.keys(EMPTY_FILTER) as (keyof FilterState)[];

function filterToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = f[k];
    if (v) p.set(k, v);
  }
  return p;
}

export function useFilterUrlSync(): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const set = useFilterStore((s) => s.set);
  const hydrated = useRef(false);

  // Hydrate the store from the URL once, on first mount.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const patch: Partial<FilterState> = {};
    for (const k of FILTER_KEYS) {
      const v = searchParams.get(k);
      if (v) patch[k] = v;
    }
    if (Object.keys(patch).length) set(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror store → URL on every change (after hydration).
  useEffect(() => {
    const unsub = useFilterStore.subscribe((state) => {
      if (!hydrated.current) return;
      const next = filterToParams(pickFilter(state)).toString();
      const curr = new URLSearchParams(window.location.search).toString();
      // Only rewrite when the serialised filter actually changed (avoids loops).
      if (curr !== next) {
        setSearchParams(next ? new URLSearchParams(next) : {}, { replace: true });
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
