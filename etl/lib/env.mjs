/**
 * Tiny .env loader (no dependency). Reads etl/.env.etl (git-ignored) into
 * process.env so credentials never live in source or ship to the browser.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '..', '.env.etl');

export function loadEnv() {
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

/** Require an env var, with a friendly message pointing at .env.etl. */
export function required(key) {
  const v = process.env[key];
  if (!v) {
    throw new Error(
      `Missing ${key}. Copy etl/.env.etl.example to etl/.env.etl and fill in the credentials.`
    );
  }
  return v;
}
