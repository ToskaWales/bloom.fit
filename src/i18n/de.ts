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
} as const;

export type Strings = typeof de;
