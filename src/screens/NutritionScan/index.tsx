import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Linking, StyleSheet, Text, View } from 'react-native';
import { lookupBarcode } from '@/api/openFoodFacts';
import { de } from '@/i18n/de';
import { useNutritionStore, type FoodSeed } from '@/store/nutrition';

const t = de.nutrition.scan;

export default function NutritionScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const setSeed = useNutritionStore((s) => s.setSeed);
  const [busy, setBusy] = useState(false);
  // Ref statt State: onBarcodeScanned feuert mehrfach, bevor ein Re-Render ankäme
  const handling = useRef(false);

  function toForm(seed: FoodSeed) {
    setSeed(seed);
    router.replace('/nutrition-entry');
  }

  async function onScanned(barcode: string) {
    if (handling.current) return;
    handling.current = true;
    setBusy(true);
    try {
      const result = await lookupBarcode(barcode);
      if (result.kind === 'found') {
        toForm({ name: result.name, barcode, quantityG: result.quantityG, per100: result.per100 });
      } else if (result.kind === 'noNutrition') {
        toForm({ name: result.name, barcode, quantityG: 100, per100: null, note: 'noNutrition' });
      } else {
        toForm({ name: '', barcode, quantityG: 100, per100: null, note: 'notFound' });
      }
    } catch {
      setBusy(false);
      Alert.alert(t.lookupError, undefined, [
        {
          text: t.manual,
          onPress: () => toForm({ name: '', barcode, quantityG: 100, per100: null }),
        },
        { text: t.retry, onPress: () => (handling.current = false) },
      ]);
    }
  }

  if (!permission) return <ActivityIndicator style={{ marginTop: 64 }} />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>{t.permissionNeeded}</Text>
        {permission.canAskAgain ? (
          <Button title={t.allow} onPress={() => void requestPermission()} />
        ) : (
          <Button title={t.openSettings} onPress={() => void Linking.openSettings()} />
        )}
        <Button
          title={t.manual}
          onPress={() => toForm({ name: '', barcode: null, quantityG: 100, per100: null })}
        />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView
        style={styles.flex}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={({ data }) => void onScanned(data)}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>{busy ? t.searching : t.hint}</Text>
        <Text style={styles.attribution}>{t.attribution}</Text>
        <Button
          title={t.manual}
          onPress={() => toForm({ name: '', barcode: null, quantityG: 100, per100: null })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  text: { fontSize: 16 },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  attribution: { color: '#ddd', fontSize: 11, textAlign: 'center' },
});
