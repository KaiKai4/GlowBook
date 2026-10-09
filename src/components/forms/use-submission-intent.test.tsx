// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useEffect } from "react";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { renderDom, type RenderedDom } from "@/test/render-dom";
import { hashSubmissionData } from "./submission-canonical";
import {
  SAVED_WITH_WARNINGS_MESSAGE,
  useSubmissionIntent,
  type SubmissionOutcome,
  type UseSubmissionIntentOptions,
} from "./use-submission-intent";
import { readSubmissionJournal } from "./submission-journal";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const JOURNAL_KEY = "glowbook:submission-intents";
const PROCEDURE = "appointments.create";

type Intent = ReturnType<typeof useSubmissionIntent>;
let latest: Intent | null = null;

function Harness(options: UseSubmissionIntentOptions) {
  const toast = useToast();
  const intent = useSubmissionIntent({
    ...options,
    onWarnings: () => toast.warning(SAVED_WITH_WARNINGS_MESSAGE),
  });
  useEffect(() => {
    latest = intent;
  });
  return <output data-testid="pending">{String(intent.pending)}</output>;
}

function mount(procedure = PROCEDURE): RenderedDom {
  return renderDom(
    <ToastProvider>
      <Harness procedure={procedure} />
    </ToastProvider>
  );
}

function current(): Intent {
  if (!latest) throw new Error("hook not mounted");
  return latest;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function okOutcome(): SubmissionOutcome {
  return { ok: true };
}

function failOutcome(): SubmissionOutcome {
  return { ok: false };
}

async function run(
  data: unknown,
  send: (key: string) => Promise<SubmissionOutcome>
): Promise<SubmissionOutcome> {
  let result: SubmissionOutcome | undefined;
  await act(async () => {
    result = await current().submit(data, send);
  });
  if (!result) throw new Error("submit did not resolve");
  return result;
}

function readJournal(): unknown {
  const raw = sessionStorage.getItem(JOURNAL_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe("useSubmissionIntent", () => {
  let rendered: RenderedDom | null = null;

  beforeEach(() => {
    sessionStorage.clear();
    latest = null;
    rendered = mount();
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = null;
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("reuses the same key for the same data after a failed attempt", async () => {
    const keys: string[] = [];
    const send = async (key: string) => {
      keys.push(key);
      return failOutcome();
    };

    await run({ customer: "c1", notes: "n" }, send);
    await run({ customer: "c1", notes: "n" }, send);

    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it("reuses the same key after a network exception", async () => {
    const keys: string[] = [];
    const send = vi
      .fn<(key: string) => Promise<SubmissionOutcome>>()
      .mockImplementationOnce(async (key) => {
        keys.push(key);
        throw new Error("network down");
      })
      .mockImplementationOnce(async (key) => {
        keys.push(key);
        return okOutcome();
      });

    await expect(run({ amount: 10 }, send)).rejects.toThrow("network down");
    await run({ amount: 10 }, send);

    expect(keys[0]).toBe(keys[1]);
  });

  it("uses the same key regardless of object key order", async () => {
    const keys: string[] = [];
    const send = async (key: string) => {
      keys.push(key);
      return failOutcome();
    };

    await run({ a: 1, b: { x: 1, y: 2 } }, send);
    await run({ b: { y: 2, x: 1 }, a: 1 }, send);

    expect(keys[0]).toBe(keys[1]);
  });

  it("generates a new key when the data changes", async () => {
    const keys: string[] = [];
    const send = async (key: string) => {
      keys.push(key);
      return failOutcome();
    };

    await run({ amount: 10 }, send);
    await run({ amount: 11 }, send);

    expect(keys[0]).not.toBe(keys[1]);
  });

  it("discards the intent after a confirmed success", async () => {
    const keys: string[] = [];
    const send = async (key: string) => {
      keys.push(key);
      return okOutcome();
    };

    await run({ amount: 10 }, send);
    await run({ amount: 10 }, send);

    expect(keys[0]).not.toBe(keys[1]);
    expect(readSubmissionJournal()).toEqual([]);
  });

  it("shares the in-flight request on a double trigger", async () => {
    const gate = deferred<SubmissionOutcome>();
    const sent = deferred<void>();
    const send = vi.fn(() => {
      sent.resolve();
      return gate.promise;
    });

    let first: Promise<SubmissionOutcome> | undefined;
    let second: Promise<SubmissionOutcome> | undefined;
    await act(async () => {
      first = current().submit({ amount: 10 }, send);
      second = current().submit({ amount: 10 }, send);
      await sent.promise;
      gate.resolve(okOutcome());
      await first;
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("journals only procedure, key, data hash and timestamp (no values)", async () => {
    const secret = "valor-muy-privado-123";
    const send = async () => failOutcome();

    await run({ notes: secret, password: "clave-secreta-xyz" }, send);

    const raw = sessionStorage.getItem(JOURNAL_KEY) ?? "";
    expect(raw).not.toContain(secret);
    expect(raw).not.toContain("clave-secreta-xyz");

    const journal = readJournal() as Array<Record<string, unknown>>;
    expect(journal).toHaveLength(1);
    expect(Object.keys(journal[0]).sort()).toEqual(["dataHash", "key", "procedure", "startedAt"]);
    expect(journal[0].procedure).toBe(PROCEDURE);
  });

  it("reuses a journaled key for the same data after remounting", async () => {
    const data = { customer: "c9", amount: 42 };
    const dataHash = await hashSubmissionData(data);
    sessionStorage.setItem(
      JOURNAL_KEY,
      JSON.stringify([{ procedure: PROCEDURE, key: "journal-key-1", dataHash, startedAt: Date.now() }])
    );

    rendered?.unmount();
    rendered = mount();

    const keys: string[] = [];
    await run(data, async (key) => {
      keys.push(key);
      return okOutcome();
    });

    expect(keys).toEqual(["journal-key-1"]);
  });

  it("ignores journal entries older than 24 hours", async () => {
    const data = { amount: 42 };
    const dataHash = await hashSubmissionData(data);
    sessionStorage.setItem(
      JOURNAL_KEY,
      JSON.stringify([{
        procedure: PROCEDURE,
        key: "stale-key",
        dataHash,
        startedAt: Date.now() - TWENTY_FOUR_HOURS_MS - 1_000,
      }])
    );

    rendered?.unmount();
    rendered = mount();

    const keys: string[] = [];
    await run(data, async (key) => {
      keys.push(key);
      return failOutcome();
    });

    expect(keys[0]).not.toBe("stale-key");
  });

  it("tolerates unavailable sessionStorage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const keys: string[] = [];
    const send = async (key: string) => {
      keys.push(key);
      return failOutcome();
    };

    await run({ amount: 1 }, send);
    await run({ amount: 1 }, send);

    expect(keys[0]).toBe(keys[1]);
  });

  it("shows a warning toast when a confirmed operation carries warnings", async () => {
    await run({ amount: 5 }, async () => ({ ok: true, warnings: ["stock"] }));

    expect(document.body.textContent).toContain(SAVED_WITH_WARNINGS_MESSAGE);
  });

  it("exposes pending while the request is in flight", async () => {
    const gate = deferred<SubmissionOutcome>();
    const sent = deferred<void>();
    const pendingLabel = () =>
      rendered?.container.querySelector("[data-testid=pending]")?.textContent;

    let promise: Promise<SubmissionOutcome> | undefined;
    await act(async () => {
      promise = current().submit({ amount: 9 }, () => {
        sent.resolve();
        return gate.promise;
      });
      await sent.promise;
    });
    expect(pendingLabel()).toBe("true");

    await act(async () => {
      gate.resolve(okOutcome());
      await promise;
    });
    expect(pendingLabel()).toBe("false");
  });
});
