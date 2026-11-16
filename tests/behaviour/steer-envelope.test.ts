/**
 * TC-STEER-073 — every outcome projects the five-field delivery.result.v1
 * envelope, the exact 0/1/2 exit row, one payload identity, and no partial
 * payload on a failure.
 */
import { describe, expect, test } from "bun:test";
import { CREATED, makeAppliedOutcome, makeMessage } from "../fixtures/steer/cases";
import { REGISTERED_SENTINEL } from "../fixtures/steer/credentials";
import { createSteerHarness } from "../fixtures/steer/harness";
import { NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

const ENVELOPE_KEYS = ["exitCode", "runId", "schemaVersion", "timing"].sort();

const collectKeys = (value: unknown, keys: Set<string> = new Set()): Set<string> => {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, keys);
    return keys;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      keys.add(key);
      collectKeys(entry, keys);
    }
  }
  return keys;
};

const errorCode = (run: { readonly envelope?: Record<string, unknown> }): string =>
  String((run.envelope?.error as Record<string, unknown> | undefined)?.code);

describe("TC-STEER-073 the envelope and exit projection are total", () => {
  test("every success row carries exactly the five envelope fields and one identity", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      const landed = makeMessage({ id: "msg-landed", created: CREATED });
      harness.seedMessage(landed);
      harness.seedOutcome(makeAppliedOutcome(landed));
      const due = makeMessage({ id: "msg-due", created: CREATED });
      harness.seedMessage(due);
      const rows = [
        await harness.run(["send", "envelope send"]),
        await harness.run(["list"]),
        await harness.run(["read"]),
        await harness.run(["complete", "msg-landed", "--ref", "doc/proof.md"]),
      ];
      for (const run of rows) {
        expect(run.exitCode).toBe(0);
        expect(Object.keys(run.envelope ?? {}).sort()).toEqual([...ENVELOPE_KEYS, "data"].sort());
        expect(run.envelope?.schemaVersion).toBe("delivery.result.v1");
        const data = run.data as Record<string, unknown> | undefined;
        expect(data?.schemaVersion).toBe("delivery.steer.v1");
        const keys = collectKeys(run.envelope);
        expect(keys.has("ok")).toBe(false);
        expect(keys.has("command")).toBe(false);
      }
    } finally {
      harness.cleanup();
    }
  });

  test("each failure row names its identity, exits 1, and renders no partial payload", async () => {
    const cases: readonly { readonly argv: readonly string[]; readonly code: string }[] = [
      { argv: ["send", ""], code: "input.value.rejected" },
      { argv: ["collect"], code: "fallback.invocation" },
    ];
    for (const cell of cases) {
      const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
      try {
        const run = await harness.run(cell.argv);
        expect(run.exitCode).toBe(1);
        expect(Object.keys(run.envelope ?? {}).sort()).toEqual([...ENVELOPE_KEYS, "error"].sort());
        expect(run.envelope?.data).toBeUndefined();
        expect(errorCode(run)).toBe(cell.code);
        expect(run.stderr).toContain(cell.code);
      } finally {
        harness.cleanup();
      }
    }

    const unknown = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      const run = await unknown.run(["complete", "msg-nope", "--ref", "doc/proof.md"]);
      expect(run.exitCode).toBe(1);
      expect(errorCode(run)).toBe("steer.unknown-id");
      expect(run.envelope?.data).toBeUndefined();
    } finally {
      unknown.cleanup();
    }

    const guarded = createSteerHarness({ secrets: [REGISTERED_SENTINEL] });
    try {
      const run = await guarded.run(["send", `note ${REGISTERED_SENTINEL}`]);
      expect(run.exitCode).toBe(1);
      expect(errorCode(run)).toBe("steer.credential-value-rejected");
      expect(run.envelope?.data).toBeUndefined();
    } finally {
      guarded.cleanup();
    }

    const broken = createSteerHarness({ storeMode: "unreadable" });
    try {
      const run = await broken.run(["list"]);
      expect(run.exitCode).toBe(2);
      expect(errorCode(run)).toBe("steer.queue-unavailable");
      expect(run.envelope?.data).toBeUndefined();
    } finally {
      broken.cleanup();
    }
  });
});
