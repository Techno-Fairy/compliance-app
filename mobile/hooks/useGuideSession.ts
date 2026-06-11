/**
 * hooks/useGuideSession.ts — Step 3
 *
 * Session management for the public Starter Guide (pre-login).
 *
 * Responsibilities:
 *  1. On first launch, generate a random UUID session ID and store it in
 *     AsyncStorage under the key "guide_session_id".
 *  2. On subsequent launches, read that same ID — so the user always
 *     resumes the same session on the same device.
 *  3. Provide `progress` (step completion map) loaded from the existing
 *     `local_onboarding_progress` SQLite table (via localOnboardingProgress.ts).
 *  4. Provide `markStep(stepId, done)` — writes to SQLite and updates
 *     in-memory state atomically, so the UI updates immediately even without
 *     a re-render trigger from useFocusEffect.
 *  5. Provide `clearSession()` — wipes both the SQLite rows and the AsyncStorage
 *     session ID. Called after the user creates an account and syncs progress.
 *  6. Expose `sessionId` for debugging / future sync needs.
 *
 * Offline-first contract:
 *  - All reads/writes are local only.
 *  - No network calls are made by this hook.
 *  - Progress survives app restarts, background kills, and device reboots.
 *  - Clearing app data (Settings → Storage → Clear Data) resets progress,
 *    which is the expected behaviour for a device-local session.
 *
 * Usage:
 *   const { progress, markStep, sessionId, loading } = useGuideSession();
 */

import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getLocalProgress,
  markLocalStep,
  clearLocalProgress,
  type LocalStepProgress,
} from "@/lib/localOnboardingProgress";

const SESSION_KEY = "guide_session_id";

/** Simple UUID v4 generator that avoids the `expo-random` / `crypto` dependency. */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface GuideSessionState {
  /** Whether the initial load is still in progress. */
  loading: boolean;
  /** Device-local session UUID. Stable across restarts until clearSession(). */
  sessionId: string | null;
  /** Map of step_id → completion record. Kept in sync with SQLite. */
  progress: Record<number, LocalStepProgress>;
  /** Mark (or unmark) a single step. Updates SQLite + in-memory state. */
  markStep: (stepId: number, completed: boolean) => Promise<void>;
  /** Wipe the session: clears SQLite rows and removes the session ID from AsyncStorage. */
  clearSession: () => Promise<void>;
}

export function useGuideSession(): GuideSessionState {
  const [loading,   setLoading]   = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress,  setProgress]  = useState<Record<number, LocalStepProgress>>({});

  // Guard against state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Initialise: get or create session ID, then load SQLite progress ────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // ── 1. Session ID ────────────────────────────────────────────────────
        let id = await AsyncStorage.getItem(SESSION_KEY);
        if (!id) {
          id = generateUUID();
          await AsyncStorage.setItem(SESSION_KEY, id);
        }

        // ── 2. Load progress from SQLite ─────────────────────────────────────
        const map = await getLocalProgress();

        if (!cancelled && mountedRef.current) {
          setSessionId(id);
          setProgress(map);
        }
      } catch (err) {
        // Non-fatal: the guide is still usable; progress just won't persist.
        console.warn("[useGuideSession] init error:", err);
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── markStep ───────────────────────────────────────────────────────────────
  const markStep = useCallback(
    async (stepId: number, completed: boolean): Promise<void> => {
      // Write to SQLite first (source of truth)
      await markLocalStep(stepId, completed);

      // Then update in-memory state so the UI reflects the change immediately
      // without waiting for a full re-fetch.
      if (mountedRef.current) {
        setProgress((prev) => ({
          ...prev,
          [stepId]: {
            step_id:      stepId,
            completed,
            completed_at: completed ? new Date().toISOString() : null,
          },
        }));
      }
    },
    []
  );

  // ── clearSession ───────────────────────────────────────────────────────────
  const clearSession = useCallback(async (): Promise<void> => {
    await clearLocalProgress();
    await AsyncStorage.removeItem(SESSION_KEY);
    if (mountedRef.current) {
      setSessionId(null);
      setProgress({});
    }
  }, []);

  return { loading, sessionId, progress, markStep, clearSession };
}