/**
 * GH-309 TC-GRPRO-001 / NFR-2 / AC-NFR2-1 / DoD-13 — the group and flat reads
 * perform exactly the two delivered permitted side effects.
 *
 * A tree snapshot before and after each read proves the write posture: no index
 * maintenance, no prune, no store-content write, no workspace-scan write. The
 * only permitted effects are the create-once identity marker (inside the
 * checkout's git common directory, outside the host root) and the read-only
 * store handle's removal of a leftover `*.tmp` sibling. Classified failures
 * write nothing at all.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hostIndexDocumentPath } from "../../packages/adapters/src/file/host-index-store";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";
import { PROJECT_IDENTITY_MARKER_NAME } from "../../packages/core/src/contracts/projects";
import {
  createMemberCheckout,
  projectGroupsConfigPathFor,
  projectGroupsDocument,
  writeProjectGroupsConfig,
} from "../fixtures/projects/groups";
import { hostIndexTextOf } from "../fixtures/projects/host-index";
import { snapshotDifferences, snapshotTree } from "../fixtures/projects/host-root";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
} from "../fixtures/projects/production";
import {
  createHostFixture,
  type HostFixture,
  nonCheckoutDirectory,
} from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

type AuditFixture = {
  readonly host: HostFixture;
  readonly workspace: string;
  readonly controller: ProductionProjectsHarness;
  readonly repoKeys: readonly [string, string];
  readonly stale: string;
  readonly staleName: string;
  readonly dispose: () => void;
};

/** One host with a group, two observed members, and a leftover store temp. */
const createAuditFixture = (label: string): AuditFixture => {
  const host = createHostFixture(label);
  const workspace = `${host.hostRoot}-workspace`;
  mkdirSync(workspace, { recursive: true });
  const a = createMemberCheckout(workspace, "member-a", host);
  const b = createMemberCheckout(workspace, "member-b", host);
  const controllerRoot = createRepository(`${host.hostRoot}-controller`, "controller");
  const controller = createProductionProjectsHarness({
    label: `${label}-controller`,
    host,
    workingDirectory: controllerRoot,
  });
  writeProjectGroupsConfig(
    controller,
    projectGroupsDocument({
      groupKey: "platform",
      workspaceRoot: workspace,
      members: [
        { selector: "repoKey", value: a.repoKey },
        { selector: "repoKey", value: b.repoKey },
      ],
    }),
  );
  // A ready state root for each observed member; one carries a leftover temp.
  const stale = join(
    projectStateRoot(host.hostRoot, a.repoKey),
    "documents.default",
    "dispatch-authority.json.stale.tmp",
  );
  for (const member of [a, b]) {
    const state = projectStateRoot(host.hostRoot, member.repoKey);
    mkdirSync(state, { recursive: true, mode: 0o700 });
    mkdirSync(join(state, "documents.default"), { recursive: true, mode: 0o700 });
  }
  writeFileSync(stale, "stale temporary bytes\n", { mode: 0o600 });
  return {
    host,
    workspace,
    controller,
    repoKeys: [a.repoKey, b.repoKey],
    stale,
    staleName: `${a.repoKey}/documents.default/dispatch-authority.json.stale.tmp`,
    dispose: () => {
      controller.dispose();
      removeDirectory(workspace);
      removeDirectory(`${host.hostRoot}-controller`);
      host.dispose();
    },
  };
};

describe("TC-GRPRO-001 group and flat reads write nothing beyond the permitted side effects", () => {
  test("group, --project, --flat, and repos list differ only by the leftover temp removal", async () => {
    const fixture = createAuditFixture("read-only-audit");
    try {
      const container = join(fixture.host.hostRoot, "projects");
      const before = snapshotTree(container);
      const indexBefore = hostIndexTextOf(fixture.host.hostRoot);
      const staleName = fixture.staleName;
      expect(Object.keys(before.files)).toContain(staleName);

      for (const argv of [
        ["projects", "list", "--json"],
        ["projects", "list", "--project", "platform", "--json"],
        ["projects", "list", "--flat", "--json"],
        ["repos", "list", "--json"],
        // Group-scoped queue/status read per-checkout state only: no host-index
        // maintenance on the group surface (GH-309 F-3, NFR-2).
        ["queue", "list", "--project", "platform", "--json"],
        ["status", "--project", "platform", "--json"],
      ] as const) {
        const run = await fixture.controller.run([...argv]);
        expect(run.exitCode, run.stderr).toBe(0);
      }

      expect(existsSync(fixture.stale)).toBe(false);
      const after = snapshotTree(container);
      const beforeWithoutTemp = {
        ...before,
        files: Object.fromEntries(
          Object.entries(before.files).filter(([name]) => name !== staleName),
        ),
      };
      expect(snapshotDifferences(beforeWithoutTemp, after)).toEqual([]);
      // The host index is untouched: no maintenance, no revision advance.
      expect(hostIndexTextOf(fixture.host.hostRoot)).toBe(indexBefore);
    } finally {
      fixture.dispose();
    }
  });

  test("a fresh checkout's marker is minted outside the host root and nothing else changes", async () => {
    const fixture = createAuditFixture("read-only-marker");
    try {
      const checkout = createRepository(`${fixture.host.hostRoot}-fresh`, "fresh");
      const freshHarness = createProductionProjectsHarness({
        label: "read-only-marker-fresh",
        host: fixture.host,
        workingDirectory: checkout,
      });
      try {
        const marker = join(checkout, ".git", PROJECT_IDENTITY_MARKER_NAME);
        rmSync(marker, { force: true });
        const before = snapshotTree(fixture.host.hostRoot);

        const run = await freshHarness.run(["repos", "list", "--json"]);
        expect(run.exitCode, run.stderr).toBe(0);

        expect(existsSync(marker)).toBe(true);
        expect(snapshotDifferences(before, snapshotTree(fixture.host.hostRoot))).toEqual([]);
        // The flat read never registers the fresh checkout: no index appeared.
        expect(hostIndexTextOf(fixture.host.hostRoot)).toBeUndefined();
        expect(existsSync(hostIndexDocumentPath(fixture.host.hostRoot))).toBe(false);
      } finally {
        freshHarness.dispose();
        removeDirectory(`${fixture.host.hostRoot}-fresh`);
      }
    } finally {
      fixture.dispose();
    }
  });

  test("classified failures (invalid config, unavailable scope) also write nothing", async () => {
    const fixture = createAuditFixture("read-only-failures");
    const outside = nonCheckoutDirectory("read-only-failures");
    try {
      const before = snapshotTree(fixture.host.hostRoot);
      const indexBefore = hostIndexTextOf(fixture.host.hostRoot);

      // Invalid configuration: the group read fails classified at exit 1.
      writeFileSync(
        projectGroupsConfigPathFor(fixture.controller),
        "schema: delivery.projects.groups.v1\ngroups: [\n",
      );
      for (const argv of [
        ["projects", "list", "--json"],
        ["queue", "list", "--project", "platform", "--json"],
        ["status", "--project", "platform", "--json"],
      ] as const) {
        const invalid = await fixture.controller.run([...argv]);
        expect(invalid.exitCode, invalid.stderr).toBe(1);
        expect(snapshotDifferences(before, snapshotTree(fixture.host.hostRoot))).toEqual([]);
        // A classified failure writes no host index either (GH-309 F-3).
        expect(hostIndexTextOf(fixture.host.hostRoot)).toBe(indexBefore);
      }

      // Unavailable scope: an invocation outside every work tree.
      const outsideHarness = createProductionProjectsHarness({
        label: "read-only-failures-outside",
        host: fixture.host,
        workingDirectory: outside,
      });
      try {
        const unavailable = await outsideHarness.run(["projects", "list", "--json"]);
        expect(unavailable.exitCode).toBe(2);
        expect(hostIndexTextOf(fixture.host.hostRoot)).toBe(indexBefore);
        expect(snapshotDifferences(before, snapshotTree(fixture.host.hostRoot))).toEqual([]);
      } finally {
        outsideHarness.dispose();
      }
    } finally {
      removeDirectory(outside);
      fixture.dispose();
    }
  });
});
