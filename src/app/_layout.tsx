import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Button, Text, View } from 'react-native';
import { de } from '@/i18n/de';
import { useCheckinStore } from '@/store/checkin';
import { useCycleStore } from '@/store/cycle';
import { useProfileStore } from '@/store/profile';
import { useTrainingStore } from '@/store/training';
import { useSessionStore } from '@/store/session';

export default function RootLayout() {
  const { session, ready, init } = useSessionStore();
  const { profile, status, load, reset } = useProfileStore();
  const userId = session?.user.id;
  // Beim Passwort-Reset entsteht erst mitten im Screen eine Session; der Screen darf dabei nicht
  // durch Lade-/Fehleransichten ersetzt werden (sonst gehen Eingaben verloren).
  const inResetFlow = usePathname() === '/reset-password';

  useEffect(() => init(), [init]);

  // Profil laden, sobald eine Session da ist; beim Abmelden zurücksetzen.
  useEffect(() => {
    if (userId) void load(userId);
    else {
      // Beim Abmelden alle nutzerbezogenen Daten aus dem Speicher entfernen
      reset();
      useCycleStore.getState().reset();
      useCheckinStore.getState().reset();
      useTrainingStore.getState().dispose();
    }
  }, [userId, load, reset]);

  // Lokalen Trainingsspeicher erst nach dem Onboarding öffnen und synchronisieren
  const onboardedAt = profile?.onboarded_at;
  useEffect(() => {
    if (userId && onboardedAt) void useTrainingStore.getState().init(userId);
  }, [userId, onboardedAt]);

  if (!ready) return null;

  if (session && !inResetFlow && status === 'error') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text>{de.common.loadError}</Text>
        <Button title={de.common.retry} onPress={() => userId && load(userId)} />
      </View>
    );
  }
  if (session && !inResetFlow && status !== 'ready') {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const onboarded = !!profile?.onboarded_at;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="checkin"
            options={{
              headerShown: true,
              title: de.checkin.title,
              headerBackTitle: de.common.back,
            }}
          />
          <Stack.Screen
            name="training"
            options={{
              headerShown: true,
              title: de.training.title,
              headerBackTitle: de.common.back,
            }}
          />
          <Stack.Screen
            name="training-pick"
            options={{
              headerShown: true,
              title: de.training.pick.title,
              presentation: 'modal',
              headerBackTitle: de.common.back,
            }}
          />
          <Stack.Screen
            name="cycle"
            options={{ headerShown: true, title: de.cycle.title, headerBackTitle: de.common.back }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !onboarded}>
          <Stack.Screen name="onboarding" />
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
