import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { api } from "@/lib/api";
import type { TokenResponse } from "@/types/types_index";

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
    set({ isAuthenticated: false });
  },
}));
