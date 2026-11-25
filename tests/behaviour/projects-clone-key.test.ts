/**
 * GH-406 TC-DPKACC-001 behaviour half — the served `cloneKey` through the
 * production path.
 *
 * A fixture clone carrying the git-directory identity marker resolves its
 * project scope through the delivered composition, and the served `cloneKey`
 * matches what the marker and the host index carry for that clone. The
 * persisted surfaces keep their delivered names — the direct field-name
 * assertion pins the marker and host-index field unchanged — and the accessor
 * is a served read: resolving twice yields the identical value and writes
 * nothing (no new persisted field in the host index or marker).
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { HOST_INDEX_ENTRY_FIELDS } from "../../packages/core/src/contracts";
import { parseProjectIdentityMarker } from "../../packages/core/src/app/state-scope";
import { createMemberCheckout, type MemberCheckout } from "../fixtures/projects/groups";
import {
  hostIndexEntriesOf,
  hostIndexTextOf,
  hostIndexRevisionOf,
} from "../fixtures/projects/host-index";
import { markerTextOf } from "../fixtures/projects/markers";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
} from "../fixtures/projects/production";
import {
  createHostFixture,
  projectScopeFor,
  type HostFixture,
} from "../fixtures/projects/state-scope";
import { removeDirectory } from "../fixtures/projects/temp-repos";

type CloneFixture = {
  readonly host: HostFixture;
  readonly checkout: MemberCheckout;
  readonly harness: ProductionProjectsHarness;
  readonly commonDir: string;
  readonly dispose: () => void;
};

const createCloneFixture = (label: string): CloneFixture => {
  const host = createHostFixture(label);
  const parent = `${host.hostRoot}-clones`;
  const checkout = createMemberCheckout(parent, `clone-${label}`, host);
  const harness = createProductionProjectsHarness({
    label,
    host,
    workingDirectory: checkout.root,
  });
  return {
    host,
    checkout,
    harness,
    commonDir: join(checkout.root, ".git"),
    dispose: () => {
      harness.dispose();
      removeDirectory(parent);
      host.dispose();
    },
  };
};

describe("TC-DPKACC-001 behaviour half the production path serves the clone identity", () => {
  test("the resolved scope's cloneKey matches the marker and the host index", async () => {
    const fixture = createCloneFixture("serve");
    try {
      const outcome = projectScopeFor({
        cwd: fixture.checkout.root,
        hostRoot: fixture.host.hostRoot,
        home: fixture.host.home,
        brand: fixture.host.brand,
      });
      if (outcome.scope.kind !== "project") throw new Error("expected a project scope");
      const cloneKey = outcome.scope.cloneKey;

      // The marker side: the minted marker's key is the served identity.
      const marker = parseProjectIdentityMarker(markerTextOf(fixture.commonDir));
      expect(marker?.projectKey).toBe(cloneKey);

      // The host-index side: one state-opening read registers the clone, and
      // the entry carries the same identity under the delivered field name.
      const run = await fixture.harness.run(["status", "--json"]);
      expect(run.exitCode).toBe(0);
      const entries = hostIndexEntriesOf(fixture.host.hostRoot);
      expect(entries.some((entry) => entry.projectKey === cloneKey)).toBe(true);

      // The flat payload side: the row's repoKey carries the identity.
      expect(fixture.checkout.repoKey).toBe(cloneKey);
    } finally {
      fixture.dispose();
    }
  });

  test("the persisted surfaces keep their delivered names (direct field-name assertion)", () => {
    const fixture = createCloneFixture("names");
    try {
      // The host-index entry's declared field set names the persisted key
      // field exactly as delivered — no rename, no re-key.
      expect([...HOST_INDEX_ENTRY_FIELDS]).toContain("projectKey");
      expect([...HOST_INDEX_ENTRY_FIELDS]).toContain("projectIdentifier");

      // The marker payload parses with the delivered field names, and the
      // flat payload's field name stays `repoKey`.
      const marker = parseProjectIdentityMarker(markerTextOf(fixture.commonDir));
      expect(marker?.projectKey).toBe(fixture.checkout.repoKey);
    } finally {
      fixture.dispose();
    }
  });

  test("cloneKey is a served read: resolving twice is stable and writes nothing", () => {
    const fixture = createCloneFixture("served");
    try {
      const resolve = (): string => {
        const outcome = projectScopeFor({
          cwd: fixture.checkout.root,
          hostRoot: fixture.host.hostRoot,
          home: fixture.host.home,
          brand: fixture.host.brand,
        });
        if (outcome.scope.kind !== "project") throw new Error("expected a project scope");
        return outcome.scope.cloneKey;
      };
      const indexBefore = hostIndexTextOf(fixture.host.hostRoot);
      const revisionBefore = hostIndexRevisionOf(fixture.host.hostRoot);
      const markerBefore = markerTextOf(fixture.commonDir);

      const first = resolve();
      const second = resolve();

      expect(second).toBe(first);
      expect(first).toBe(fixture.checkout.repoKey);
      expect(hostIndexTextOf(fixture.host.hostRoot)).toBe(indexBefore);
      expect(hostIndexRevisionOf(fixture.host.hostRoot)).toBe(revisionBefore);
      expect(markerTextOf(fixture.commonDir)).toBe(markerBefore);
    } finally {
      fixture.dispose();
    }
  });
});
