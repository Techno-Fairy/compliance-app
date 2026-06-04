// mobile/hooks/useFilingHistory.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FilingHistoryEntry } from "@/types";

export type { FilingHistoryEntry as HistoryEntry };

export function useFilingHistory(deadlineId?: number) {
  return useQuery<FilingHistoryEntry[]>({
    queryKey: ["history", deadlineId],
    queryFn: async () => {
      const params = deadlineId ? { deadline_id: deadlineId } : {};
      const { data } = await api.get<FilingHistoryEntry[]>("/history", { params });
      return data;
    },
    staleTime: 1000 * 60 * 2,   // 2 min — audit trail changes on user action
    retry: 2,
    // Return empty array on error so the screen shows empty state, not spinner
    throwOnError: false,
  });
}