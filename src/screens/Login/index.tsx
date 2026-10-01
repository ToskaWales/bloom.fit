import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput } from 'react-native';
import { isSupabaseConfigured, supabase } from '@/api/supabase';
import { Screen } from '@/components/Screen';
import { de } from '@/i18n/de';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setInfo(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) Alert.alert(error.message);
  }

  async function signUp() {
    setBusy(true);
    setInfo(null);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) return Alert.alert(error.message);
    // Ist E-Mail-Bestätigung aktiv, gibt es noch keine Session: Hinweis statt stiller Leere.
    if (!data.session) setInfo(de.login.confirmEmail);
  }

  async function forgotPassword() {
    if (!email.trim()) return Alert.alert(de.login.enterEmailFirst);
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('reset-password'),
    });
    setBusy(false);
    // Bewusst immer dieselbe Antwort, damit nicht erkennbar ist, ob eine Adresse registriert ist.
    setInfo(de.login.resetSent);
  }

  return (
    <Screen title={de.login.title}>
      {!isSupabaseConfigured && <Text>{de.login.notConfigured}</Text>}
      {info && <Text>{info}</Text>}
      <TextInput
        style={styles.input}
        placeholder={de.login.email}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder={de.login.password}
        secureTextEntry
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
      />
      <Button title={de.login.signIn} disabled={busy} onPress={signIn} />
      <Button title={de.login.signUp} disabled={busy} onPress={signUp} />
      <Button title={de.login.forgotPassword} disabled={busy} onPress={forgotPassword} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12 },
});
