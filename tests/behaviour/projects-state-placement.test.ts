/**
 * GH-288 TC-PROJ-021 — write placement, override honouring, read parity, and the
 * runtime-aware edge's audit store.
 *
 * The temporary home is a distinct directory from the host root, so "the store
 * honours the override" is observable: a store that ignored it would land under
 * the home default and fail here.
 */
import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createProductionDependencies } from "../../packages/cli/src/edge";
import { runCli } from "../../packages/cli/src/index";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
} from "../fixtures/projects/production";
import { createHostFixture } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";
import { writeProviderProfilesConfig } from "../fixtures/queue/production/harness";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const REF = "GH-241";
const PM_NOTES = `---
change_id: ${REF}
title: "placement fixture"
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

const seedChange = (checkout: string): void => {
  const folder = join(checkout, "doc", "changes", "2026-11", `2026-11-11--${REF}--placement`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `chg-${REF}-pm-notes.yaml`), PM_NOTES);
};

const list = (directory: string): readonly string[] =>
  existsSync(directory) ? readdirSync(directory).sort() : [];

const dataOf = (run: { readonly envelope?: Record<string, unknown> }): Record<string, unknown> => {
  const data = run.envelope?.data as Record<string, unknown> | undefined;
  if (data === undefined) throw new Error("no data envelope");
  return data;
};

describe("TC-PROJ-021 write placement and override honouring", () => {
  it("every artifact lands under the project root, the home default stays absent, and reads agree", async () => {
    const host = createHostFixture("state-placement");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "placement-repo");
      // GH-294 phase 12 (F-1): dispatch admission reads the provider profiles
      // (fail-closed on the shipped empty default), so the fixture declares
      // the minimal branch before any dispatch runs.
      writeProviderProfilesConfig(checkout);
      seedChange(checkout);
      const harness = createProductionProjectsHarness({
        label: "placement",
        host,
        workingDirectory: checkout,
        originUrl: "https://github.com/owner/placement.git",
      });
      harnesses.push(harness);

      const homeDefault = join(host.home, harness.brand.stateDirectoryName);
      expect(existsSync(homeDefault)).toBe(false);

      expect(
        (await harness.run(["phase", "complete", REF, "delivery", "--no-commit", "--json"]))
          .exitCode,
      ).toBe(0);
      expect((await harness.run(["queue", "add", REF, "--priority", "5", "--json"])).exitCode).toBe(
        0,
      );
      expect((await harness.run(["dispatch", REF, "--json"])).exitCode).toBe(0);

      // The delivered layout, under the project root and nowhere else.
      const artifacts = list(harness.stateLocation);
      expect(artifacts).toContain("ledger.default.jsonl");
      expect(artifacts).toContain("header.default.json");
      expect(artifacts).toContain("documents.default");
      expect(list(join(harness.stateLocation, "documents.default"))).toContain(
        `phase-state.${REF}.json`,
      );
      // No artifact at the host root and nothing under the home default.
      expect(list(host.hostRoot)).toEqual(["host-index.json", "projects"]);
      expect(existsSync(homeDefault)).toBe(false);

      // Read parity: the same surfaces observe what step 1 wrote.
      const queueList = await harness.run(["queue", "list", "--json"]);
      expect(queueList.exitCode).toBe(0);
      expect(dataOf(queueList).entries as readonly unknown[]).toHaveLength(1);
      const lanes = await harness.run(["lanes", "list", "--json"]);
      expect(lanes.exitCode).toBe(0);
      const status = await harness.run(["status", "--json"]);
      expect(status.exitCode).toBe(0);
      // `retro collect` reads the project state root; with no harness telemetry
      // in this fixture it may report a bounded absence, so the assertion is its
      // exit class plus the placement fact below (no host-root store appears).
      const retro = await harness.run(["retro", "collect", "--json"]);
      expect([0, 1]).toContain(retro.exitCode);
      // `spend` reads the project ledger; without captured telemetry it reports
      // the delivered `spend.telemetry-absent` refusal at exit 1, which is an
      // honest read of the same root rather than an empty host-root store.
      const spend = await harness.run(["spend", "--json"]);
      expect([0, 1]).toContain(spend.exitCode);
      // Nothing was re-created at the host root by those reads.
      expect(list(host.hostRoot)).toEqual(["host-index.json", "projects"]);

      // The runtime-aware edge's audit store resolves the same project root.
      const program = {
        commands: {
          status: { handler: () => ({ data: { ok: true } }) },
        },
      };
      const deps = createProductionDependencies({
        brand: harness.brand,
        program,
        environment: {
          HOME: host.home,
          [stateVariable(harness.brand.environmentPrefix)]: host.hostRoot,
        },
        cwd: checkout,
        workspaceId: "default",
        fenceNamespace: "cli-audit",
        isTTY: false,
      });
      expect(deps.audit).toBeDefined();
      expect(
        await runCli(["--json", "status"], { stdout: bufferSink(), stderr: bufferSink() }, deps),
      ).toBe(0);
      const auditRecords = readFileSync(
        join(harness.stateLocation, "ledger.default.jsonl"),
        "utf8",
      );
      expect(auditRecords).toContain("audit.invocation");
      expect(existsSync(join(host.hostRoot, "ledger.default.jsonl"))).toBe(false);
      expect(existsSync(homeDefault)).toBe(false);
    } finally {
      for (const record of harnesses) record.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

const stateVariable = (environmentPrefix: string): string =>
  `${environmentPrefix.toUpperCase().replace(/_+$/u, "")}_STATE_DIR`;

/** The synthetic brand is unused here; kept for the fixture contract. */
void SYNTHETIC_BRAND;
