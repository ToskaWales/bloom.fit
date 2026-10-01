// Alle UI-Texte zentral hier (Deutsch). Texte zu Zyklusphasen: nie universell formulieren,
// siehe CLAUDE.md und copyLint.test.ts.
export const de = {
  tabs: {
    log: 'Log',
    insights: 'Insights',
    profile: 'Profil',
  },
  log: {
    title: 'Heute loggen',
    placeholder: 'Training, Ernährung und Check-in folgen hier.',
  },
  insights: {
    title: 'Insights',
    placeholder:
      'Insights brauchen Zeit: Nach 1–2 Zyklen mit deinen Daten zeigt Bloom erste Muster.',
  },
  profile: {
    title: 'Profil',
    signOut: 'Abmelden',
    exportData: 'Meine Daten exportieren',
    exportReady: 'Export erstellt.',
    deleteAccount: 'Konto und alle Daten löschen',
    deleteTitle: 'Konto wirklich löschen?',
    deleteMessage: 'Alle deine Daten werden unwiderruflich gelöscht.',
    deleteConfirm: 'Endgültig löschen',
    cancel: 'Abbrechen',
  },
  login: {
    title: 'Willkommen bei Bloom',
    email: 'E-Mail',
    password: 'Passwort',
    signIn: 'Anmelden',
    signUp: 'Konto erstellen',
    notConfigured: 'Supabase ist noch nicht konfiguriert (siehe .env.example).',
    confirmEmail:
      'Fast geschafft: Wir haben dir eine E-Mail geschickt. Bitte bestätige deine Adresse und melde dich dann an.',
    forgotPassword: 'Passwort vergessen?',
    enterEmailFirst: 'Bitte gib zuerst deine E-Mail-Adresse ein.',
    resetSent:
      'Wenn zu dieser Adresse ein Konto existiert, haben wir dir einen Link zum Zurücksetzen geschickt.',
  },
  resetPassword: {
    title: 'Neues Passwort festlegen',
    password: 'Neues Passwort',
    save: 'Passwort speichern',
    waiting: 'Link wird geprüft …',
    invalidLink: 'Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.',
    done: 'Passwort geändert.',
    minLength: 'Das Passwort braucht mindestens 8 Zeichen.',
  },
  common: {
    next: 'Weiter',
    back: 'Zurück',
    save: 'Speichern',
    retry: 'Erneut versuchen',
    loadError: 'Deine Daten konnten nicht geladen werden. Bitte prüfe deine Verbindung.',
  },
  onboarding: {
    introTitle: 'Willkommen bei Bloom',
    introBody:
      'Bloom hilft dir, Training, Ernährung und Zyklus an einem Ort zu loggen – und zeigt dir, was deine eigenen Daten über deine Wochen verraten.',
    introExpectation:
      'Insights brauchen Zeit: Nach 1–2 Zyklen mit deinen Daten zeigt Bloom erste Muster. Bis dahin lohnt es sich, Training, Ernährung und das tägliche Check-in zu loggen.',
    trainingTitle: 'Dein Training',
    goalLabel: 'Was ist dein Ziel?',
    goals: {
      muscle_gain: 'Muskelaufbau',
      recomposition: 'Körperrekomposition',
      other: 'Etwas anderes',
    },
    experienceLabel: 'Wie lange trainierst du schon strukturiert?',
    experiences: {
      intermediate: 'Seit 1–3 Jahren',
      advanced: 'Seit mehr als 3 Jahren',
      other: 'Weniger als 1 Jahr',
    },
    cycleTitle: 'Dein Zyklus',
    contextLabel: 'Was trifft am ehesten auf dich zu?',
    contexts: {
      regular: { label: 'Regelmäßiger Zyklus', hint: '' },
      irregular: {
        label: 'Unregelmäßiger Zyklus',
        hint: 'Bloom funktioniert auch dann, braucht aber etwas mehr Daten von dir, bevor Muster sichtbar werden.',
      },
      hormonal_contraception: {
        label: 'Hormonelle Verhütung',
        hint: 'Bloom funktioniert auch dann, braucht aber etwas mehr Daten von dir, bevor Muster sichtbar werden.',
      },
      pregnant_or_postpartum: {
        label: 'Schwanger oder kurz nach der Geburt',
        hint: 'In dieser Zeit gibt Bloom keine Anpassungen anhand deines Zyklus. Logging und Auswertung deiner Daten funktionieren normal. Sprich Training und Ernährung bitte mit deiner Ärztin oder Hebamme ab.',
      },
      perimenopause_menopause: {
        label: 'Wechseljahre / Perimenopause',
        hint: 'Bloom funktioniert auch dann, braucht aber etwas mehr Daten von dir, bevor Muster sichtbar werden.',
      },
    },
    cycleLengthLabel: 'Wie lang ist dein Zyklus meistens (in Tagen)?',
    lastPeriodLabel: 'Wann hat deine letzte Periode begonnen?',
    lastPeriodPlaceholder: 'Datum wählen',
    lastPeriodSkip: 'Weiß ich nicht / nicht relevant',
    consentTitle: 'Deine Daten',
    consentHealth:
      'Ich willige ausdrücklich ein, dass Bloom meine Gesundheitsdaten (Zyklus, Training, Ernährung, Schlaf, Energie, Motivation) verarbeitet, um mein Training an meine Daten anzupassen. Ich kann die Einwilligung jederzeit widerrufen.',
    consentPrivacy: 'Ich habe die Datenschutzerklärung zur Kenntnis genommen.',
    finish: "Los geht's",
    saveError: 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
    errors: {
      required: 'Bitte wähle eine Option.',
      cycleLengthRange: 'Bitte gib eine Zahl zwischen 21 und 45 ein.',
      invalidDate: 'Das Datum ist ungültig.',
      futureDate: 'Das Datum liegt in der Zukunft.',
      tooOld: 'Das Datum liegt zu weit zurück (max. 1 Jahr).',
    },
  },
} as const;

export type Strings = typeof de;
