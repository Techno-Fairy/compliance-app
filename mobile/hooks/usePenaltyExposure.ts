import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface PenaltyItem {
  deadline_id: number;
  name: string;
  category: string;
  days_overdue: number;
  fixed_penalty: number;
  interest_penalty: number;
  total_penalty_bwp: number;
}

export interface PenaltyExposure {
  total_exposure_bwp: number;
  breakdown: PenaltyItem[];
}

export function usePenaltyExposure() {
  return useQuery<PenaltyExposure>({
    queryKey: ["penalty-exposure"],
    queryFn: async () => {
      const { data } = await api.get<PenaltyExposure>(
        "/analytics/penalty-exposure"
      );
      return data;
    },
    staleTime: 1000 * 60 * 2,
  });
}