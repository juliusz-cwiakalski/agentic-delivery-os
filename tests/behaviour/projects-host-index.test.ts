/**
 * GH-288 TC-PROJ-009 — pruning is index-only and re-registration recovers the
 * same root (AC-F2-4).
 *
 * The maintenance step removes index entries that are provably dead (the
 * recorded root is gone, or the root's marker now resolves to a different
 * project identifier) and leaves every referenced state root byte- and
 * mode-identical. The mutation this guards against (P3) deletes the referenced
 * state root during pruning, which must red the snapshot at step 3.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readQueueEntries } from "../../packages/core/src/app/queue";
import {
  projectKeyFor,
  projectsContainerPath,
  sanitizeProjectBasename,
  serializeProjectIdentityMarker,
} from "../../packages/core/src/app/state-scope";
import {
  hostIndexEntryOf,
  hostIndexKeysOf,
  hostIndexOf,
  hostIndexRevisionOf,
} from "../fixtures/projects/host-index";
import { snapshotDifferences, snapshotTree } from "../fixtures/projects/host-root";
import { rotateProjectIdentityMarker } from "../fixtures/projects/markers";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
} from "../fixtures/projects/production";
import { createHostFixture } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

const REF = "GH-241";

const PM_NOTES = `---
change_id: ${REF}
title: "host index fixture"
milestone: "M2: Workstation"
story_code: M2-S11
delivery_mode: interactive
phases:
  clarify_scope: { started: "2026-11-11T08:00:00Z", completed: "2026-11-11T08:10:00Z" }
  specification: { started: "2026-11-11T08:11:00Z", completed: "2026-11-11T08:20:00Z" }
  test_planning: { started: "2026-11-11T08:21:00Z", completed: "2026-11-11T08:30:00Z" }
  delivery_planning: { started: "2026-11-11T08:31:00Z", completed: "2026-11-11T08:40:00Z" }
  dor_check: { started: "2026-11-11T08:41:00Z", completed: "2026-11-11T08:50:00Z" }
  delivery: { started: null, completed: null, reopened: null, commits: [] }
  system_spec_update: { started: null, completed: null }
  review_fix: { started: null, completed: null }
  quality_gates: { started: null, completed: null }
  dod_check: { started: null, completed: null }
  pr_creation: { started: null, completed: null, url: null }
decisions: []
open_questions: []
blockers: []
notes: []
`;

const seedPmNotes = (checkout: string): void => {
  const folder = join(checkout, "doc", "changes", "2026-11", `2026-11-11--${REF}--host-index`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `chg-${REF}-pm-notes.yaml`), PM_NOTES);
};

const projectKeyOf = (harness: ProductionProjectsHarness): string =>
  harness.projectKey.startsWith("/") ? "unbound" : harness.projectKey;

describe("TC-PROJ-009 pruning is index-only", () => {
  test("a vanished root and a re-keyed root are pruned; both state roots survive", async () => {
    const host = createHostFixture("host-index");
    const base = `${host.hostRoot}-repos`;
    try {
      const gone = createRepository(base, "gone-repo");
      const rekeyed = createRepository(base, "rekeyed-repo");
      const stable = createRepository(base, "stable-repo");
      for (const checkout of [gone, rekeyed, stable]) seedPmNotes(checkout);

      const harnessFor = (label: string, checkout: string) =>
        createProductionProjectsHarness({
          label,
          host,
          workingDirectory: checkout,
          originUrl: `https://github.com/owner/${label}.git`,
        });
      const goneHarness = harnessFor("gone", gone);
      const rekeyedHarness = harnessFor("rekeyed", rekeyed);
      const stableHarness = harnessFor("stable", stable);

      for (const [harness, priority] of [
        [goneHarness, "1"],
        [rekeyedHarness, "2"],
        [stableHarness, "3"],
      ] as const) {
        const queued = await harness.run(["queue", "add", REF, "--priority", priority, "--json"]);
        expect(queued.exitCode).toBe(0);
        const phased = await harness.run([
          "phase",
          "complete",
          REF,
          "delivery",
          "--no-commit",
          "--json",
        ]);
        expect(phased.exitCode).toBe(0);
      }

      const goneKey = projectKeyOf(goneHarness);
      const rekeyedKey = projectKeyOf(rekeyedHarness);
      const stableKey = projectKeyOf(stableHarness);
      const goneStateLocation = goneHarness.stateLocation;
      const rekeyedStateLocation = rekeyedHarness.stateLocation;
      expect(hostIndexKeysOf(host.hostRoot)).toEqual([goneKey, rekeyedKey, stableKey].sort());

      const container = projectsContainerPath(host.hostRoot);
      const beforeSnapshot = snapshotTree(container);
      const beforeRevision = hostIndexRevisionOf(host.hostRoot);

      // P-gone: the checkout root is moved away, so the recorded root is absent.
      const movedAway = `${base}/gone-repo-moved`;
      renameSync(gone, movedAway);

      // P-rekeyed: the root stays, but its identity marker now carries another
      // identifier, so the recorded entry resolves to a different project.
      const replacementIdentifier = globalThis.crypto.randomUUID().replace(/-/gu, "");
      const replacementKey = projectKeyFor(
        sanitizeProjectBasename("rekeyed-repo"),
        replacementIdentifier,
      );
      rotateProjectIdentityMarker(
        join(rekeyed, ".git"),
        serializeProjectIdentityMarker({
          schema: "delivery.projects.identity.v1",
          projectKey: replacementKey,
          projectIdentifier: replacementIdentifier,
          basename: sanitizeProjectBasename("rekeyed-repo"),
        }),
      );
      expect(replacementKey).not.toBe(rekeyedKey);

      // One state-opening invocation inside P-stable triggers maintenance.
      const maintained = await stableHarness.run(["queue", "list", "--json"]);
      expect(maintained.exitCode).toBe(0);

      expect(hostIndexKeysOf(host.hostRoot)).toEqual([stableKey]);
      expect(hostIndexRevisionOf(host.hostRoot)).toBe(beforeRevision + 1);

      // Every referenced state root survives, byte- and mode-identical.
      const afterSnapshot = snapshotTree(container);
      expect(snapshotDifferences(beforeSnapshot, afterSnapshot)).toEqual([]);
      expect(readFileSync(join(goneStateLocation, "ledger.default.jsonl"), "utf8")).toContain(REF);
      expect(readFileSync(join(rekeyedStateLocation, "ledger.default.jsonl"), "utf8")).toContain(
        REF,
      );

      // Re-registering the moved checkout restores the same key and location.
      renameSync(movedAway, gone);
      const restoredHarness = harnessFor("restored", gone);
      const restored = await restoredHarness.run(["queue", "list", "--json"]);
      expect(restored.exitCode).toBe(0);
      expect(projectKeyOf(restoredHarness)).toBe(goneKey);
      expect(restoredHarness.stateLocation).toBe(goneStateLocation);
      const restoredEntry = hostIndexEntryOf(host.hostRoot, goneKey);
      expect(restoredEntry?.root).toBe(gone);
      expect(restoredEntry?.stateLocation).toBe(goneStateLocation);
      const readable = readQueueEntries(restoredHarness.store);
      expect(readable.ok && readable.records.some((record) => record.ref === REF)).toBe(true);

      // The marker — not the path — governs identity: the re-keyed key changed.
      const rekeyedScope = harnessFor("rekeyed-after", rekeyed);
      expect(projectKeyOf(rekeyedScope)).toBe(replacementKey);
      expect(projectKeyOf(rekeyedScope)).not.toBe(rekeyedKey);
    } finally {
      removeDirectory(base);
      host.dispose();
    }
  });

  test("one read and at most one write per invocation; zero writes when unchanged", async () => {
    const host = createHostFixture("host-index-write-rule");
    const base = `${host.hostRoot}-repos`;
    try {
      const checkout = createRepository(base, "write-rule-repo");
      seedPmNotes(checkout);
      const harness = createProductionProjectsHarness({
        label: "write-rule",
        host,
        workingDirectory: checkout,
        originUrl: "https://github.com/owner/write-rule.git",
      });
      const counter = () => ({
        reads: harness.hostIndexAccess.reads,
        writes: harness.hostIndexAccess.writes,
        revision: hostIndexRevisionOf(host.hostRoot),
      });

      const first = counter();
      expect(await harness.run(["queue", "list", "--json"])).toMatchObject({ exitCode: 0 });
      const afterFirst = counter();
      expect(afterFirst.reads - first.reads).toBe(1);
      expect(afterFirst.writes - first.writes).toBe(1);
      expect(afterFirst.revision).toBe(first.revision + 1);

      // Three further invocations with nothing changed: zero writes, no advance.
      for (let index = 0; index < 3; index += 1) {
        const before = counter();
        expect(await harness.run(["queue", "list", "--json"])).toMatchObject({ exitCode: 0 });
        const after = counter();
        expect(after.reads - before.reads).toBe(1);
        expect(after.writes - before.writes).toBe(0);
        expect(after.revision).toBe(before.revision);
      }

      const document = hostIndexOf(host.hostRoot);
      expect(document?.schema).toBe("delivery.projects.host-index.v1");
      expect(document?.projects).toHaveLength(1);
      const entry = document?.projects[0];
      expect(Object.keys(entry ?? {}).sort()).toEqual(
        ["lastWrittenAt", "projectIdentifier", "projectKey", "root", "stateLocation"].sort(),
      );
      expect(entry?.root).toBe(checkout);
      expect(entry?.stateLocation).toBe(harness.stateLocation);
    } finally {
      removeDirectory(base);
      host.dispose();
    }
  });
});
