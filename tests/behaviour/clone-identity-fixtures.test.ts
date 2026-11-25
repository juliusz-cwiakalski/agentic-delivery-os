/**
 * GH-406 TC-DPKFIX-001/002/003 — the clone-identity fixtures G-1..G-3, built
 * on the tests/fixtures/projects/ helpers (temp repositories, identity
 * markers, host-index readers, groups configuration).
 *
 * Everything runs under the session-scoped temporary root with sanitized git
 * environment (no network, no wall clock, no hostname dependence), and the
 * committed tree stays clean: every fixture lives under the approved base and
 * is removed with its host.
 *
 * G-1 a linked worktree resolves the SAME clone identity as its main checkout
 *     through the production path, stable across repeated reads.
 * G-2 one repository cloned twice resolves the SAME product key from the
 *     groups.v1 declaration while the two clone identities and the two
 *     per-clone state roots differ; the product key is never compared against
 *     the clone identity (the owner amendment's nouns, comment 7138707234).
 * G-3 an existing-shape groups.v1 configuration whose group key is OUTSIDE the
 *     declared product-key grammar loads unchanged through the production path — exit
 *     0, no classified validation error, the configuration bytes on disk
 *     unchanged — and a grammar-valid twin loads identically, proving the
 *     local layer enforces no pattern (no-public-pattern contract, DEC-4).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";
import {
  createMemberCheckout,
  type MemberCheckout,
  projectGroupsDocument,
  writeProjectGroupsConfig,
} from "../fixtures/projects/groups";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  type ProductionRun,
} from "../fixtures/projects/production";
import {
  createHostFixture,
  type HostFixture,
  projectScopeFor,
} from "../fixtures/projects/state-scope";
import {
  addWorktree,
  cloneRepository,
  createBareOrigin,
  createRepository,
  removeDirectory,
  seedOrigin,
} from "../fixtures/projects/temp-repos";

type Envelope = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
};

type GroupJson = {
  readonly groupKey: string;
  readonly name: string;
  readonly members: readonly Record<string, unknown>[];
};

const groupsOf = (run: ProductionRun): readonly GroupJson[] => {
  const envelope = run.envelope as Envelope | undefined;
  const data = envelope?.data;
  if (!Array.isArray(data?.groups))
    throw new Error(`no groups envelope: ${run.stdout}${run.stderr}`);
  return data.groups as readonly GroupJson[];
};

const identityOf = (
  host: HostFixture,
  cwd: string,
): { readonly cloneKey: string; readonly stateLocation: string } => {
  const outcome = projectScopeFor({
    cwd,
    hostRoot: host.hostRoot,
    home: host.home,
    brand: host.brand,
  });
  if (outcome.scope.kind !== "project") throw new Error(`expected a project scope at ${cwd}`);
  return { cloneKey: outcome.scope.cloneKey, stateLocation: outcome.scope.stateLocation };
};

describe("TC-DPKFIX-001 fixture G-1 a linked worktree shares the main checkout's identity", () => {
  test("the worktree resolves the same clone identity as its main checkout, stable across reads", () => {
    const host = createHostFixture("g1");
    const parent = `${host.hostRoot}-main`;
    try {
      const main = createRepository(parent, "main-checkout");
      const mainIdentity = identityOf(host, main);
      const worktree = addWorktree(main, `${host.hostRoot}-worktrees`, "wt-item-1");
      const worktreeIdentity = identityOf(host, worktree);
      const worktreeAgain = identityOf(host, worktree);

      expect(worktreeIdentity.cloneKey).toBe(mainIdentity.cloneKey);
      expect(worktreeAgain.cloneKey).toBe(mainIdentity.cloneKey);
      expect(worktreeIdentity.stateLocation).toBe(mainIdentity.stateLocation);
    } finally {
      removeDirectory(`${host.hostRoot}-worktrees`);
      removeDirectory(parent);
      host.dispose();
    }
  });
});

describe("TC-DPKFIX-002 fixture G-2 two clones, one product key, distinct state roots", () => {
  test("both clones resolve the same product key with different identities and roots", async () => {
    const host = createHostFixture("g2");
    const originParent = `${host.hostRoot}-origin`;
    const seedParent = `${host.hostRoot}-seed`;
    const clonesParent = `${host.hostRoot}-clones`;
    let harnessA: ProductionProjectsHarness | undefined;
    let harnessB: ProductionProjectsHarness | undefined;
    try {
      const origin = createBareOrigin(originParent, "project-origin");
      const seed = createRepository(seedParent, "seed-repo");
      seedOrigin(seed, origin);
      const cloneA = cloneRepository(origin, clonesParent, "clone-a");
      const cloneB = cloneRepository(origin, clonesParent, "clone-b");

      const productKey = "platform-alpha";
      const document = projectGroupsDocument({
        groupKey: productKey,
        members: [{ selector: "root", value: seed }],
      });
      harnessA = createProductionProjectsHarness({ label: "g2-a", host, workingDirectory: cloneA });
      harnessB = createProductionProjectsHarness({ label: "g2-b", host, workingDirectory: cloneB });
      writeProjectGroupsConfig(harnessA, document);
      writeProjectGroupsConfig(harnessB, document);

      const runA = await harnessA.run(["projects", "list", "--project", productKey, "--json"]);
      const runB = await harnessB.run(["projects", "list", "--project", productKey, "--json"]);
      expect(runA.exitCode).toBe(0);
      expect(runB.exitCode).toBe(0);
      expect(groupsOf(runA)[0]?.groupKey).toBe(productKey);
      expect(groupsOf(runB)[0]?.groupKey).toBe(productKey);

      const identityA = identityOf(host, cloneA);
      const identityB = identityOf(host, cloneB);
      expect(identityA.cloneKey).not.toBe(identityB.cloneKey);
      expect(identityA.stateLocation).not.toBe(identityB.stateLocation);
      expect(identityA.stateLocation).toBe(projectStateRoot(host.hostRoot, identityA.cloneKey));
      expect(identityB.stateLocation).toBe(projectStateRoot(host.hostRoot, identityB.cloneKey));

      // The disjoint namespaces: the product key resolves from the
      // configuration document while each state root keys on the clone
      // identity — the two are never compared.
      expect(productKey).not.toBe(identityA.cloneKey);
      expect(identityA.stateLocation).not.toBe(projectStateRoot(host.hostRoot, productKey));
    } finally {
      harnessA?.dispose();
      harnessB?.dispose();
      removeDirectory(originParent);
      removeDirectory(seedParent);
      removeDirectory(clonesParent);
      host.dispose();
    }
  });
});

describe("TC-DPKFIX-003 fixture G-3 out-of-grammar configuration loads unchanged", () => {
  test("the local layer enforces no pattern: legacy key and grammar-valid twin load identically", async () => {
    const host = createHostFixture("g3");
    const parent = `${host.hostRoot}-clone`;
    let checkout: MemberCheckout | undefined;
    let harness: ProductionProjectsHarness | undefined;
    try {
      checkout = createMemberCheckout(parent, "legacy-clone", host);
      harness = createProductionProjectsHarness({
        label: "g3",
        host,
        workingDirectory: checkout.root,
      });
      const seed = createRepository(`${host.hostRoot}-seed`, "seed-repo");

      const legacyKey = "Platform";
      const configPath = writeProjectGroupsConfig(
        harness,
        projectGroupsDocument({
          groupKey: legacyKey,
          members: [{ selector: "root", value: seed }],
        }),
      );
      const bytesBefore = readFileSync(configPath);

      const legacyRun = await harness.run(["projects", "list", "--project", legacyKey, "--json"]);
      expect(legacyRun.exitCode).toBe(0);
      const groups = groupsOf(legacyRun);
      expect(groups).toHaveLength(1);
      expect(groups[0]?.groupKey).toBe(legacyKey);
      expect((legacyRun.envelope as Envelope | undefined)?.error).toBeUndefined();
      expect(readFileSync(configPath).equals(bytesBefore)).toBe(true);

      // The grammar-valid twin loads identically: the grammar is invisible
      // to this layer, and the load rewrote or re-keyed nothing — the bytes
      // on disk after the run are exactly the bytes the twin write laid down.
      const validKey = "platform-alpha";
      const twinPath = writeProjectGroupsConfig(
        harness,
        projectGroupsDocument({
          groupKey: validKey,
          members: [{ selector: "root", value: seed }],
        }),
      );
      const twinBytes = readFileSync(twinPath);
      const validRun = await harness.run(["projects", "list", "--project", validKey, "--json"]);
      expect(validRun.exitCode).toBe(0);
      const validGroups = groupsOf(validRun);
      expect(validGroups).toHaveLength(1);
      expect(validGroups[0]?.groupKey).toBe(validKey);
      expect(readFileSync(configPath).equals(twinBytes)).toBe(true);
    } finally {
      harness?.dispose();
      removeDirectory(`${host.hostRoot}-seed`);
      removeDirectory(parent);
      host.dispose();
    }
  });
});
