/**
 * Type surface for the shared record-quality guards (quality.mjs), so the browser
 * app can apply the same dedupe / cause-validity rules to an already-published
 * snapshot that the ETL applies at source-load time.
 */
import type { EngineRecord } from './indicators.d.mts';

export function hasImpossibleCauses(r: EngineRecord): boolean;

export function dedupeSubmissions<T extends EngineRecord>(
  records: T[],
  onDrop?: (loser: T, winner: T) => void,
): T[];

export function voidImpossibleCauses<T extends EngineRecord>(
  records: T[],
  onVoid?: (r: T) => void,
): T[];

export function sanitizeRecords<T extends EngineRecord>(
  records: T[],
  label?: string,
): { records: T[]; dropped: number; voided: number };
