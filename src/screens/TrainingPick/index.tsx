import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { de } from '@/i18n/de';
import { format } from '@/i18n/format';
import { hasExactMatch, searchExercises } from '@/lib/training';
import { useTrainingStore } from '@/store/training';

const t = de.training.pick;

export default function TrainingPickScreen() {
  const router = useRouter();
  const exercises = useTrainingStore((s) => s.exercises);
  const { addExercise, createExercise } = useTrainingStore.getState();
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchExercises(exercises, query), [exercises, query]);
  const canCreate = query.trim().length > 0 && !hasExactMatch(exercises, query);

  async function pick(exerciseId: string) {
    await addExercise(exerciseId);
    router.back();
  }

  async function create() {
    const exercise = await createExercise(query);
    await pick(exercise.id);
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder={t.search}
        autoFocus
        autoCorrect={false}
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={results}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          canCreate ? (
            <Pressable style={[styles.row, styles.create]} onPress={() => void create()}>
              <Text>{format(t.create, { name: query.trim() })}</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={canCreate ? null : <Text style={styles.empty}>{t.empty}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => void pick(item.id)}>
            <Text style={styles.name}>{item.name}</Text>
            {item.userId && <Text style={styles.own}>★</Text>}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  input: { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
  },
  create: { backgroundColor: '#f3ecfa' },
  name: { fontSize: 16 },
  own: { color: '#8a5a00' },
  empty: { color: '#555', padding: 12 },
});
