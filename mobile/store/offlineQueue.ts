/**
 * Offline write queue — FE-13
 *
 * When the device is offline, mutating operations (status updates, checklist
 * patches, custom deadline creation) are pushed onto this queue instead of
 * hitting the network.  On reconnect the queue is flushed in order.
 *
 * Persistence: AsyncStorage (survives app restarts).
 * Network detection: NetInfo from @react-native-community/netinfo.
 *
 * Usage:
 *   const { enqueue } = useOfflineQueue();
 *   enqueue({ method: "PATCH", url: "/deadlines/5/status", body: { status: "complete" } });
 *
 * The flushQueue() function is called automatically when NetInfo reports
 * "connected" (see the useNetworkFlusher hook at the bottom of this file,
 * which should be mounted once near the app root).
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { api } from "@/lib/api";

const QUEUE_KEY = "offline_write_queue_v1";

export interface QueuedWrite {
  id: string;                         // uuid-ish key for dedup
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  body?: Record<string, unknown>;
  enqueued_at: string;                // ISO timestamp
}

interface OfflineQueueState {
  queue: QueuedWrite[];
  flushing: boolean;
  /** Load persisted queue from AsyncStorage (call once at startup) */
  hydrate: () => Promise<void>;
  /** Add a write to the queue and persist */
  enqueue: (item: Omit<QueuedWrite, "id" | "enqueued_at">) => Promise<void>;
  /** Flush all queued writes in order; drop successfully sent items */
  flushQueue: () => Promise<void>;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useOfflineQueue = create<OfflineQueueState>((set, get) => ({
  queue: [],
  flushing: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (raw) {
        const queue: QueuedWrite[] = JSON.parse(raw);
        set({ queue });
      }
    } catch {
      // corrupt storage — start fresh
      set({ queue: [] });
    }
  },

  enqueue: async (item) => {
    const entry: QueuedWrite = {
      id: makeId(),
      enqueued_at: new Date().toISOString(),
      ...item,
    };
    const queue = [...get().queue, entry];
    set({ queue });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  flushQueue: async () => {
    if (get().flushing) return;
    set({ flushing: true });

    let remaining = [...get().queue];

    for (const item of [...remaining]) {
      try {
        switch (item.method) {
          case "POST":
            await api.post(item.url, item.body);
            break;
          case "PATCH":
            await api.patch(item.url, item.body);
            break;
          case "DELETE":
            await api.delete(item.url);
            break;
        }
        // Remove successfully sent item
        remaining = remaining.filter((q) => q.id !== item.id);
        set({ queue: remaining });
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
      } catch {
        // Leave failed item in queue; stop flushing to preserve order
        break;
      }
    }

    set({ flushing: false });
  },
}));

/**
 * Mount this hook once at the app root (e.g. in _layout.tsx).
 * It hydrates the queue on startup and sets up a NetInfo listener
 * that auto-flushes when connectivity is restored.
 */
export function useNetworkFlusher() {
  const { hydrate, flushQueue } = useOfflineQueue();

  useEffect(() => {
    hydrate();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        flushQueue();
      }
    });

    return () => unsubscribe();
  }, []);
}