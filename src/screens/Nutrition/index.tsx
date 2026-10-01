import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Alert, Button, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NutritionEntryRow } from '@/api/database.types';
import { addDays } from '@/engine/cyclePhase';
import { de } from '@/i18n/de';
import { format } from '@/i18n/format';
import { formatDateDe, todayIso } from '@/lib/date';
import { dedupeRecent, per100FromTotals, sumMacros, type Macros } from '@/lib/nutrition';
import { useNutritionStore } from '@/store/nutrition';

const t = de.nutrition;

const macrosOf = (e: NutritionEntryRow): Macros => ({
  kcal: Number(e.kcal),
  proteinG: Number(e.protein_g),
  carbsG: Number(e.carbs_g),
  fatG: Number(e.fat_g),
});

const entryLine = (m: Macros) =>
  format(t.entryLine, {
    kcal: Math.round(m.kcal),
    p: Math.round(m.proteinG),
    c: Math.round(m.carbsG),
    f: Math.round(m.fatG),
  });

export default function NutritionScreen() {
  const router = useRouter();
  const { date, entries, recent, loaded, load, setDate, setSeed, remove } = useNutritionStore();
  const today = todayIso();

  useEffect(() => {
    load().catch(() => Alert.alert(t.loadError));
  }, [load]);

  const total = useMemo(() => sumMacros(entries.map(macrosOf)), [entries]);
  const recentFoods = useMemo(() => dedupeRecent(recent), [recent]);

  function openForm(seed: Parameters<typeof setSeed>[0]) {
    setSeed(seed);
    router.push('/nutrition-entry');
  }

  function edit(entry: NutritionEntryRow) {
    openForm({
      id: entry.id,
      name: entry.name,
      barcode: entry.barcode,
      quantityG: Number(entry.quantity_g ?? 100),
      per100: per100FromTotals(
        macrosOf(entry),
        entry.quantity_g === null ? null : Number(entry.quantity_g),
      ),
    });
  }

  function reuse(entry: NutritionEntryRow) {
    openForm({
      name: entry.name,
      barcode: entry.barcode,
      quantityG: Number(entry.quantity_g ?? 100),
      per100: per100FromTotals(
        macrosOf(entry),
        entry.quantity_g === null ? null : Number(entry.quantity_g),
      ),
    });
  }

  function confirmDelete(entry: NutritionEntryRow) {
    Alert.alert(t.deleteTitle, entry.name, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => remove(entry.id).catch(() => Alert.alert(t.loadError)),
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.dayRow}>
        <Button
          title="‹"
          accessibilityLabel={t.previousDay}
          onPress={() => void setDate(addDays(date, -1))}
        />
        <Text style={styles.dayLabel}>{date === today ? t.today : formatDateDe(date)}</Text>
        <Button
          title="›"
          accessibilityLabel={t.nextDay}
          disabled={date >= today}
          onPress={() => void setDate(addDays(date, 1))}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.big}>
          {t.total}: {Math.round(total.kcal)} {t.kcal}
        </Text>
        <Text>
          {t.protein} {Math.round(total.proteinG)} {t.grams} · {t.carbs} {Math.round(total.carbsG)}{' '}
          {t.grams} · {t.fat} {Math.round(total.fatG)} {t.grams}
        </Text>
      </View>

      <Button
        title={t.add}
        onPress={() => openForm({ name: '', barcode: null, quantityG: 100, per100: null })}
      />
      <Button title={t.scanButton} onPress={() => router.push('/nutrition-scan')} />

      {loaded && entries.length === 0 && <Text style={styles.hint}>{t.emptyDay}</Text>}
      {entries.map((entry) => (
        <Pressable
          key={entry.id}
          style={styles.card}
          onPress={() => edit(entry)}
          onLongPress={() => confirmDelete(entry)}
        >
          <Text style={styles.big}>{entry.name}</Text>
          <Text style={styles.hint}>
            {entry.quantity_g !== null
              ? `${format(t.quantityLine, { n: Number(entry.quantity_g) })} · `
              : ''}
            {entryLine(macrosOf(entry))}
          </Text>
        </Pressable>
      ))}

      {recentFoods.length > 0 && <Text style={styles.heading}>{t.recentTitle}</Text>}
      {recentFoods.map((entry) => (
        <Pressable key={entry.id} style={styles.card} onPress={() => reuse(entry)}>
          <Text>{entry.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: { fontSize: 18, fontWeight: '600' },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  big: { fontSize: 16, fontWeight: '500' },
  hint: { color: '#555' },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, gap: 4 },
});
