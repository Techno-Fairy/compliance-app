import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FilingHistoryEntry } from "@/types";

// Re-export so history.tsx can import HistoryEntry from this hook
export type { FilingHistoryEntry as HistoryEntry };

export function useFilingHistory(deadlineId?: number) {
  return useQuery<FilingHistoryEntry[]>({
    queryKey: ["history", deadlineId],
    queryFn: async () => {
      const params = deadlineId ? { deadline_id: deadlineId } : {};
      const { data } = await api.get<FilingHistoryEntry[]>("/history", { params });
      return data;
    },
  });
}