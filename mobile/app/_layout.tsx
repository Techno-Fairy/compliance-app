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
import { ActivityIndicator, View } from "react-native";
import {
  useFonts,
  PublicSans_400Regular,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} from "@expo-google-fonts/public-sans";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

function AppServices() {
  useNetworkFlusher();
  useNotificationSetup();
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
          <Stack.Screen name="index" />
          <Stack.Screen name="business-profile" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          {/* Week 3 */}
          <Stack.Screen name="add-task" options={{ presentation: "modal" }} />
          <Stack.Screen name="history" />
          {/* Week 4 */}
          <Stack.Screen name="knowledge-base" />
          <Stack.Screen name="notification-preferences" />
          {/* Week 5 */}
          <Stack.Screen name="client-switcher" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}


