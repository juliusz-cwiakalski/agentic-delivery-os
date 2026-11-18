/**
 * TC-ENGINE-035 — no-flip discipline.
 *
 * Two falsifiable properties: the only writer of `dispatch.handover` records is
 * the handover use case (the flip and the revert), and every read surface appends
 * nothing. The source scan proves the writer set and the absence of a
 * cross-import; the behavioural half proves a summary read, a fleet read, and a
 * replayed noop leave the handover ledger and the authority document untouched.
 * The permanent half of AMB-ENG-3 (no authoritative record attributable to this
 * change in this repository) is an audit recorded in test-plan §10, never
 * asserted here against a live state root.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readDispatchAuthority } from "../../packages/adapters/src/file/dispatch-authority";
import {
  handoverDispatchEvidence,
  revertDispatchHandoverEvidence,
  summarizeDispatchEvidence,
} from "../../packages/core/src/app/dispatch-gate";
import {
  appendDispatchAttempt,
  readDispatchHandover,
} from "../../packages/core/src/app/dispatch-ledger";
import { buildAttempts, eligibleSpecs } from "../fixtures/dispatch/evidence-windows";
import { createDispatchState } from "../fixtures/dispatch/harness";
import { REPOSITORY } from "../fixtures/dispatch/ledger";

const ROOT = process.cwd();

const listSourceFiles = (relative: string): readonly string[] => {
  const results: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
      const next = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) {
        results.push(next);
      }
    }
  };
  walk(relative);
  return results.sort();
};

describe("TC-ENGINE-035 the writer set is exactly the handover use case", () => {
  test("only the handover/revert use cases call the handover append", () => {
    const callers = listSourceFiles("packages")
      .filter((file) => readFileSync(join(ROOT, file), "utf8").includes("appendDispatchHandover("))
      .filter((file) => !file.startsWith("packages/core/src/app/dispatch-ledger.ts"));
    // The use case module (app/dispatch-gate.ts) is the only caller; the ledger
    // module defines the function and is excluded above.
    expect(callers).toEqual(["packages/core/src/app/dispatch-gate.ts"]);
    const useCase = readFileSync(join(ROOT, "packages/core/src/app/dispatch-gate.ts"), "utf8");
    // Both operations write through it: the flip and the revert.
    expect(useCase.split("appendDispatchHandover(").length - 1).toBe(2);
    for (const reader of [
      "packages/core/src/app/projects.ts",
      "packages/cli/src/commands/repos.ts",
      "packages/cli/src/output/repos-text.ts",
      "packages/cli/src/commands/dispatch.ts",
    ]) {
      const source = readFileSync(join(ROOT, reader), "utf8");
      expect(source, reader).not.toContain("appendDispatchHandover");
      expect(source, reader).not.toContain("handoverDispatchEvidence");
      expect(source, reader).not.toContain("revertDispatchHandoverEvidence");
    }
  });

  test("the fleet read composes no flip helper", () => {
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    const readRepos = production.slice(production.indexOf("const readRepos = async"));
    const block = readRepos.slice(0, readRepos.indexOf("const readProjects"));
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toContain("handoverDispatchEvidence");
    expect(block).not.toContain("appendDispatchHandover");
  });
});

describe("TC-ENGINE-035 reads append nothing", () => {
  test("summary, fleet-shaped gate read, and a replayed noop leave the ledger and authority intact", () => {
    const state = createDispatchState("no-flip");
    try {
      for (const attempt of buildAttempts(eligibleSpecs())) {
        const appended = appendDispatchAttempt(state.store, state.fenceToken, attempt);
        if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
      }
      const before = readDispatchHandover(state.store);
      if (!before.ok) throw new Error("ledger read failed");
      // The flip is the one writer: it lands exactly one record and derives the
      // authority document.
      const flip = handoverDispatchEvidence({
        store: state.store,
        fenceToken: state.fenceToken,
        repository: REPOSITORY,
        scope: "production",
        nowIso: "2026-11-08T10:00:00.000Z",
        principal: "coder@local",
      });
      expect(flip.ok && flip.data.recorded).toBe(true);
      const flipped = readDispatchHandover(state.store);
      if (!flipped.ok) throw new Error("ledger read failed");
      expect(flipped.records.length).toBe(before.records.length + 1);
      const authorityBefore = readDispatchAuthority(state.root, REPOSITORY);
      expect(authorityBefore.authority).toBe("authoritative");

      // A summary read appends nothing.
      const summary = summarizeDispatchEvidence({
        store: state.store,
        repository: REPOSITORY,
        scope: "production",
        nowIso: "2026-11-08T10:01:00.000Z",
      });
      expect(summary.ok).toBe(true);
      // A replayed flip is answered as a noop and appends nothing.
      const replay = handoverDispatchEvidence({
        store: state.store,
        fenceToken: state.fenceToken,
        repository: REPOSITORY,
        scope: "production",
        nowIso: "2026-11-08T10:02:00.000Z",
        principal: "coder@local",
      });
      expect(replay.ok && replay.data.noop).toBe(true);

      const afterReads = readDispatchHandover(state.store);
      if (!afterReads.ok) throw new Error("ledger read failed");
      expect(afterReads.records.length).toBe(before.records.length + 1);
      expect(readDispatchAuthority(state.root, REPOSITORY)).toEqual(authorityBefore);

      // The recorded revert is the second (and last) writer; the replay of it
      // is the declared noop and appends nothing.
      const revert = revertDispatchHandoverEvidence({
        store: state.store,
        fenceToken: state.fenceToken,
        repository: REPOSITORY,
        scope: "production",
        nowIso: "2026-11-08T10:03:00.000Z",
        principal: "coder@local",
      });
      expect(revert.ok && revert.data.recorded).toBe(true);
      const noop = revertDispatchHandoverEvidence({
        store: state.store,
        fenceToken: state.fenceToken,
        repository: REPOSITORY,
        scope: "production",
        nowIso: "2026-11-08T10:04:00.000Z",
        principal: "coder@local",
      });
      expect(noop.ok && noop.data.noop).toBe(true);
      const after = readDispatchHandover(state.store);
      if (!after.ok) throw new Error("ledger read failed");
      expect(after.records.length).toBe(before.records.length + 2);
      expect(readDispatchAuthority(state.root, REPOSITORY).authority).toBe("dual-run");
      console.log(
        `TC-ENGINE-035 records before=${String(before.records.length)} after=${String(after.records.length)} authority=${authorityBefore.authority}->dual-run`,
      );
      expect(statSync(state.root).isDirectory()).toBe(true);
    } finally {
      state.dispose();
    }
  });
});
