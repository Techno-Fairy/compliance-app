import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Deadline } from "@/types";

export function useDeadlines(category?: string) {
  return useQuery<Deadline[]>({
    queryKey: ["deadlines", category],
    queryFn: async () => {
      const params = category ? { category } : {};
      const { data } = await api.get<Deadline[]>("/deadlines", { params });
      return data;
    },
  });
}

export function useUpdateDeadlineStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/deadlines/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deadlines"] }),
  });
}

export function useCreateCustomDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<Deadline, "id" | "status" | "is_custom">) =>
      api.post("/deadlines/custom", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deadlines"] }),
  });
}
