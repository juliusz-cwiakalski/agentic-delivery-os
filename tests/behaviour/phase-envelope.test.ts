/**
 * TC-PHASE-008 — the phase surface's envelope and `{0,1,2}` exit projection
 * (NFR-2) plus TC-SYNC-007's write-path trigger half.
 *
 * `phase list` reads without mutating; the absent registry is an explicit
 * verified-empty success; every invocation class returns exactly one valid
 * envelope; user-category failures project to 1 and platform state failures
 * to 2.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import {
  ERROR_TABLE,
  type StateStoreIdentity,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import {
  appendPhaseTransition,
  phaseTransitionRecordKey,
} from "../../packages/core/src/state/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  ledgerPath,
  makeIdentity,
  openStore,
  removeRoot,
  withinFence,
} from "../fixtures/state/harness";
import { runDescriptor } from "../golden/helpers";
import {
  makePhaseRoot,
  PHASE_REF,
  type PhaseHarness,
  type PhaseRun,
  withPhaseHarness,
} from "./phase-support";
import { documentOf, loadPmNotes, mutated, readPmNotesFixture } from "./pm-notes-lint-support";

const ROOT = process.cwd();
const FULL = readFileSync(join(ROOT, "tests/fixtures/phase/full-open.yaml"), "utf8");
const MALFORMED = readPmNotesFixture("malformed/unparseable-orphaned-indentation.yaml.txt");

const errorOf = (run: PhaseRun): Record<string, unknown> => {
  const error = run.envelope?.error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    throw new Error("expected an error envelope");
  }
  return error as Record<string, unknown>;
};

const dataOf = (run: PhaseRun): Record<string, unknown> => {
  const data = run.envelope?.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected success data");
  }
  return data as Record<string, unknown>;
};

const seedTransition = (store: StateStorePort): void => {
  const appended = appendPhaseTransition(store, {
    changeRef: PHASE_REF,
    phaseId: "delivery",
    operation: "complete",
    timestamp: "2026-10-31T10:00:00Z",
    fenceToken: "envelope-seed",
  });
  if (!appended.ok) throw new Error(`seed failed: ${appended.error.code}`);
};

type StateSetup = {
  readonly level?: "local" | "project";
  readonly prepare?: (identity: StateStoreIdentity, store: StateStorePort) => void;
};

const withStateHarness = async (
  label: string,
  setup: StateSetup,
  body: (harness: PhaseHarness) => Promise<void>,
  fixtureText: string = FULL,
): Promise<void> => {
  const stateRoot = makePhaseRoot(`envelope-state-${label}`);
  try {
    const identity = makeIdentity(join(stateRoot, "state"), {
      workspaceId: "phase-fixture",
      ...(setup.level === undefined ? {} : { level: setup.level }),
    });
    const { store } = openStore(identity);
    setup.prepare?.(identity, store);
    await withPhaseHarness(fixtureText, body, label, undefined, { state: { identity, store } });
  } finally {
    removeRoot(stateRoot);
  }
};

const textFrom = (
  base: ReturnType<typeof loadPmNotes>,
  mutate: (document: Record<string, unknown>) => void,
): string => stringify(documentOf(mutated(base, "planted-payload-envelope-0001", mutate)));

describe("TC-PHASE-008 phase list", () => {
  test("a populated registry lists the derived state and mutates nothing", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const landed = await harness.run(["complete", PHASE_REF, "delivery"]);
        expect(landed.exitCode).toBe(0);
        const before = harness.rawLedgerLines().length;

        const run = await harness.run(["list", PHASE_REF]);
        expect(run.exitCode).toBe(0);
        expect(assertEnvelopeContract(run.envelope)).toEqual([]);
        const data = dataOf(run);
        expect(data).toMatchObject({
          schemaVersion: "delivery.registry.v1",
          verifiedEmpty: false,
          phases: { delivery: { completed: dataOf(landed).timestamp } },
        });
        expect(harness.rawLedgerLines().length).toBe(before);
      },
      "list-populated",
    );
  });

  test("an absent registry is a verified-empty success with explicit evidence", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const run = await harness.run(["list", PHASE_REF]);
        expect(run.exitCode).toBe(0);
        expect(assertEnvelopeContract(run.envelope)).toEqual([]);
        const data = dataOf(run);
        expect(data.verifiedEmpty).toBe(true);
        expect(data.phases).toEqual({});
        expect(data.evidence).toMatchObject({ class: "verified-empty", target: "registry" });
        expect(harness.rawLedgerLines()).toEqual([]);
      },
      "list-empty",
    );
  });
});

describe("TC-PHASE-008 success and failure envelopes in both modes", () => {
  test("success is one valid envelope in json mode and the same exit in human mode", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const json = await harness.run(["complete", PHASE_REF, "delivery"]);
        expect(json.exitCode).toBe(0);
        expect(assertEnvelopeContract(json.envelope)).toEqual([]);

        const human = await harness.run(["list", PHASE_REF], { json: false });
        expect(human.exitCode).toBe(0);
        expect(human.stderr).toBe("");
        expect(human.stdout).toContain("delivery.registry.v1");
        expect(human.stdout).not.toContain('"error"');
      },
      "mode-success",
    );
  });

  test("input.value.rejected is one envelope at exit 1 in both modes", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const json = await harness.run(["reopen", PHASE_REF, "delivery"]);
        expect(json.exitCode).toBe(1);
        expect(assertEnvelopeContract(json.envelope)).toEqual([]);
        expect(json.envelope?.data).toBeUndefined();
        expect(errorOf(json)).toMatchObject({
          code: "input.value.rejected",
          category: "user",
          retryable: false,
          consequence: "not_landed",
        });

        const human = await harness.run(["reopen", PHASE_REF, "delivery"], { json: false });
        expect(human.exitCode).toBe(1);
        expect(human.stdout).toBe("");
        expect(human.stderr).toContain("input.value.rejected");
      },
      "mode-input",
    );
  });

  test("a lint failure is one envelope at exit 1 in both modes", async () => {
    await withPhaseHarness(
      MALFORMED,
      async (harness) => {
        const json = await harness.run(["complete", PHASE_REF, "delivery"]);
        expect(json.exitCode).toBe(1);
        expect(assertEnvelopeContract(json.envelope)).toEqual([]);
        expect(errorOf(json)).toMatchObject({
          code: "lint.notes.malformed",
          category: "user",
          consequence: "not_landed",
        });

        const human = await harness.run(["complete", PHASE_REF, "delivery"], { json: false });
        expect(human.exitCode).toBe(1);
        expect(human.stdout).toBe("");
        expect(human.stderr).toContain("lint.notes.malformed");
      },
      "mode-lint",
    );
  });
});

describe("TC-PHASE-008 exit projection matrix", () => {
  test("success 0, user failures 1, platform state failures 2, nothing else", async () => {
    const exits: number[] = [];

    await withPhaseHarness(
      FULL,
      async (harness) => {
        exits.push((await harness.run(["list", PHASE_REF])).exitCode);
        exits.push((await harness.run(["reopen", PHASE_REF, "delivery"])).exitCode);
      },
      "exits-user",
    );

    await withPhaseHarness(
      MALFORMED,
      async (harness) => {
        exits.push((await harness.run(["complete", PHASE_REF, "delivery"])).exitCode);
      },
      "exits-lint",
    );

    await withPhaseHarness(
      FULL,
      async (harness) => {
        exits.push((await harness.run(["complete", PHASE_REF, "delivery"])).exitCode);
      },
      "exits-success",
      undefined,
      { omitTarget: true },
    );

    // User-category state failure: an unsupported level projects to 1.
    await withStateHarness("user-state", { level: "project" }, async (harness) => {
      const run = await harness.run(["list", PHASE_REF]);
      expect(run.exitCode).toBe(1);
      expect(errorOf(run)).toMatchObject({ code: "state.level.unsupported", category: "user" });
      exits.push(run.exitCode);
    });

    // Platform state failures read through `phase list`: torn, schema, keys.
    await withStateHarness(
      "torn",
      {
        prepare: (identity, store) => {
          seedTransition(store);
          const path = ledgerPath(identity);
          writeFileSync(path, readFileSync(path, "utf8").replace('"sequence":1', '"sequence":9'));
        },
      },
      async (harness) => {
        const run = await harness.run(["list", PHASE_REF]);
        expect(run.exitCode).toBe(2);
        expect(errorOf(run)).toMatchObject({ code: "state.store.torn" });
        exits.push(run.exitCode);
      },
    );

    await withStateHarness(
      "schema",
      {
        prepare: (identity) => {
          mkdirSync(identity.stateDirectory, { recursive: true });
          writeFileSync(
            join(identity.stateDirectory, `header.${identity.workspaceId}.json`),
            `${JSON.stringify({ schemaVersion: "delivery.state.v0" })}\n`,
          );
        },
      },
      async (harness) => {
        const run = await harness.run(["list", PHASE_REF]);
        expect(run.exitCode).toBe(2);
        expect(errorOf(run)).toMatchObject({ code: "state.schema.mismatch" });
        exits.push(run.exitCode);
      },
    );

    await withStateHarness(
      "keys",
      {
        prepare: (_identity, store) => {
          withinFence(store, "envelope-keys", (handle) => {
            const appended = store.append(handle, {
              kind: "phase.transition",
              recordKey: phaseTransitionRecordKey(PHASE_REF),
              payload: {
                transitions: [
                  {
                    changeRef: PHASE_REF,
                    operation: "complete",
                    timestamp: "2026-10-31T10:00:00Z",
                    outcome: "landed",
                  },
                ],
              },
            });
            if (!appended.ok) throw new Error(`keys seed failed: ${appended.error.code}`);
          });
        },
      },
      async (harness) => {
        const run = await harness.run(["list", PHASE_REF]);
        expect(run.exitCode).toBe(2);
        expect(errorOf(run)).toMatchObject({ code: "state.keys.missing" });
        exits.push(run.exitCode);
      },
    );

    expect(new Set(exits)).toEqual(new Set([0, 1, 2]));
    for (const exit of exits) expect([0, 1, 2]).toContain(exit);
  });

  test("the unknown command/flag path still returns fallback.invocation", async () => {
    const result = await runDescriptor(
      "ok-data",
      ["--json", "synthetic.missing"],
      [1, 2],
      "run-envelope-unknown",
    );
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: { code: "fallback.invocation" },
    });
  });
});

describe("TC-SYNC-007 write-path lint identities round-trip", () => {
  const missingDeliveryMode = (): string =>
    textFrom(loadPmNotes("valid/full-complete.yaml"), (document) => {
      delete document.delivery_mode;
    });
  const unknownVariant = (): string =>
    textFrom(loadPmNotes("valid/full-complete.yaml"), (document) => {
      document.variant = "compressed";
    });
  const liteMissingPhase = (): string =>
    textFrom(loadPmNotes("valid/lite-six.yaml"), (document) => {
      delete (document.phases as Record<string, unknown>).quality_gates;
    });

  const documented = (code: string): Record<string, unknown> => {
    const entry = (ERROR_TABLE as readonly Record<string, unknown>[]).find(
      (candidate) => candidate.code === code,
    );
    if (entry === undefined) throw new Error(`no documented row for ${code}`);
    return {
      code: entry.code,
      category: entry.category,
      retryable: entry.retryable,
      consequence: entry.consequence,
      remediationHint: entry.remediationHint,
    };
  };

  const cases: readonly {
    readonly code: string;
    readonly text?: string;
    readonly target: string;
    readonly omitTarget?: boolean;
  }[] = [
    { code: "lint.notes.malformed", text: MALFORMED, target: "delivery" },
    { code: "lint.keys.missing", text: missingDeliveryMode(), target: "delivery" },
    { code: "lint.variant.unknown", text: unknownVariant(), target: "delivery" },
    { code: "lint.phases.incomplete", text: liteMissingPhase(), target: "delivery" },
    { code: "lint.target.missing", target: "delivery", omitTarget: true },
  ];

  test("each of the five pins is triggered by the write path with documented fields", async () => {
    const observed: string[] = [];
    for (const entry of cases) {
      await withPhaseHarness(
        entry.text ?? MALFORMED,
        async (harness) => {
          const run = await harness.run(["complete", PHASE_REF, entry.target]);
          expect(run.exitCode).toBe(1);
          expect(assertEnvelopeContract(run.envelope)).toEqual([]);
          expect(errorOf(run)).toMatchObject(documented(entry.code));
          observed.push(String(errorOf(run).code));
          expect(harness.rawLedgerLines()).toEqual([]);
        },
        `sync-${entry.code}`,
        undefined,
        entry.omitTarget === true ? { omitTarget: true } : {},
      );
    }
    expect(observed.sort()).toEqual(
      [
        "lint.notes.malformed",
        "lint.keys.missing",
        "lint.variant.unknown",
        "lint.phases.incomplete",
        "lint.target.missing",
      ].sort(),
    );
  });
});
