import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Button, Platform, View } from 'react-native';
import { dateToIso, formatDateDe, isoToDate, todayIso } from '@/lib/date';

type Props = {
  value: string | null;
  onChange: (iso: string) => void;
  placeholder: string;
  maximumDate?: Date;
};

/** Datumsauswahl: iOS zeigt den Picker direkt, Android öffnet ihn per Tipp. */
export function DateField({ value, onChange, placeholder, maximumDate }: Props) {
  const [open, setOpen] = useState(false);
  const date = isoToDate(value ?? todayIso());

  const picker = (
    <DateTimePicker
      value={date}
      mode="date"
      maximumDate={maximumDate}
      onChange={(_event, selected) => {
        setOpen(false);
        if (selected) onChange(dateToIso(selected));
      }}
    />
  );

  if (Platform.OS === 'ios') {
    return <View>{picker}</View>;
  }
  return (
    <View>
      <Button title={value ? formatDateDe(value) : placeholder} onPress={() => setOpen(true)} />
      {open && picker}
    </View>
  );
}
