import { Tabs } from 'expo-router';
import { de } from '@/i18n/de';

// Navigation: Tab-basiert (Log, Insights, Profil) – siehe Architektur-Dokument.
export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: de.tabs.log }} />
      <Tabs.Screen name="insights" options={{ title: de.tabs.insights }} />
      <Tabs.Screen name="profile" options={{ title: de.tabs.profile }} />
    </Tabs>
  );
}
