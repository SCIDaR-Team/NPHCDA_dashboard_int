/**
 * ETL entry point. Run with `npm run data:refresh`.
 *
 * Fetches every real source (SRH ODK, SFM ODK, SRH Google Sheet), normalises and
 * folds them onto the preserved indicator names, and writes a single static
 * snapshot the SPA reads at runtime: public/data-snapshot/measurements.json.
 *
 * Credentials come from etl/.env.etl (git-ignored) — they NEVER ship to the browser.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadEnv, required } from './lib/env.mjs';
import { loadSrhOdk } from './sources/srhOdk.mjs';
import { loadSfmOdk } from './sources/sfmOdk.mjs';
import { loadSrhSheet } from './sources/srhSheet.mjs';
import { transform } from './transform.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, '..', 'public', 'data-snapshot');
const OUT_FILE = resolve(OUT_DIR, 'measurements.json');

async function safe(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✓ ${label}: ${result.rowsFetched} rows → ${result.facilities} facilities`);
    return result;
  } catch (err) {
    console.warn(`  ✗ ${label}: ${err.message}`);
    return { name: label, ok: false, error: err.message, rowsFetched: 0, facilities: 0, records: [], allRecords: [] };
  }
}

async function main() {
  loadEnv();
  console.log('NPHCDA data refresh — pulling live sources…');

  const srh = await safe('SRH ODK', () =>
    loadSrhOdk(`${required('SRH_ODK_USER')}:${required('SRH_ODK_PASS')}`)
  );
  const sfm = await safe('SFM ODK', () =>
    loadSfmOdk(`${required('SFM_ODK_USER')}:${required('SFM_ODK_PASS')}`)
  );
  const sheet = await safe('SRH Google Sheet', () => loadSrhSheet());

  const { indicators, kpis, trends, stateScores, facilities } = transform({ srh, sfm, sheet });

  const quarters = [...new Set([...(srh.quarters || []), ...(sfm.quarters || [])])].sort();
  const snapshot = {
    generatedAt: new Date().toISOString(),
    period: { quarters, from: quarters[0] ?? null, to: quarters[quarters.length - 1] ?? null },
    sources: [srh, sfm, sheet].map((s) => ({
      name: s.name,
      ok: s.ok,
      error: s.error ?? null,
      rowsFetched: s.rowsFetched,
      facilities: s.facilities,
    })),
    counts: { indicators: Object.keys(indicators).length, facilities: facilities.length, states: Object.keys(stateScores).length },
    indicators,
    kpis,
    trends,
    stateScores,
    facilities,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2));

  console.log(
    `\nWrote ${OUT_FILE}\n  ${snapshot.counts.indicators} live indicators · ${snapshot.counts.facilities} facilities · ${snapshot.counts.states} states · period ${snapshot.period.from ?? '?'} → ${snapshot.period.to ?? '?'}`
  );
}

main().catch((err) => {
  console.error('\nData refresh failed:', err);
  process.exit(1);
});
