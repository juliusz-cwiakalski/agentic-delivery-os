/**
 * TC-SESS-001 / TC-SESS-003 — the commit surface runs inside a delivery session
 * under the primitive's normal safety and staging rules, and in-session versus
 * out-of-session behaviour is otherwise identical.
 */
import { describe, expect, test } from "bun:test";
import { withCommitHarness } from "../fixtures/commit/harness";
import {
  COMMIT_REF,
  commitCount,
  dataOf,
  errorCodeOf,
  head,
  seedDirtyTree,
  telemetryPayloads,
  transitionPayloads,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;
const SESSION = { insideDeliverySession: true, sessionId: "ses_fixture" } as const;

describe("TC-SESS-001 in-session commit lands under normal rules", () => {
  test("a dry run succeeds without landing", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const baselineCommits = commitCount(harness);
        const baselineHead = head(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const dry = await harness.runCommit([COMMIT_REF, "--dry-run"]);
        expect(dry.exitCode).toBe(0);
        expect(errorCodeOf(dry)).toBeUndefined();
        expect(dataOf(dry)).toMatchObject({ dryRun: true, messageSource: "model" });
        expect(commitCount(harness)).toBe(baselineCommits);
        expect(head(harness)).toBe(baselineHead);
        expect(telemetryPayloads(harness)).toEqual([]);
      },
      { seedFiles: SEED, sessionFacts: SESSION },
    );
  });

  test("a standalone commit lands and records telemetry", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const baselineCommits = commitCount(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const standalone = await harness.runCommit([COMMIT_REF]);
        expect(standalone.exitCode).toBe(0);
        const landed = dataOf(standalone);
        expect(errorCodeOf(standalone)).toBeUndefined();
        expect(landed.commitSha).toBe(head(harness));
        expect(commitCount(harness)).toBe(baselineCommits + 1);
        expect(telemetryPayloads(harness)).toHaveLength(1);
      },
      { seedFiles: SEED, sessionFacts: SESSION },
    );
  });

  test("a phase-centric commit lands one transition and one commit", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const baselineCommits = commitCount(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const phaseCentric = await harness.runCommit([COMMIT_REF, "--phase", "delivery"]);
        expect(phaseCentric.exitCode).toBe(0);
        expect(errorCodeOf(phaseCentric)).toBeUndefined();
        expect(dataOf(phaseCentric)).toMatchObject({ atomic: true });
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(commitCount(harness)).toBe(baselineCommits + 1);
      },
      { seedFiles: SEED, sessionFacts: SESSION },
    );
  });
});

describe("TC-SESS-003 in-session and out-of-session behaviour is identical", () => {
  test("only the injected session fact differs; the committed result does not", async () => {
    const compare = async (sessionFacts: {
      readonly insideDeliverySession: boolean;
      readonly sessionId?: string;
    }): Promise<Record<string, unknown>> => {
      let shape: Record<string, unknown> = {};
      await withCommitHarness(
        async (harness) => {
          seedDirtyTree(harness);
          harness.coreTransport.push({ kind: "success", message: validMessage() });
          const run = await harness.runCommit([COMMIT_REF]);
          expect(run.exitCode).toBe(0);
          const data = dataOf(run);
          shape = {
            subject: data.subject,
            stagedFiles: data.stagedFiles,
            messageSource: data.messageSource,
            transport: data.transport,
            atomic: data.atomic,
            excluded: data.excluded,
            safety: data.safety,
          };
        },
        { seedFiles: SEED, sessionFacts },
      );
      return shape;
    };

    const inSession = await compare(SESSION);
    const outOfSession = await compare({ insideDeliverySession: false });
    expect(inSession).toEqual(outOfSession);
  });
});
