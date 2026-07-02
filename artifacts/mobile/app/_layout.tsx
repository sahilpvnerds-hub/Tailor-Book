import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { initI18n } from "@/utils/i18n";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Boot i18n at the very top of the app so the first frame is localised
// even before any auth state is restored. AuthProvider will then
// re-initialise with the cached user's preferred language.
initI18n();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="customers/new" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="customers/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="measurements/new" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="measurements/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="invoices/index" options={{ headerShown: false }} />
      <Stack.Screen name="invoices/new" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="invoices/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="orders/new" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="orders/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ presentation: "modal", headerShown: false }} />
    </Stack>
  );
}

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <DataProvider>
                  <RootLayoutNav />
                </DataProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
