import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import type { DailyCheckinRow } from '@/api/database.types';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScaleInput } from '@/components/ScaleInput';
import { de } from '@/i18n/de';
import { format } from '@/i18n/format';
import { SLEEP, stepSleep, validateCheckin } from '@/lib/checkin';
import { useCheckinStore } from '@/store/checkin';
import { useSessionStore } from '@/store/session';

const t = de.checkin;

export default function CheckinScreen() {
  const { today, loaded, load } = useCheckinStore();

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  if (!loaded) return <ActivityIndicator style={{ marginTop: 64 }} />;
  // Formular erst nach dem Laden mounten: Startwerte kommen direkt aus dem vorhandenen Check-in.
  return <CheckinForm existing={today} />;
}

function CheckinForm({ existing }: { existing: DailyCheckinRow | null }) {
  const router = useRouter();
  const userId = useSessionStore((s) => s.session?.user.id);
  const save = useCheckinStore((s) => s.save);

  const [sleep, setSleep] = useState<number>(
    existing ? Number(existing.sleep_hours) : SLEEP.default,
  );
  const [motivation, setMotivation] = useState<number | null>(existing?.motivation ?? null);
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const errors = validateCheckin({ sleepHours: sleep, motivation, energy });
    if (Object.keys(errors).length > 0) return setMissing(true);
    if (!userId || motivation === null || energy === null) return;
    setBusy(true);
    try {
      await save(userId, { sleepHours: sleep, motivation, energy });
      router.back();
    } catch {
      Alert.alert(t.saveError);
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text>{t.intro}</Text>
      {existing && <Text style={styles.hint}>{t.existing}</Text>}

      <Text style={styles.label}>{t.sleep}</Text>
      <View style={styles.stepper}>
        <Button title="−" onPress={() => setSleep(stepSleep(sleep, -1))} />
        <Text style={styles.sleepValue}>
          {format(t.sleepValue, { h: String(sleep).replace('.', ',') })}
        </Text>
        <Button title="+" onPress={() => setSleep(stepSleep(sleep, 1))} />
      </View>

      <Text style={styles.label}>{t.motivation}</Text>
      <ScaleInput
        value={motivation}
        onChange={setMotivation}
        lowLabel={t.scaleLow}
        highLabel={t.scaleHigh}
      />

      <Text style={styles.label}>{t.energy}</Text>
      <ScaleInput
        value={energy}
        onChange={setEnergy}
        lowLabel={t.scaleLow}
        highLabel={t.scaleHigh}
      />

      {missing && (motivation === null || energy === null) && (
        <Text style={styles.error}>{t.required}</Text>
      )}
      {busy ? <ActivityIndicator /> : <Button title={t.save} onPress={submit} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  label: { fontSize: 16, fontWeight: '500', marginTop: 8 },
  hint: { color: '#555' },
  error: { color: '#b00020' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  sleepValue: { fontSize: 20, minWidth: 90, textAlign: 'center' },
});
