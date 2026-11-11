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
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { hostIndexDocumentPath } from "../../packages/adapters/src/file/host-index-store";
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
  hostIndexTextOf,
} from "../fixtures/projects/host-index";
import { snapshotDifferences, snapshotTree } from "../fixtures/projects/host-root";
import { rotateProjectIdentityMarker } from "../fixtures/projects/markers";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
} from "../fixtures/projects/production";
import { createHostFixture, nonCheckoutDirectory } from "../fixtures/projects/state-scope";
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

const corruptSiblings = (hostRoot: string): string[] =>
  readdirSync(hostRoot)
    .filter((name) => name.startsWith("host-index.json.") && name.endsWith(".corrupt"))
    .sort();

const harnessFor = (host: ReturnType<typeof createHostFixture>, label: string, checkout: string) =>
  createProductionProjectsHarness({
    label,
    host,
    workingDirectory: checkout,
    originUrl: `https://github.com/owner/${label}.git`,
  });

const dataOf = (run: { readonly envelope?: Record<string, unknown> }) => {
  const data = run.envelope?.data as Record<string, unknown> | undefined;
  if (data === undefined) throw new Error("the run produced no data envelope");
  return data;
};

const errorOf = (run: { readonly envelope?: Record<string, unknown> }) =>
  run.envelope?.error as { readonly code?: string; readonly summary?: string } | undefined;

describe("TC-PROJ-006 an absent index is an ordinary first run", () => {
  test("listing an absent host succeeds and creates nothing; one status registers the checkout", async () => {
    const host = createHostFixture("index-first-run");
    const base = `${host.hostRoot}-repos`;
    const outside = nonCheckoutDirectory("index-first-run");
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "first-run-repo");
      seedPmNotes(checkout);
      const harness = harnessFor(host, "first-run", checkout);
      harnesses.push(harness);
      const outsideHarness = createProductionProjectsHarness({
        label: "first-run-outside",
        host,
        workingDirectory: outside,
        originUrl: "https://github.com/owner/outside.git",
      });
      harnesses.push(outsideHarness);

      expect(hostIndexTextOf(host.hostRoot)).toBeUndefined();
      expect(existsSync(join(host.hostRoot, "projects"))).toBe(false);

      const empty = await outsideHarness.run(["projects", "list", "--json"]);
      expect(empty.exitCode).toBe(0);
      expect(dataOf(empty).projects).toEqual([]);
      expect(dataOf(empty).hostIndexRevision).toBe(0);
      expect(errorOf(empty)).toBeUndefined();
      expect(empty.stdout + empty.stderr).not.toContain("projects.registry-corrupt");
      expect(hostIndexTextOf(host.hostRoot)).toBeUndefined();
      expect(existsSync(join(host.hostRoot, "projects"))).toBe(false);

      const opened = await harness.run(["status", "--json"]);
      expect(opened.exitCode).toBe(0);
      const document = hostIndexOf(host.hostRoot);
      expect(document?.revision).toBe(1);
      expect(document?.projects).toHaveLength(1);
      expect(document?.projects[0]?.projectKey).toBe(harness.projectKey);
      expect(document?.projects[0]?.stateLocation).toBe(harness.stateLocation);
      expect(existsSync(harness.stateLocation)).toBe(false);

      const fromOutside = await outsideHarness.run(["projects", "list", "--json"]);
      const fromInside = await harness.run(["projects", "list", "--json"]);
      expect(fromOutside.exitCode).toBe(0);
      expect(fromInside.exitCode).toBe(0);
      expect(dataOf(fromOutside)).toEqual(dataOf(fromInside));
      expect(dataOf(fromInside).hostIndexRevision).toBe(1);
      expect(dataOf(fromInside).projects as readonly Record<string, unknown>[]).toHaveLength(1);
      for (const run of [empty, opened, fromOutside, fromInside]) {
        expect(run.stdout + run.stderr).not.toContain("projects.registry-corrupt");
      }
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      removeDirectory(outside);
      host.dispose();
    }
  });
});

describe("TC-PROJ-007 discovery without a registry", () => {
  test("both projects are reported from either checkout and from outside, identically", async () => {
    const host = createHostFixture("index-discovery");
    const base = `${host.hostRoot}-repos`;
    const outside = nonCheckoutDirectory("index-discovery");
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const alpha = createRepository(base, "discovery-alpha");
      const beta = createRepository(base, "discovery-beta");
      const a = harnessFor(host, "discovery-alpha", alpha);
      const b = harnessFor(host, "discovery-beta", beta);
      const outsideHarness = createProductionProjectsHarness({
        label: "discovery-outside",
        host,
        workingDirectory: outside,
        originUrl: "https://github.com/owner/outside.git",
      });
      harnesses.push(a, b, outsideHarness);

      const hostBefore = new Set(readdirSync(host.hostRoot).sort());
      await a.run(["queue", "list", "--json"]);
      await b.run(["queue", "list", "--json"]);
      const hostAfter = new Set(readdirSync(host.hostRoot).sort());
      for (const name of hostAfter) {
        if (!hostBefore.has(name)) {
          expect(["host-index.json", "projects", "owner-hold"]).toContain(name);
        }
      }

      const fromA = await a.run(["projects", "list", "--json"]);
      const fromB = await b.run(["projects", "list", "--json"]);
      const fromOutside = await outsideHarness.run(["projects", "list", "--json"]);
      for (const run of [fromA, fromB, fromOutside]) expect(run.exitCode).toBe(0);
      const entries = dataOf(fromA).projects as readonly Record<string, unknown>[];
      expect(entries).toHaveLength(2);
      expect(dataOf(fromB).projects).toEqual(entries);
      expect(dataOf(fromOutside).projects).toEqual(entries);
      const keys = entries.map((entry) => entry.projectKey as string);
      expect(new Set(keys).size).toBe(2);
      const byKey = new Map(entries.map((entry) => [entry.projectKey as string, entry]));
      for (const harness of [a, b]) {
        const entry = byKey.get(harness.projectKey);
        expect(entry?.root).toBe(harness.checkout);
        expect(entry?.stateLocation).toBe(`${host.hostRoot}/projects/${harness.projectKey}`);
      }
      expect(typeof dataOf(fromA).hostIndexRevision).toBe("number");
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      removeDirectory(outside);
      host.dispose();
    }
  });
});

describe("TC-PROJ-008 a corrupt index refuses honestly, then recovers preserving bytes", () => {
  test("the read changes no file; maintenance preserves one sibling and writes a fresh index", async () => {
    const host = createHostFixture("index-corrupt");
    const base = `${host.hostRoot}-repos`;
    const outside = nonCheckoutDirectory("index-corrupt");
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "corrupt-repo");
      seedPmNotes(checkout);
      const harness = harnessFor(host, "corrupt", checkout);
      const outsideHarness = createProductionProjectsHarness({
        label: "corrupt-outside",
        host,
        workingDirectory: outside,
        originUrl: "https://github.com/owner/corrupt-outside.git",
      });
      harnesses.push(harness, outsideHarness);
      await harness.run(["queue", "add", REF, "--priority", "1", "--json"]);
      const validRevision = hostIndexRevisionOf(host.hostRoot);
      expect(validRevision).toBeGreaterThan(0);

      const corruptBytes = '{ "schema": "delivery.projects.host-index.v1", "revision": ';
      writeFileSync(hostIndexDocumentPath(host.hostRoot), corruptBytes);
      const hostListing = readdirSync(host.hostRoot).sort();

      const refused = await outsideHarness.run(["projects", "list", "--json"]);
      expect(refused.exitCode).toBe(2);
      expect(errorOf(refused)?.code).toBe("projects.registry-corrupt");
      expect(errorOf(refused)?.summary ?? "").toContain("host-index.json");
      expect(refused.envelope?.data).toBeUndefined();
      expect(readFileSync(hostIndexDocumentPath(host.hostRoot), "utf8")).toBe(corruptBytes);
      expect(readdirSync(host.hostRoot).sort()).toEqual(hostListing);
      expect(corruptSiblings(host.hostRoot)).toHaveLength(0);

      const repaired = await harness.run(["status", "--json"]);
      expect(repaired.exitCode).toBe(0);
      const siblings = corruptSiblings(host.hostRoot);
      expect(siblings).toHaveLength(1);
      expect(readFileSync(join(host.hostRoot, siblings[0] as string), "utf8")).toBe(corruptBytes);
      const fresh = hostIndexOf(host.hostRoot);
      expect(fresh?.revision).toBe(1);
      expect(fresh?.projects.map((entry) => entry.projectKey)).toEqual([harness.projectKey]);
      expect(existsSync(harness.stateLocation)).toBe(true);

      const recovered = await outsideHarness.run(["projects", "list", "--json"]);
      expect(recovered.exitCode).toBe(0);
      expect(dataOf(recovered).projects as readonly unknown[]).toHaveLength(1);
      expect(dataOf(recovered).hostIndexRevision).toBe(1);
      expect(recovered.stdout + recovered.stderr).not.toContain("projects.registry-corrupt");

      // A second maintenance pass over the now-valid index adds no sibling.
      await harness.run(["status", "--json"]);
      expect(corruptSiblings(host.hostRoot)).toHaveLength(1);

      // The negative control: a fresh host root with no index is a success.
      const cleanHost = createHostFixture("index-corrupt-control");
      try {
        const cleanCheckout = createRepository(`${cleanHost.hostRoot}-repos`, "clean-repo");
        const cleanHarness = createProductionProjectsHarness({
          label: "clean",
          host: cleanHost,
          workingDirectory: cleanCheckout,
          originUrl: "https://github.com/owner/clean.git",
        });
        harnesses.push(cleanHarness);
        const clean = await cleanHarness.run(["projects", "list", "--json"]);
        expect(clean.exitCode).toBe(0);
        expect(clean.stdout + clean.stderr).not.toContain("projects.registry-corrupt");
        removeDirectory(`${cleanHost.hostRoot}-repos`);
      } finally {
        cleanHost.dispose();
      }
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      removeDirectory(outside);
      host.dispose();
    }
  });
});

describe("TC-PROJ-010 revision, re-derived state location, and the recorded-value repair", () => {
  test("zero writes when unchanged, one write per change, and the derived location always wins", async () => {
    const host = createHostFixture("index-revision");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "revision-repo");
      seedPmNotes(checkout);
      const harness = harnessFor(host, "revision", checkout);
      harnesses.push(harness);
      await harness.run(["queue", "list", "--json"]);

      const counter = () => ({
        writes: harness.hostIndexAccess.writes,
        reads: harness.hostIndexAccess.reads,
        revision: hostIndexRevisionOf(host.hostRoot),
      });
      // Step 1: three unchanged invocations write nothing and advance nothing.
      for (let index = 0; index < 3; index += 1) {
        const before = counter();
        expect((await harness.run(["queue", "list", "--json"])).exitCode).toBe(0);
        const after = counter();
        expect(after.writes - before.writes).toBe(0);
        expect(after.reads - before.reads).toBe(1);
        expect(after.revision).toBe(before.revision);
      }

      // Step 2: a new checkout registers with exactly one write and one advance.
      const second = createRepository(base, "revision-second");
      const secondHarness = harnessFor(host, "revision-second", second);
      harnesses.push(secondHarness);
      const secondWritesBefore = secondHarness.hostIndexAccess.writes;
      const revisionBefore = hostIndexRevisionOf(host.hostRoot);
      expect((await secondHarness.run(["queue", "list", "--json"])).exitCode).toBe(0);
      expect(secondHarness.hostIndexAccess.writes - secondWritesBefore).toBe(1);
      expect(hostIndexRevisionOf(host.hostRoot)).toBe(revisionBefore + 1);

      // Step 3: the list reports the revision it read and performs no write.
      const beforeList = counter();
      const listed = await harness.run(["projects", "list", "--json"]);
      expect(listed.exitCode).toBe(0);
      expect(dataOf(listed).hostIndexRevision).toBe(beforeList.revision);
      expect(counter().writes).toBe(beforeList.writes);

      // Steps 4-5: a tampered recorded location is never trusted.
      const injected = "/tmp/gh288-not-a-project";
      const document = hostIndexOf(host.hostRoot);
      const tampered = (document?.projects ?? []).map((entry) =>
        entry.projectKey === harness.projectKey ? { ...entry, stateLocation: injected } : entry,
      );
      writeFileSync(
        hostIndexDocumentPath(host.hostRoot),
        `${JSON.stringify({ schema: document?.schema, revision: document?.revision, projects: tampered }, null, 2)}\n`,
      );
      const tamperedList = await harness.run(["projects", "list", "--json"]);
      expect(tamperedList.exitCode).toBe(0);
      const rows = dataOf(tamperedList).projects as readonly Record<string, unknown>[];
      const row = rows.find((entry) => entry.projectKey === harness.projectKey);
      expect(row?.stateLocation).toBe(harness.stateLocation);
      expect(row?.stateLocation).not.toBe(injected);
      expect(tamperedList.stderr).toContain(harness.projectKey);
      expect(tamperedList.stderr).toContain("disagree");
      expect(existsSync(injected)).toBe(false);

      // Step 6: the next store-opening invocation repairs the recorded value once.
      const beforeRepair = counter();
      expect((await harness.run(["status", "--json"])).exitCode).toBe(0);
      const afterRepair = counter();
      expect(afterRepair.writes - beforeRepair.writes).toBe(1);
      expect(afterRepair.revision).toBe(beforeRepair.revision + 1);
      expect(hostIndexEntryOf(host.hostRoot, harness.projectKey)?.stateLocation).toBe(
        harness.stateLocation,
      );

      // Tampering with another field never changes the reported location.
      const current = hostIndexOf(host.hostRoot);
      const changedRoot = (current?.projects ?? []).map((entry) =>
        entry.projectKey === harness.projectKey ? { ...entry, root: "/nowhere/at/all" } : entry,
      );
      writeFileSync(
        hostIndexDocumentPath(host.hostRoot),
        `${JSON.stringify({ schema: current?.schema, revision: current?.revision, projects: changedRoot }, null, 2)}\n`,
      );
      const changed = await harness.run(["projects", "list", "--json"]);
      const changedRow = (dataOf(changed).projects as readonly Record<string, unknown>[]).find(
        (entry) => entry.projectKey === harness.projectKey,
      );
      expect(changedRow?.stateLocation).toBe(harness.stateLocation);
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});
