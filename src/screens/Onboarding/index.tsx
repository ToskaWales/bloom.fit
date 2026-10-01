import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DateField } from '@/components/DateField';
import { OptionGroup } from '@/components/OptionGroup';
import { de } from '@/i18n/de';
import {
  emptyOnboarding,
  errorsForStep,
  hasErrors,
  ONBOARDING_STEPS,
  type OnboardingErrors,
  type OnboardingInput,
} from '@/lib/onboarding';
import { useProfileStore } from '@/store/profile';
import { useSessionStore } from '@/store/session';
import type { CycleContext, TrainingExperience, TrainingGoal } from '@/api/database.types';

const t = de.onboarding;

function ErrorText({ code }: { code?: string }) {
  if (!code) return null;
  return <Text style={styles.error}>{t.errors[code as keyof typeof t.errors]}</Text>;
}

export default function OnboardingScreen() {
  const userId = useSessionStore((s) => s.session?.user.id);
  const finishOnboarding = useProfileStore((s) => s.finishOnboarding);

  const [stepIndex, setStepIndex] = useState(0);
  const [input, setInput] = useState<OnboardingInput>(emptyOnboarding);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [busy, setBusy] = useState(false);

  const step = ONBOARDING_STEPS[stepIndex];
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;
  const update = (patch: Partial<OnboardingInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
    setErrors({});
  };

  async function next() {
    const stepErrors = errorsForStep(step, input);
    if (hasErrors(stepErrors)) return setErrors(stepErrors);
    if (!isLast) return setStepIndex(stepIndex + 1);
    if (!userId) return;
    setBusy(true);
    try {
      await finishOnboarding(userId, input);
      // Das Auth-Gate im Root-Layout wechselt danach automatisch zu den Tabs.
    } catch {
      Alert.alert(t.saveError);
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {step === 'intro' && (
        <>
          <Text style={styles.title}>{t.introTitle}</Text>
          <Text>{t.introBody}</Text>
          <Text>{t.introExpectation}</Text>
        </>
      )}

      {step === 'training' && (
        <>
          <Text style={styles.title}>{t.trainingTitle}</Text>
          <Text style={styles.label}>{t.goalLabel}</Text>
          <OptionGroup<TrainingGoal>
            value={input.trainingGoal}
            onChange={(trainingGoal) => update({ trainingGoal })}
            options={(Object.keys(t.goals) as TrainingGoal[]).map((value) => ({
              value,
              label: t.goals[value],
            }))}
          />
          <ErrorText code={errors.trainingGoal} />
          <Text style={styles.label}>{t.experienceLabel}</Text>
          <OptionGroup<TrainingExperience>
            value={input.trainingExperience}
            onChange={(trainingExperience) => update({ trainingExperience })}
            options={(Object.keys(t.experiences) as TrainingExperience[]).map((value) => ({
              value,
              label: t.experiences[value],
            }))}
          />
          <ErrorText code={errors.trainingExperience} />
        </>
      )}

      {step === 'cycle' && (
        <>
          <Text style={styles.title}>{t.cycleTitle}</Text>
          <Text style={styles.label}>{t.contextLabel}</Text>
          <OptionGroup<CycleContext>
            value={input.cycleContext}
            onChange={(cycleContext) => update({ cycleContext })}
            options={(Object.keys(t.contexts) as CycleContext[]).map((value) => ({
              value,
              label: t.contexts[value].label,
              hint: t.contexts[value].hint || undefined,
            }))}
          />
          <ErrorText code={errors.cycleContext} />
          <Text style={styles.label}>{t.cycleLengthLabel}</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={input.cycleLength}
            onChangeText={(cycleLength) => update({ cycleLength })}
          />
          <ErrorText code={errors.cycleLength} />
          <Text style={styles.label}>{t.lastPeriodLabel}</Text>
          <DateField
            value={input.lastPeriodStart}
            onChange={(lastPeriodStart) => update({ lastPeriodStart })}
            placeholder={t.lastPeriodPlaceholder}
            maximumDate={new Date()}
          />
          {input.lastPeriodStart && (
            <Button title={t.lastPeriodSkip} onPress={() => update({ lastPeriodStart: null })} />
          )}
          {!input.lastPeriodStart && <Text style={styles.hint}>{t.lastPeriodSkip}</Text>}
          <ErrorText code={errors.lastPeriodStart} />
        </>
      )}

      {step === 'consent' && (
        <>
          <Text style={styles.title}>{t.consentTitle}</Text>
          <View style={styles.row}>
            <Switch
              value={input.consentHealthData}
              onValueChange={(consentHealthData) => update({ consentHealthData })}
            />
            <Text style={styles.flex}>{t.consentHealth}</Text>
          </View>
          <ErrorText code={errors.consentHealthData} />
          <View style={styles.row}>
            <Switch
              value={input.consentPrivacy}
              onValueChange={(consentPrivacy) => update({ consentPrivacy })}
            />
            <Text style={styles.flex}>{t.consentPrivacy}</Text>
          </View>
          <ErrorText code={errors.consentPrivacy} />
        </>
      )}

      {busy ? (
        <ActivityIndicator />
      ) : (
        <>
          <Button title={isLast ? t.finish : de.common.next} onPress={next} />
          {stepIndex > 0 && (
            <Button title={de.common.back} onPress={() => setStepIndex(stepIndex - 1)} />
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  label: { fontSize: 16, fontWeight: '500', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12 },
  error: { color: '#b00020' },
  hint: { color: '#555' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
