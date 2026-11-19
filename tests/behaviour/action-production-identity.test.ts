/**
 * Review iteration 1 F-1 — the production composition generates distinct action
 * identities across separate one-shot invocations.
 *
 * Every delivered action suite injects `newActionId`, so no suite can observe
 * whether the production composition wires that seam at all. This suite
 * deliberately injects NO id factory: it composes the production program twice
 * (two fresh runtimes, the shape of two separate CLI processes) against one
 * temp state root, files one action per composition, and asserts the stored
 * identities are distinct with no duplicate list rows.
 */
import { describe, expect, test } from "bun:test";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { createProductionComposer } from "../../packages/cli/src/production";
import { makeTempRoot, removeRoot } from "../fixtures/state/harness";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const FILED_MS = Date.UTC(2026, 10, 16, 12, 0, 0);

/** One filing invocation: every contract member present, ids left unwired. */
const FILE_ARGV = [
  "retro",
  "action",
  "file",
  "--owner",
  "agent-role:reviewer",
  "--owner-kind",
  "agent-role",
  "--verb",
  "add",
  "--outcome",
  "the identity regression proves distinct registry identities",
  "--tracker",
  "GH-287",
  "--due",
  "2026-11-30T00:00:00Z",
  "--artifact",
  "artifact:tests/behaviour/action-production-identity.test.ts",
  "--outcome-evidence",
  "metric:duplicate-identity-count",
  "--outcome-window",
  "2026-12-01T00:00:00Z..2026-12-15T00:00:00Z",
  "--rollback",
  "revert the identity wiring when the duplicate count is non-zero",
  "--window",
  "window-a",
  "--json",
] as const;

const LIST_ARGV = ["retro", "action", "list", "--json"] as const;

type Invocation = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

/**
 * Compose the production program afresh and run one invocation against the
 * shared temp root. A fresh composer is the in-process shape of a fresh CLI
 * process: no id factory, no shared runtime state.
 */
const invokeInFreshComposition = async (
  root: string,
  argv: readonly string[],
  runId: string,
): Promise<Invocation> => {
  const composer = createProductionComposer({
    harnessVersionProbe: async () => ({ status: "answered" as const, stdout: "opencode v2.3.2" }),
    environment: { HOME: root, PATH: "/usr/bin" },
    cwd: root,
    homeDirectory: root,
    workingName: SYNTHETIC_BRAND.binaryName,
  });
  const stdout = bufferSink();
  const stderr = bufferSink();
  const exitCode = await runEntrypoint(argv, {
    streams: { stdout, stderr },
    environment: { HOME: root },
    configuredWorkingName: SYNTHETIC_BRAND.binaryName,
    composeProgram: composer,
    clock: { now: () => FILED_MS },
    newRunId: () => runId,
  });
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

const filedIdentity = (invocation: Invocation): string => {
  const envelope = JSON.parse(invocation.stdout) as {
    readonly data?: { readonly actionId?: unknown };
  };
  const actionId = envelope.data?.actionId;
  if (typeof actionId !== "string") {
    throw new Error(`filing returned no data.actionId: ${invocation.stdout}`);
  }
  return actionId;
};

type ListedAction = { readonly actionId?: unknown };

const listedRows = (invocation: Invocation): readonly ListedAction[] => {
  const envelope = JSON.parse(invocation.stdout) as {
    readonly data?: { readonly actions?: readonly ListedAction[] };
  };
  return envelope.data?.actions ?? [];
};

describe("review-iter-1 F-1 production action identities", () => {
  test("two fresh production compositions file actions under distinct stored identities", async () => {
    const root = makeTempRoot("action-production-identity");
    try {
      const first = await invokeInFreshComposition(root, FILE_ARGV, "run-identity-a");
      const second = await invokeInFreshComposition(root, FILE_ARGV, "run-identity-b");
      expect(first.exitCode).toBe(0);
      expect(second.exitCode).toBe(0);

      const firstId = filedIdentity(first);
      const secondId = filedIdentity(second);
      expect(firstId).not.toBe(secondId);

      const listed = await invokeInFreshComposition(root, LIST_ARGV, "run-identity-list");
      expect(listed.exitCode).toBe(0);
      const rows = listedRows(listed);
      const ids = rows.map((row) => row.actionId);
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual([firstId, secondId].sort());
    } finally {
      removeRoot(root);
    }
  });
});
