import { Button } from 'react-native';
import { supabase } from '@/api/supabase';
import { Screen } from '@/components/Screen';
import { de } from '@/i18n/de';

export default function ProfileScreen() {
  return (
    <Screen title={de.profile.title}>
      <Button title={de.profile.signOut} onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
