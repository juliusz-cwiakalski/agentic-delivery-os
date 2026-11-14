/**
 * GH-309 TC-GRPSURF-001 (contract half), TC-GRPAGG-002 (closed vocabularies) and
 * TC-GRPENV-001 (group-envelope conformance) — the `project-groups.v1` contract
 * and the OQ-3 health classification.
 *
 * The envelope assertions run over a real production-composition read, so the
 * five-field `delivery.result.v1` shell, the exact DM-2 member fields, the
 * declared order, and the closed daemon-reason vocabulary are observed rather
 * than restated. The scan containment unit case uses an injected directory tree,
 * so it proves admission at any depth without touching the filesystem. The full
 * delivered-envelope set for the change is exercised from the rename phase.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { join } from "node:path";
import { probeDaemonSocket } from "../../packages/adapters/src/daemon/unix";
import {
  nodeWorkspaceScanFileSystem,
  scanDeclaredWorkspaceMembers,
  type WorkspaceScanEntry,
} from "../../packages/adapters/src/file/workspace-scan";
import {
  type DaemonComposition,
  projectGroupEntry,
  projectGroupMemberEntry,
  projectMemberHealth,
  selectDaemonReachability,
} from "../../packages/core/src/app/projects";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";
import { resolveDaemonSettings } from "../../packages/core/src/config/index";
import {
  DAEMON_REACHABILITY_REASONS,
  type DaemonReachability,
  PROJECT_GROUP_FIELDS,
  PROJECT_GROUP_MEMBER_FIELDS,
  PROJECT_GROUPS_LIST_SCHEMA,
  PROJECT_MEMBER_HEALTH_VALUES,
  PROJECT_MEMBER_OUTCOMES,
} from "../../packages/core/src/contracts/projects";
import {
  projectGroupMemberSelectors,
  selectProjectGroups,
  validateProjectGroupsDocument,
} from "../../packages/core/src/domain/project-groups";
import {
  createMemberCheckout,
  projectGroupsDocument,
  writeProjectGroupsConfig,
} from "../fixtures/projects/groups";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  type ProductionRun,
} from "../fixtures/projects/production";
import { createHostFixture } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

type Envelope = Record<string, unknown> & {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string };
};

type MemberJson = {
  readonly repoKey: string;
  readonly root: string;
  readonly trackerKind: string;
  readonly state: string;
  readonly health: string;
  readonly daemonReachable: DaemonReachability;
};

type GroupJson = {
  readonly groupKey: string;
  readonly name: string;
  readonly workspaceRoot?: string;
  readonly members: readonly MemberJson[];
};

const envelopeOf = (run: ProductionRun): Envelope | undefined =>
  run.envelope as Envelope | undefined;

const dataOf = (run: ProductionRun): Record<string, unknown> => {
  const data = envelopeOf(run)?.data;
  if (data === undefined) throw new Error(`no data envelope: ${run.stdout}${run.stderr}`);
  return data;
};

const groupsOf = (run: ProductionRun): readonly GroupJson[] => {
  const groups = dataOf(run).groups;
  if (!Array.isArray(groups)) throw new Error("data.groups is not an array");
  return groups as readonly GroupJson[];
};

const scopedList = (harness: ProductionProjectsHarness, groupKey: string): Promise<ProductionRun> =>
  harness.run(["projects", "list", "--project", groupKey, "--json"]);

type BoundServer = {
  readonly server: Server;
  readonly close: () => Promise<void>;
};

const bindSocket = async (socketPath: string): Promise<BoundServer> => {
  const server = createServer((socket) => {
    socket.resume();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => resolve());
  });
  return {
    server,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
};

const mountedProbe = (): DaemonComposition => ({
  mounted: true,
  capability: () => ({
    probe: async (input) => {
      const result = await probeDaemonSocket(input);
      return result.reachable ? "reachable" : result.reason;
    },
  }),
});

const socketSettingsFor = (stateLocation: string) => {
  const settings = resolveDaemonSettings({}, {}, { stateDirectory: stateLocation });
  if (!settings.ok) throw new Error(`daemon settings failed: ${settings.error.code}`);
  return settings.value;
};

describe("TC-GRPSURF-001 the DM-2 group contract is exact", () => {
  test("group and member field sets are the contract's declared fields and order", () => {
    expect(PROJECT_GROUPS_LIST_SCHEMA).toBe("project-groups.v1");
    expect(PROJECT_GROUP_FIELDS).toEqual(["groupKey", "name", "workspaceRoot", "members"]);
    expect(PROJECT_GROUP_MEMBER_FIELDS).toEqual([
      "repoKey",
      "root",
      "trackerKind",
      "state",
      "health",
      "daemonReachable",
    ]);

    const member = projectGroupMemberEntry({
      repoKey: "member-a-1a2b3c4d",
      root: "/fixture/member-a",
      trackerKind: "github",
      state: "shell",
      health: "degraded",
      daemonReachable: { reachable: false, reason: "socket-absent" },
    });
    expect(Object.keys(member)).toEqual([...PROJECT_GROUP_MEMBER_FIELDS]);

    const withWorkspace = projectGroupEntry({
      groupKey: "platform",
      name: "Platform",
      workspaceRoot: "/fixture/workspace",
      members: [member],
    });
    expect(Object.keys(withWorkspace)).toEqual([...PROJECT_GROUP_FIELDS]);

    const withoutWorkspace = projectGroupEntry({
      groupKey: "platform",
      name: "Platform",
      members: [member],
    });
    expect(Object.hasOwn(withoutWorkspace, "workspaceRoot")).toBe(false);
    expect(Object.keys(withoutWorkspace)).toEqual(["groupKey", "name", "members"]);
  });
});

describe("TC-GRPSURF-001 group enumeration preserves declared order", () => {
  test("every configured group enumerates in declared order and a key selects one", () => {
    const validated = validateProjectGroupsDocument({
      schema: "delivery.projects.groups.v1",
      groups: [
        {
          groupKey: "alpha",
          name: "Alpha",
          workspaceRoot: "/fixture/alpha-workspace",
          members: [{ root: "/fixture/alpha-a", trackerKind: "github" }],
        },
        {
          groupKey: "beta",
          name: "Beta",
          members: [{ repoKey: "beta-b-1a2b3c4d", trackerKind: "jira" }],
        },
      ],
    });
    if (!validated.ok) throw new Error("fixture configuration must validate");
    const config = validated.config;
    expect(selectProjectGroups(config).map((group) => group.groupKey)).toEqual(["alpha", "beta"]);
    expect(selectProjectGroups(config, "beta").map((group) => group.groupKey)).toEqual(["beta"]);
    expect(selectProjectGroups(config, "missing")).toEqual([]);
    expect(selectProjectGroups({ state: "empty" })).toEqual([]);
    if (config.state !== "loaded") throw new Error("fixture configuration must be loaded");
    const alpha = config.groups[0];
    const beta = config.groups[1];
    if (alpha === undefined || beta === undefined) throw new Error("both groups must be present");
    expect(projectGroupMemberSelectors(alpha)).toEqual({
      roots: ["/fixture/alpha-a"],
      repoKeys: [],
    });
    expect(projectGroupMemberSelectors(beta)).toEqual({
      roots: [],
      repoKeys: ["beta-b-1a2b3c4d"],
    });
  });
});

describe("TC-GRPAGG-002 the outcome and health vocabularies are closed", () => {
  test("every outcome resolves to exactly one health from the five-value set", () => {
    expect(PROJECT_MEMBER_OUTCOMES).toEqual([
      "observed",
      "not-yet-supported",
      "state-unavailable",
      "unregistered",
    ]);
    expect(PROJECT_MEMBER_HEALTH_VALUES).toEqual([
      "healthy",
      "degraded",
      "state-unavailable",
      "not-yet-supported",
      "unregistered",
    ]);

    const unreachable: DaemonReachability = { reachable: false, reason: "socket-absent" };
    const produced: string[] = [];
    for (const outcome of PROJECT_MEMBER_OUTCOMES) {
      const health = projectMemberHealth({
        outcome,
        daemonReachable: { reachable: true },
      });
      produced.push(health);
      expect(PROJECT_MEMBER_HEALTH_VALUES).toContain(health);
      if (outcome !== "observed") expect(health).toBe(outcome);
    }
    expect(projectMemberHealth({ outcome: "observed", daemonReachable: { reachable: true } })).toBe(
      "healthy",
    );
    expect(projectMemberHealth({ outcome: "observed", daemonReachable: unreachable })).toBe(
      "degraded",
    );
    produced.push(
      projectMemberHealth({ outcome: "observed", daemonReachable: { reachable: true } }),
      projectMemberHealth({ outcome: "observed", daemonReachable: unreachable }),
    );
    expect([...new Set(produced)].sort()).toEqual([...PROJECT_MEMBER_HEALTH_VALUES].sort());
  });
});

describe("TC-GRPSURF-001 the daemon reason vocabulary stays closed and ordered", () => {
  test("first applicable reason wins in the delivered order", () => {
    expect(DAEMON_REACHABILITY_REASONS).toEqual([
      "daemon-not-mounted",
      "state-absent",
      "socket-absent",
      "socket-unreachable",
    ]);
    expect(selectDaemonReachability({ mount: { mounted: false } })).toEqual({
      reachable: false,
      reason: "daemon-not-mounted",
    });
    expect(
      selectDaemonReachability({ mount: { mounted: true }, probe: { stateRoot: "absent" } }),
    ).toEqual({ reachable: false, reason: "state-absent" });
    expect(
      selectDaemonReachability({
        mount: { mounted: true },
        probe: { stateRoot: "present", socket: "socket-absent" },
      }),
    ).toEqual({ reachable: false, reason: "socket-absent" });
    expect(
      selectDaemonReachability({
        mount: { mounted: true },
        probe: { stateRoot: "present", socket: "socket-unreachable" },
      }),
    ).toEqual({ reachable: false, reason: "socket-unreachable" });
    expect(
      selectDaemonReachability({
        mount: { mounted: true },
        probe: { stateRoot: "present", socket: "reachable" },
      }),
    ).toEqual({ reachable: true });
  });
});

describe("TC-GRPWORK-003 the scan admits declared members only, at any depth", () => {
  test("a nested declared clone is located and every undeclared clone is dropped", () => {
    const directory = (name: string): WorkspaceScanEntry => ({
      name,
      directory: true,
      symbolicLink: false,
    });
    const linked = (name: string): WorkspaceScanEntry => ({
      name,
      directory: true,
      symbolicLink: true,
    });
    const tree: Record<string, readonly WorkspaceScanEntry[]> = {
      "/workspace": [
        directory("member-a"),
        directory("intruder"),
        directory("deep"),
        linked("linked-clone"),
      ],
      "/workspace/member-a": [directory(".git"), directory("nested")],
      "/workspace/member-a/nested": [directory(".git")],
      "/workspace/intruder": [directory(".git")],
      "/workspace/deep": [directory("nested")],
      "/workspace/deep/nested": [directory(".git")],
      "/workspace/linked-clone": [directory(".git")],
    };
    const keys: Record<string, string> = {
      "/workspace/member-a": "member-a-1a2b3c4d",
      "/workspace/member-a/nested": "nested-in-member-5e6f7a8b",
      "/workspace/intruder": "intruder-9a8b7c6d",
      "/workspace/deep/nested": "nested-declared-12345678",
      "/workspace/linked-clone": "linked-87654321",
    };
    const located = scanDeclaredWorkspaceMembers({
      workspaceRoot: "/workspace",
      declared: [{ repoKey: "member-a-1a2b3c4d" }, { root: "/workspace/deep/nested" }],
      repoKeyOf: (root) => keys[root],
      fs: { list: (path) => tree[path] ?? [] },
    });
    expect(located).toEqual([
      { root: "/workspace/deep/nested", repoKey: "nested-declared-12345678" },
      { root: "/workspace/member-a", repoKey: "member-a-1a2b3c4d" },
    ]);
    expect(located.map((candidate) => candidate.root)).not.toContain("/workspace/intruder");
    expect(located.map((candidate) => candidate.root)).not.toContain("/workspace/member-a/nested");
    expect(located.map((candidate) => candidate.root)).not.toContain("/workspace/linked-clone");

    const withoutDeclaredIdentity = scanDeclaredWorkspaceMembers({
      workspaceRoot: "/workspace",
      declared: [{ repoKey: "member-a-1a2b3c4d" }],
      repoKeyOf: () => undefined,
      fs: { list: (path) => tree[path] ?? [] },
    });
    expect(withoutDeclaredIdentity).toEqual([]);
    expect(
      scanDeclaredWorkspaceMembers({
        workspaceRoot: "/absent",
        declared: [{ repoKey: "member-a-1a2b3c4d" }],
        repoKeyOf: () => "member-a-1a2b3c4d",
        fs: { list: (path) => tree[path] ?? [] },
      }),
    ).toEqual([]);
    expect(nodeWorkspaceScanFileSystem().list("/absent-directory")).toEqual([]);
  });
});

describe("TC-GRPENV-001 and the OQ-3 health cases over the delivered group envelope", () => {
  test("five-field envelope, exact member fields, declared order, and all five healths", async () => {
    const host = createHostFixture("grpenv-001");
    const workspace = `${host.hostRoot}-workspace`;
    mkdirSync(workspace, { recursive: true });
    const healthy = createMemberCheckout(workspace, "healthy", host);
    const degraded = createMemberCheckout(workspace, "degraded", host);
    const unavailable = createMemberCheckout(workspace, "unavailable", host);
    const controller = createRepository(`${host.hostRoot}-controller`, "controller");
    const harness = createProductionProjectsHarness({
      label: "grpenv-001-controller",
      host,
      workingDirectory: controller,
      daemon: mountedProbe(),
    });
    const missingUnsupported = join(host.hostRoot, "declared-unsupported-missing");
    const missingUnregistered = join(host.hostRoot, "declared-unregistered-missing");
    let server: BoundServer | undefined;
    try {
      writeProjectGroupsConfig(
        harness,
        projectGroupsDocument({
          groupKey: "platform",
          members: [
            { selector: "root", value: unavailable.root },
            { selector: "root", value: missingUnsupported, trackerKind: "jira" },
            { selector: "root", value: missingUnregistered },
            { selector: "root", value: healthy.root },
            { selector: "root", value: degraded.root },
          ],
        }),
      );

      for (const member of [healthy, degraded]) {
        const stateDirectory = projectStateRoot(host.hostRoot, member.repoKey);
        mkdirSync(stateDirectory, { recursive: true });
        chmodSync(stateDirectory, 0o700);
      }
      const unavailableState = projectStateRoot(host.hostRoot, unavailable.repoKey);
      mkdirSync(join(host.hostRoot, "projects"), { recursive: true });
      writeFileSync(unavailableState, "not a state directory\n");
      const healthyState = projectStateRoot(host.hostRoot, healthy.repoKey);
      server = await bindSocket(socketSettingsFor(healthyState).socketPath);

      const run = await scopedList(harness, "platform");
      expect(run.exitCode, run.stderr).toBe(0);
      const envelope = envelopeOf(run);
      if (envelope === undefined) throw new Error("no envelope");
      expect(Object.keys(envelope).sort()).toEqual([
        "data",
        "exitCode",
        "runId",
        "schemaVersion",
        "timing",
      ]);
      expect(Object.hasOwn(envelope, "ok")).toBe(false);
      expect(Object.hasOwn(envelope, "command")).toBe(false);
      expect(envelope.schemaVersion).toBe("delivery.result.v1");

      const group = groupsOf(run)[0];
      expect(group?.groupKey).toBe("platform");
      expect(group?.workspaceRoot).toBeUndefined();
      expect(Object.keys(group ?? {}).sort()).toEqual(["groupKey", "members", "name"]);

      const members = group?.members ?? [];
      expect(members).toHaveLength(5);
      for (const member of members) {
        expect(Object.keys(member).sort()).toEqual([...PROJECT_GROUP_MEMBER_FIELDS].sort());
        if (!member.daemonReachable.reachable) {
          expect(DAEMON_REACHABILITY_REASONS).toContain(member.daemonReachable.reason);
        }
      }
      expect(members.map((member) => member.root)).toEqual([
        unavailable.root,
        missingUnsupported,
        missingUnregistered,
        healthy.root,
        degraded.root,
      ]);
      expect(members.map((member) => member.health)).toEqual([
        "state-unavailable",
        "not-yet-supported",
        "unregistered",
        "healthy",
        "degraded",
      ]);
      expect(members[0]?.trackerKind).toBe("github");
      expect(members[1]?.trackerKind).toBe("jira");
      expect(members[3]?.daemonReachable).toEqual({ reachable: true });
      expect(members[4]?.daemonReachable).toEqual({
        reachable: false,
        reason: "socket-absent",
      });

      const failure = await scopedList(harness, "missing-group");
      expect(failure.exitCode).toBe(1);
      expect(envelopeOf(failure)?.error?.code).toBe("projects.unknown-group");
      const failureEnvelope = envelopeOf(failure);
      if (failureEnvelope === undefined) throw new Error("no failure envelope");
      expect(Object.keys(failureEnvelope).sort()).toEqual([
        "error",
        "exitCode",
        "runId",
        "schemaVersion",
        "timing",
      ]);
      expect(Object.hasOwn(failureEnvelope, "ok")).toBe(false);
      expect(Object.hasOwn(failureEnvelope, "command")).toBe(false);
    } finally {
      if (server !== undefined) await server.close();
      harness.dispose();
      removeDirectory(workspace);
      removeDirectory(`${host.hostRoot}-controller`);
      host.dispose();
    }
  });
});
