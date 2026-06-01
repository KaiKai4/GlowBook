import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_DOCS = [
  "docs/reminders-launch-decision.md",
  "src/features/reminders/README.md",
];

const FORBIDDEN_AUTOMATIC_SEND_FILES = [
  "src/features/reminders/use-cases/send-reminder.ts",
  "src/features/reminders/use-cases/record-reminder-attempt.ts",
  "src/features/reminders/use-cases/retry-reminder.ts",
  "src/features/reminders/data/reminder-log.repo.ts",
];

const REQUIRED_DECISION_TEXT = [
  "No se activa envio real sin elegir proveedor y canal",
  "accion manual",
  "Si El Producto Promete Envio Real",
  "appointment_reminder_log",
];

function walkFiles(root) {
  if (!existsSync(root)) return [];

  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walkFiles(path));
    } else {
      files.push(path);
    }
  }

  return files;
}

function fail(message) {
  console.error(`[reminders-readiness] ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`[reminders-readiness] OK ${message}`);
}

for (const doc of REQUIRED_DOCS) {
  if (existsSync(join(process.cwd(), doc))) {
    pass(`${doc} exists`);
  } else {
    fail(`${doc} is missing`);
  }
}

const decision = existsSync(join(process.cwd(), "docs/reminders-launch-decision.md"))
  ? readFileSync(join(process.cwd(), "docs/reminders-launch-decision.md"), "utf8")
  : "";

for (const text of REQUIRED_DECISION_TEXT) {
  if (decision.includes(text)) {
    pass(`decision contains: ${text}`);
  } else {
    fail(`decision missing: ${text}`);
  }
}

for (const path of FORBIDDEN_AUTOMATIC_SEND_FILES) {
  if (existsSync(join(process.cwd(), path))) {
    fail(`${path} exists, but reminders launch decision is manual`);
  } else {
    pass(`${path} absent while decision is manual`);
  }
}

const reminderFiles = walkFiles(join(process.cwd(), "src/features/reminders"))
  .filter((path) => /\.(ts|tsx)$/.test(path));
const combined = reminderFiles.map((path) => readFileSync(path, "utf8")).join("\n");

if (/\bfetch\s*\(|\.send\s*\(|sendReminder|retryReminder|recordReminderAttempt/.test(combined)) {
  fail("src/features/reminders contains possible automatic sending code while decision is manual");
} else {
  pass("src/features/reminders contains no automatic sending code");
}

if (process.env.GLOWBOOK_REMINDERS_AUTOMATIC_CONFIRMED === "true") {
  for (const path of FORBIDDEN_AUTOMATIC_SEND_FILES) {
    if (existsSync(join(process.cwd(), path))) {
      pass(`${path} exists for automatic reminders`);
    } else {
      fail(`${path} is required when GLOWBOOK_REMINDERS_AUTOMATIC_CONFIRMED=true`);
    }
  }
} else {
  pass("automatic reminders are not confirmed; manual MVP decision remains active");
}

if (process.exitCode) {
  console.log("[reminders-readiness] Reminders readiness failed.");
  process.exit(process.exitCode);
}

console.log("[reminders-readiness] Reminders readiness passed.");
