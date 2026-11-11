/**
 * GH-288 TC-PROJ-014, TC-PROJ-015 and TC-PROJ-016 — the handover projection.
 *
 * Every cell is seeded through the delivered ledger APIs (`appendDispatchHandover`
 * for the folded truth, `writeDispatchAuthority` for the derived document), so
 * the assertions are about the projection rather than about fixture JSON. The
 * malformed cells write raw bytes because the document is untrusted input by
 * contract, and the projection must tell "malformed" apart from "absent".
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendDispatchHandover,
  writeDispatchAuthority,
} from "../../packages/core/src/app/dispatch-ledger";
import { projectHandoverState } from "../../packages/core/src/app/projects";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";

import {
  DISPATCH_AUTHORITY_DOCUMENT_NAME,
  DISPATCH_HANDOVER_PAYLOAD_SCHEMA,
  type DispatchHandoverOperation,
  type DispatchHandoverRecord,
} from "../../packages/core/src/contracts/dispatch";
import { makeAuthorityView, makeHandover } from "../fixtures/dispatch/ledger";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  type ProductionRun,
} from "../fixtures/projects/production";
import { createHostFixture } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

type Envelope = {
  readonly data?: { readonly projects?: readonly Record<string, unknown>[] };
  readonly error?: { readonly code?: string };
};

const dataOf = (run: ProductionRun): { readonly projects: readonly Record<string, unknown>[] } => {
  const envelope = run.envelope as Envelope | undefined;
  const data = envelope?.data;
  if (data?.projects === undefined) throw new Error(`no data envelope: ${run.stdout}${run.stderr}`);
  return data as { readonly projects: readonly Record<string, unknown>[] };
};

const handoverOf = (run: ProductionRun, projectKey: string): unknown =>
  dataOf(run).projects.find((entry) => entry.projectKey === projectKey)?.handoverState;

const register = async (harness: ProductionProjectsHarness): Promise<void> => {
  const run = await harness.run(["queue", "list", "--json"]);
  if (run.exitCode !== 0) throw new Error(`registration failed: ${run.stderr}`);
};

const handoverRecord = (
  repository: string,
  operation: DispatchHandoverOperation,
  recordedAt: string,
): DispatchHandoverRecord => ({
  ...makeHandover({ operation, recordedAt }),
  schema: DISPATCH_HANDOVER_PAYLOAD_SCHEMA,
  repository,
});

const appendTruth = (
  harness: ProductionProjectsHarness,
  operation: DispatchHandoverOperation,
  recordedAt: string,
): void => {
  const record = handoverRecord(`github.com/owner/${harness.projectKey}`, operation, recordedAt);
  const result = appendDispatchHandover(
    harness.store,
    `fence-${harness.projectKey}-${recordedAt}`,
    record,
  );
  if (!result.ok) throw new Error(`handover append failed: ${result.code}`);
};

const writeView = (
  harness: ProductionProjectsHarness,
  authority: "authoritative" | "dual-run",
): void => {
  const repository = `github.com/owner/${harness.projectKey}`;
  const result = writeDispatchAuthority(
    harness.store,
    `fence-view-${harness.projectKey}`,
    makeAuthorityView({ repository, authority, recordedAt: "2026-11-11T09:00:00.000Z" }),
  );
  if (!result.ok) throw new Error(`authority write failed: ${result.code}`);
};

const writeRawAuthority = (harness: ProductionProjectsHarness, bytes: string): void => {
  // The store requires a private documents directory; the raw provocation
  // honours the same mode so the read reaches the parser, not a mode refusal.
  const directory = join(harness.stateLocation, "documents.default");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(join(directory, DISPATCH_AUTHORITY_DOCUMENT_NAME), bytes, { mode: 0o600 });
};

const cell = async (
  host: ReturnType<typeof createHostFixture>,
  base: string,
  label: string,
): Promise<ProductionProjectsHarness> => {
  const checkout = createRepository(base, `${label}-repo`);
  const harness = createProductionProjectsHarness({
    label,
    host,
    workingDirectory: checkout,
    originUrl: `https://github.com/owner/${label}.git`,
  });
  await register(harness);
  return harness;
};

describe("TC-PROJ-014 and TC-PROJ-015 the eight-cell handover matrix", () => {
  test("engine only on agreement, shell as the safe default, in-transition only on disagreement", async () => {
    const host = createHostFixture("handover-matrix");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const a = await cell(host, base, "cell-a");
      const b = await cell(host, base, "cell-b");
      const c = await cell(host, base, "cell-c");
      const d = await cell(host, base, "cell-d");
      const e = await cell(host, base, "cell-e");
      const f = await cell(host, base, "cell-f");
      const g = await cell(host, base, "cell-g");
      const h = await cell(host, base, "cell-h");
      const reversal = await cell(host, base, "cell-reversal");
      harnesses.push(a, b, c, d, e, f, g, h, reversal);

      // (a) authoritative + authoritative
      appendTruth(a, "authoritative", "2026-11-11T08:00:00.000Z");
      writeView(a, "authoritative");
      // (b) dual-run + dual-run
      appendTruth(b, "dual-run", "2026-11-11T08:00:00.000Z");
      writeView(b, "dual-run");
      // (c) dual-run + no derived document
      appendTruth(c, "dual-run", "2026-11-11T08:00:00.000Z");
      // (d) no handover record + no derived document
      // (e) authoritative + absent
      appendTruth(e, "authoritative", "2026-11-11T08:00:00.000Z");
      // (f) authoritative + dual-run
      appendTruth(f, "authoritative", "2026-11-11T08:00:00.000Z");
      writeView(f, "dual-run");
      // (g) authoritative + malformed (out-of-shape JSON, then unparsable bytes)
      appendTruth(g, "authoritative", "2026-11-11T08:00:00.000Z");
      writeRawAuthority(
        g,
        JSON.stringify({
          schema: "delivery.dispatch.authority.v0",
          repository: "github.com/owner/cell-g",
          authority: "authoritative",
          recordedAt: "",
          reversalAvailable: false,
        }),
      );
      // (h) dual-run + authoritative
      appendTruth(h, "dual-run", "2026-11-11T08:00:00.000Z");
      writeView(h, "authoritative");
      // The reversal sequence: authoritative, then dual-run, with the view left
      // at authoritative after the first write.
      appendTruth(reversal, "authoritative", "2026-11-11T08:00:00.000Z");
      writeView(reversal, "authoritative");
      appendTruth(reversal, "dual-run", "2026-11-11T09:00:00.000Z");

      const listed = await a.run(["projects", "list", "--json"]);
      expect(listed.exitCode, listed.stdout + listed.stderr).toBe(0);
      const expected: readonly [ProductionProjectsHarness, string][] = [
        [a, "engine"],
        [b, "shell"],
        [c, "shell"],
        [d, "shell"],
        [e, "in-transition"],
        [f, "in-transition"],
        [g, "in-transition"],
        [h, "in-transition"],
        [reversal, "in-transition"],
      ];
      for (const [harness, state] of expected) {
        expect(handoverOf(listed, harness.projectKey), harness.projectKey).toBe(state);
      }

      // The malformed sub-case: valid JSON with a wrong schema is malformed too.
      writeRawAuthority(g, "{ not json");
      const reparsed = await a.run(["projects", "list", "--json"]);
      expect(reparsed.exitCode).toBe(0);
      expect(handoverOf(reparsed, g.projectKey)).toBe("in-transition");

      // Rewriting the view catches the shell up: the reversal cell becomes shell.
      writeView(reversal, "dual-run");
      const caughtUp = await a.run(["projects", "list", "--json"]);
      expect(handoverOf(caughtUp, reversal.projectKey)).toBe("shell");

      // No fourth value is ever produced across the matrix.
      for (const run of [listed, reparsed, caughtUp]) {
        for (const entry of dataOf(run).projects) {
          expect(["engine", "shell", "in-transition"]).toContain(entry.handoverState);
        }
      }

      // The direct unit call returns the same values, so no CLI default masks a
      // projection regression.
      expect(
        projectHandoverState({
          operation: "authoritative",
          authority: { state: "valid", authority: "authoritative" },
        }),
      ).toBe("engine");
      expect(
        projectHandoverState({
          operation: "dual-run",
          authority: { state: "valid", authority: "dual-run" },
        }),
      ).toBe("shell");
      expect(projectHandoverState({ operation: "dual-run", authority: { state: "absent" } })).toBe(
        "shell",
      );
      expect(projectHandoverState({ operation: "none", authority: { state: "absent" } })).toBe(
        "shell",
      );
      expect(
        projectHandoverState({ operation: "authoritative", authority: { state: "absent" } }),
      ).toBe("in-transition");
      expect(
        projectHandoverState({
          operation: "authoritative",
          authority: { state: "valid", authority: "dual-run" },
        }),
      ).toBe("in-transition");
      expect(
        projectHandoverState({ operation: "authoritative", authority: { state: "malformed" } }),
      ).toBe("in-transition");
      expect(
        projectHandoverState({
          operation: "dual-run",
          authority: { state: "valid", authority: "authoritative" },
        }),
      ).toBe("in-transition");
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

describe("TC-PROJ-016 no invented handover state; unreadable state location is an error", () => {
  test("the implication holds both ways, and an unreadable root fails the whole answer", async () => {
    const host = createHostFixture("handover-invention");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const agree = await cell(host, base, "agree");
      const disagreeAbsent = await cell(host, base, "disagree-absent");
      const blocked = await cell(host, base, "blocked");
      harnesses.push(agree, disagreeAbsent, blocked);

      appendTruth(agree, "authoritative", "2026-11-11T08:00:00.000Z");
      writeView(agree, "authoritative");
      appendTruth(disagreeAbsent, "authoritative", "2026-11-11T08:00:00.000Z");

      const listed = await agree.run(["projects", "list", "--json"]);
      expect(listed.exitCode).toBe(0);
      expect(handoverOf(listed, agree.projectKey)).toBe("engine");
      expect(handoverOf(listed, disagreeAbsent.projectKey)).toBe("in-transition");

      // Replace the blocked project's derived state location with a regular file.
      const blockedLocation = projectStateRoot(host.hostRoot, blocked.projectKey);
      removeDirectory(blockedLocation);
      mkdirSync(join(blockedLocation, ".."), { recursive: true });
      writeFileSync(blockedLocation, "opaque\n");
      const before = {
        bytes: readFileSync(blockedLocation, "utf8"),
        mtimeMs: statSync(blockedLocation).mtimeMs,
      };

      const failed = await agree.run(["projects", "list", "--json"]);
      expect(failed.exitCode).toBe(2);
      const envelope = failed.envelope as Envelope | undefined;
      expect(envelope?.error?.code).toBe("projects.state-unavailable");
      expect(envelope?.data).toBeUndefined();
      expect(failed.stdout).not.toContain("handoverState");
      expect(readFileSync(blockedLocation, "utf8")).toBe(before.bytes);
      expect(statSync(blockedLocation).mtimeMs).toBe(before.mtimeMs);
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});
