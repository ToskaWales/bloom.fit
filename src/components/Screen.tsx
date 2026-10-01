import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = { title: string; children?: ReactNode };

export function Screen({ title, children }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
});
