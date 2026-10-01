import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput } from 'react-native';
import { supabase } from '@/api/supabase';
import { Screen } from '@/components/Screen';
import { de } from '@/i18n/de';

/** Tokens stehen im Fragment des Deep Links: bloom://reset-password#access_token=…&refresh_token=… */
function readTokens(url: string) {
  const fragment = url.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  return { accessToken: params.get('access_token'), refreshToken: params.get('refresh_token') };
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const url = Linking.useLinkingURL();
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const tokens = url ? readTokens(url) : null;
  const accessToken = tokens?.accessToken;
  const refreshToken = tokens?.refreshToken;

  useEffect(() => {
    if (!accessToken || !refreshToken) return;
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => setSessionOk(!error));
  }, [accessToken, refreshToken]);

  const state = !url
    ? 'checking'
    : !accessToken || !refreshToken || sessionOk === false
      ? 'invalid'
      : sessionOk
        ? 'ready'
        : 'checking';

  async function save() {
    if (password.length < 8) return Alert.alert(de.resetPassword.minLength);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return Alert.alert(error.message);
    Alert.alert(de.resetPassword.done);
    router.replace('/');
  }

  return (
    <Screen title={de.resetPassword.title}>
      {state === 'checking' && <Text>{de.resetPassword.waiting}</Text>}
      {state === 'invalid' && <Text>{de.resetPassword.invalidLink}</Text>}
      {state === 'ready' && (
        <>
          <TextInput
            style={styles.input}
            placeholder={de.resetPassword.password}
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
          />
          <Button title={de.resetPassword.save} disabled={busy} onPress={save} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12 },
});
