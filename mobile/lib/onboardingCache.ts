/**
 * onboardingCache.ts — FE-22
 *
 * Thin SQLite read-cache for onboarding data.  Writes come from the network;
 * reads fall back to cache when offline.  The cache stores two blobs:
 *   - "steps"    → full OnboardingStatus (GET /onboarding/steps)
 *   - "progress" → OnboardingProgressSummary (GET /onboarding/progress)
 *
 * Using expo-sqlite so the data survives app restarts and is available offline.
 */
import * as SQLite from "expo-sqlite";
import type { OnboardingStatus, OnboardingProgressSummary } from "@/types";

type CacheKey = "steps" | "progress";

let _db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("onboarding_cache.db");
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS onboarding_cache (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      cached_at  TEXT DEFAULT (datetime('now'))
    );
  `);
  return _db;
}

export async function cacheOnboardingSteps(data: OnboardingStatus): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO onboarding_cache (key, value, cached_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, cached_at = excluded.cached_at;`,
    "steps",
    JSON.stringify(data)
  );
}

export async function getCachedOnboardingSteps(): Promise<OnboardingStatus | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM onboarding_cache WHERE key = ?;",
    "steps"
  );
  if (!row) return null;
  try {
    return JSON.parse(row.value) as OnboardingStatus;
  } catch {
    return null;
  }
}

export async function cacheOnboardingProgress(data: OnboardingProgressSummary): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO onboarding_cache (key, value, cached_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, cached_at = excluded.cached_at;`,
    "progress",
    JSON.stringify(data)
  );
}

export async function getCachedOnboardingProgress(): Promise<OnboardingProgressSummary | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM onboarding_cache WHERE key = ?;",
    "progress"
  );
  if (!row) return null;
  try {
    return JSON.parse(row.value) as OnboardingProgressSummary;
  } catch {
    return null;
  }
}

export async function clearOnboardingCache(): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM onboarding_cache;");
}