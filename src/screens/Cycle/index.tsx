import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CycleSaveError } from '@/api/cycles';
import type { CycleRow } from '@/api/database.types';
import { DateField } from '@/components/DateField';
import { phaseForDate } from '@/engine/cyclePhase';
import { de } from '@/i18n/de';
import { format } from '@/i18n/format';
import { periodLengthDays, validateCycleInput } from '@/lib/cycleInput';
import { formatDateDe, todayIso } from '@/lib/date';
import { useCycleStore } from '@/store/cycle';
import { useProfileStore } from '@/store/profile';
import { useSessionStore } from '@/store/session';

const t = de.cycle;

export default function CycleScreen() {
  const userId = useSessionStore((s) => s.session?.user.id);
  const defaultCycleLength = useProfileStore((s) => s.profile?.default_cycle_length ?? 28);
  const { cycles, loaded, load, save, remove } = useCycleStore();

  const [newStart, setNewStart] = useState<string | null>(todayIso());
  const [newEnd, setNewEnd] = useState<string | null>(null);
  const [editing, setEditing] = useState<CycleRow | null>(null);
  const [editStart, setEditStart] = useState<string | null>(null);
  const [editEnd, setEditEnd] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const info = useMemo(
    () =>
      phaseForDate(
        todayIso(),
        cycles.map((c) => ({ periodStart: c.period_start, periodEnd: c.period_end })),
        { defaultCycleLength },
      ),
    [cycles, defaultCycleLength],
  );

  async function run(
    input: { id?: string; periodStart: string | null; periodEnd: string | null },
    after?: () => void,
  ) {
    const problem = validateCycleInput({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    });
    if (problem) return Alert.alert(t.errors[problem]);
    if (!userId || !input.periodStart) return;
    setBusy(true);
    try {
      await save(userId, {
        id: input.id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      });
      after?.();
    } catch (e) {
      Alert.alert(
        e instanceof CycleSaveError && e.reason === 'overlap'
          ? t.errors.overlap
          : t.errors.saveError,
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(cycle: CycleRow) {
    Alert.alert(t.deleteTitle, `${formatDateDe(cycle.period_start)}`, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.deleteConfirm,
        style: 'destructive',
        onPress: () => remove(cycle.id).catch(() => Alert.alert(t.errors.saveError)),
      },
    ]);
  }

  function startEdit(cycle: CycleRow) {
    setEditing(cycle);
    setEditStart(cycle.period_start);
    setEditEnd(cycle.period_end);
  }

  if (!loaded) return <ActivityIndicator style={{ marginTop: 64 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {info ? (
        <View style={styles.card}>
          <Text style={styles.big}>{format(t.todayLine, { day: info.cycleDay })}</Text>
          <Text>{format(t.nextPeriod, { date: formatDateDe(info.nextPeriodStart) })}</Text>
          {info.basis === 'default' && <Text style={styles.hint}>{t.predictionHint}</Text>}
          {info.overdue && <Text style={styles.hint}>{t.overdue}</Text>}
        </View>
      ) : (
        <Text>{t.noData}</Text>
      )}

      <Text style={styles.heading}>{t.newTitle}</Text>
      <Text style={styles.label}>{t.start}</Text>
      <DateField
        value={newStart}
        onChange={setNewStart}
        placeholder={t.start}
        maximumDate={new Date()}
      />
      <Text style={styles.label}>{t.end}</Text>
      <DateField value={newEnd} onChange={setNewEnd} placeholder={t.end} maximumDate={new Date()} />
      {newEnd && <Button title={t.clearEnd} onPress={() => setNewEnd(null)} />}
      <Button
        title={t.save}
        disabled={busy}
        onPress={() => run({ periodStart: newStart, periodEnd: newEnd }, () => setNewEnd(null))}
      />

      {cycles.length > 0 && <Text style={styles.heading}>{t.historyTitle}</Text>}
      {cycles.map((cycle) => (
        <View key={cycle.id} style={styles.card}>
          <Text style={styles.big}>
            {formatDateDe(cycle.period_start)}
            {cycle.period_end ? ` – ${formatDateDe(cycle.period_end)}` : ''}
          </Text>
          <Text style={styles.hint}>
            {cycle.period_end
              ? format(t.days, { n: periodLengthDays(cycle.period_start, cycle.period_end) })
              : t.ongoing}
          </Text>

          {editing?.id === cycle.id ? (
            <>
              <Text style={styles.label}>{t.start}</Text>
              <DateField
                value={editStart}
                onChange={setEditStart}
                placeholder={t.start}
                maximumDate={new Date()}
              />
              <Text style={styles.label}>{t.end}</Text>
              <DateField
                value={editEnd}
                onChange={setEditEnd}
                placeholder={t.end}
                maximumDate={new Date()}
              />
              {editEnd && <Button title={t.clearEnd} onPress={() => setEditEnd(null)} />}
              <Button
                title={t.save}
                disabled={busy}
                onPress={() =>
                  run({ id: cycle.id, periodStart: editStart, periodEnd: editEnd }, () =>
                    setEditing(null),
                  )
                }
              />
              <Button title={t.cancel} onPress={() => setEditing(null)} />
            </>
          ) : (
            <View style={styles.actions}>
              {!cycle.period_end && (
                <Button
                  title={t.endToday}
                  disabled={busy}
                  onPress={() =>
                    run({ id: cycle.id, periodStart: cycle.period_start, periodEnd: todayIso() })
                  }
                />
              )}
              <Button title={t.edit} onPress={() => startEdit(cycle)} />
              <Button title={t.delete} color="#b00020" onPress={() => confirmDelete(cycle)} />
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  heading: { fontSize: 20, fontWeight: '600', marginTop: 12 },
  label: { fontSize: 16, fontWeight: '500' },
  big: { fontSize: 17, fontWeight: '500' },
  hint: { color: '#555' },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, gap: 6 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
