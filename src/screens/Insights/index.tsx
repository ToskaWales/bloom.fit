import { Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { de } from '@/i18n/de';

export default function InsightsScreen() {
  return (
    <Screen title={de.insights.title}>
      <Text>{de.insights.placeholder}</Text>
    </Screen>
  );
}
