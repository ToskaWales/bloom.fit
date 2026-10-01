import { useRouter } from 'expo-router';
import { Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RestTimer } from '@/components/RestTimer';
import { SetRow } from '@/components/SetRow';
import { SyncStatus } from '@/components/SyncStatus';
import { de } from '@/i18n/de';
import { format } from '@/i18n/format';
import { formatDateDe } from '@/lib/date';
import { isCompleteSet, suggestSet, type WorkoutEntry } from '@/lib/training';
import { completeSetCount, useTrainingStore } from '@/store/training';

const t = de.training;

export default function TrainingScreen() {
  const status = useTrainingStore((s) => s.status);
  const active = useTrainingStore((s) => s.active);
  const recent = useTrainingStore((s) => s.recent);
  const startWorkout = useTrainingStore((s) => s.startWorkout);

  if (status === 'error') return <Text style={styles.container}>{t.loadError}</Text>;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <SyncStatus />
      {active ? (
        <ActiveWorkout workout={active} />
      ) : (
        <>
          <Button
            title={t.start}
            onPress={() => void startWorkout()}
            disabled={status !== 'ready'}
          />
          <Text style={styles.heading}>{t.recentTitle}</Text>
          {recent.length === 0 && <Text style={styles.hint}>{t.noRecent}</Text>}
          {recent.map((w) => (
            <View key={w.id} style={styles.card}>
              <Text>
                {format(t.recentLine, {
                  date: formatDateDe(w.performedOn),
                  exercises: w.exerciseCount,
                  sets: w.setCount,
                })}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function ActiveWorkout({ workout }: { workout: WorkoutEntry }) {
  const router = useRouter();
  const lastPerformance = useTrainingStore((s) => s.lastPerformance);
  const { addSet, updateSet, removeSet, removeExercise, finishWorkout, discardWorkout } =
    useTrainingStore.getState();

  function confirmDiscard(message: string, title: string = t.discardTitle) {
    Alert.alert(title, message, [
      { text: de.common.back, style: 'cancel' },
      { text: t.discard, style: 'destructive', onPress: () => void discardWorkout() },
    ]);
  }

  async function finish() {
    const hasComplete = workout.exercises.some((we) => we.sets.some(isCompleteSet));
    if (!hasComplete) return confirmDiscard(t.finishEmptyMessage, t.finishEmptyTitle);
    await finishWorkout();
    router.back();
  }

  return (
    <>
      <Text style={styles.heading}>
        {t.running} · {format(t.setsDone, { n: completeSetCount(workout) })}
      </Text>
      {workout.exercises.length === 0 && <Text style={styles.hint}>{t.emptyActive}</Text>}

      {workout.exercises.map((we) => {
        const lastSets = lastPerformance[we.exerciseId] ?? [];
        const lastComplete = [...we.sets].reverse().find(isCompleteSet);
        let working = 0;
        return (
          <View key={we.id} style={styles.card}>
            <Text style={styles.exercise}>{we.exerciseName}</Text>
            {we.sets.map((set, index) => {
              if (!set.isWarmup) working += 1;
              return (
                <SetRow
                  key={set.id}
                  set={set}
                  label={format(t.setLabel, { n: working || index + 1 })}
                  // Vorschlag nur anhand der Sätze vor diesem
                  suggestion={suggestSet(we.sets.slice(0, index), lastSets)}
                  onChange={(patch) => updateSet(set.id, patch)}
                  onRemove={() => void removeSet(set.id)}
                />
              );
            })}
            <View style={styles.actions}>
              <Button title={t.addSet} onPress={() => void addSet(we.id)} />
              {lastComplete && (
                <Button title={t.copySet} onPress={() => void addSet(we.id, lastComplete)} />
              )}
              <Button
                title={t.removeExercise}
                color="#b00020"
                onPress={() => void removeExercise(we.id)}
              />
            </View>
          </View>
        );
      })}

      <Button title={t.addExercise} onPress={() => router.push('/training-pick')} />
      <RestTimer />
      <Button title={t.finish} onPress={() => void finish()} />
      <Button title={t.discard} color="#b00020" onPress={() => confirmDiscard(t.discardMessage)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  heading: { fontSize: 20, fontWeight: '600' },
  hint: { color: '#555' },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, gap: 8 },
  exercise: { fontSize: 17, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
