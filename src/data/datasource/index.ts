import type { DataSource } from './types';
import { ApiDataSource } from './ApiDataSource';
import { SnapshotDataSource } from './SnapshotDataSource';

export type { DataSource } from './types';
export { ApiDataSource } from './ApiDataSource';
export { SnapshotDataSource } from './SnapshotDataSource';

/**
 * Single place that decides which data source the app uses.
 *
 * The app is REAL-DATA-ONLY: the default (and only shipped) source is the ETL
 * snapshot (`npm run data:refresh` → public/data-snapshot/measurements.json).
 * Set `VITE_DATA_SOURCE=api` to point at a live backend via ApiDataSource.
 * There is no mock/illustrative source.
 *
 * Components consume this through the `useDataSource()` hook / DataProvider,
 * so swapping data sources never touches UI code.
 */
let instance: DataSource | null = null;

export function getDataSource(): DataSource {
  if (instance) return instance;
  const mode = import.meta.env.VITE_DATA_SOURCE ?? 'snapshot';
  instance = mode === 'api' ? new ApiDataSource() : new SnapshotDataSource();
  return instance;
}

/** Mostly for tests — inject a custom source. */
export function setDataSource(ds: DataSource): void {
  instance = ds;
}
