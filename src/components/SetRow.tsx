import { useState } from 'react';
import { Button, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { de } from '@/i18n/de';
import { format } from '@/i18n/format';
import { formatNumber, parseDecimal, parseReps, parseRpe, type SetEntry } from '@/lib/training';

const t = de.training;

type Props = {
  set: SetEntry;
  label: string;
  suggestion: { weightKg: number; reps: number } | null;
  onChange: (patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'rpe' | 'isWarmup'>>) => void;
  onRemove: () => void;
};

export function SetRow({ set, label, suggestion, onChange, onRemove }: Props) {
  const [weight, setWeight] = useState(formatNumber(set.weightKg));
  const [reps, setReps] = useState(formatNumber(set.reps));
  const [rpe, setRpe] = useState(formatNumber(set.rpe));
  const [rpeInvalid, setRpeInvalid] = useState(false);

  const empty = weight === '' && reps === '';

  function changeWeight(text: string) {
    setWeight(text);
    onChange({ weightKg: parseDecimal(text) });
  }
  function changeReps(text: string) {
    setReps(text);
    onChange({ reps: parseReps(text) });
  }
  function changeRpe(text: string) {
    setRpe(text);
    const parsed = parseRpe(text);
    setRpeInvalid(parsed === undefined);
    if (parsed !== undefined) onChange({ rpe: parsed });
  }
  function applySuggestion() {
    if (!suggestion) return;
    setWeight(formatNumber(suggestion.weightKg));
    setReps(formatNumber(suggestion.reps));
    onChange({ weightKg: suggestion.weightKg, reps: suggestion.reps });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={set.isWarmup ? t.warmup : t.working}
          onPress={() => onChange({ isWarmup: !set.isWarmup })}
          style={[styles.badge, set.isWarmup && styles.badgeWarmup]}
        >
          <Text style={styles.badgeText}>{set.isWarmup ? 'W' : label}</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder={suggestion ? formatNumber(suggestion.weightKg) : t.kg}
          value={weight}
          onChangeText={changeWeight}
          accessibilityLabel={t.kg}
        />
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder={suggestion ? formatNumber(suggestion.reps) : t.reps}
          value={reps}
          onChangeText={changeReps}
          accessibilityLabel={t.reps}
        />
        <TextInput
          style={[styles.input, rpeInvalid && styles.invalid]}
          keyboardType="decimal-pad"
          placeholder={t.rpe}
          value={rpe}
          onChangeText={changeRpe}
          accessibilityLabel={t.rpe}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="×"
          onPress={onRemove}
          style={styles.remove}
        >
          <Text style={styles.removeText}>×</Text>
        </Pressable>
      </View>
      {empty && suggestion && (
        <View style={styles.suggestion}>
          <Text style={styles.hint}>
            {format(t.previous, { kg: formatNumber(suggestion.weightKg), reps: suggestion.reps })}
          </Text>
          <Button title={t.useSuggestion} onPress={applySuggestion} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    width: 56,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  badgeWarmup: { backgroundColor: '#fff3cd' },
  badgeText: { fontSize: 13 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  invalid: { borderColor: '#b00020' },
  remove: { width: 32, alignItems: 'center' },
  removeText: { fontSize: 22, color: '#b00020' },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 64,
  },
  hint: { color: '#555', fontSize: 12 },
});
