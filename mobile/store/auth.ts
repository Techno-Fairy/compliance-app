import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { api } from "@/lib/api";
import { QueryClient } from "@tanstack/react-query";
import type { TokenResponse } from "@/types";

// Module-level QueryClient reference set once from the app root.
// Allows the auth store (outside React tree) to call queryClient.clear() on logout.
let _queryClient: QueryClient | null = null;
export function setAuthQueryClient(qc: QueryClient) {
  _queryClient = qc;
}

interface AuthState {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<TokenResponse>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,

  register: async (fullName, email, password) => {
    const { data } = await api.post<TokenResponse>("/auth/register", {
      full_name: fullName,
      email,
      password,
    });
    await SecureStore.setItemAsync("access_token", data.access_token);
    await SecureStore.setItemAsync("refresh_token", data.refresh_token);
    set({ isAuthenticated: true });
    return data;
  },

  login: async (email, password) => {
    const { data } = await api.post<TokenResponse>("/auth/login", {
      email,
      password,
    });
    await SecureStore.setItemAsync("access_token", data.access_token);
    await SecureStore.setItemAsync("refresh_token", data.refresh_token);
    set({ isAuthenticated: true });
  },

  logout: async () => {
    await api.delete("/auth/session").catch(() => {});
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
    // ── Clear React Query cache so the next user never sees stale data ──
    _queryClient?.clear();
    set({ isAuthenticated: false });
  },
}));