/**
 * GH-279 admission preflight (TC-ADMIT-001..010): a credential refusal is a
 * pre-session refusal with zero spawns, zero resumes, zero leases, and zero
 * attempts; the production composition supplies the port; a direct caller that
 * omits it keeps the delivered order.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchDivergences, readDispatchHandover } from "../../packages/core/src/app/dispatch-ledger";
import { runAdmission } from "../fixtures/dispatch/admission";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { readFail } from "../fixtures/dispatch/truth";

const REFUSAL_SUMMARY =
  'credential key GITHUB_TOKEN is unset (reference github-read); export GITHUB_TOKEN="$(gh auth token)" or configure a credential reference';

const refusingPreflight = () => ({
  ok: false as const,
  error: {
    kind: "config" as const,
    code: "config.credential.missing",
    summary: REFUSAL_SUMMARY,
    trustedRefusal: true as const,
  },
});

describe("TC-ADMIT-001 a missing credential refuses pre-session with a named key", () => {
  test("the production composer yields config.credential.missing at exit 1 with zero side effects", async () => {
    const observed = await runAdmission({ credential: "missing" });
    expect(observed.exit).toBe(1);
    expect(observed.envelope?.error?.code).toBe("config.credential.missing");
    expect(observed.envelope?.error?.summary).toContain("GITHUB_TOKEN");
    expect(observed.envelope?.error?.summary).toContain("github-read");
    expect(observed.envelope?.error?.remediationHint).toBeDefined();
    expect(observed.spawns).toBe(0);
    expect(observed.resumes).toBe(0);
    expect(observed.requests).toEqual([]);
    expect(observed.attempts).toEqual([]);
  });
});

describe("TC-ADMIT-002 a pre-session refusal leaves zero dispatch side effects", () => {
  test("zero leases, attempts, divergences, and handovers", async () => {
    const scenario = createCommandScenario({ preflight: async () => refusingPreflight() });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.error?.code).toBe("config.credential.missing");
      expect(scenario.calls.claims).toEqual([]);
      expect(scenario.calls.releases).toEqual([]);
      expect(scenario.scripted.calls.filter((call) => call === "spawn")).toEqual([]);
      expect(scenario.scripted.calls.filter((call) => call === "resume")).toEqual([]);
      const divergences = readDispatchDivergences(scenario.state.store);
      expect(divergences.ok).toBe(true);
      if (divergences.ok) expect(divergences.records).toEqual([]);
      const handover = readDispatchHandover(scenario.state.store);
      expect(handover.ok).toBe(true);
      if (handover.ok) expect(handover.records).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-ADMIT-003 an input refusal precedes the preflight", () => {
  test("a malformed ref and an unknown harness never invoke the port", async () => {
    let invocations = 0;
    const scenario = createCommandScenario({
      preflight: async () => {
        invocations += 1;
        return refusingPreflight();
      },
    });
    try {
      const malformed = await scenario.invoke(["dispatch", "GH-301-extra", "--json"]);
      expect(malformed.exit).toBe(1);
      expect(malformed.envelope?.error?.code).toBe("input.value.rejected");
      const unknownHarness = await scenario.invoke([
        "dispatch",
        "GH-301",
        "--harness",
        "unknown",
        "--json",
      ]);
      expect(unknownHarness.exit).toBe(1);
      expect(unknownHarness.envelope?.error?.code).toBe("input.value.rejected");
      expect(invocations).toBe(0);
      expect(scenario.scripted.calls.filter((call) => call === "spawn")).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-ADMIT-004 a provisioned credential reaches a real verdict", () => {
  test("the derived token is not state-unverified and exactly one attempt lands", async () => {
    const observed = await runAdmission({ credential: "resolved" });
    expect([0, 1]).toContain(observed.exit);
    expect(observed.envelope?.data?.result).toBeDefined();
    expect(observed.envelope?.data?.result).not.toBe("state-unverified");
    expect(observed.attempts).toHaveLength(1);
    expect(observed.spawns).toBe(1);
    expect(observed.requests.some((url) => url.includes("/issues/301"))).toBe(true);
  });
});

describe("TC-ADMIT-007 a resume is refused identically", () => {
  test("a refusing credential port refuses before any resume", async () => {
    const scenario = createCommandScenario({
      lane: { completedPhases: ["clarify_scope"], adapterSupportsResumeInjection: false },
      preflight: async () => refusingPreflight(),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--resume-prompt", "go", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.error?.code).toBe("config.credential.missing");
      expect(scenario.calls.claims).toEqual([]);
      expect(scenario.scripted.calls.filter((call) => call === "resume")).toEqual([]);
      expect(scenario.scripted.calls.filter((call) => call === "spawn")).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-ADMIT-008 a direct caller without the preflight keeps the delivered order", () => {
  test("one spawn and the delivered state-unverified outcome", async () => {
    const scenario = createCommandScenario({
      reads: readsFrom({ tracker: readFail("tracker", "config.credential.missing") }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(2);
      expect(run.envelope?.data?.result).toBe("state-unverified");
      expect(scenario.scripted.calls.filter((call) => call === "spawn")).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-ADMIT-009 missing-credential refusal latency and request count", () => {
  test("zero requests, one credential resolution, under two seconds", async () => {
    const started = Date.now();
    const observed = await runAdmission({ credential: "missing", label: "gh279-latency-" });
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(2000);
    expect(observed.requests).toEqual([]);
    expect(observed.credentialResolutions).toBe(1);
  });

  test("identical injected inputs produce byte-identical refusal envelopes", async () => {
    const first = await runAdmission({ credential: "missing", label: "gh279-det-a-" });
    const second = await runAdmission({ credential: "missing", label: "gh279-det-b-" });
    expect(second.stdout).toBe(first.stdout);
  });
});

describe("TC-REG-001 refusal determinism (admission half)", () => {
  test("the machine envelope is stable across runs", async () => {
    const first = await runAdmission({ credential: "missing", label: "gh279-reg-adm-a-" });
    const second = await runAdmission({ credential: "missing", label: "gh279-reg-adm-b-" });
    expect(JSON.stringify(second.envelope)).toBe(JSON.stringify(first.envelope));
  });
});
