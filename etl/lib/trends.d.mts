/**
 * Type surface for the shared trend engine (trends.mjs), so the browser app
 * (src/data/scopedEngine.ts) can import and re-run it under `tsc` cleanly. Records are
 * the flat, source-agnostic shapes the ETL adapters emit; each returned series is the
 * 42-month MONTH_LABELS-aligned array of values (null where a month has no data).
 */
import type { EngineRecord } from './indicators.d.mts';

export function buildTrends(
  srhAll: EngineRecord[],
  sfmAll: EngineRecord[],
  pfmoAll?: EngineRecord[],
): Record<string, (number | null)[]>;
