import { Pressable, StyleSheet, Text, View } from 'react-native';

type Option<T extends string> = { value: T; label: string; hint?: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
};

/** Einfachauswahl als Liste antippbarer Karten. */
export function OptionGroup<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.group}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.selected]}
          >
            <Text style={styles.label}>{option.label}</Text>
            {selected && option.hint ? <Text style={styles.hint}>{option.hint}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  option: { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12, gap: 4 },
  selected: { borderColor: '#6b3fa0', backgroundColor: '#f3ecfa' },
  label: { fontSize: 16 },
  hint: { fontSize: 13, color: '#555' },
});
