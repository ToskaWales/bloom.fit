import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, Vibration, View } from 'react-native';
import { de } from '@/i18n/de';
import { formatTimer } from '@/lib/training';

const PRESETS = [60, 90, 120, 180];

const now = () => Date.now();

/** Einfacher Pausentimer; vibriert am Ende. Läuft nur, solange der Screen sichtbar ist. */
export function RestTimer() {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => {
      const left = Math.ceil((endAt - now()) / 1000);
      if (left <= 0) {
        clearInterval(id);
        Vibration.vibrate(500);
        setEndAt(null);
        setRemaining(0);
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [endAt]);

  function start(seconds: number) {
    setEndAt(now() + seconds * 1000);
    setRemaining(seconds);
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>
        {de.training.restTitle}
        {endAt !== null ? ` · ${formatTimer(remaining)}` : ''}
      </Text>
      <View style={styles.row}>
        {endAt === null ? (
          PRESETS.map((s) => <Button key={s} title={formatTimer(s)} onPress={() => start(s)} />)
        ) : (
          <Button title={de.training.restStop} onPress={() => setEndAt(null)} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, gap: 6 },
  title: { fontWeight: '500' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
