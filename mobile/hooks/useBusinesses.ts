// mobile/hooks/useBusinesses.ts
// FE-19: Client switcher — fetch businesses accessible to accountant/admin roles

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BusinessProfile, User } from "@/types";

export interface AccessibleBusiness {
  id: number;
  business_name: string;
  company_type: string;
  owner_name: string;
  owner_email: string;
  health_score?: number;
  health_band?: "green" | "amber" | "red";
  overdue_count?: number;
  last_activity?: string;
}

// GET /business/accessible — list of businesses this user can switch into
export function useAccessibleBusinesses() {
  return useQuery<AccessibleBusiness[]>({
    queryKey: ["accessible-businesses"],
    queryFn: async () => {
      const { data } = await api.get<AccessibleBusiness[]>("/business/accessible");
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// POST /business/switch — switch active business context (sets server-side session scope)
export function useSwitchBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (businessId: number) =>
      api.post("/business/switch", { business_id: businessId }),
    onSuccess: () => {
      // Invalidate everything — data is now scoped to the new business
      qc.invalidateQueries();
    },
  });
}

// GET /auth/me — fetch current user (used for role check)
export function useCurrentUser() {
  return useQuery<User>({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await api.get<User>("/auth/me");
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
}