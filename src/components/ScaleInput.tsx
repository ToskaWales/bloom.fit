import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
};

/** Skala als Reihe antippbarer Zahlen (z. B. 1–5). */
export function ScaleInput({ value, onChange, min = 1, max = 5, lowLabel, highLabel }: Props) {
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {steps.map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityState={{ selected: n === value }}
            onPress={() => onChange(n)}
            style={[styles.cell, n === value && styles.selected]}
          >
            <Text style={styles.number}>{n}</Text>
          </Pressable>
        ))}
      </View>
      {(lowLabel || highLabel) && (
        <View style={styles.labels}>
          <Text style={styles.label}>{lowLabel}</Text>
          <Text style={styles.label}>{highLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', gap: 8 },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
  },
  selected: { borderColor: '#6b3fa0', backgroundColor: '#f3ecfa' },
  number: { fontSize: 18 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 12, color: '#555' },
});
