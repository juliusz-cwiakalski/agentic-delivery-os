/**
 * TC-QLC-084 (GH-292, AC-NFR-5, NFR-6, NFR-8) — the new surfaces are bounded and
 * carry no secret: the removal payload has exactly the declared data keys and
 * its projected event exactly the three declared fields; the reconcile lists
 * are bounded and identifier/count/timestamp only; the single-flight refusal
 * detail is a single bounded identifier at the envelope root while the shared
 * error keeps exactly its six fields; and no output, record, or event carries
 * a credential shape, repository content, a prompt, a diff, or an ambient
 * value — including a token passed on the command line, which is refused as
 * grammar and never echoed.
 */
import { describe, expect, test } from "bun:test";
import { QUEUE_RECONCILE_MAX_ENTRIES } from "../../packages/core/src/contracts/index";
import { createEventProjector } from "../../packages/core/src/domain/event-projection";
import { RECONCILE_PAYLOAD_KEYS } from "../fixtures/queue/reconcile/cases";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";
import { REMOVAL_PAYLOAD_KEYS, REMOVAL_REF } from "../fixtures/queue/removal/cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";

const AMBIENT_CANARY = "sk-ambient-canary-000111222333";
const CLI_TOKEN = "sk-cli-canary-987654321";
const CLI_TOKEN_2 = "ghp_cliCanary123456789";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

const SECRET_PATTERNS: readonly (readonly [string, RegExp])[] = [
  ["ambient canary", new RegExp(AMBIENT_CANARY, "u")],
  ["sk- credential", /\bsk-[A-Za-z0-9]{8,}/u],
  ["ghp_ token", /\bghp_[A-Za-z0-9]{8,}/u],
  ["bearer token", /Bearer\s+[A-Za-z0-9._-]{8,}/u],
  ["private key block", /BEGIN [A-Z ]*PRIVATE KEY/u],
  ["credential query", /[?&](token|api_key|password)=/u],
  ["repository content", /\/work\/repo-alpha/u],
  ["absolute home path", /\/home\/[A-Za-z0-9._-]+\//u],
  ["diff body", /diff --git/u],
  ["prompt marker", /<prompt[> ]/u],
];

/** Every pattern must miss: one accumulator list, asserted empty per surface. */
const matchesOf = (label: string, text: string): string[] => {
  const failures: string[] = [];
  for (const [patternLabel, pattern] of SECRET_PATTERNS) {
    if (pattern.test(text)) failures.push(`${label}: ${patternLabel}`);
  }
  return failures;
};

describe("TC-QLC-084 bounded output and no secret material", () => {
  test("the removal payload is exactly additive and its event exactly three fields", async () => {
    const harness = createRemovalHarness("privacy-remove");
    harness.seedEntry({ ref: REMOVAL_REF });
    const projector = createEventProjector();
    const seededRecords = harness.composition.store.readRecords();
    expect(seededRecords.ok).toBe(true);
    if (!seededRecords.ok) return;
    // First observation baselines the seeded ledger.
    projector.project(seededRecords.value.records);

    const run = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "abandoned",
      "--json",
    ]);
    expect(run.exitCode).toBe(0);
    const envelope = json(run.stdout);
    const data = envelope.data as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual([...REMOVAL_PAYLOAD_KEYS].sort());
    expect(data.event).toEqual({ topic: "queue.graph", kind: "remove" });

    // The durable removal record carries exactly the declared fields.
    const removals = harness.removalRecords();
    expect(removals).toHaveLength(1);
    const removal = removals[0];
    if (removal === undefined) return;
    expect(Object.keys(removal).sort()).toEqual([
      "callerPrincipal",
      "reason",
      "recordedAt",
      "ref",
      "schema",
    ]);

    // The projected remove event carries exactly the three declared fields.
    const afterRecords = harness.composition.store.readRecords();
    expect(afterRecords.ok).toBe(true);
    if (!afterRecords.ok) return;
    const events = projector.project(afterRecords.value.records);
    const removes = events.filter((event) => event.kind === "remove");
    expect(removes).toHaveLength(1);
    const remove = removes[0] ?? ({} as (typeof events)[number]);
    expect(Object.keys(remove.payload).sort()).toEqual(["reason", "recordedAt", "ref"]);
    expect(remove.payload.ref).toBe(REMOVAL_REF);
  });

  test("the reconcile lists are bounded, identifier-only, and leak no ambient value", async () => {
    const harness = createReconcileHarness("privacy-reconcile");
    process.env.ADHOC_PRIVACY_CANARY = AMBIENT_CANARY;
    try {
      harness.seedEntry({ ref: "GH-241" });
      harness.seedEntry({ ref: "GH-242" });
      harness.seedEntry({ ref: "GH-243" });
      harness.program("GH-241", { deliveryState: "done" });
      harness.program("GH-242", { deliveryState: "canceled" });
      harness.program("GH-243", { deliveryState: "ready" });

      const run = await harness.run(["queue", "reconcile", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = json(run.stdout).data as Record<string, unknown>;
      expect(Object.keys(data).sort()).toEqual([...RECONCILE_PAYLOAD_KEYS].sort());
      // Bounded lists with row shapes of identifiers, aliases, and counts only.
      for (const list of ["removed", "retained", "unobserved"] as const) {
        const value = data[list];
        expect(Array.isArray(value)).toBe(true);
        expect((value as readonly unknown[]).length).toBeLessThanOrEqual(
          QUEUE_RECONCILE_MAX_ENTRIES,
        );
      }
      expect(
        Object.keys((data.removed as readonly Record<string, unknown>[])[0] ?? {}).sort(),
      ).toEqual(["reason", "ref"]);
      expect(
        Object.keys((data.retained as readonly Record<string, unknown>[])[0] ?? {}).sort(),
      ).toEqual(["deliveryState", "ref"]);
      expect(typeof data.checked).toBe("number");
      expect(typeof data.truncated).toBe("boolean");
      expect(typeof data.remainder).toBe("number");
      // The declared credential port receives refs only — never tokens.
      for (const call of harness.calls()) {
        expect(call.ref).toMatch(/^GH-\d+$/u);
      }
      // No output surface echoes the ambient canary or any secret shape.
      expect(matchesOf("reconcile stdout", run.stdout)).toEqual([]);
      expect(matchesOf("reconcile stderr", run.stderr)).toEqual([]);
    } finally {
      delete process.env.ADHOC_PRIVACY_CANARY;
    }
  });

  test("the single-flight refusal detail is one bounded identifier and the error keeps six fields", async () => {
    const harness = createRemovalHarness("privacy-detail");
    harness.seedEntry({ ref: REMOVAL_REF });
    harness.seedLease({ ref: REMOVAL_REF, holder: "lane-1" });
    const refused = await harness.run([
      "queue",
      "claim",
      REMOVAL_REF,
      "--holder",
      "lane-2",
      "--json",
    ]);
    expect(refused.exitCode).toBe(1);
    const envelope = json(refused.stdout);
    const error = envelope.error as Record<string, unknown>;
    expect(error.code).toBe("queue.single-flight");
    // The holder rides the envelope root (TDR-0027), single line and bounded.
    const detail = envelope.detail as { holder?: string } | undefined;
    expect(detail).toBeDefined();
    const holder = detail?.holder ?? "";
    expect(holder).toBe("lane-1");
    expect(holder.length).toBeLessThanOrEqual(128);
    expect(holder.includes("\n")).toBe(false);
    expect(holder).toMatch(/^[A-Za-z0-9._:@-]+$/u);
    // The shared error keeps exactly its six fields; error.detail is absent.
    expect(Object.keys(error).sort()).toEqual([
      "category",
      "code",
      "consequence",
      "remediationHint",
      "retryable",
      "summary",
    ]);
    expect(Object.hasOwn(error, "detail")).toBe(false);
    // Every error string is single line and carries no secret shape.
    for (const value of Object.values(error)) {
      if (typeof value === "string") {
        expect(value.includes("\n")).toBe(false);
      }
    }
    expect(matchesOf("refusal stdout", refused.stdout)).toEqual([]);
  });

  test("a token on the command line is refused as grammar and never echoed", async () => {
    const harness = createRemovalHarness("privacy-cli-token");
    harness.seedEntry({ ref: REMOVAL_REF });
    const removeAttempt = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "abandoned",
      "--access-token",
      CLI_TOKEN,
      "--json",
    ]);
    expect(removeAttempt.exitCode).not.toBe(0);
    expect(removeAttempt.stdout).not.toContain(CLI_TOKEN);
    expect(removeAttempt.stderr).not.toContain(CLI_TOKEN);
    expect(matchesOf("token-refusal stdout", removeAttempt.stdout)).toEqual([]);

    const reconcileAttempt = await harness.run([
      "queue",
      "reconcile",
      "--ref",
      REMOVAL_REF,
      "--api-key",
      CLI_TOKEN_2,
      "--json",
    ]);
    expect(reconcileAttempt.exitCode).not.toBe(0);
    expect(reconcileAttempt.stdout).not.toContain(CLI_TOKEN_2);
    expect(reconcileAttempt.stderr).not.toContain(CLI_TOKEN_2);
    // The refused runs appended nothing: the removal ledger is still empty.
    expect(harness.removalRecords()).toHaveLength(0);
  });

  test("the durable removal records and projected events carry no repository content", async () => {
    const harness = createRemovalHarness("privacy-records");
    harness.seedEntry({ ref: REMOVAL_REF });
    await harness.run(["queue", "remove", REMOVAL_REF, "--reason", "superseded", "--json"]);
    const removals = harness.removalRecords();
    expect(removals).toHaveLength(1);
    expect(matchesOf("removal record", JSON.stringify(removals))).toEqual([]);
    const document = harness.graphDocument();
    expect(document).toBeDefined();
    expect(matchesOf("derived document", document ?? "")).toEqual([]);
  });
});
