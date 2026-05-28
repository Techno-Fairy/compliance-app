// mobile/app/_layout.tsx
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useNetworkFlusher } from "@/store/offlineQueue";
import { useNotificationSetup } from "@/hooks/useNotifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

// Mount once at root — offline queue + push notification listeners
function AppServices() {
  useNetworkFlusher();
  useNotificationSetup();    // FE-14: registers token, wires deep-link routing
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppServices />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="business-profile" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          {/* Week 3 */}
          <Stack.Screen name="add-task"  options={{ presentation: "modal" }} />
          <Stack.Screen name="history" />
          {/* Week 4 */}
          <Stack.Screen name="knowledge-base" />
          <Stack.Screen name="notification-preferences" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}