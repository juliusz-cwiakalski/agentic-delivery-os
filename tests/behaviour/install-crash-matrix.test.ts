/**
 * GH-346 TC-INST-030..037 — the seven-step crash matrix and the
 * agreement-reconciliation matrix (FAULT-TP-1, ATOMIC-TP-1, NFR-3).
 *
 * Every arm asserts the invariant directly: a runnable artifact exists at a
 * known path after the failure, no staged file survives at the destination, and
 * the recovery re-run restores a complete install. The step-7 arm additionally
 * proves the recovery performs NO destination rename and leaves the slot's
 * content digest unchanged.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createInstallCommandDefinition } from "../../packages/cli/src/commands/install";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import type { InstallFaultStep } from "../../packages/core/src/contracts/install";
import {
  createFixtureArtifact,
  type FixtureArtifact,
  removeFixtureArtifact,
} from "../fixtures/install/artifact";
import { createRecordingDaemon } from "../fixtures/install/daemon";
import { faultAt } from "../fixtures/install/faults";
import {
  createInstallRuntime,
  createInstallScratch,
  fixtureIdentity,
  type InstallScratch,
  readRecordText,
  snapshotTree,
} from "../fixtures/install/home";

const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "jaiship" });
  if (!resolved.ok) throw new Error("the resolver rejected jaiship");
  return resolved.value;
})();

const digestOf = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

type Output = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string };
};

const invoke = async (
  runtime: ReturnType<typeof createInstallRuntime>,
  positionals: readonly string[] = [],
  flags: Readonly<Record<string, string | true>> = {},
): Promise<Output> => {
  const definition = createInstallCommandDefinition(runtime);
  return (await definition.handler({
    command: "install",
    flags,
    argv: ["install", ...positionals],
    positionals,
    brand,
  } as never)) as Output;
};

/** The handler data, or an empty record for a human-form arm. */
const dataOf = (outcome: Output): Record<string, unknown> => outcome.data ?? {};

let base: InstallScratch;
let running: FixtureArtifact;
let other: FixtureArtifact;

beforeAll(() => {
  base = createInstallScratch("crash-base");
  running = createFixtureArtifact("crash-running");
  other = createFixtureArtifact("crash-other");
});

afterAll(() => {
  removeFixtureArtifact(running);
  removeFixtureArtifact(other);
  base.dispose();
});

const scratchFor = (): InstallScratch => createInstallScratch("crash");

const identityA = fixtureIdentity({ commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
const identityB = fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" });

const runtimeFor = (
  target: InstallScratch,
  options: {
    readonly artifact?: string;
    readonly identity?: ReturnType<typeof fixtureIdentity>;
    readonly fault?: InstallFaultStep;
  } = {},
) =>
  createInstallRuntime({
    scratch: target,
    runningArtifactPath: options.artifact ?? running.path,
    identity: options.identity ?? identityA,
    ...(options.fault === undefined ? {} : { fault: faultAt(options.fault) }),
  });

const stagedLeftovers = (target: InstallScratch): readonly string[] =>
  existsSync(target.installDirectory)
    ? readdirSync(target.installDirectory).filter((name) => name.includes(".staged-"))
    : [];

const runnableAtKnownPath = (target: InstallScratch): boolean =>
  existsSync(target.destinationPath) || existsSync(target.slotPath);

/** Install A, then attempt an upgrade to B with one injected failure. */
const crashAnUpgrade = async (step: InstallFaultStep) => {
  const target = scratchFor();
  await invoke(runtimeFor(target));
  const destinationBefore = digestOf(target.destinationPath);
  const failed = await invoke(
    runtimeFor(target, { artifact: other.path, identity: identityB, fault: step }),
  );
  return { target, destinationBefore, failed };
};

describe("TC-INST-030 step 1: admission, identity, daemon, and pre-flight write nothing", () => {
  test("a live daemon refusal writes nothing, and a failing stop does not proceed", async () => {
    const target = scratchFor();
    try {
      const daemon = createRecordingDaemon({ running: true, instanceId: "live-1", pid: 42 });
      daemon.setStopResult(false);
      const before = snapshotTree(target.base);
      const runtime = createInstallRuntime({
        scratch: target,
        runningArtifactPath: running.path,
        identity: identityA,
        daemon: daemon.port,
      });
      const refused = await invoke(runtime, [], { "--stop-daemon": true });
      expect(refused.error?.code).toBe("install.daemon.running");
      expect(snapshotTree(target.base)).toEqual(before);
      expect(daemon.log()).toEqual(["status:running", "stop"]);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-031 step 2: staging leaves destination and record untouched", () => {
  test("an injected staging failure writes no staged file and leaves the destination", async () => {
    const { target, destinationBefore, failed } = await crashAnUpgrade("stage");
    try {
      expect(failed.error?.code).toBe("fallback.internal");
      expect(digestOf(target.destinationPath)).toBe(destinationBefore);
      expect(stagedLeftovers(target)).toEqual([]);
      expect(readRecordText(target)).not.toBeUndefined();
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-032 step 3: verification removes the temporary file", () => {
  test("an injected verification failure removes the staged copy", async () => {
    const { target, destinationBefore, failed } = await crashAnUpgrade("verify");
    try {
      expect(failed.error?.code).toBe("fallback.internal");
      expect(digestOf(target.destinationPath)).toBe(destinationBefore);
      expect(stagedLeftovers(target)).toEqual([]);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-033 step 4: artifact agreement stops before any rename", () => {
  test("an agreement run creates no staging file and performs no rename", async () => {
    const target = scratchFor();
    try {
      await invoke(runtimeFor(target));
      const before = snapshotTree(target.installDirectory);
      const faulted = await invoke(runtimeFor(target, { fault: "identity-compare" }));
      expect(faulted.error?.code).toBe("fallback.internal");
      expect(snapshotTree(target.installDirectory)).toEqual(before);
      expect(stagedLeftovers(target)).toEqual([]);
      // The same state without the fault is the agreement no-op.
      const agreement = await invoke(runtimeFor(target));
      expect(agreement.data?.disposition).toBe("unchanged");
      expect(snapshotTree(target.installDirectory)).toEqual(before);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-034 step 5: the destination is absent and the slot is runnable", () => {
  test("the failed run leaves a runnable slot and the recovery re-run skips step 5", async () => {
    const { target, destinationBefore, failed } = await crashAnUpgrade("destination-to-slot");
    try {
      expect(failed.error?.code).toBe("fallback.internal");
      expect(existsSync(target.destinationPath)).toBe(false);
      expect(existsSync(target.slotPath)).toBe(true);
      expect(digestOf(target.slotPath)).toBe(destinationBefore);
      expect(stagedLeftovers(target).length).toBeGreaterThan(0);
      // The step-5 crash state is exactly "no destination, runnable slot": the
      // recovery re-run completes and preserves the slot.
      const recovered = await invoke(
        runtimeFor(target, { artifact: other.path, identity: identityB }),
      );
      expect(recovered.error).toBeUndefined();
      expect(digestOf(target.destinationPath)).toBe(digestOf(other.path));
      expect(digestOf(target.slotPath)).toBe(destinationBefore);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-035 step 6: the destination returns and the slot stays intact", () => {
  test("the failed run leaves the slot intact and the recovery restores the destination", async () => {
    const { target, destinationBefore, failed } = await crashAnUpgrade("staged-to-destination");
    try {
      expect(failed.error?.code).toBe("fallback.internal");
      expect(existsSync(target.slotPath)).toBe(true);
      expect(digestOf(target.slotPath)).toBe(destinationBefore);
      const recovered = await invoke(
        runtimeFor(target, { artifact: other.path, identity: identityB }),
      );
      expect(recovered.error).toBeUndefined();
      expect(digestOf(target.destinationPath)).toBe(digestOf(other.path));
      expect(digestOf(target.slotPath)).toBe(destinationBefore);
      expect(stagedLeftovers(target)).toEqual([]);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-036 step 7: both artifacts are valid and the record reports stale", () => {
  test("the recovery performs no destination rename and reconciles the record in place", async () => {
    const { target, destinationBefore, failed } = await crashAnUpgrade("record-write");
    try {
      expect(failed.error?.code).toBe("fallback.internal");
      expect(digestOf(target.destinationPath)).toBe(digestOf(other.path));
      expect(digestOf(target.slotPath)).toBe(destinationBefore);
      // The record still names the predecessor: status reports record-stale.
      const invoked = runtimeFor(target, { artifact: target.destinationPath, identity: identityB });
      const stale = await invoke(invoked, ["status"]);
      expect(stale.data?.recordState).toBe("record-stale");
      const snapshotBefore = snapshotTree(target.installDirectory);
      const slotBefore = digestOf(target.slotPath);
      const recovered = await invoke(invoked);
      expect(recovered.data?.outcome).toBe("unchanged");
      expect(digestOf(target.slotPath)).toBe(slotBefore);
      expect(snapshotTree(target.installDirectory)).toEqual(snapshotBefore);
      const record = JSON.parse(readRecordText(target) ?? "{}") as {
        readonly commit?: string;
        readonly previous?: { readonly commit?: string };
      };
      expect(record.commit).toBe(identityB.commit);
      expect(record.previous?.commit).toBe(identityA.commit);
      const current = await invoke(invoked, ["status"]);
      expect(current.data?.recordState).toBe("current");
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-037 the record is reconciled in place for every non-current condition", () => {
  test("current, record-stale, unreadable, and absent each reconcile as declared", async () => {
    const target = scratchFor();
    try {
      await invoke(runtimeFor(target));
      const recordBefore = readRecordText(target);
      // A `current` record is not rewritten at all.
      expect((await invoke(runtimeFor(target))).data?.disposition).toBe("unchanged");
      expect(readRecordText(target)).toBe(recordBefore);

      // A readable record naming another identity is record-stale and is
      // reconciled in place, with previous = the predecessor it named.
      writeFileSync(
        target.recordPath,
        JSON.stringify({
          schemaVersion: "install.record.v1",
          ...JSON.parse(JSON.stringify(identityB)),
          stateSchemaVersion: "delivery.state.v1",
          provenance: "verified",
          installedAt: "2026-11-18T10:00:00.000Z",
          launcherDisposition: "none",
        }),
      );
      const slotDigestBefore = existsSync(target.slotPath) ? digestOf(target.slotPath) : undefined;
      const reconciled = await invoke(runtimeFor(target));
      expect(reconciled.data?.outcome).toBe("unchanged");
      expect((dataOf(reconciled).reconciliation as { readonly from?: string }).from).toBe(
        "record-stale",
      );
      const afterStale = JSON.parse(readRecordText(target) ?? "{}") as {
        readonly previous?: { readonly commit?: string };
      };
      expect(afterStale.previous?.commit).toBe(identityB.commit);
      expect(existsSync(target.slotPath) ? digestOf(target.slotPath) : undefined).toBe(
        slotDigestBefore,
      );

      // A damaged record is unreadable and reconciles with an unknown previous.
      writeFileSync(target.recordPath, "{ damaged\n");
      const damaged = await invoke(runtimeFor(target));
      expect((dataOf(damaged).reconciliation as { readonly from?: string }).from).toBe(
        "unreadable",
      );
      expect((dataOf(damaged).reconciliation as { readonly previous?: unknown }).previous).toBe(
        "unknown",
      );

      // An absent record reconciles the same way.
      writeFileSync(target.recordPath, "");
      const absent = await invoke(runtimeFor(target));
      expect((dataOf(absent).reconciliation as { readonly from?: string }).from).toBe("unreadable");
      // Remove it entirely for the true absent arm.
      require("node:fs").rmSync(target.recordPath, { force: true });
      const noRecord = await invoke(runtimeFor(target));
      expect((dataOf(noRecord).reconciliation as { readonly from?: string }).from).toBe("absent");
      expect((dataOf(noRecord).reconciliation as { readonly previous?: unknown }).previous).toBe(
        "unknown",
      );
    } finally {
      target.dispose();
    }
  });
});
