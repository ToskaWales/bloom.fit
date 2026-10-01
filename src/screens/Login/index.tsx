import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput } from 'react-native';
import { isSupabaseConfigured, supabase } from '@/api/supabase';
import { Screen } from '@/components/Screen';
import { de } from '@/i18n/de';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(mode: 'signIn' | 'signUp') {
    setBusy(true);
    const credentials = { email: email.trim(), password };
    const { error } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
    setBusy(false);
    if (error) Alert.alert(error.message);
  }

  return (
    <Screen title={de.login.title}>
      {!isSupabaseConfigured && <Text>{de.login.notConfigured}</Text>}
      <TextInput
        style={styles.input}
        placeholder={de.login.email}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder={de.login.password}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title={de.login.signIn} disabled={busy} onPress={() => submit('signIn')} />
      <Button title={de.login.signUp} disabled={busy} onPress={() => submit('signUp')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12 },
});
