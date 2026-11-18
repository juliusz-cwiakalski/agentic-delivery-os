/**
 * TC-HARNESS-042 (grammar/normalization half) — probe parsing and normalization.
 *
 * The parse half is owned by this phase; TC-HARNESS-006's single-invocation and
 * deadline assertions extend this file in the dispatch phase.
 */
import { describe, expect, test } from "bun:test";
import {
  HARNESS_VERSION_PROBE_PATTERN,
  HARNESS_VERSION_PROBE_TIMEOUT_MS,
  type HarnessVersionProbeOutcome,
} from "../../packages/core/src/contracts/index";
import {
  evaluateHarnessVersion,
  type HarnessAdapterRegistration,
  normalizeHarnessVersion,
  resolveHarnessInstance,
} from "../../packages/core/src/domain/index";
import {
  ACCEPTED_GRAMMAR_EXAMPLES,
  PROBE_OUTCOME_TABLE,
  VERSION_TABLE,
} from "../fixtures/harness/version";

describe("TC-HARNESS-042 the observed line and the accepted forms", () => {
  test("the observed delivery and intake lines normalize to bare semver", () => {
    expect(normalizeHarnessVersion("opencode v2.3.2")).toBe("2.3.2");
    expect(normalizeHarnessVersion("opencode v2.2.5")).toBe("2.2.5");
    for (const accepted of ACCEPTED_GRAMMAR_EXAMPLES) {
      expect(HARNESS_VERSION_PROBE_PATTERN.test(accepted), accepted).toBe(true);
      expect(normalizeHarnessVersion(accepted)).not.toBeUndefined();
    }
  });

  test("the grammar requires a product token and a three-part version, and the v is optional", () => {
    expect(normalizeHarnessVersion("opencode 2.3.2")).toBe("2.3.2");
    expect(normalizeHarnessVersion("2.3.2")).toBeUndefined();
    expect(normalizeHarnessVersion("v2.3.2")).toBeUndefined();
    expect(normalizeHarnessVersion("opencode v2.3")).toBeUndefined();
    expect(normalizeHarnessVersion("opencode v2.3.2.1")).toBeUndefined();
  });

  test("one trailing line terminator is accepted and interior newlines are not", () => {
    expect(normalizeHarnessVersion("opencode v2.3.2\n")).toBe("2.3.2");
    expect(normalizeHarnessVersion("opencode v2.3.2\r\n")).toBe("2.3.2");
    expect(normalizeHarnessVersion("opencode v2.3.2\nopencode v2.1.7")).toBeUndefined();
    expect(normalizeHarnessVersion("opencode v2.3.2\n\n")).toBeUndefined();
  });

  test("every off-grammar shape in the table is indeterminate and never a substring match", () => {
    for (const row of VERSION_TABLE.filter((entry) => entry.verdict === "indeterminate")) {
      expect(normalizeHarnessVersion(row.raw), row.id).toBeUndefined();
      expect(evaluateHarnessVersion(row.raw).verdict, row.id).toBe("indeterminate");
      expect(evaluateHarnessVersion(row.raw).observedVersion, row.id).toBeNull();
    }
  });

  test("the probe bound has one declared home", () => {
    expect(HARNESS_VERSION_PROBE_TIMEOUT_MS).toBe(5000);
  });

  test("a rejected or timed-out probe yields the unknown verdict with one invocation", async () => {
    const registration: HarnessAdapterRegistration = {
      kind: "opencode",
      create: (input) => ({
        kind: input.kind,
        observedVersion: input.observedVersion,
        ...(input.versionWarning === undefined ? {} : { versionWarning: input.versionWarning }),
        capabilities: {
          supportedOperations: [],
          lifecycleCapabilities: [],
          livenessSources: [],
          declaredGaps: [],
        },
      }),
    };
    for (const row of PROBE_OUTCOME_TABLE) {
      const calls: { deadlineMs: number; now: () => number }[] = [];
      const clock = () => 7;
      const probe = async (input: {
        readonly deadlineMs: number;
        readonly now: () => number;
      }): Promise<HarnessVersionProbeOutcome> => {
        calls.push(input);
        if (row.reject) throw new Error("non-zero exit");
        return { status: "timed-out" };
      };
      const resolved = await resolveHarnessInstance({
        kind: "opencode",
        registrations: [registration],
        versionProbe: probe,
        now: clock,
      });
      expect(resolved.ok, row.id).toBe(true);
      if (!resolved.ok) continue;
      expect(calls, row.id).toHaveLength(1);
      expect(calls[0]?.deadlineMs, row.id).toBe(HARNESS_VERSION_PROBE_TIMEOUT_MS);
      expect(calls[0]?.now, row.id).toBe(clock);
      expect(resolved.value.versionVerdict, row.id).toBe("indeterminate");
      expect(resolved.value.observedVersion, row.id).toBeNull();
      expect(resolved.value.versionWarning, row.id).toBe("version-probe-failed");
    }
  });
});
