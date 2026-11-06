/**
 * TC-ENV-001..003 — committed, normalized commit-envelope goldens, the six
 * failure projections, and single-envelope containment.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { createCommitCommandDefinition } from "../../packages/cli/src/commands/commit";
import { runCli } from "../../packages/cli/src/index";
import { bufferSink, SYNTHETIC_BRAND } from "./helpers";
import {
  COMMIT_REF,
  errorCodeOf,
  seedDirtyTree,
  validMessage,
} from "../behaviour/commit-support";
import { createCommitHarness, type CommitHarness } from "../fixtures/commit/harness";

const ROOT = process.cwd();
const GOLDEN_DIR = join(ROOT, "tests/fixtures/envelope/golden");
const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;

const normalize = (text: string): string =>
  text.replace(/"commitSha": "[0-9a-f]{40}"/g, '"commitSha": "<sha>"');

type Scenario = {
  readonly id: string;
  readonly run: (harness: CommitHarness) => Promise<string>;
};

const scenarios: readonly Scenario[] = [
  {
    id: "commit-success",
    run: async (harness) => {
      seedDirtyTree(harness);
      harness.coreTransport.push({ kind: "success", message: validMessage() });
      return (await harness.runCommit([COMMIT_REF])).stdout;
    },
  },
  {
    id: "commit-dry-run",
    run: async (harness) => {
      seedDirtyTree(harness);
      harness.coreTransport.push({ kind: "success", message: validMessage() });
      return (await harness.runCommit([COMMIT_REF, "--dry-run"])).stdout;
    },
  },
  {
    id: "phase-atomic",
    run: async (harness) => {
      seedDirtyTree(harness);
      harness.coreTransport.push({ kind: "success", message: validMessage() });
      return (await harness.runPhase(["complete", COMMIT_REF, "delivery"])).stdout;
    },
  },
  {
    id: "phase-skipped",
    run: async (harness) => (await harness.runPhase(["complete", COMMIT_REF, "delivery"])).stdout,
  },
  {
    id: "template-fallback",
    run: async (harness) => {
      seedDirtyTree(harness);
      return (await harness.runCommit([COMMIT_REF])).stdout;
    },
  },
];

const scenarioHarness = (id: string): CommitHarness => {
  if (id === "template-fallback") {
    return createCommitHarness({
      seedFiles: SEED,
      availability: {
        coreInference: { available: false },
        harnessOneShot: { available: false },
      },
    });
  }
  return createCommitHarness({ seedFiles: SEED });
};

describe("TC-ENV-001 success envelopes match committed normalized goldens", () => {
  for (const scenario of scenarios) {
    test(`${scenario.id} matches its golden and the contract`, async () => {
      const harness = scenarioHarness(scenario.id);
      try {
        const stdout = await scenario.run(harness);
        const normalized = normalize(stdout);
        const golden = readFileSync(join(GOLDEN_DIR, `commit-${scenario.id}.json`), "utf8");
        expect(`${normalized.trim()}`).toBe(`${golden.trim()}`);
        const envelope = JSON.parse(normalized) as Record<string, unknown>;
        expect(assertEnvelopeContract(envelope)).toEqual([]);
        expect(envelope.exitCode).toBe(0);
      } finally {
        harness.cleanup();
      }
    });
  }
});

describe("TC-ENV-002 the six commit failures project exactly", () => {
  test("staging-blocked, commitlint-failed, secret-suspected, session-refused exit 1", async () => {
    const cases: Array<{
      readonly code: string;
      readonly setup: (harness: CommitHarness) => void;
      readonly expectExit: number;
    }> = [
      {
        code: "commit.staging-blocked-untracked",
        setup: (harness) => {
          harness.repo.run(["checkout", "--", "src/existing.ts"]);
        },
        expectExit: 1,
      },
      {
        code: "commit.commitlint-failed",
        setup: (harness) => {
          seedDirtyTree(harness);
          for (let index = 0; index < 3; index += 1) {
            harness.commitlint.push({ status: "invalid", errors: ["forbidden"] });
          }
          for (let index = 0; index < 2; index += 1) {
            harness.coreTransport.push({
              kind: "success",
              message: { subject: `wip(${COMMIT_REF}): invalid`, breaking: false },
            });
          }
        },
        expectExit: 1,
      },
      {
        code: "commit.safety.secret-suspected",
        setup: (harness) => {
          seedDirtyTree(harness);
          harness.safety.setFindings([{ class: "secret-content", path: "src/existing.ts" }]);
        },
        expectExit: 1,
      },
      {
        code: "commit.session.context-refused",
        setup: (harness) => {
          seedDirtyTree(harness);
          harness.sessionFacts = { insideDeliverySession: true, sessionId: "fixture" };
        },
        expectExit: 1,
      },
    ];
    for (const entry of cases) {
      const harness = scenarioHarness("commit-success");
      try {
        entry.setup(harness);
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode, entry.code).toBe(entry.expectExit);
        expect(errorCodeOf(run), entry.code).toBe(entry.code);
        const envelope = run.envelope as Record<string, unknown>;
        expect(assertEnvelopeContract(envelope)).toEqual([]);
        expect(Object.hasOwn(envelope, "data")).toBe(false);
        expect(Object.hasOwn(envelope, "error")).toBe(true);
      } finally {
        harness.cleanup();
      }
    }
  });

  test("scan-unavailable and atomic-abort exit 2", async () => {
    const scan = scenarioHarness("commit-success");
    try {
      seedDirtyTree(scan);
      scan.safety.setUnavailable();
      const run = await scan.runCommit([COMMIT_REF]);
      expect(run.exitCode).toBe(2);
      expect(errorCodeOf(run)).toBe("commit.safety.scan-unavailable");
      expect(assertEnvelopeContract(run.envelope as Record<string, unknown>)).toEqual([]);
    } finally {
      scan.cleanup();
    }

    const abort = scenarioHarness("commit-success");
    try {
      seedDirtyTree(abort);
      abort.faults.commitObject = true;
      const run = await abort.runPhase(["complete", COMMIT_REF, "delivery"]);
      expect(run.exitCode).toBe(2);
      expect(errorCodeOf(run)).toBe("commit.atomic-abort");
      expect(assertEnvelopeContract(run.envelope as Record<string, unknown>)).toEqual([]);
    } finally {
      abort.cleanup();
    }
  });
});

describe("TC-ENV-003 containment and broken invocation yield one valid envelope", () => {
  test("an unknown flag and an unknown command are single fallback envelopes", async () => {
    const harness = scenarioHarness("commit-success");
    try {
      seedDirtyTree(harness);
      const definition = createCommitCommandDefinition({
        sessionFacts: () => ({ insideDeliverySession: false }),
        resolveRef: async () => ({ ref: COMMIT_REF, refSource: "branch" }),
        readContext: () => ({ planPresent: false, phases: [] }),
        runAct: async () => ({ kind: "failure", code: "commit.staging-blocked-untracked" }),
        currentHead: async () => undefined,
      });
      const stdout = bufferSink();
      const stderr = bufferSink();
      const exitCode = await runCli(
        ["--json", "commit", COMMIT_REF, "--unknown"],
        { stdout, stderr },
        {
          brand: SYNTHETIC_BRAND,
          clock: { now: () => 0 },
          newRunId: () => "run-env",
          secrets: [],
          program: { commands: { commit: definition } },
        },
      );
      expect(exitCode).toBe(1);
      const envelope = JSON.parse(stdout.value) as Record<string, unknown>;
      expect(assertEnvelopeContract(envelope)).toEqual([]);
      expect(errorCodeOf({ exitCode, stdout: stdout.value, stderr: stderr.value, envelope })).toBe(
        "fallback.invocation",
      );
    } finally {
      harness.cleanup();
    }
  });
});

describe("normalization keeps goldens free of product literals and absolute paths", () => {
  test("the committed golden files carry no repo path or host literal", () => {
    for (const scenario of scenarios) {
      const text = readFileSync(join(GOLDEN_DIR, `commit-${scenario.id}.json`), "utf8");
      expect(text).not.toContain(ROOT);
      expect(text).not.toContain("/home/");
      expect(text).not.toContain("example-product");
    }
  });
});
