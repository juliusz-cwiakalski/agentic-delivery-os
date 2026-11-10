/**
 * GH-279 named-source refusal diagnostics (TC-CREDNAME-001..005, 007):
 * machine and human output carry the resolved key, the reference, and one
 * remediation; the value never appears; a prefixed reference reports its full
 * derived name; bounds hold. TC-CREDNAME-006 lives in the CLI edge seam suite.
 */
import { describe, expect, test } from "bun:test";
import { resolveCredentialSourceKey } from "../../packages/adapters/src/credentials/index";
import { resolveDispatchDivergenceEvidence } from "../../packages/core/src/app/dispatch-gate";
import { appendDispatchDivergence } from "../../packages/core/src/app/dispatch-ledger";
import type {
  DispatchDivergenceRecord,
  ExternalSystemInstance,
  StateStorePort,
} from "../../packages/core/src/contracts/index";
import { DISPATCH_NOW } from "../fixtures/dispatch/harness";
import { ADMISSION_CANARY, createAdmissionHarness } from "../fixtures/dispatch/admission";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { makeDivergence } from "../fixtures/dispatch/ledger";

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** The canary scanner shared by the positive and negative cases. */
const canaryHits = (haystack: readonly unknown[], canary: string): string[] =>
  haystack.flatMap((entry) =>
    (JSON.stringify(entry) ?? "").includes(canary) ? [String(entry)] : [],
  );

const prefixedInstance = (): ExternalSystemInstance => ({
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "tracker-read",
      sourceKey: { style: "environment-prefixed", suffix: "TRACKER_TOKEN" },
    },
  },
});

describe("TC-CREDNAME-001 machine and human refusals name the key and reference", () => {
  test("both modes carry the same bounded facts and one remediation", async () => {
    const harness = createAdmissionHarness({ credential: "missing", label: "gh279-name-" });
    try {
      const machine = await harness.run(["dispatch", "GH-301", "--json"]);
      const human = await harness.run(["dispatch", "GH-301"]);
      for (const [mode, output] of [
        ["machine", machine.stdout + machine.stderr],
        ["human", human.stderr],
      ] as const) {
        expect(output, mode).toContain("GITHUB_TOKEN");
        expect(output, mode).toContain("github-read");
        expect(output.toLowerCase(), mode).toContain("export");
      }
      expect(machine.stdout).not.toContain(ADMISSION_CANARY);
      expect(human.stdout + human.stderr).not.toContain(ADMISSION_CANARY);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CREDNAME-002 a prefixed reference reports the full derived key", () => {
  test("the full key appears and the bare suffix never does", async () => {
    const harness = createAdmissionHarness({
      credential: "missing",
      label: "gh279-prefixed-",
      githubInstance: prefixedInstance(),
    });
    try {
      const observed = await harness.run(["dispatch", "GH-301", "--json"]);
      const summary = observed.envelope?.error?.summary ?? "";
      const instance = prefixedInstance();
      const reference =
        instance.authMethod.mechanism === "credential-reference"
          ? instance.authMethod.reference
          : { referenceName: "tracker-read", sourceKey: { style: "literal" as const, name: "x" } };
      const fullKey = resolveCredentialSourceKey(reference, harness.brand);
      expect(fullKey).toBe(`${harness.brand.environmentPrefix}TRACKER_TOKEN`);
      expect(summary).toContain(fullKey);
      expect(summary).not.toMatch(/\bTRACKER_TOKEN\b/);
      expect(observed.exit).toBe(1);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CREDNAME-003 the planted canary never escapes any surface", () => {
  test("refusal, success, resolve failure, and divergence record are clean", async () => {
    const surfaces: unknown[] = [];
    const refusalHarness = createAdmissionHarness({
      credential: "missing",
      label: "gh279-canary-refusal-",
      environment: { GITHUB_TOKEN: ADMISSION_CANARY },
    });
    try {
      const refusal = await refusalHarness.run(["dispatch", "GH-301", "--json"]);
      surfaces.push(refusal.stdout, refusal.stderr, refusal.envelope);
    } finally {
      refusalHarness.dispose();
    }

    const successHarness = createAdmissionHarness({
      credential: "resolved",
      label: "gh279-canary-success-",
      environment: { GITHUB_TOKEN: ADMISSION_CANARY },
    });
    try {
      const success = await successHarness.run(["dispatch", "GH-301", "--json"]);
      surfaces.push(success.stdout, success.stderr, success.envelope, success.attempts);
    } finally {
      successHarness.dispose();
    }

    const failingStore = {
      readRecords: () => ({
        ok: false,
        error: { code: "state.lock.busy", location: { path: "state/diverge.log" } },
      }),
    } as unknown as StateStorePort;
    const resolveFailure = resolveDispatchDivergenceEvidence({
      store: failingStore,
      fenceToken: "fence",
      divergenceId: "DIV-1",
      note: "note",
      principal: "coder@local",
      nowIso: DISPATCH_NOW,
    });
    surfaces.push(resolveFailure);

    const scenario = createCommandScenario({ label: "gh279-canary-div" });
    try {
      const record: DispatchDivergenceRecord = makeDivergence({ divergenceId: "DIV-CANARY" });
      appendDispatchDivergence(scenario.state.store, scenario.state.fenceToken, record);
      surfaces.push(record);
    } finally {
      scenario.dispose();
    }

    expect(canaryHits(surfaces, ADMISSION_CANARY)).toEqual([]);
  });
});

describe("TC-CREDNAME-004 the canary detector fires on a deliberate leak", () => {
  test("the scanner reports a planted hit", () => {
    expect(canaryHits([{ summary: `leaked ${ADMISSION_CANARY}` }], ADMISSION_CANARY)).toHaveLength(
      1,
    );
  });
});

describe("TC-CREDNAME-005 refusal summary and last_message respect their bounds", () => {
  test("the summary is one bounded line and the derived last_message is bounded", async () => {
    const observed = await createAdmissionHarness({
      credential: "missing",
      label: "gh279-bounds-",
    }).run(["dispatch", "GH-301", "--json"]);
    const summary = observed.envelope?.error?.summary ?? "";
    expect(summary.length).toBeLessThanOrEqual(240);
    expect(summary).not.toContain("\n");
    expect(summary).toContain("GITHUB_TOKEN");
    expect(summary).toContain("github-read");

    const scenario = createCommandScenario({ label: "gh279-last-message-" });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const data = asRecord(run.envelope?.data);
      expect(String(data.lastMessage ?? "").length).toBeLessThanOrEqual(512);
    } finally {
      scenario.dispose();
    }
  });
});
