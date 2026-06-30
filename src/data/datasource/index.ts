import type { DataSource } from './types';
import { MockDataSource } from './MockDataSource';
import { ApiDataSource } from './ApiDataSource';

export type { DataSource } from './types';
export { MockDataSource } from './MockDataSource';
export { ApiDataSource } from './ApiDataSource';

/**
 * Single place that decides which data source the app uses.
 *
 * Controlled by the `VITE_DATA_SOURCE` env var:
 *   - "mock" (default) → preserved illustrative figures
 *   - "api"            → live backend via ApiDataSource
 *
 * Components consume this through the `useDataSource()` hook / DataProvider,
 * so swapping data sources never touches UI code.
 */
let instance: DataSource | null = null;

export function getDataSource(): DataSource {
  if (instance) return instance;
  const mode = import.meta.env.VITE_DATA_SOURCE ?? 'mock';
  instance = mode === 'api' ? new ApiDataSource() : new MockDataSource();
  return instance;
}

/** Mostly for tests — inject a custom source. */
export function setDataSource(ds: DataSource): void {
  instance = ds;
}
