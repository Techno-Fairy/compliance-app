import axios, { type InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "@/constants";

export const api = axios.create({ baseURL: API_BASE_URL });

// Attach access token to every request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = await SecureStore.getItemAsync("refresh_token");
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refresh,
        });
        await SecureStore.setItemAsync("access_token", data.access_token);
        await SecureStore.setItemAsync("refresh_token", data.refresh_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        await SecureStore.deleteItemAsync("access_token");
        await SecureStore.deleteItemAsync("refresh_token");
      }
    }
    return Promise.reject(error);
  }
);
