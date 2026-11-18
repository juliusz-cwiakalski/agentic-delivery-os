/**
 * GH-346 TC-INST-040..042 — the install record's shape, atomicity, tolerance,
 * and the rollback record precondition (DM-2, DEC-13, ATOMIC-TP-1).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInstallCommandDefinition } from "../../packages/cli/src/commands/install";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import { parseInstallRecord as parseFromDomain } from "../../packages/core/src/domain/install-record";
import {
  rollbackCauseSentence,
  rollbackPrecondition,
} from "../../packages/core/src/domain/install-replace";
import {
  createFixtureArtifact,
  type FixtureArtifact,
  removeFixtureArtifact,
} from "../fixtures/install/artifact";
import {
  createInstallRuntime,
  createInstallScratch,
  fixtureIdentity,
  type InstallScratch,
  readRecordText,
} from "../fixtures/install/home";
import { writeRecordFixture } from "../fixtures/install/records";

const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "jaiship" });
  if (!resolved.ok) throw new Error("the resolver rejected jaiship");
  return resolved.value;
})();

type Output = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
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

let scratch: InstallScratch;
let running: FixtureArtifact;
let other: FixtureArtifact;
const identityA = fixtureIdentity({ commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
const identityB = fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" });

beforeAll(() => {
  scratch = createInstallScratch("record");
  running = createFixtureArtifact("record-running");
  other = createFixtureArtifact("record-other");
});

afterAll(() => {
  removeFixtureArtifact(running);
  removeFixtureArtifact(other);
  scratch.dispose();
});

const fresh = (): InstallScratch => createInstallScratch("record-arm");
const runtimeFor = (
  target: InstallScratch,
  options: {
    readonly artifact?: string;
    readonly identity?: typeof identityA;
    readonly environment?: Record<string, string>;
  } = {},
) =>
  createInstallRuntime({
    scratch: target,
    runningArtifactPath: options.artifact ?? running.path,
    identity: options.identity ?? identityA,
    ...(options.environment === undefined ? {} : { environment: options.environment }),
  });

describe("TC-INST-040 the record has the declared shape, is atomic, and carries no secret", () => {
  test("every declared field is populated or legitimately absent", async () => {
    const target = fresh();
    try {
      await invoke(runtimeFor(target), []);
      const text = readRecordText(target) ?? "";
      const record = JSON.parse(text) as Record<string, unknown>;
      expect(Object.keys(record).sort()).toEqual([
        "builtAt",
        "channel",
        "commit",
        "dirty",
        "installedAt",
        "launcherDisposition",
        "provenance",
        "schemaVersion",
        "stateSchemaVersion",
        "version",
      ]);
      expect(record.schemaVersion).toBe("install.record.v1");
      expect(record.version).toBe(identityA.version);
      expect(record.commit).toBe(identityA.commit);
      expect(record.builtAt).toBe(identityA.builtAt);
      expect(record.dirty).toBe(false);
      expect(record.channel).toBe("dev");
      expect(record.stateSchemaVersion).toBe("delivery.state.v1");
      expect(record.provenance).toBe("unverified");
      expect(record.installedAt).toBe("2026-11-18T12:05:00.000Z");
      expect(record.launcherDisposition).toBe("none");
      expect(record.previous).toBeUndefined();
      expect(record.sourceCheckout).toBeUndefined();
      // Atomicity: no staged record artifact survives.
      expect(readdirSync(target.configRoot).filter((name) => name.includes(".staged-"))).toEqual(
        [],
      );
      // The same identity the artifact reports.
      const status = await invoke(runtimeFor(target), ["status"]);
      expect((dataOf(status).installed as { readonly commit?: string }).commit).toBe(
        identityA.commit,
      );
      expect((dataOf(status).running as { readonly commit?: string }).commit).toBe(
        identityA.commit,
      );
    } finally {
      target.dispose();
    }
  });

  test("a credential value in the environment never reaches the record", async () => {
    const target = fresh();
    try {
      const canary = "gh346-record-canary-value";
      await invoke(
        runtimeFor(target, { environment: { HOME: target.home, GITHUB_TOKEN: canary } }),
        [],
      );
      const text = readRecordText(target) ?? "";
      expect(text).not.toContain(canary);
      expect(text).not.toContain("token");
      expect(text).not.toContain("secret");
    } finally {
      target.dispose();
    }
  });

  test("a truncated record is reported unreadable, never parsed", () => {
    expect(parseFromDomain('{"schemaVersion":"install.record.v1",').kind).toBe("unreadable");
    expect(parseFromDomain(JSON.stringify({ schemaVersion: "install.record.v1" })).kind).toBe(
      "unreadable",
    );
  });
});

describe("TC-INST-041 the record's three damaged states are reported as data", () => {
  test("absent, damaged, and the post-crash pair report as data at exit 0", async () => {
    const target = fresh();
    try {
      await invoke(runtimeFor(target), []);
      await invoke(runtimeFor(target, { artifact: other.path, identity: identityB }), []);
      const arms: readonly {
        readonly state: Parameters<typeof writeRecordFixture>[0]["state"];
        readonly expected: string;
      }[] = [
        { state: "absent", expected: "absent" },
        { state: "damaged", expected: "unreadable" },
        { state: "inverted", expected: "record-stale" },
      ];
      for (const arm of arms) {
        writeRecordFixture({
          state: arm.state,
          path: target.recordPath,
          identity: identityA,
          previous: identityB,
        });
        const status = await invoke(
          runtimeFor(target, { artifact: target.destinationPath, identity: identityB }),
          ["status"],
        );
        expect(status.error).toBeUndefined();
        expect({ state: arm.state, recordState: status.data?.recordState }).toEqual({
          state: arm.state,
          recordState: arm.expected,
        });
      }
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-042 write paths tolerate damage; rollback's precondition refuses four causes", () => {
  test("install brings damage back to current, uninstall removes what it can", async () => {
    const target = fresh();
    try {
      await invoke(runtimeFor(target), []);
      writeFileSync(target.recordPath, "{ damaged\n");
      const repaired = await invoke(runtimeFor(target));
      expect(repaired.error).toBeUndefined();
      const record = JSON.parse(readRecordText(target) ?? "{}") as { readonly commit?: string };
      expect(record.commit).toBe(identityA.commit);
      const removed = await invoke(runtimeFor(target), ["uninstall"]);
      expect(removed.data?.outcome).toBe("uninstalled");
      expect(existsSync(target.recordPath)).toBe(false);
      expect(existsSync(target.destinationPath)).toBe(false);
    } finally {
      target.dispose();
    }
  });

  test("the four causes refuse and the wrong-name cell proceeds as a declared limit", async () => {
    const target = fresh();
    try {
      await invoke(runtimeFor(target), []);
      await invoke(runtimeFor(target, { artifact: other.path, identity: identityB }), []);
      // (d) absent record.
      writeRecordFixture({
        state: "absent",
        path: target.recordPath,
        identity: identityA,
        previous: identityB,
      });
      const absent = await invoke(
        runtimeFor(target, { artifact: target.destinationPath, identity: identityB }),
        ["rollback"],
      );
      expect(absent.error?.code).toBe("install.record.unreadable");
      expect(absent.error?.summary).toContain("absent");
      // step 3 unreadable.
      writeRecordFixture({
        state: "damaged",
        path: target.recordPath,
        identity: identityA,
        previous: identityB,
      });
      const damaged = await invoke(
        runtimeFor(target, { artifact: target.destinationPath, identity: identityB }),
        ["rollback"],
      );
      expect(damaged.error?.code).toBe("install.record.unreadable");
      expect(damaged.error?.summary).toContain("unreadable");
      // (e) readable current naming no previous.
      writeRecordFixture({ state: "no-previous", path: target.recordPath, identity: identityB });
      const noPrevious = await invoke(
        runtimeFor(target, { artifact: target.destinationPath, identity: identityB }),
        ["rollback"],
      );
      expect(noPrevious.error?.summary).toContain("no previous artifact");
      // (f) the post-crash pair: current names the slot occupant P, destination holds B.
      writeRecordFixture({
        state: "inverted",
        path: target.recordPath,
        identity: identityA,
        previous: identityB,
      });
      const inverted = await invoke(
        runtimeFor(target, { artifact: target.destinationPath, identity: identityB }),
        ["rollback"],
      );
      expect(inverted.error?.code).toBe("install.record.unreadable");
      expect(inverted.error?.summary).toContain("other than the one at the destination");
      // (g) the wrong-name cell: current names the destination, previous names a
      // non-occupant. It PROCEEDS, carrying the claim verbatim and the displaced
      // destination, and reports exactly those two identities.
      const wrong = fixtureIdentity({ commit: "dddddddddddddddddddddddddddddddddddddddd" });
      writeRecordFixture({
        state: "wrong-previous",
        path: target.recordPath,
        identity: identityB,
        wrongPrevious: wrong,
      });
      const proceeded = await invoke(
        runtimeFor(target, { artifact: target.destinationPath, identity: identityB }),
        ["rollback"],
      );
      expect(proceeded.error).toBeUndefined();
      expect(proceeded.data?.outcome).toBe("rolled-back");
      expect((dataOf(proceeded).previous as { readonly commit?: string }).commit).toBe(
        wrong.commit,
      );
      const record = JSON.parse(readRecordText(target) ?? "{}") as {
        readonly commit?: string;
        readonly previous?: { readonly commit?: string };
      };
      expect(record.commit).toBe(wrong.commit);
      expect(record.previous?.commit).toBe(identityB.commit);
      const status = await invoke(
        runtimeFor(target, { artifact: target.destinationPath, identity: wrong }),
        ["status"],
      );
      expect((dataOf(status).installed as { readonly commit?: string }).commit).toBe(wrong.commit);
      // The structural guard: the record carries no slot digest or slot-derived field.
      const keys = Object.keys(JSON.parse(readRecordText(target) ?? "{}"));
      expect(keys.some((key) => /slot|digest/iu.test(key))).toBe(false);
    } finally {
      target.dispose();
    }
  });

  test("the predicate itself discriminates a candidate invocation from the post-crash pair", () => {
    const record = parseFromDomain(
      JSON.stringify({
        schemaVersion: "install.record.v1",
        ...identityB,
        stateSchemaVersion: "delivery.state.v1",
        provenance: "verified",
        installedAt: "2026-11-18T10:00:00.000Z",
        launcherDisposition: "none",
        previous: identityA,
      }),
    );
    // A candidate artifact (not the destination's) takes the record at its word.
    expect(
      rollbackPrecondition({ record, running: identityB, destinationIsRunning: false }).ok,
    ).toBe(true);
    // The same record against a destination that holds another artifact refuses.
    expect(
      rollbackPrecondition({ record, running: identityA, destinationIsRunning: true }),
    ).toEqual({ ok: false, cause: "pair-inverted" });
    expect(rollbackCauseSentence("pair-inverted")).toContain("destination");
  });
});
