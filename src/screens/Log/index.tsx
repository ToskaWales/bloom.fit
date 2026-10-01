import { Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { de } from '@/i18n/de';

export default function LogScreen() {
  return (
    <Screen title={de.log.title}>
      <Text>{de.log.placeholder}</Text>
    </Screen>
  );
}
