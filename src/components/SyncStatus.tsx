import { Pressable, StyleSheet, Text } from 'react-native';
import { de } from '@/i18n/de';
import { format } from '@/i18n/format';
import { useTrainingStore } from '@/store/training';

const t = de.training.sync;

/** Dezente Anzeige des Sync-Zustands; Tippen stößt einen neuen Versuch an. */
export function SyncStatus() {
  const { state, pending } = useTrainingStore((s) => s.sync);
  const syncNow = useTrainingStore((s) => s.syncNow);

  let text: string;
  if (state === 'syncing') text = t.syncing;
  else if (state === 'offline') text = format(t.offline, { n: pending });
  else if (state === 'error') text = format(t.error, { n: pending });
  else if (pending > 0) text = format(t.pending, { n: pending });
  else text = t.synced;

  const problem = state === 'offline' || state === 'error';
  return (
    <Pressable onPress={() => void syncNow()} accessibilityRole="button" accessibilityLabel={t.now}>
      <Text style={[styles.text, problem && styles.problem]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 12, color: '#666' },
  problem: { color: '#8a5a00' },
});
