import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { de } from '@/i18n/de';
import { format } from '@/i18n/format';
import { formatNumber } from '@/lib/training';
import { parseFoodDraft, scaleMacros, type FoodDraft, type FoodErrors } from '@/lib/nutrition';
import { useNutritionStore, type FoodSeed } from '@/store/nutrition';
import { useSessionStore } from '@/store/session';

const t = de.nutrition.form;

const draftFromSeed = (seed: FoodSeed | null): FoodDraft => ({
  name: seed?.name ?? '',
  quantityG: formatNumber(seed?.quantityG ?? 100),
  kcal: seed?.per100 ? formatNumber(seed.per100.kcal) : '',
  proteinG: seed?.per100 ? formatNumber(seed.per100.proteinG) : '',
  carbsG: seed?.per100 ? formatNumber(seed.per100.carbsG) : '',
  fatG: seed?.per100 ? formatNumber(seed.per100.fatG) : '',
});

export default function NutritionEntryScreen() {
  // Das Formular erst mounten, wenn die Vorbelegung feststeht (kein State-Sync im Effect nötig)
  const seed = useNutritionStore((s) => s.seed);
  return <EntryForm seed={seed} />;
}

function EntryForm({ seed }: { seed: FoodSeed | null }) {
  const router = useRouter();
  const userId = useSessionStore((s) => s.session?.user.id);
  const save = useNutritionStore((s) => s.save);
  const setSeed = useNutritionStore((s) => s.setSeed);

  const [draft, setDraft] = useState<FoodDraft>(() => draftFromSeed(seed));
  const [errors, setErrors] = useState<FoodErrors>({});
  const [busy, setBusy] = useState(false);

  const update = (patch: Partial<FoodDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors({});
  };

  const parsed = useMemo(() => parseFoodDraft(draft), [draft]);
  const preview = parsed.ok ? scaleMacros(parsed.value.per100, parsed.value.quantityG) : null;

  async function submit() {
    if (!parsed.ok) return setErrors(parsed.errors);
    if (!userId) return;
    setBusy(true);
    try {
      await save(userId, {
        id: seed?.id,
        name: parsed.value.name,
        barcode: seed?.barcode ?? null,
        quantityG: parsed.value.quantityG,
        totals: scaleMacros(parsed.value.per100, parsed.value.quantityG),
      });
      setSeed(null);
      router.back();
    } catch {
      Alert.alert(t.saveError);
      setBusy(false);
    }
  }

  const err = (field: keyof FoodDraft) =>
    errors[field] ? <Text style={styles.error}>{t.errors[errors[field]!]}</Text> : null;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {seed?.note && <Text style={styles.hint}>{t[seed.note]}</Text>}

      <Text style={styles.label}>{t.name}</Text>
      <TextInput
        style={styles.input}
        value={draft.name}
        onChangeText={(name) => update({ name })}
      />
      {err('name')}

      <Text style={styles.label}>{t.quantity}</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={draft.quantityG}
        onChangeText={(quantityG) => update({ quantityG })}
      />
      {err('quantityG')}

      <Text style={styles.label}>{t.per100}</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder={t.kcalPlaceholder}
        value={draft.kcal}
        onChangeText={(kcal) => update({ kcal })}
      />
      {err('kcal')}
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder={t.protein}
        value={draft.proteinG}
        onChangeText={(proteinG) => update({ proteinG })}
      />
      {err('proteinG')}
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder={t.carbs}
        value={draft.carbsG}
        onChangeText={(carbsG) => update({ carbsG })}
      />
      {err('carbsG')}
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder={t.fat}
        value={draft.fatG}
        onChangeText={(fatG) => update({ fatG })}
      />
      {err('fatG')}

      {preview && parsed.ok && (
        <Text style={styles.hint}>
          {format(t.preview, {
            n: formatNumber(parsed.value.quantityG),
            kcal: Math.round(preview.kcal),
            p: Math.round(preview.proteinG),
            c: Math.round(preview.carbsG),
            f: Math.round(preview.fatG),
          })}
        </Text>
      )}

      {busy ? <ActivityIndicator /> : <Button title={t.save} onPress={() => void submit()} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 8 },
  label: { fontSize: 16, fontWeight: '500', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12 },
  error: { color: '#b00020' },
  hint: { color: '#555' },
});
