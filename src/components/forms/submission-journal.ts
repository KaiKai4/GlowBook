// Per-tab journal of pending submissions. Stores ONLY procedure, idempotency key,
// a hash of the data and a timestamp: never field values or credentials.
// Every storage access is guarded because sessionStorage can be missing or blocked.

const STORAGE_KEY = "glowbook:submission-intents";
const SUBMISSION_INTENT_TTL_MS = 24 * 60 * 60 * 1000;

export interface SubmissionJournalEntry {
  procedure: string;
  key: string;
  dataHash: string;
  startedAt: number;
}

function isEntry(value: unknown): value is SubmissionJournalEntry {
  if (value === null || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.procedure === "string" &&
    typeof entry.key === "string" &&
    typeof entry.dataHash === "string" &&
    typeof entry.startedAt === "number"
  );
}

export function readSubmissionJournal(now: number = Date.now()): SubmissionJournalEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isEntry)
      .filter((entry) => now - entry.startedAt < SUBMISSION_INTENT_TTL_MS)
      .map(({ procedure, key, dataHash, startedAt }) => ({ procedure, key, dataHash, startedAt }));
  } catch {
    return [];
  }
}

function writeSubmissionJournal(entries: SubmissionJournalEntry[]): void {
  try {
    if (entries.length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable: the in-memory intent still protects the current page.
  }
}

export function rememberSubmissionIntent(entry: SubmissionJournalEntry): void {
  const others = readSubmissionJournal().filter((item) => item.procedure !== entry.procedure);
  writeSubmissionJournal([
    ...others,
    { procedure: entry.procedure, key: entry.key, dataHash: entry.dataHash, startedAt: entry.startedAt },
  ]);
}

export function forgetSubmissionIntent(procedure: string): void {
  writeSubmissionJournal(readSubmissionJournal().filter((item) => item.procedure !== procedure));
}
