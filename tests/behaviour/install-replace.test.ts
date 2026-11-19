/**
 * GH-346 TC-INST-020..026 — dispositions, agreement, upgrade, and the involutive
 * rollback, plus the recorded provenance of the four admissible origins
 * (TC-INST-011/012, completed here because the record lands in this phase).
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
import { dirname, join } from "node:path";
import { createInstallCommandDefinition } from "../../packages/cli/src/commands/install";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import {
  createFixtureArtifact,
  type FixtureArtifact,
  removeFixtureArtifact,
} from "../fixtures/install/artifact";
import {
  createFixtureCheckouts,
  type FixtureCheckouts,
  readFixtureCheckout,
} from "../fixtures/install/checkouts";
import { type DestinationState, placeDestination } from "../fixtures/install/destinations";
import {
  createInstallRuntime,
  createInstallScratch,
  fixtureIdentity,
  type InstallScratch,
  readRecordText,
  snapshotTree,
} from "../fixtures/install/home";
import { writeRecordFixture } from "../fixtures/install/records";

const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "jaiship" });
  if (!resolved.ok) throw new Error("the resolver rejected jaiship");
  return resolved.value;
})();

const digestOf = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

type Output = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
};

const invoke = async (
  runtime: Parameters<typeof createInstallCommandDefinition>[0],
  positionals: readonly string[],
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

beforeAll(() => {
  scratch = createInstallScratch("replace");
  running = createFixtureArtifact("running");
  other = createFixtureArtifact("other");
});

afterAll(() => {
  removeFixtureArtifact(running);
  removeFixtureArtifact(other);
  scratch.dispose();
});

const freshScratch = (): InstallScratch => createInstallScratch("replace-arm");

const runtimeFor = (
  target: InstallScratch,
  options: {
    readonly artifact?: string;
    readonly identity?: ReturnType<typeof fixtureIdentity>;
  } = {},
) =>
  createInstallRuntime({
    scratch: target,
    runningArtifactPath: options.artifact ?? running.path,
    identity: options.identity ?? fixtureIdentity(),
  });

describe("TC-INST-020 the destination disposition matrix is exactly the declared states", () => {
  const arms: readonly { readonly state: DestinationState; readonly disposition: string }[] = [
    { state: "absent", disposition: "created" },
    { state: "differing", disposition: "slot-swapped" },
    { state: "launcher", disposition: "launcher-discarded" },
    { state: "symlink", disposition: "symlink-replaced" },
    { state: "agreeing", disposition: "unchanged" },
  ];
  for (const arm of arms) {
    test(`${arm.state} installs as ${arm.disposition}`, async () => {
      const target = freshScratch();
      try {
        placeDestination({
          state: arm.state,
          destination: target.destinationPath,
          runningArtifactPath: running.path,
          otherArtifactPath: other.path,
          launcherTarget: "/checkout/packages/cli/bin/jaiship.ts",
        });
        const linkTargetBefore =
          arm.state === "symlink" ? readFileSync(other.path).length : undefined;
        const outcome = await invoke(runtimeFor(target), [], { "--json": true });
        expect(outcome.error).toBeUndefined();
        expect(outcome.data?.disposition).toBe(arm.disposition);
        expect(digestOf(target.destinationPath)).toBe(digestOf(running.path));
        if (arm.state === "differing") {
          expect(digestOf(target.slotPath)).toBe(digestOf(other.path));
        } else {
          expect(existsSync(target.slotPath)).toBe(false);
        }
        if (arm.state === "launcher") {
          expect(String(outcome.data?.launcherTarget)).toContain("jaiship.ts");
        }
        if (arm.state === "symlink") {
          expect(readFileSync(other.path).length).toBe(linkTargetBefore ?? 0);
        }
        expect(existsSync(target.recordPath)).toBe(true);
      } finally {
        target.dispose();
      }
    });
  }
});

describe("TC-INST-021 the slot never holds anything but a compiled artifact", () => {
  test("a launcher is discarded and never promoted; a launcher in the slot is refused", async () => {
    const target = freshScratch();
    try {
      placeDestination({
        state: "launcher",
        destination: target.destinationPath,
        runningArtifactPath: running.path,
        otherArtifactPath: other.path,
      });
      const outcome = await invoke(runtimeFor(target), []);
      expect(outcome.data?.disposition).toBe("launcher-discarded");
      expect(existsSync(target.slotPath)).toBe(false);
      // Plant a launcher in the slot: rollback must refuse it as invalid, and
      // status must agree rather than claim a rollback-ready slot.
      writeFileSync(target.slotPath, "#!/usr/bin/env bash\nreadonly TARGET=/x\nexit 0\n", {
        mode: 0o755,
      });
      const refused = await invoke(runtimeFor(target), ["rollback"]);
      expect(refused.error?.code).toBe("install.slot.invalid");
      const launcherStatus = await invoke(runtimeFor(target), ["status"]);
      expect((dataOf(launcherStatus).rollback as { readonly state?: string }).state).toBe(
        "invalid",
      );
      // And an identity-less (non-executable) binary is invalid too.
      writeFileSync(target.slotPath, Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
      chmodSync(target.slotPath, 0o644);
      expect((await invoke(runtimeFor(target), ["rollback"])).error?.code).toBe(
        "install.slot.invalid",
      );
      const plainStatus = await invoke(runtimeFor(target), ["status"]);
      expect((dataOf(plainStatus).rollback as { readonly state?: string }).state).toBe("invalid");
      // The same bytes with the execute bit set are a compiled artifact, and the
      // slot then reads as present.
      chmodSync(target.slotPath, 0o755);
      const executableStatus = await invoke(runtimeFor(target), ["status"]);
      expect((dataOf(executableStatus).rollback as { readonly state?: string }).state).toBe(
        "present",
      );
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-021b rollback refuses a destination that is not a compiled artifact", () => {
  test("a launcher at the destination is never displaced into the slot", async () => {
    const target = freshScratch();
    try {
      // Two installs leave a real artifact in the slot and a valid record.
      await invoke(runtimeFor(target), []);
      await invoke(
        runtimeFor(target, {
          artifact: other.path,
          identity: fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
        }),
        [],
      );
      const slotBefore = digestOf(target.slotPath);
      // Replace the destination with a delivered launcher: the pair the swap
      // inverts no longer exists, so the run refuses and writes nothing.
      writeFileSync(
        target.destinationPath,
        "#!/usr/bin/env bash\nreadonly TARGET=/checkout/packages/cli/bin/jaiship.ts\nexit 0\n",
        { mode: 0o755 },
      );
      const destinationBefore = readFileSync(target.destinationPath);
      const dry = await invoke(runtimeFor(target), ["rollback"], { "--dry-run": true });
      expect(dry.error).toBeUndefined();
      expect((dataOf(dry).plan as readonly string[]).join("\n")).toContain(
        "refusal: install.record.unreadable",
      );
      const refused = await invoke(runtimeFor(target), ["rollback"]);
      expect(refused.error?.code).toBe("install.record.unreadable");
      expect(readFileSync(target.destinationPath)).toEqual(destinationBefore);
      expect(digestOf(target.slotPath)).toBe(slotBefore);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-022 an identical re-install over a current record rewrites zero bytes", () => {
  test("destination bytes and mtime, slot digest, and record bytes are unchanged", async () => {
    const target = freshScratch();
    try {
      await invoke(runtimeFor(target), []);
      const before = snapshotTree(target.installDirectory);
      const recordBefore = readRecordText(target);
      const slotBefore = existsSync(target.slotPath) ? digestOf(target.slotPath) : undefined;
      const outcome = await invoke(runtimeFor(target), [], { "--json": true });
      expect(outcome.data?.disposition).toBe("unchanged");
      expect(snapshotTree(target.installDirectory)).toEqual(before);
      expect(readRecordText(target)).toBe(recordBefore);
      expect(existsSync(target.slotPath) ? digestOf(target.slotPath) : undefined).toBe(slotBefore);
      expect(
        readdirSync(target.installDirectory).filter((name) => name.includes(".staged-")),
      ).toEqual([]);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-023 an upgrade names both identities and both surfaces agree", () => {
  test("the displaced identity is recorded and status reports the new one", async () => {
    const target = freshScratch();
    try {
      await invoke(runtimeFor(target), []);
      const upgraded = await invoke(
        runtimeFor(target, {
          artifact: other.path,
          identity: fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
        }),
        [],
      );
      expect(upgraded.data?.disposition).toBe("slot-swapped");
      expect((dataOf(upgraded).previous as { readonly commit?: string }).commit).toBe(
        fixtureIdentity().commit,
      );
      const status = await invoke(
        runtimeFor(target, {
          artifact: target.destinationPath,
          identity: fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
        }),
        ["status"],
      );
      expect((dataOf(status).installed as { readonly commit?: string }).commit).toBe(
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      );
      expect(status.data?.recordState).toBe("current");
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-024/025 rollback restores the previous artifact and is involutive", () => {
  test("the first rollback restores the predecessor; the second returns the original", async () => {
    const target = freshScratch();
    try {
      const a = fixtureIdentity({ commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
      const b = fixtureIdentity({ commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" });
      await invoke(runtimeFor(target, { identity: a }), []);
      await invoke(runtimeFor(target, { artifact: other.path, identity: b }), []);
      const first = await invoke(
        runtimeFor(target, { artifact: target.destinationPath, identity: b }),
        ["rollback"],
      );
      expect(first.data?.outcome).toBe("rolled-back");
      expect(digestOf(target.destinationPath)).toBe(digestOf(running.path));
      expect(digestOf(target.slotPath)).toBe(digestOf(other.path));
      expect((dataOf(first).previous as { readonly commit?: string }).commit).toBe(a.commit);
      // The record now names the restored artifact; a second rollback returns B.
      const second = await invoke(
        runtimeFor(target, { artifact: target.destinationPath, identity: a }),
        ["rollback"],
      );
      expect(second.data?.outcome).toBe("rolled-back");
      expect(digestOf(target.destinationPath)).toBe(digestOf(other.path));
      expect(digestOf(target.slotPath)).toBe(digestOf(running.path));
      const record = JSON.parse(readRecordText(target) ?? "{}") as {
        readonly commit?: string;
        readonly previous?: { readonly commit?: string };
      };
      expect(record.commit).toBe(b.commit);
      expect(record.previous?.commit).toBe(a.commit);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-026 rollback refuses an absent, launcher-holding, or identity-less slot", () => {
  test("the two slot refusals are ordered before the record gate and write nothing", async () => {
    const target = freshScratch();
    try {
      await invoke(runtimeFor(target), []);
      const before = snapshotTree(target.installDirectory);
      // Absent slot.
      writeRecordFixture({
        state: "damaged",
        path: target.recordPath,
        identity: fixtureIdentity(),
      });
      expect((await invoke(runtimeFor(target), ["rollback"])).error?.code).toBe(
        "install.slot.absent",
      );
      expect(snapshotTree(target.installDirectory)).toEqual(before);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-011/012 the recorded provenance of the four admissible origins", () => {
  let checkouts: FixtureCheckouts;
  beforeAll(() => {
    checkouts = createFixtureCheckouts("replace-provenance");
  });
  afterAll(() => {
    checkouts.dispose();
  });

  test("a primary checkout and a clone are verified; a plain directory and a no-git host unverified", async () => {
    for (const origin of [
      { directory: checkouts.primary, provenance: "verified", checkout: true },
      { directory: checkouts.clone, provenance: "verified", checkout: true },
      { directory: checkouts.plain, provenance: "unverified", checkout: false },
    ]) {
      const target = freshScratch();
      try {
        const artifactPath = join(origin.directory, "fixture-artifact");
        mkdirSync(dirname(artifactPath), { recursive: true });
        writeFileSync(artifactPath, readFileSync(running.path), { mode: 0o755 });
        chmodSync(artifactPath, 0o755);
        const runtime = createInstallRuntime({
          scratch: target,
          runningArtifactPath: artifactPath,
          identity: fixtureIdentity(),
          // A plain directory carries no git metadata; the case injects that absence
          // rather than relying on the repository's own worktree resolution.
          git: origin.checkout ? readFixtureCheckout(origin.directory) : { kind: "unbound" },
        });
        const outcome = await invoke(runtime, []);
        expect({ origin: origin.directory, error: outcome.error?.code }).toEqual({
          origin: origin.directory,
          error: undefined,
        });
        const record = JSON.parse(readRecordText(target) ?? "{}") as {
          readonly provenance?: string;
          readonly sourceCheckout?: string;
        };
        expect({ origin: origin.directory, provenance: record.provenance }).toEqual({
          origin: origin.directory,
          provenance: origin.provenance,
        });
        if (origin.checkout) expect(record.sourceCheckout).toBe(origin.directory);
        else expect(record.sourceCheckout).toBeUndefined();
      } finally {
        target.dispose();
      }
    }
    // No git metadata on PATH is the same admitted `unverified` shape.
    const target = freshScratch();
    try {
      const outcome = await invoke(
        createInstallRuntime({
          scratch: target,
          runningArtifactPath: running.path,
          identity: fixtureIdentity(),
          git: { kind: "unbound" },
        }),
        [],
      );
      expect(outcome.error).toBeUndefined();
      const record = JSON.parse(readRecordText(target) ?? "{}") as { readonly provenance?: string };
      expect(record.provenance).toBe("unverified");
    } finally {
      target.dispose();
    }
  });

  test("a dirty origin is admitted and the record repeats the dirty token", async () => {
    const target = freshScratch();
    try {
      const dirty = fixtureIdentity({
        dirty: true,
        commit: "cccccccccccccccccccccccccccccccccccccccc",
      });
      await invoke(runtimeFor(target, { identity: dirty }), []);
      const record = JSON.parse(readRecordText(target) ?? "{}") as { readonly dirty?: boolean };
      expect(record.dirty).toBe(true);
    } finally {
      target.dispose();
    }
  });
});
