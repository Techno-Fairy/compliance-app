// mobile/app/_layout.tsx
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, View } from "react-native";
import {
  useFonts,
  PublicSans_400Regular,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} from "@expo-google-fonts/public-sans";
import { useNetworkFlusher } from "@/store/offlineQueue";
import { useNotificationSetup } from "@/hooks/useNotifications";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

function AppServices() {
  useNetworkFlusher();
  useNotificationSetup();

  // ── Deep link handler ──────────────────────────────────────────────────
  // Handles compliancepro://team/accept/{token}
  // and https://compliancepro.co.bw/team/accept?token={token}
  useEffect(() => {
    function handleUrl({ url }: { url: string }) {
      try {
        const parsed = Linking.parse(url);

        // Custom scheme:  compliancepro://team/accept/TOKEN
        if (parsed.scheme === "compliancepro") {
          const pathParts = (parsed.path ?? "").split("/").filter(Boolean);
          if (pathParts[0] === "team" && pathParts[1] === "accept" && pathParts[2]) {
            router.push({
              pathname: "/(auth)/register-invited" as any,
              params: { token: pathParts[2] },
            });
            return;
          }
        }

        // Universal / HTTPS link: https://compliancepro.co.bw/team/accept?token=TOKEN
        if (parsed.hostname === "compliancepro.co.bw") {
          const pathParts = (parsed.path ?? "").split("/").filter(Boolean);
          if (pathParts[0] === "team" && pathParts[1] === "accept") {
            const token = parsed.queryParams?.token as string | undefined;
            if (token) {
              router.push({
                pathname: "/(auth)/register-invited" as any,
                params: { token },
              });
            }
          }
        }
      } catch {
        // Malformed URL — ignore
      }
    }

    // Handle link when app is already open
    const sub = Linking.addEventListener("url", handleUrl);

    // Handle link that cold-started the app
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => sub.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PublicSans_400Regular,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f3faff" }}>
        <ActivityIndicator size="large" color="#000b25" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppServices />
        <Stack screenOptions={{ headerShown: false }}>
          {/* ── Root landing — replaces the old redirect-only index ── */}
          <Stack.Screen name="index" />

          {/* ── Auth ── */}
          <Stack.Screen name="(auth)" />
          {/* Invite accept flows — outside (auth) group so token param passes cleanly */}
          <Stack.Screen name="(auth)/register-invited" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="(auth)/login-invited" options={{ animation: "slide_from_right" }} />

          {/* ── Authenticated area (existing, unchanged) ── */}
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-task" options={{ presentation: "modal" }} />
          <Stack.Screen name="history" />
          <Stack.Screen name="knowledge-base" />
          <Stack.Screen name="notification-preferences" />
          <Stack.Screen name="client-switcher" />
          <Stack.Screen name="business-profile" />

          {/* ── PUBLIC — no JWT required ── */}
          {/* The accordion overview screen */}
          <Stack.Screen
            name="starter-guide"
            options={{ animation: "slide_from_bottom", gestureEnabled: true }}
          />
          {/* Individual step detail screen */}
          <Stack.Screen
            name="starter-guide/[id]"
            options={{ animation: "slide_from_right" }}
          />
          {/* Registration screen shown at the end of the guide */}
          <Stack.Screen
            name="guide-register"
            options={{ animation: "slide_from_right" }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}