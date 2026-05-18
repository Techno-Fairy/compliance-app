import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { HealthScore } from "@/types";

export function useHealthScore() {
  return useQuery<HealthScore>({
    queryKey: ["health-score"],
    queryFn: async () => {
      const { data } = await api.get<HealthScore>("/analytics/health-score");
      return data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}