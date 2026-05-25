import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useNetworkFlusher } from "@/store/offlineQueue";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

// Mounts the NetInfo listener that auto-flushes the offline write queue
function NetworkFlusher() {
  useNetworkFlusher();
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <NetworkFlusher />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="business-profile" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          {/* Week 3 screens */}
          <Stack.Screen name="add-task" options={{ presentation: "modal" }} />
          <Stack.Screen name="history" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}