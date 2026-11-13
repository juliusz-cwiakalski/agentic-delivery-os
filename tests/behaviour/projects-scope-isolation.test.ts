/**
 * GH-288 TC-PROJ-001 and TC-PROJ-002 — two checkouts, one ref, one host.
 *
 * Two real repositories working the same ref record phase state and queue
 * entries through the delivered production composition. The assertions are
 * cross-store record checks: the file names and record keys are deliberately
 * identical under both project roots, so "the paths differ" alone would prove
 * nothing.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { QUEUE_ENTRY_KEY_PREFIX } from "../../packages/core/src/contracts/queue";
import {
  createProductionProjectsHarness,
  namesOf,
  type ProductionProjectsHarness,
} from "../fixtures/projects/production";
import { createHostFixture } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";
import { writeProviderProfilesConfig } from "../fixtures/queue/production/harness";

const REF = "GH-241";
const WORKSPACE = "default";

/** The delivered pm-notes fixture every checkout carries for the shared ref. */
const PM_NOTES = `---
change_id: ${REF}
title: "two checkouts, one ref"
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
  const folder = join(checkout, "doc", "changes", "2026-11", `2026-11-11--${REF}--same-ref`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `chg-${REF}-pm-notes.yaml`), PM_NOTES);
};

const phaseDocumentPath = (projectRoot: string): string =>
  join(projectRoot, `documents.${WORKSPACE}`, `phase-state.${REF}.json`);

const ledgerPath = (projectRoot: string): string => join(projectRoot, `ledger.${WORKSPACE}.jsonl`);

/** Every queue record the store wrote for the shared ref, read from the ledger. */
const queueRecordsOf = (projectRoot: string): readonly Record<string, unknown>[] => {
  const path = ledgerPath(projectRoot);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((record) => String(record.key ?? "").startsWith(QUEUE_ENTRY_KEY_PREFIX));
};

const dataOf = (run: { readonly envelope?: Record<string, unknown> }): Record<string, unknown> => {
  const data = run.envelope?.data;
  if (data === undefined) throw new Error("the run produced no data envelope");
  return data as Record<string, unknown>;
};

/** The store artifact names forbidden directly under the host root (TC-PROJ-001). */
const HOST_ROOT_STORE_ARTIFACTS = [
  `ledger.${WORKSPACE}.jsonl`,
  `header.${WORKSPACE}.json`,
  `index.${WORKSPACE}.sqlite`,
  `fence.${WORKSPACE}.lock`,
  `documents.${WORKSPACE}`,
  `quarantine.${WORKSPACE}`,
  `chain-key.${WORKSPACE}.json`,
  `chain-key.retro.${WORKSPACE}.json`,
  `retro-evidence.${WORKSPACE}.jsonl`,
  "retro-evidence.lock",
];

describe("TC-PROJ-001 two checkouts, one ref: disjoint phase and queue state", () => {
  test("each checkout owns its own phase document and queue record", async () => {
    const host = createHostFixture("scope-isolation");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkoutA = createRepository(base, "checkout-a");
      const checkoutB = createRepository(base, "checkout-b");
      // GH-294 phase 12 (F-1): dispatch admission reads the provider profiles
      // (fail-closed on the shipped empty default); both checkouts declare the
      // minimal branch before any dispatch runs.
      writeProviderProfilesConfig(checkoutA);
      writeProviderProfilesConfig(checkoutB);
      seedPmNotes(checkoutA);
      seedPmNotes(checkoutB);
      const a = createProductionProjectsHarness({
        label: "scope-a",
        host,
        workingDirectory: checkoutA,
        originUrl: "https://github.com/owner/repo-a.git",
      });
      const b = createProductionProjectsHarness({
        label: "scope-b",
        host,
        workingDirectory: checkoutB,
        originUrl: "https://github.com/owner/repo-b.git",
      });
      harnesses.push(a, b);

      expect(a.projectKey).not.toBe(b.projectKey);
      expect(a.stateLocation).not.toBe(b.stateLocation);
      for (const key of [a.projectKey, b.projectKey]) {
        expect(key).not.toContain("/");
        expect([".", ".."]).not.toContain(key);
      }

      const queueA = await a.run(["queue", "add", REF, "--priority", "1", "--json"]);
      const queueB = await b.run(["queue", "add", REF, "--priority", "5", "--json"]);
      expect(queueA.exitCode).toBe(0);
      expect(queueB.exitCode).toBe(0);

      const phaseA1 = await a.run(["phase", "complete", REF, "delivery", "--no-commit", "--json"]);
      const phaseA2 = await a.run([
        "phase",
        "complete",
        REF,
        "system_spec_update",
        "--no-commit",
        "--json",
      ]);
      const phaseB = await b.run(["phase", "complete", REF, "delivery", "--no-commit", "--json"]);
      expect(phaseA1.exitCode).toBe(0);
      expect(phaseA2.exitCode).toBe(0);
      expect(phaseB.exitCode).toBe(0);

      // Two distinct project roots under the shared host root.
      expect(a.stateLocation.startsWith(join(host.hostRoot, "projects"))).toBe(true);
      expect(b.stateLocation.startsWith(join(host.hostRoot, "projects"))).toBe(true);

      const documentA = JSON.parse(readFileSync(phaseDocumentPath(a.stateLocation), "utf8")) as {
        readonly phases?: Record<string, { readonly completed?: string | null }>;
      };
      const documentB = JSON.parse(readFileSync(phaseDocumentPath(b.stateLocation), "utf8")) as {
        readonly phases?: Record<string, { readonly completed?: string | null }>;
      };
      const completedA = Object.values(documentA.phases ?? {}).filter(
        (entry) => entry.completed !== null && entry.completed !== undefined,
      ).length;
      const completedB = Object.values(documentB.phases ?? {}).filter(
        (entry) => entry.completed !== null && entry.completed !== undefined,
      ).length;
      expect(completedA).toBe(2);
      expect(completedB).toBe(1);

      const recordsA = queueRecordsOf(a.stateLocation);
      const recordsB = queueRecordsOf(b.stateLocation);
      expect(recordsA.length).toBeGreaterThan(0);
      expect(recordsB.length).toBeGreaterThan(0);
      const priorityOf = (records: readonly Record<string, unknown>[]): readonly unknown[] =>
        records.map((record) => (record.payload as { readonly priority?: unknown })?.priority);
      expect(priorityOf(recordsA)).toEqual([1]);
      expect(priorityOf(recordsB)).toEqual([5]);
      expect(priorityOf(recordsA)).not.toContain(5);
      expect(priorityOf(recordsB)).not.toContain(1);

      // The delivered layout: the same artifact names under each root, and no
      // store artifact directly under the host root.
      expect(a.fileList(a.stateLocation)).toContain(
        `documents.${WORKSPACE}/phase-state.${REF}.json`,
      );
      expect(b.fileList(b.stateLocation)).toContain(
        `documents.${WORKSPACE}/phase-state.${REF}.json`,
      );
      const atHost = namesOf(host.hostRoot);
      for (const forbidden of HOST_ROOT_STORE_ARTIFACTS) expect(atHost).not.toContain(forbidden);
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

describe("TC-PROJ-002 no read surface observes the other checkout", () => {
  test("every read surface and dispatch stays inside its own project", async () => {
    const host = createHostFixture("scope-read-surfaces");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkoutA = createRepository(base, "reads-a");
      const checkoutB = createRepository(base, "reads-b");
      // GH-294 phase 12 (F-1): dispatch admission reads the provider profiles
      // (fail-closed on the shipped empty default); both checkouts declare the
      // minimal branch before any dispatch runs.
      writeProviderProfilesConfig(checkoutA);
      writeProviderProfilesConfig(checkoutB);
      seedPmNotes(checkoutA);
      seedPmNotes(checkoutB);
      const a = createProductionProjectsHarness({
        label: "reads-a",
        host,
        workingDirectory: checkoutA,
        originUrl: "https://github.com/owner/repo-a.git",
      });
      const b = createProductionProjectsHarness({
        label: "reads-b",
        host,
        workingDirectory: checkoutB,
        originUrl: "https://github.com/owner/repo-b.git",
      });
      harnesses.push(a, b);

      await a.run(["queue", "add", REF, "--priority", "1", "--json"]);
      await b.run(["queue", "add", REF, "--priority", "5", "--json"]);
      await a.run(["phase", "complete", REF, "delivery", "--no-commit", "--json"]);
      await a.run(["phase", "complete", REF, "system_spec_update", "--no-commit", "--json"]);
      await b.run(["phase", "complete", REF, "delivery", "--no-commit", "--json"]);

      const outputs = new Map<ProductionProjectsHarness, string[]>();
      const capture = async (harness: ProductionProjectsHarness, argv: readonly string[]) => {
        const run = await harness.run([...argv]);
        const captured = outputs.get(harness) ?? [];
        captured.push(run.stdout, run.stderr);
        outputs.set(harness, captured);
        return run;
      };

      const phaseListA = await capture(a, ["phase", "list", REF, "--json"]);
      const phaseListB = await capture(b, ["phase", "list", REF, "--json"]);
      expect(phaseListA.exitCode).toBe(0);
      expect(phaseListB.exitCode).toBe(0);
      const completedCount = (run: { readonly envelope?: Record<string, unknown> }): number => {
        const phases = dataOf(run).phases as Record<string, { readonly completed?: string | null }>;
        return Object.values(phases).filter(
          (entry) => entry.completed !== null && entry.completed !== undefined,
        ).length;
      };
      expect(completedCount(phaseListA)).toBe(2);
      expect(completedCount(phaseListB)).toBe(1);

      const queueListA = await capture(a, ["queue", "list", "--json"]);
      const queueListB = await capture(b, ["queue", "list", "--json"]);
      expect(queueListA.exitCode).toBe(0);
      expect(queueListB.exitCode).toBe(0);
      const entriesA = dataOf(queueListA).entries as readonly { readonly priority?: number }[];
      const entriesB = dataOf(queueListB).entries as readonly { readonly priority?: number }[];
      expect(entriesA.map((entry) => entry.priority)).toEqual([1]);
      expect(entriesB.map((entry) => entry.priority)).toEqual([5]);

      const lanesA = await capture(a, ["lanes", "list", "--json"]);
      const lanesB = await capture(b, ["lanes", "list", "--json"]);
      expect(lanesA.exitCode).toBe(0);
      expect(lanesB.exitCode).toBe(0);

      const statusA = await capture(a, ["status", "--json"]);
      const statusB = await capture(b, ["status", "--json"]);
      expect(statusA.exitCode).toBe(0);
      expect(statusB.exitCode).toBe(0);

      const attemptsBeforeB = readDispatchAttempts(b.store);
      expect(attemptsBeforeB.ok).toBe(true);
      const dispatchA = await capture(a, ["dispatch", REF, "--json"]);
      const dispatchB = await capture(b, ["dispatch", REF, "--json"]);
      expect([dispatchA.exitCode, dispatchB.exitCode]).toEqual([0, 0]);
      const attemptsA = readDispatchAttempts(a.store);
      const attemptsAfterB = readDispatchAttempts(b.store);
      expect(attemptsA.ok).toBe(true);
      expect(attemptsAfterB.ok).toBe(true);
      if (!attemptsA.ok || !attemptsBeforeB.ok || !attemptsAfterB.ok) return;
      expect(attemptsA.records).toHaveLength(1);
      expect(attemptsAfterB.records).toHaveLength(attemptsBeforeB.records.length + 1);

      // The other project's key, root, and state location never appear.
      for (const [mine, other] of [
        [a, b],
        [b, a],
      ] as const) {
        for (const text of outputs.get(mine) ?? []) {
          expect(text).not.toContain(other.projectKey);
          expect(text).not.toContain(other.stateLocation);
          expect(text).not.toContain(other.checkout);
        }
      }
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});
