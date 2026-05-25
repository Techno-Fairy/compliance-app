import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface HistoryEntry {
  id: number;
  action_type: string;
  deadline_id?: number;
  deadline_name?: string;
  document_id?: number;
  document_filename?: string;
  user_email?: string;
  created_at: string;
  notes?: string;
}

export function useFilingHistory(deadlineId?: number) {
  return useQuery<HistoryEntry[]>({
    queryKey: ["history", deadlineId],
    queryFn: async () => {
      const params = deadlineId ? { deadline_id: deadlineId } : {};
      const { data } = await api.get<HistoryEntry[]>("/history", { params });
      return data;
    },
  });
}