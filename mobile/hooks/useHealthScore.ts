import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface HealthScore {
  score: number;
  breakdown: { category: string; score: number }[];
}

export function useHealthScore() {
  return useQuery<HealthScore>({
    queryKey: ["health-score"],
    queryFn: async () => {
      const { data } = await api.get<HealthScore>("/analytics/health-score");
      return data;
    },
  });
}
