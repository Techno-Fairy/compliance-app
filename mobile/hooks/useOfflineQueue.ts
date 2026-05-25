// mobile/hooks/useOfflineQueue.ts
// FE-13: Offline queue — write actions stored in SQLite, flushed on reconnect
import { useEffect, useRef, useCallback } from "react";
import * as SQLite from "expo-sqlite";
import NetInfo from "@react-native-community/netinfo";
import { api } from "@/lib/api";

export interface QueuedAction {
  id?: number;
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  body?: string; // JSON string
  created_at?: string;
}

// ── DB bootstrap ──────────────────────────────────────────────────────────────
let _db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("offline_queue.db");
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS queue (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      method     TEXT NOT NULL,
      url        TEXT NOT NULL,
      body       TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return _db;
}

// ── Queue helpers ─────────────────────────────────────────────────────────────
export async function enqueue(action: Omit<QueuedAction, "id" | "created_at">) {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO queue (method, url, body) VALUES (?, ?, ?);",
    action.method,
    action.url,
    action.body ?? null
  );
}

async function dequeue(id: number) {
  const db = await getDb();
  await db.runAsync("DELETE FROM queue WHERE id = ?;", id);
}

async function getPending(): Promise<QueuedAction[]> {
  const db = await getDb();
  return db.getAllAsync<QueuedAction>(
    "SELECT * FROM queue ORDER BY id ASC;"
  );
}

// ── Flush logic ───────────────────────────────────────────────────────────────
async function flushQueue(onFlushed?: () => void) {
  const pending = await getPending();
  if (!pending.length) return;

  for (const action of pending) {
    try {
      const body = action.body ? JSON.parse(action.body) : undefined;
      if (action.method === "POST")   await api.post(action.url, body);
      if (action.method === "PATCH")  await api.patch(action.url, body);
      if (action.method === "DELETE") await api.delete(action.url);
      await dequeue(action.id!);
    } catch {
      // If still offline or server error, stop and retry later
      break;
    }
  }
  onFlushed?.();
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useOfflineQueue(onFlushed?: () => void) {
  const onFlushedRef = useRef(onFlushed);
  onFlushedRef.current = onFlushed;

  useEffect(() => {
    // Bootstrap DB on mount
    getDb().catch(console.error);

    // Listen for connectivity changes — flush when we come back online
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        flushQueue(onFlushedRef.current).catch(console.error);
      }
    });
    return () => unsub();
  }, []);

  const addToQueue = useCallback(
    (action: Omit<QueuedAction, "id" | "created_at">) => enqueue(action),
    []
  );

  return { addToQueue, flushQueue: () => flushQueue(onFlushedRef.current) };
}