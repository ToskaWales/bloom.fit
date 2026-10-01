import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { de } from '@/i18n/de';
import { useCheckinStore } from '@/store/checkin';
import { useTrainingStore } from '@/store/training';

const t = de.logHub;

function Card({
  href,
  title,
  hint,
}: {
  href: '/checkin' | '/cycle' | '/training' | '/nutrition';
  title: string;
  hint: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="button" style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </Pressable>
    </Link>
  );
}

export default function LogScreen() {
  const { today, load } = useCheckinStore();
  const trainingActive = useTrainingStore((s) => s.active !== null);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{t.today}</Text>
      {today ? (
        <Card href="/checkin" title={t.checkinDone} hint={t.checkinDoneHint} />
      ) : (
        <Card href="/checkin" title={t.checkinOpen} hint={t.checkinOpenHint} />
      )}
      {trainingActive ? (
        <Card href="/training" title={t.trainingRunning} hint={t.trainingRunningHint} />
      ) : (
        <Card href="/training" title={t.training} hint={t.trainingHint} />
      )}
      <Card href="/nutrition" title={t.nutrition} hint={t.nutritionHint} />
      <Card href="/cycle" title={t.cycle} hint={t.cycleHint} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 12 },
  heading: { fontSize: 24, fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 16, gap: 4 },
  title: { fontSize: 17, fontWeight: '500' },
  hint: { color: '#555' },
});
