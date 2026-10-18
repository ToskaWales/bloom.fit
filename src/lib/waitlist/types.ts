export type HookVariant = "a" | "b" | "c";

export interface WaitlistEntry {
  email: string;
  variant: HookVariant;
  source: string | null;
  tokenHash: string;
  tokenSentAt: Date;
  consentAt: Date;
  confirmedAt: Date | null;
}

export interface WaitlistRepo {
  findByEmail(email: string): Promise<WaitlistEntry | null>;
  findByTokenHash(hash: string): Promise<WaitlistEntry | null>;
  insert(entry: WaitlistEntry): Promise<void>;
  update(email: string, patch: Partial<WaitlistEntry>): Promise<void>;
}

export interface Mailer {
  sendConfirmation(email: string, token: string): Promise<void>;
}

export interface Deps {
  repo: WaitlistRepo;
  mailer: Mailer;
  now: () => Date;
}
