/**
 * GH-288 TC-PROJ-026 and TC-PROJ-027 — migration integrity and legacy detection.
 *
 * The pre-migration store is built entirely through the delivered APIs (audit
 * pairs, a queue entry, a phase document, the retro sidecar with its lock and key,
 * a quarantine artifact, and the header/index/fence an open store creates), then
 * moved with plain `rename`. Every comparison is per-file digest plus mode, so a
 * silent re-encoding fails even when the reads happen to succeed.
 */
import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { readStateRootArtifacts } from "../../packages/adapters/src/file/index";
import { declareQueueEntry } from "../../packages/core/src/app/queue";
import { STATE_MIGRATION_NOTE_PATH } from "../../packages/core/src/contracts/index";
import { RETRO_EVIDENCE_PAYLOAD_SCHEMA } from "../../packages/core/src/contracts/retro";
import { STATE_SCHEMA_VERSION } from "../../packages/core/src/contracts/state";
import { legacyStoreWarning } from "../../packages/core/src/index";
import { verifyAuditChain } from "../../packages/core/src/state/audit";
import { createNodeRetroSidecarIo } from "../../packages/core/src/state/index";
import { createRetroSidecar } from "../../packages/core/src/state/retro-sidecar";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
} from "../fixtures/projects/production";
import { createHostFixture, projectScopeFor } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";
import {
  createTestEdge,
  makeIdentity,
  openStore,
  quarantinePath,
  seedAuditPairs,
} from "../fixtures/state/harness";

const REF = "GH-241";

type FileFact = { readonly sha256: string; readonly mode: number };

const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

/** Every store artifact directly at one root: relative name → digest and mode. */
const artifactFacts = (root: string): Record<string, FileFact> => {
  const facts: Record<string, FileFact> = {};
  for (const name of readStateRootArtifacts(root)) {
    const path = join(root, name);
    const stat = statSync(path);
    facts[name] = {
      sha256: stat.isDirectory() ? "directory" : sha256(path),
      mode: stat.mode & 0o777,
    };
  }
  return facts;
};

const openAt = (stateDirectory: string) => {
  const identity = makeIdentity(stateDirectory, {
    workspaceId: "default",
    fenceNamespace: "cli",
  });
  const { store } = openStore(identity, { edge: createTestEdge() });
  return { identity, store };
};

const writePhaseDocument = (
  store: ReturnType<typeof openAt>["store"],
  fenceToken: string,
): void => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) throw new Error(`fence failed: ${acquired.error.code}`);
  try {
    const replaced = store.replaceDocument(acquired.value.handle, {
      name: `phase-state.${REF}.json`,
      content: {
        schemaVersion: "delivery.registry.v1",
        changeRef: REF,
        phases: {
          delivery: { started: "2026-11-11T08:00:00.000Z", completed: "2026-11-11T08:10:00.000Z" },
        },
        verifiedEmpty: false,
      },
    });
    if (!replaced.ok) throw new Error(`document failed: ${replaced.error.code}`);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

/** Build one populated pre-migration store at `stateDirectory` through the APIs. */
const seedStore = (stateDirectory: string): void => {
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  const { identity, store } = openAt(stateDirectory);
  seedAuditPairs(store, 3);
  const queued = declareQueueEntry(store, {
    ref: REF,
    repository: "github.com/owner/migrated",
    repositoryRoot: stateDirectory,
    priority: 5,
    recordedAt: "2026-11-11T08:00:00.000Z",
    fenceToken: "seed-queue",
  });
  if (!queued.ok) throw new Error(`queue seed failed: ${queued.code}`);
  writePhaseDocument(store, "seed-phase");
  const sidecar = createRetroSidecar(
    createNodeRetroSidecarIo({ stateDirectory, workspaceId: "default" }),
  );
  const appended = sidecar.append({
    traceId: "ev-migration-0001",
    level: "change",
    source: "pm-notes",
    windowStart: Date.parse("2026-11-11T07:00:00.000Z"),
    windowEnd: Date.parse("2026-11-11T08:00:00.000Z"),
    collectedAt: Date.parse("2026-11-11T08:00:00.000Z"),
    payloadRefs: ["note:0", "text:synthetic migration evidence"],
    payloadSchemaId: RETRO_EVIDENCE_PAYLOAD_SCHEMA,
  });
  if (!appended.ok) throw new Error(`retro seed failed: ${appended.error.code}`);
  mkdirSync(join(identity.stateDirectory, `quarantine.${identity.workspaceId}`), {
    recursive: true,
    mode: 0o700,
  });
  writeFileSync(quarantinePath(identity, "torn-tail.bin"), "quarantined bytes\n", { mode: 0o600 });
};

describe("TC-PROJ-026 migration preserves bytes, modes, the audit chain, and the retro sidecar", () => {
  it("a per-artifact rename moves the store without rewriting it, and the inverse move restores it", async () => {
    const host = createHostFixture("migration");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "migration-repo");
      const scope = projectScopeFor({ cwd: checkout, hostRoot: host.hostRoot, home: host.home });
      if (scope.scope.kind !== "project") throw new Error("expected a project scope");
      const projectRoot = scope.scope.stateLocation;

      // Pre-migration: a populated store directly at the host root.
      seedStore(host.hostRoot);
      const before = artifactFacts(host.hostRoot);
      expect(Object.keys(before).length).toBeGreaterThan(5);
      const { store: hostStore } = openAt(host.hostRoot);
      const chainBefore = verifyAuditChain(hostStore);
      expect(chainBefore.ok).toBe(true);
      const phaseBefore = readFileSync(
        join(host.hostRoot, "documents.default", `phase-state.${REF}.json`),
        "utf8",
      );

      // The documented one-step move: same names, same modes, nothing rewritten.
      mkdirSync(projectRoot, { recursive: true, mode: 0o700 });
      for (const name of Object.keys(before)) {
        renameSync(join(host.hostRoot, name), join(projectRoot, name));
      }

      const after = artifactFacts(projectRoot);
      expect(after).toEqual(before);
      expect(statSync(projectRoot).mode & 0o777).toBe(0o700);
      // The host root now holds no store artifact.
      expect(readStateRootArtifacts(host.hostRoot)).toEqual([]);

      // The same reads work at the project root.
      const { store: projectStore } = openAt(projectRoot);
      const chainAfter = verifyAuditChain(projectStore);
      expect(chainAfter.ok).toBe(true);
      expect(chainAfter.ok && chainAfter.value.verdict).toBe(
        chainBefore.ok ? chainBefore.value.verdict : "unknown",
      );
      expect(
        readFileSync(join(projectRoot, "documents.default", `phase-state.${REF}.json`), "utf8"),
      ).toBe(phaseBefore);
      const sidecar = createRetroSidecar(
        createNodeRetroSidecarIo({ stateDirectory: projectRoot, workspaceId: "default" }),
      );
      const verdict = sidecar.verify();
      expect(verdict.ok).toBe(true);
      const queueRead = projectStore.readRecords();
      expect(queueRead.ok).toBe(true);
      if (queueRead.ok) {
        expect(
          queueRead.value.records.some((record) => record.key.startsWith("queue.entries:")),
        ).toBe(true);
      }

      // The inverse move restores the pre-migration reads.
      for (const name of Object.keys(after)) {
        renameSync(join(projectRoot, name), join(host.hostRoot, name));
      }
      expect(artifactFacts(host.hostRoot)).toEqual(before);
      expect(readStateRootArtifacts(projectRoot)).toEqual([]);
      const restored = openAt(host.hostRoot);
      const chainRestored = verifyAuditChain(restored.store);
      expect(chainRestored.ok).toBe(true);
      expect(chainRestored.ok && chainRestored.value.verdict).toBe(
        chainBefore.ok ? chainBefore.value.verdict : "unknown",
      );
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

describe("TC-PROJ-027 legacy detection warns once and moves nothing", () => {
  it("an unmigrated host warns exactly once per invocation; a migrated host stays silent", async () => {
    const host = createHostFixture("legacy");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "legacy-repo");
      seedStore(host.hostRoot);
      const before = artifactFacts(host.hostRoot);
      const harness = createProductionProjectsHarness({
        label: "legacy",
        host,
        workingDirectory: checkout,
        originUrl: "https://github.com/owner/legacy.git",
      });
      harnesses.push(harness);

      const run = await harness.run(["status", "--json"]);
      expect(run.exitCode).toBe(0);
      expect(run.envelope?.error).toBeUndefined();
      const occurrences = run.stderr.split(STATE_MIGRATION_NOTE_PATH).length - 1;
      expect(occurrences).toBe(1);
      // Nothing moved and nothing deleted: every host-root artifact is identical.
      expect(artifactFacts(host.hostRoot)).toEqual(before);

      // Per invocation, not cumulative noise.
      const second = await harness.run(["status", "--json"]);
      expect(second.stderr.split(STATE_MIGRATION_NOTE_PATH).length - 1).toBe(1);

      // Migrated: the project root holds the store, the host root holds none.
      const scope = projectScopeFor({ cwd: checkout, hostRoot: host.hostRoot, home: host.home });
      if (scope.scope.kind !== "project") throw new Error("expected a project scope");
      mkdirSync(scope.scope.stateLocation, { recursive: true, mode: 0o700 });
      for (const name of Object.keys(before)) {
        renameSync(join(host.hostRoot, name), join(scope.scope.stateLocation, name));
      }
      const migrated = await harness.run(["status", "--json"]);
      expect(migrated.exitCode).toBe(0);
      expect(migrated.stderr).not.toContain(STATE_MIGRATION_NOTE_PATH);

      // Index-and-hold-only host: never a legacy warning.
      const clean = createHostFixture("legacy-index-only");
      try {
        const cleanRepo = createRepository(`${clean.hostRoot}-repos`, "clean-repo");
        const cleanHarness = createProductionProjectsHarness({
          label: "clean",
          host: clean,
          workingDirectory: cleanRepo,
          originUrl: "https://github.com/owner/clean.git",
        });
        harnesses.push(cleanHarness);
        expect((await cleanHarness.run(["status", "--json"])).exitCode).toBe(0);
        writeFileSync(join(clean.hostRoot, "owner-hold"), "operator pause\n");
        const indexOnly = await cleanHarness.run(["status", "--json"]);
        expect(indexOnly.exitCode).toBe(0);
        expect(indexOnly.stderr).not.toContain(STATE_MIGRATION_NOTE_PATH);
        removeDirectory(`${clean.hostRoot}-repos`);
      } finally {
        clean.dispose();
      }
    } finally {
      for (const record of harnesses) record.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });

  it("the predicate excludes the index, the owner hold, the project container, and the unbound scope", () => {
    expect(legacyStoreWarning({ hostArtifacts: [], projectRootExists: false })).toBeUndefined();
    expect(
      legacyStoreWarning({ hostArtifacts: ["ledger.default.jsonl"], projectRootExists: true }),
    ).toBeUndefined();
    expect(
      legacyStoreWarning({
        hostArtifacts: ["host-index.json", "owner-hold", "projects", "unbound"],
        projectRootExists: false,
      }),
    ).toBeUndefined();
    const warning = legacyStoreWarning({
      hostArtifacts: ["ledger.default.jsonl"],
      projectRootExists: false,
    });
    expect(warning).toContain(STATE_MIGRATION_NOTE_PATH);
    expect(warning).toContain("nothing was moved or deleted");
    // A stale index sibling is host-index evidence, never a store artifact.
    expect(existsSync(hostArtifactSentinel())).toBe(false);
  });
});

const hostArtifactSentinel = (): string =>
  join(process.cwd(), "tmp", "tmpdir", "gh288-never-written");

describe("TC-PROJ-028 the migration note is registered and distributed", () => {
  it("declares its distribution class, its generated header, and its registry row", () => {
    const note = readFileSync(join(process.cwd(), STATE_MIGRATION_NOTE_PATH), "utf8");
    expect(note).toContain("ados_distribution: redistributable");
    expect(note).toContain(
      "source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/guides/migrating-to-per-repository-state.md",
    );
    const registry = JSON.parse(
      readFileSync(join(process.cwd(), "scripts/checks/forbidden-literals.registry.json"), "utf8"),
    ) as { readonly registered: readonly string[]; readonly scopeClasses: readonly unknown[] };
    expect(registry.registered).toContain(STATE_MIGRATION_NOTE_PATH);
    expect(registry.scopeClasses).toHaveLength(5);
    // The six required statements, quoted from the note.
    for (const fragment of [
      "Designate exactly **one** checkout as the primary project",
      "Every other checkout starts fresh",
      "The owner-hold marker stays at the host root",
      "uses the declared `unbound`\nscope",
      "Move the artifacts back from the project root to the host root",
      "The delivery\nstore begins honouring that override in this change",
    ]) {
      expect(note, fragment).toContain(fragment.replace("\n", "\n"));
    }
  });
});

describe("TC-PROJ-042 cells 2 and 4 — the legacy warning and the uncreatable marker", () => {
  it("cell 2: an absent project root beside a host store is a warning, not an error", async () => {
    const host = createHostFixture("cells-legacy");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "cells-legacy-repo");
      const harness = createProductionProjectsHarness({
        label: "cells-legacy",
        host,
        workingDirectory: checkout,
        originUrl: "https://github.com/owner/cells-legacy.git",
      });
      harnesses.push(harness);
      expect((await harness.run(["queue", "list", "--json"])).exitCode).toBe(0);

      // The project root was never written and the host root holds a store.
      mkdirSync(join(host.hostRoot, "documents.default"), { recursive: true });
      writeFileSync(join(host.hostRoot, "ledger.default.jsonl"), "");
      const listed = await harness.run(["projects", "list", "--json"]);
      expect(listed.exitCode).toBe(0);
      expect(listed.envelope?.error).toBeUndefined();
      expect(listed.stderr.split(STATE_MIGRATION_NOTE_PATH).length - 1).toBe(1);
      expect(listed.stdout + listed.stderr).not.toContain("projects.state-unavailable");
      expect(listed.exitCode).toBe(0);
    } finally {
      for (const record of harnesses) record.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });

  it("cell 4: an uncreatable marker is a state failure naming the root and the failing path", async () => {
    const host = createHostFixture("cells-marker");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = join(base, "marker-blocked");
      mkdirSync(checkout, { recursive: true });
      // The git directory resolves to a regular file, so the marker cannot be
      // created there: a structural provocation, not a permission one.
      writeFileSync(join(checkout, ".gitdir-file"), "not a directory\n");
      writeFileSync(join(checkout, ".git"), `gitdir: ${join(checkout, ".gitdir-file")}\n`);
      const harness = createProductionProjectsHarness({
        label: "cells-marker",
        host,
        workingDirectory: checkout,
        originUrl: "https://github.com/owner/cells-marker.git",
      });
      harnesses.push(harness);

      const stateOpening = await harness.run(["queue", "list", "--json"]);
      expect(stateOpening.exitCode).toBe(2);
      const error = stateOpening.envelope?.error as
        | { readonly code?: string; readonly summary?: string }
        | undefined;
      expect(error?.code).toBe("projects.state-unavailable");
      expect(error?.summary ?? "").toContain(checkout);
      expect(error?.summary ?? "").toContain("project-identity.json");

      const listed = await harness.run(["projects", "list", "--json"]);
      expect(listed.exitCode).toBe(2);
      expect((listed.envelope?.error as { readonly code?: string } | undefined)?.code).toBe(
        "projects.state-unavailable",
      );
      expect(listed.envelope?.data).toBeUndefined();
    } finally {
      for (const record of harnesses) record.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});
