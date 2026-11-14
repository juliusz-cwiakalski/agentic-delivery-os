/**
 * GH-309 TC-GRPSREAD-001..002 and the TC-GRPDOC-004 queue/status refusal steps
 * — group-scoped queue and status reads under the one aggregation clause.
 *
 * The grammar is additive: `queue list --project <groupKey>` and
 * `status --project <groupKey>` answer what one configured group has running,
 * waiting, and parked, while the unscoped forms keep the delivered payload.
 * Each member's work is seeded into its own per-checkout state store, so the
 * read proves the state layer keeps a per-checkout scope rather than a
 * group-scoped store. A repository outside the group carries its own work and
 * must never appear in a scoped result. No live daemon is used: the group
 * classification comes from state presence alone.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  claimQueueLease,
  declareQueueEntry,
  releaseQueueLease,
} from "../../packages/core/src/app/queue";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import { PROJECT_GROUPS_CONFIG_SCHEMA } from "../../packages/core/src/contracts/projects";
import {
  createNodeStateEdge,
  createStateStore,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/state/index";
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
import { createHostFixture, type HostFixture } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

type Envelope = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
};

type WorkMemberJson = {
  readonly repoKey: string;
  readonly root: string;
  readonly trackerKind: string;
  readonly outcome: string;
  readonly health: string;
  readonly running: readonly { readonly ref: string; readonly state: string }[];
  readonly waiting: readonly { readonly ref: string; readonly state: string }[];
  readonly parked: readonly { readonly ref: string; readonly state: string }[];
};

const envelopeOf = (run: ProductionRun): Envelope | undefined =>
  run.envelope as Envelope | undefined;

const dataOf = (run: ProductionRun): Record<string, unknown> => {
  const data = envelopeOf(run)?.data;
  if (data === undefined) throw new Error(`no data envelope: ${run.stdout}${run.stderr}`);
  return data;
};

const workMembersOf = (run: ProductionRun): readonly WorkMemberJson[] => {
  const members = dataOf(run).members;
  if (!Array.isArray(members)) throw new Error("data.members is not an array");
  return members as readonly WorkMemberJson[];
};

const errorCodeOf = (run: ProductionRun): string | undefined => envelopeOf(run)?.error?.code;

type GroupFixture = {
  readonly host: HostFixture;
  readonly a: MemberCheckout;
  readonly b: MemberCheckout;
  readonly c: MemberCheckout;
  readonly outsider: MemberCheckout;
  readonly harness: ProductionProjectsHarness;
  readonly dispose: () => void;
};

const createGroupFixture = (label: string): GroupFixture => {
  const host = createHostFixture(label);
  const workspace = `${host.hostRoot}-workspace`;
  mkdirSync(workspace, { recursive: true });
  const a = createMemberCheckout(workspace, "member-a", host);
  const b = createMemberCheckout(workspace, "member-b", host);
  const c = createMemberCheckout(workspace, "member-c", host);
  const outsider = createMemberCheckout(workspace, "outsider", host);
  const controller = createRepository(`${host.hostRoot}-controller`, "controller");
  const harness = createProductionProjectsHarness({
    label: `${label}-controller`,
    host,
    workingDirectory: controller,
  });
  return {
    host,
    a,
    b,
    c,
    outsider,
    harness,
    dispose: () => {
      harness.dispose();
      removeDirectory(workspace);
      removeDirectory(`${host.hostRoot}-controller`);
      host.dispose();
    },
  };
};

const stateStoreFor = (host: HostFixture, checkout: MemberCheckout): StateStorePort =>
  createStateStore(
    {
      level: "local",
      workspaceId: "default",
      fenceNamespace: "cli",
      schemaVersion: STATE_SCHEMA_VERSION,
      stateDirectory: projectStateRoot(host.hostRoot, checkout.repoKey),
    },
    { driver: "jsonl", edge: createNodeStateEdge() },
  );

let fenceOrdinal = 0;
const fence = (): string => {
  fenceOrdinal += 1;
  return `gh309-scope-fence-${String(fenceOrdinal)}`;
};

const now = (): { readonly iso: string; readonly ms: number } => {
  const ms = Date.now();
  return { iso: new Date(ms).toISOString(), ms };
};

/** Declare one entry in a member's own per-checkout store. */
const declare = (store: StateStorePort, checkout: MemberCheckout, ref: string): void => {
  const declared = declareQueueEntry(store, {
    ref,
    repository: checkout.repoKey,
    repositoryRoot: checkout.root,
    recordedAt: now().iso,
    fenceToken: fence(),
  });
  if (!declared.ok) throw new Error(`entry ${ref} was not declared: ${declared.code}`);
};

/** Declare and hold one entry (the running bucket). */
const startRunning = (store: StateStorePort, checkout: MemberCheckout, ref: string): void => {
  declare(store, checkout, ref);
  const claimed = claimQueueLease(store, {
    ref,
    holder: "lane-a",
    runner: "runner-a",
    weightClass: "standard",
    ttlMs: 24 * 60 * 60 * 1000,
    nowIso: now().iso,
    nowMs: now().ms,
    fenceToken: fence(),
  });
  if (!claimed.ok) throw new Error(`entry ${ref} was not claimed: ${claimed.code}`);
};

/** Declare, claim, and park one entry with the provider-quota cause. */
const startParked = (store: StateStorePort, checkout: MemberCheckout, ref: string): void => {
  startRunning(store, checkout, ref);
  const released = releaseQueueLease(store, {
    ref,
    nowIso: now().iso,
    nowMs: now().ms,
    fenceToken: fence(),
    park: { cause: "provider-quota", condition: { type: "provider-quota" } },
  });
  if (!released.ok) throw new Error(`entry ${ref} was not parked: ${released.code}`);
};

const configuredDocument = (fixture: GroupFixture, groupKey = "platform"): string =>
  projectGroupsDocument({
    groupKey,
    workspaceRoot: `${fixture.host.hostRoot}-workspace`,
    members: [
      { selector: "repoKey", value: fixture.a.repoKey },
      { selector: "repoKey", value: fixture.b.repoKey },
      { selector: "repoKey", value: fixture.c.repoKey },
    ],
  });

const scopedQueue = (
  harness: ProductionProjectsHarness,
  groupKey: string,
): Promise<ProductionRun> => harness.run(["queue", "list", "--project", groupKey, "--json"]);

const scopedStatus = (
  harness: ProductionProjectsHarness,
  groupKey: string,
): Promise<ProductionRun> => harness.run(["status", "--project", groupKey, "--json"]);

describe("TC-GRPSREAD-001 group-scoped queue and status reads accept the group key", () => {
  test("both reads return only the group's running, waiting, and parked work at exit 0", async () => {
    const fixture = createGroupFixture("grpsread-001");
    try {
      writeProjectGroupsConfig(fixture.harness, configuredDocument(fixture));

      // A repository holds one lease at a time, so each bucket needs its own
      // member: a runs, b waits, c parks.
      const aStore = stateStoreFor(fixture.host, fixture.a);
      startRunning(aStore, fixture.a, "GH-901");
      const bStore = stateStoreFor(fixture.host, fixture.b);
      declare(bStore, fixture.b, "GH-902");
      const cStore = stateStoreFor(fixture.host, fixture.c);
      startParked(cStore, fixture.c, "GH-903");

      const queue = await scopedQueue(fixture.harness, "platform");
      expect(queue.exitCode, queue.stderr).toBe(0);
      expect(dataOf(queue).groupKey).toBe("platform");
      const queueMembers = workMembersOf(queue);
      expect(queueMembers.map((member) => member.repoKey)).toEqual([
        fixture.a.repoKey,
        fixture.b.repoKey,
        fixture.c.repoKey,
      ]);
      expect(queueMembers.every((member) => member.outcome === "observed")).toBe(true);
      expect(queueMembers[0]?.running.map((entry) => entry.ref)).toEqual(["GH-901"]);
      expect(queueMembers[1]?.waiting.map((entry) => entry.ref)).toEqual(["GH-902"]);
      expect(queueMembers[2]?.parked.map((entry) => entry.ref)).toEqual(["GH-903"]);

      const status = await scopedStatus(fixture.harness, "platform");
      expect(status.exitCode, status.stderr).toBe(0);
      expect(dataOf(status).groupKey).toBe("platform");
      expect(
        workMembersOf(status).map((member) => ({
          repoKey: member.repoKey,
          running: member.running.map((entry) => entry.ref),
          waiting: member.waiting.map((entry) => entry.ref),
          parked: member.parked.map((entry) => entry.ref),
        })),
      ).toEqual([
        { repoKey: fixture.a.repoKey, running: ["GH-901"], waiting: [], parked: [] },
        { repoKey: fixture.b.repoKey, running: [], waiting: ["GH-902"], parked: [] },
        { repoKey: fixture.c.repoKey, running: [], waiting: [], parked: ["GH-903"] },
      ]);
      // The aggregation keys are omitted on a clean read.
      expect(Object.hasOwn(dataOf(queue), "partial")).toBe(false);
      expect(Object.hasOwn(dataOf(status), "partial")).toBe(false);
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPSREAD-002 scoped reads return only the group's work", () => {
  test("a non-member repository's work never appears and the unscoped forms are unchanged", async () => {
    const fixture = createGroupFixture("grpsread-002");
    try {
      writeProjectGroupsConfig(fixture.harness, configuredDocument(fixture));
      const aStore = stateStoreFor(fixture.host, fixture.a);
      declare(aStore, fixture.a, "GH-911");
      const outsiderStore = stateStoreFor(fixture.host, fixture.outsider);
      declare(outsiderStore, fixture.outsider, "GH-999");

      const queue = await scopedQueue(fixture.harness, "platform");
      const status = await scopedStatus(fixture.harness, "platform");
      for (const run of [queue, status]) {
        expect(run.exitCode, run.stderr).toBe(0);
        expect(run.stdout).not.toContain(fixture.outsider.repoKey);
        expect(run.stdout).not.toContain("GH-999");
      }

      // The grammar is additive: the unscoped forms keep their delivered
      // payloads and carry no group scoping.
      const unscopedQueue = await fixture.harness.run(["queue", "list", "--json"]);
      expect(unscopedQueue.exitCode, unscopedQueue.stderr).toBe(0);
      expect(Array.isArray(dataOf(unscopedQueue).entries)).toBe(true);
      expect(Object.hasOwn(dataOf(unscopedQueue), "groupKey")).toBe(false);

      const unscopedStatus = await fixture.harness.run(["status", "--json"]);
      expect(unscopedStatus.exitCode, unscopedStatus.stderr).toBe(0);
      expect(Array.isArray(dataOf(unscopedStatus).sections)).toBe(true);
      expect(Object.hasOwn(dataOf(unscopedStatus), "groupKey")).toBe(false);
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPAGG-001 the aggregation clause governs the scoped reads", () => {
  test("one state-unavailable member yields partial true and is named, readable members returned", async () => {
    const fixture = createGroupFixture("grpsread-agg-001");
    try {
      writeProjectGroupsConfig(fixture.harness, configuredDocument(fixture));
      // Member b's state location is a regular file: state-unavailable.
      const unavailableState = projectStateRoot(fixture.host.hostRoot, fixture.b.repoKey);
      mkdirSync(join(fixture.host.hostRoot, "projects"), { recursive: true });
      writeFileSync(unavailableState, "not a state directory\n");
      // Member a stays readable and carries waiting work.
      const aStore = stateStoreFor(fixture.host, fixture.a);
      declare(aStore, fixture.a, "GH-921");

      for (const run of [
        await scopedQueue(fixture.harness, "platform"),
        await scopedStatus(fixture.harness, "platform"),
      ]) {
        expect(run.exitCode, run.stderr).toBe(0);
        expect(dataOf(run).partial).toBe(true);
        expect(dataOf(run).degradedMembers).toEqual([
          { repoKey: fixture.b.repoKey, outcome: "state-unavailable" },
        ]);
        const members = workMembersOf(run);
        const byKey = new Map(members.map((member) => [member.repoKey, member]));
        expect(byKey.get(fixture.a.repoKey)?.outcome).toBe("observed");
        expect(byKey.get(fixture.b.repoKey)?.outcome).toBe("state-unavailable");
        expect(byKey.get(fixture.b.repoKey)?.waiting).toEqual([]);
      }
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPDOC-004 the one refusal rule holds on every group-scoped surface", () => {
  test("an unknown group key is projects.unknown-group at exit 1 on projects, queue, and status", async () => {
    const fixture = createGroupFixture("grpsread-refusal");
    try {
      writeProjectGroupsConfig(fixture.harness, configuredDocument(fixture));
      const runs = [
        await fixture.harness.run(["projects", "list", "--project", "does-not-exist", "--json"]),
        await fixture.harness.run(["queue", "list", "--project", "does-not-exist", "--json"]),
        await fixture.harness.run(["status", "--project", "does-not-exist", "--json"]),
      ];
      for (const run of runs) {
        expect(run.exitCode).toBe(1);
        expect(errorCodeOf(run)).toBe("projects.unknown-group");
        expect(Object.hasOwn(envelopeOf(run) ?? {}, "data")).toBe(false);
      }
    } finally {
      fixture.dispose();
    }
  });

  test("an absent or zero-group configuration refuses the key on queue and status too", async () => {
    const fixture = createGroupFixture("grpsread-refusal-empty");
    try {
      // No configuration document: an explicit key is not declared, so it is
      // never rendered as a group with no work (F-1/F-2, AC-F2-1, NFR-5).
      for (const run of [
        await scopedQueue(fixture.harness, "platform"),
        await scopedStatus(fixture.harness, "platform"),
      ]) {
        expect(run.exitCode).toBe(1);
        expect(errorCodeOf(run)).toBe("projects.unknown-group");
        expect(Object.hasOwn(envelopeOf(run) ?? {}, "data")).toBe(false);
      }

      // A declared zero-group document is the same refusal for an explicit key.
      writeProjectGroupsConfig(
        fixture.harness,
        `schema: ${PROJECT_GROUPS_CONFIG_SCHEMA}\ngroups: []\n`,
      );
      for (const run of [
        await scopedQueue(fixture.harness, "platform"),
        await scopedStatus(fixture.harness, "platform"),
      ]) {
        expect(run.exitCode).toBe(1);
        expect(errorCodeOf(run)).toBe("projects.unknown-group");
      }

      // The unscoped forms keep their delivered payloads and stay at exit 0.
      const unscopedQueue = await fixture.harness.run(["queue", "list", "--json"]);
      expect(unscopedQueue.exitCode, unscopedQueue.stderr).toBe(0);
      const unscopedStatus = await fixture.harness.run(["status", "--json"]);
      expect(unscopedStatus.exitCode, unscopedStatus.stderr).toBe(0);
    } finally {
      fixture.dispose();
    }
  });
});
