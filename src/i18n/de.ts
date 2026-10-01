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
  },
  login: {
    title: 'Willkommen bei Bloom',
    email: 'E-Mail',
    password: 'Passwort',
    signIn: 'Anmelden',
    signUp: 'Konto erstellen',
    notConfigured: 'Supabase ist noch nicht konfiguriert (siehe .env.example).',
  },
} as const;

export type Strings = typeof de;
