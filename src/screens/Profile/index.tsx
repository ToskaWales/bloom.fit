import { Alert, Button, Share } from 'react-native';
import { deleteAccount, exportMyData } from '@/api/account';
import { supabase } from '@/api/supabase';
import { Screen } from '@/components/Screen';
import { de } from '@/i18n/de';
import { useSessionStore } from '@/store/session';

export default function ProfileScreen() {
  const userId = useSessionStore((s) => s.session?.user.id);
  async function exportData() {
    try {
      const data = await exportMyData();
      await Share.share({ message: JSON.stringify(data, null, 2), title: de.profile.exportReady });
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : String(e));
    }
  }

  function confirmDelete() {
    if (!userId) return;
    Alert.alert(de.profile.deleteTitle, de.profile.deleteMessage, [
      { text: de.profile.cancel, style: 'cancel' },
      {
        text: de.profile.deleteConfirm,
        style: 'destructive',
        onPress: () =>
          deleteAccount(userId).catch((e) =>
            Alert.alert(e instanceof Error ? e.message : String(e)),
          ),
      },
    ]);
  }

  return (
    <Screen title={de.profile.title}>
      <Button title={de.profile.exportData} onPress={exportData} />
      <Button title={de.profile.signOut} onPress={() => supabase.auth.signOut()} />
      <Button title={de.profile.deleteAccount} color="#b00020" onPress={confirmDelete} />
    </Screen>
  );
}
