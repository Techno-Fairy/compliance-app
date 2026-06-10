/**
 * useOnboardingProgress — FE-22
 *
 * Two React Query queries + one mutation covering all onboarding API calls:
 *
 *   useOnboardingSteps()     — GET /onboarding/steps   (full step detail, grouped by phase)
 *   useOnboardingProgress()  — GET /onboarding/progress (lightweight summary for dashboard card)
 *   useMarkStepComplete()    — PATCH /onboarding/steps/{step_id}
 *
 * Offline behaviour:
 *   - On successful fetch, the response is written to SQLite via onboardingCache.
 *   - If a fetch throws (no network), the hook falls back to the SQLite cache
 *     and sets `fromCache: true` on the returned data.
 *   - Mark-complete while offline: the PATCH is enqueued via the existing
 *     offline write queue (useOfflineQueue) and the local React Query cache is
 *     optimistically updated so the UI reflects the change immediately.
 *
 * Stale time: 5 minutes (per PRD FE-22 spec).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { api } from "@/lib/api";
import {
  cacheOnboardingSteps,
  getCachedOnboardingSteps,
  cacheOnboardingProgress,
  getCachedOnboardingProgress,
} from "@/lib/onboardingCache";
import { useOfflineQueue } from "@/store/offlineQueue";
import type {
  OnboardingStatus,
  OnboardingProgressSummary,
  OnboardingStepUpdateResponse,
} from "@/types";

const STALE_TIME = 1000 * 60 * 5; // 5 minutes

// ── Query keys ────────────────────────────────────────────────────────────────
export const onboardingKeys = {
  steps: ["onboarding", "steps"] as const,
  progress: ["onboarding", "progress"] as const,
};

// ── useOnboardingSteps ────────────────────────────────────────────────────────
/**
 * Fetches all onboarding steps grouped by phase with per-step completion status.
 * Falls back to SQLite cache when offline.
 */
export function useOnboardingSteps() {
  return useQuery<OnboardingStatus & { fromCache?: boolean }>({
    queryKey: onboardingKeys.steps,
    queryFn: async () => {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        const cached = await getCachedOnboardingSteps();
        if (cached) return { ...cached, fromCache: true };
        throw new Error("Offline and no cached onboarding steps available.");
      }

      const { data } = await api.get<OnboardingStatus>("/onboarding/steps");
      // Write to cache for offline fallback
      await cacheOnboardingSteps(data);
      return data;
    },
    staleTime: STALE_TIME,
    retry: (failureCount, error: unknown) => {
      // Don't retry on offline — we already fell back to cache
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("Offline")) return false;
      return failureCount < 2;
    },
  });
}

// ── useOnboardingProgress ────────────────────────────────────────────────────
/**
 * Fetches the lightweight progress summary used by the dashboard onboarding card.
 * Falls back to SQLite cache when offline.
 */
export function useOnboardingProgress() {
  return useQuery<OnboardingProgressSummary & { fromCache?: boolean }>({
    queryKey: onboardingKeys.progress,
    queryFn: async () => {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        const cached = await getCachedOnboardingProgress();
        if (cached) return { ...cached, fromCache: true };
        throw new Error("Offline and no cached onboarding progress available.");
      }

      const { data } = await api.get<OnboardingProgressSummary>("/onboarding/progress");
      await cacheOnboardingProgress(data);
      return data;
    },
    staleTime: STALE_TIME,
    retry: (failureCount, error: unknown) => {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("Offline")) return false;
      return failureCount < 2;
    },
  });
}

// ── useMarkStepComplete ───────────────────────────────────────────────────────
/**
 * Marks a single onboarding step complete or incomplete.
 *
 * Online:  PATCH /onboarding/steps/{step_id} → invalidates both queries.
 * Offline: Enqueues the PATCH and optimistically updates the React Query cache
 *          so the UI reflects the change before the network is available.
 */
export function useMarkStepComplete() {
  const qc = useQueryClient();
  const { enqueue } = useOfflineQueue();

  type MutationContext = {
    prevSteps: (OnboardingStatus & { fromCache?: boolean }) | undefined;
    prevProgress: (OnboardingProgressSummary & { fromCache?: boolean }) | undefined;
  };

  return useMutation<
    OnboardingStepUpdateResponse,
    Error,
    { stepId: number; completed: boolean },
    MutationContext
  >({
    mutationFn: async ({ stepId, completed }) => {
      const netState = await NetInfo.fetch();

      if (!netState.isConnected) {
        // Enqueue for later and return a synthetic response so the UI doesn't error
        await enqueue({
          method: "PATCH",
          url: `/onboarding/steps/${stepId}`,
          body: { completed } as Record<string, unknown>,
        });
        // Throw a typed sentinel so onError can distinguish offline vs server error
        throw Object.assign(new Error("OFFLINE_QUEUED"), { isOfflineQueued: true });
      }

      const { data } = await api.patch<OnboardingStepUpdateResponse>(
        `/onboarding/steps/${stepId}`,
        { completed }
      );
      return data;
    },

    onMutate: async ({ stepId, completed }) => {
      // Optimistic update — immediately reflect the new completion state in cache
      await qc.cancelQueries({ queryKey: onboardingKeys.steps });
      await qc.cancelQueries({ queryKey: onboardingKeys.progress });

      const prevSteps = qc.getQueryData<OnboardingStatus>(onboardingKeys.steps);
      const prevProgress = qc.getQueryData<OnboardingProgressSummary>(onboardingKeys.progress);

      if (prevSteps) {
        qc.setQueryData<OnboardingStatus>(onboardingKeys.steps, (old) => {
          if (!old) return old;
          return {
            ...old,
            phases: old.phases.map((phase) => ({
              ...phase,
              steps: phase.steps.map((step) =>
                step.id === stepId
                  ? { ...step, completed, completed_at: completed ? new Date().toISOString() : null }
                  : step
              ),
            })),
          };
        });
      }

      return { prevSteps, prevProgress };
    },

    onError: (error, _vars, context) => {
      // Don't roll back on offline-queued — the optimistic update is intentional
      if ((error as unknown as { isOfflineQueued?: boolean }).isOfflineQueued) return;

      // Roll back on genuine errors
      if (context?.prevSteps) {
        qc.setQueryData(onboardingKeys.steps, context.prevSteps);
      }
      if (context?.prevProgress) {
        qc.setQueryData(onboardingKeys.progress, context.prevProgress);
      }
    },

    onSuccess: (data) => {
      // Update steps cache with the server-authoritative response
      qc.setQueryData<OnboardingStatus>(onboardingKeys.steps, (old) => {
        if (!old) return old;
        return {
          ...old,
          completed_steps: data.completed_steps,
          overall_progress_pct: data.overall_progress_pct,
          is_onboarding_complete: data.is_onboarding_complete,
          phases: old.phases.map((phase) => ({
            ...phase,
            steps: phase.steps.map((step) =>
              step.id === data.step.id ? data.step : step
            ),
          })),
        };
      });

      // Invalidate progress so the dashboard card refreshes
      qc.invalidateQueries({ queryKey: onboardingKeys.progress });
    },
  });
}