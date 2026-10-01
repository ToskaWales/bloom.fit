import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useSessionStore } from '@/store/session';

export default function RootLayout() {
  const { session, ready, init } = useSessionStore();

  useEffect(() => init(), [init]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        {/* Immer erreichbar: der Link aus der Passwort-Reset-Mail öffnet die App abgemeldet */}
        <Stack.Screen name="reset-password" />
      </Stack>
    </>
  );
}
