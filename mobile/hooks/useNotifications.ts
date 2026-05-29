// mobile/hooks/useNotifications.ts
// FE-14: expo-notifications — permissions, device token registration, deep link routing

import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { router } from "expo-router";
import { api } from "@/lib/api";
import Constants from "expo-constants";

// ── Notification handler (foreground) ────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Permission + token registration ──────────────────────────────────────────
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("Push notifications only work on physical devices.");
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Android channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("compliance-deadlines", {
      name: "Compliance Deadlines",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#000b25",
      sound: "default",
      showBadge: true,
    });
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn(
        "No EAS projectId found in app.json extra.eas.projectId — skipping push token registration."
      );
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return token;
  } catch (e) {
    console.warn("Failed to get push token:", e);
    return null;
  }
}

// ── Register token with backend ───────────────────────────────────────────────
export async function registerDeviceToken(token: string): Promise<void> {
  try {
    await api.post("/notifications/device-token", {
      token,
      platform: Platform.OS,
    });
  } catch {
    // Non-fatal — token stored; retry on next launch
  }
}

// ── Deep-link routing from notification ──────────────────────────────────────
function handleNotificationResponse(
  response: Notifications.NotificationResponse
) {
  const data = response.notification.request.content.data as Record<
    string,
    any
  >;

  if (data?.screen === "deadline" && data?.id) {
    router.push(`/deadline/${data.id}` as any);
  } else if (data?.screen === "vault") {
    router.push("/(tabs)/vault" as any);
  } else if (data?.screen === "history") {
    router.push("/history" as any);
  }
}

// ── Hook (mount once in _layout.tsx via <AppServices />) ─────────────────────
export function useNotificationSetup() {
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(
    null
  );
  const receivedListenerRef = useRef<Notifications.EventSubscription | null>(
    null
  );

  useEffect(() => {
    // Register device and send token to backend
    registerForPushNotifications()
      .then((token) => {
        if (token) registerDeviceToken(token);
      })
      .catch(console.error);

    // Foreground notification received
    receivedListenerRef.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log(
          "Notification received:",
          notification.request.content.title
        );
      }
    );

    // Tapped notification — deep link routing
    responseListenerRef.current =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse
      );

    // Handle notification that launched the app from killed state
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    });

    return () => {
      receivedListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, []);
}

// ── Notification preferences (stored on device + synced to backend) ──────────
export interface NotificationPrefs {
  deadline_reminders: boolean;
  reminder_days_before: number; // 1, 3, 7, 14
  penalty_alerts: boolean;
  document_expiry: boolean;
  weekly_digest: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  deadline_reminders: true,
  reminder_days_before: 7,
  penalty_alerts: true,
  document_expiry: true,
  weekly_digest: false,
};

export async function saveNotificationPrefs(
  prefs: NotificationPrefs
): Promise<void> {
  await api.patch("/notifications/preferences", prefs);
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const { data } = await api.get<NotificationPrefs>(
    "/notifications/preferences"
  );
  return data;
}