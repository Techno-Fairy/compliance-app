/**
 * lib/localOnboardingProgress.ts — Step 2
 *
 * SQLite-backed store for the PUBLIC Starter Guide.
 *
 * This is completely separate from the existing `onboardingCache.ts`
 * (which caches server data for authenticated users).  This module
 * stores the user's *real* progress while they have no account yet.
 *
 * Table: local_onboarding_progress
 *   step_id       INTEGER PRIMARY KEY
 *   completed     INTEGER (0 | 1) — SQLite has no BOOL type
 *   completed_at  TEXT    — ISO-8601 string | NULL
 *
 * Public surface:
 *   getLocalProgress()            → Record<stepId, LocalStepProgress>
 *   markLocalStep(stepId, done)   → updates / inserts one row
 *   clearLocalProgress()          → wipe everything (called after account sync)
 *   exportLocalProgress()         → array of completed-step rows for the sync API
 */

import * as SQLite from "expo-sqlite";

const DB_NAME = "local_onboarding_progress.db";

let _db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_onboarding_progress (
      step_id       INTEGER PRIMARY KEY,
      completed     INTEGER NOT NULL DEFAULT 0,
      completed_at  TEXT
    );
  `);
  return _db;
}

export interface LocalStepProgress {
  step_id: number;
  completed: boolean;
  completed_at: string | null;
}

/** Return all rows as a map keyed by step_id. */
export async function getLocalProgress(): Promise<Record<number, LocalStepProgress>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    step_id: number;
    completed: number;
    completed_at: string | null;
  }>("SELECT * FROM local_onboarding_progress;");

  const result: Record<number, LocalStepProgress> = {};
  for (const row of rows) {
    result[row.step_id] = {
      step_id: row.step_id,
      completed: row.completed === 1,
      completed_at: row.completed_at,
    };
  }
  return result;
}

/** Mark (or unmark) a single step.  Creates the row if not present. */
export async function markLocalStep(
  stepId: number,
  completed: boolean
): Promise<void> {
  const db = await getDb();
  const completedAt = completed ? new Date().toISOString() : null;
  await db.runAsync(
    `INSERT INTO local_onboarding_progress (step_id, completed, completed_at)
     VALUES (?, ?, ?)
     ON CONFLICT(step_id) DO UPDATE SET
       completed    = excluded.completed,
       completed_at = excluded.completed_at;`,
    stepId,
    completed ? 1 : 0,
    completedAt
  );
}

/** Called after a successful account registration + sync. */
export async function clearLocalProgress(): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM local_onboarding_progress;");
}

/** Returns only the completed rows — used by the sync endpoint payload. */
export async function exportLocalProgress(): Promise<LocalStepProgress[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    step_id: number;
    completed: number;
    completed_at: string | null;
  }>(
    "SELECT * FROM local_onboarding_progress WHERE completed = 1;"
  );
  return rows.map((r) => ({
    step_id: r.step_id,
    completed: true,
    completed_at: r.completed_at,
  }));
}