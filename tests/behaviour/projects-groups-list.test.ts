/**
 * GH-309 TC-GRPWORK-001..003 and TC-GRPSURF-001..003 — workspace discovery and
 * the group surface, observed through the `projects list --project <groupKey>`
 * scoped read.
 *
 * The intermediate-state rule binds this suite: `projects list` with no flags
 * still returns the delivered flat `projects.v1` payload until the rename phase,
 * so every group assertion goes through `--project`. Member checkouts are real
 * repositories under the approved temp base; the workspace scan is exercised on
 * a host whose index is deliberately cold, so a located member is proof of the
 * declared-only scan rather than an index lookup. No live daemon is used: the
 * reachable state comes from a bound unix socket, the unreachable state from its
 * absence.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { join } from "node:path";
import { probeDaemonSocket } from "../../packages/adapters/src/daemon/unix";
import { hostIndexDocumentPath } from "../../packages/adapters/src/file/host-index-store";
import type { DaemonComposition } from "../../packages/core/src/app/projects";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";
import { resolveDaemonSettings } from "../../packages/core/src/config/index";
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

type MemberJson = {
  readonly repoKey: string;
  readonly root: string;
  readonly trackerKind: string;
  readonly state: string;
  readonly health: string;
  readonly daemonReachable: { readonly reachable: boolean; readonly reason?: string };
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

const membersOf = (run: ProductionRun): readonly MemberJson[] => {
  const members = groupsOf(run)[0]?.members;
  if (!Array.isArray(members)) throw new Error("data.groups[0].members is not an array");
  return members;
};

const errorCodeOf = (run: ProductionRun): string | undefined => envelopeOf(run)?.error?.code;

type WorkspaceFixture = {
  readonly host: HostFixture;
  readonly workspace: string;
  readonly a: MemberCheckout;
  readonly b: MemberCheckout;
  readonly harness: ProductionProjectsHarness;
  readonly dispose: () => void;
};

const createWorkspaceFixture = (
  label: string,
  options: { readonly daemon?: DaemonComposition } = {},
): WorkspaceFixture => {
  const host = createHostFixture(label);
  const workspace = `${host.hostRoot}-workspace`;
  mkdirSync(workspace, { recursive: true });
  const a = createMemberCheckout(workspace, "member-a", host);
  const b = createMemberCheckout(workspace, "member-b", host);
  const controller = createRepository(`${host.hostRoot}-controller`, "controller");
  const harness = createProductionProjectsHarness({
    label: `${label}-controller`,
    host,
    workingDirectory: controller,
    ...(options.daemon === undefined ? {} : { daemon: options.daemon }),
  });
  return {
    host,
    workspace,
    a,
    b,
    harness,
    dispose: () => {
      harness.dispose();
      removeDirectory(workspace);
      removeDirectory(`${host.hostRoot}-controller`);
      host.dispose();
    },
  };
};

const scopedList = (
  harness: ProductionProjectsHarness,
  groupKey: string,
  json = true,
): Promise<ProductionRun> =>
  harness.run(
    json
      ? ["projects", "list", "--project", groupKey, "--json"]
      : ["projects", "list", "--project", groupKey],
  );

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

/** A mounted capability backed by the delivered bounded socket probe. */
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

describe("TC-GRPWORK-001 a registered workspace locates both declared members", () => {
  test("a cold-host key-selected group resolves both clones through the declared-only scan", async () => {
    const fixture = createWorkspaceFixture("grpwork-001");
    try {
      writeProjectGroupsConfig(
        fixture.harness,
        projectGroupsDocument({
          groupKey: "platform",
          workspaceRoot: fixture.workspace,
          members: [
            { selector: "repoKey", value: fixture.a.repoKey },
            { selector: "repoKey", value: fixture.b.repoKey },
          ],
        }),
      );
      const run = await scopedList(fixture.harness, "platform");
      expect(run.exitCode, run.stderr).toBe(0);
      const group = groupsOf(run)[0];
      expect(group?.groupKey).toBe("platform");
      expect(group?.workspaceRoot).toBe(fixture.workspace);
      expect(membersOf(run).map((member) => member.repoKey)).toEqual([
        fixture.a.repoKey,
        fixture.b.repoKey,
      ]);
      expect(membersOf(run).map((member) => member.root)).toEqual([fixture.a.root, fixture.b.root]);
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPWORK-002 the same group without a workspace reads identically", () => {
  test("member keys, health, and state map 1:1 with only workspaceRoot absent", async () => {
    const fixture = createWorkspaceFixture("grpwork-002");
    try {
      writeProjectGroupsConfig(
        fixture.harness,
        projectGroupsDocument({
          groupKey: "platform",
          workspaceRoot: fixture.workspace,
          members: [
            { selector: "repoKey", value: fixture.a.repoKey },
            { selector: "repoKey", value: fixture.b.repoKey },
          ],
        }),
      );
      const registered = await scopedList(fixture.harness, "platform");
      expect(registered.exitCode, registered.stderr).toBe(0);

      writeProjectGroupsConfig(
        fixture.harness,
        projectGroupsDocument({
          groupKey: "platform",
          members: [
            { selector: "root", value: fixture.a.root },
            { selector: "root", value: fixture.b.root },
          ],
        }),
      );
      const unregistered = await scopedList(fixture.harness, "platform");
      expect(unregistered.exitCode, unregistered.stderr).toBe(0);

      const baseline = membersOf(registered).map((member) => ({
        repoKey: member.repoKey,
        health: member.health,
        state: member.state,
      }));
      const parity = membersOf(unregistered).map((member) => ({
        repoKey: member.repoKey,
        health: member.health,
        state: member.state,
      }));
      expect(parity).toEqual(baseline);
      expect(groupsOf(unregistered)[0]?.workspaceRoot).toBeUndefined();
      expect(groupsOf(unregistered)[0]?.groupKey).toBe("platform");
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPWORK-003 an undeclared clone is never admitted", () => {
  test("clones at the workspace root and nested inside a member checkout are filtered out", async () => {
    const fixture = createWorkspaceFixture("grpwork-003");
    try {
      const intruder = createMemberCheckout(fixture.workspace, "intruder", fixture.host);
      const nestedParent = join(fixture.workspace, "deep", "nested");
      mkdirSync(nestedParent, { recursive: true });
      const nested = createMemberCheckout(nestedParent, "nested-intruder", fixture.host);
      writeProjectGroupsConfig(
        fixture.harness,
        projectGroupsDocument({
          groupKey: "platform",
          workspaceRoot: fixture.workspace,
          members: [
            { selector: "repoKey", value: fixture.a.repoKey },
            { selector: "repoKey", value: fixture.b.repoKey },
          ],
        }),
      );

      const run = await scopedList(fixture.harness, "platform");
      expect(run.exitCode, run.stderr).toBe(0);
      expect(membersOf(run).map((member) => member.repoKey)).toEqual([
        fixture.a.repoKey,
        fixture.b.repoKey,
      ]);
      expect(membersOf(run)).toHaveLength(2);
      for (const undeclared of [intruder, nested]) {
        expect(run.stdout).not.toContain(undeclared.repoKey);
        expect(run.stdout).not.toContain(undeclared.root);
      }
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPSURF-001 the group envelope carries member mechanics and closed reasons", () => {
  test("declared order, health, reachability, and the text columns are exact", async () => {
    const fixture = createWorkspaceFixture("grpsurf-001", { daemon: mountedProbe() });
    let server: BoundServer | undefined;
    try {
      for (const member of [fixture.a, fixture.b]) {
        const stateDirectory = projectStateRoot(fixture.host.hostRoot, member.repoKey);
        mkdirSync(stateDirectory, { recursive: true });
        chmodSync(stateDirectory, 0o700);
      }
      // Declare b first: sorted order would disagree, so order drift is visible.
      writeProjectGroupsConfig(
        fixture.harness,
        projectGroupsDocument({
          groupKey: "platform",
          members: [
            { selector: "root", value: fixture.b.root },
            { selector: "root", value: fixture.a.root },
          ],
        }),
      );
      const reachableState = projectStateRoot(fixture.host.hostRoot, fixture.a.repoKey);
      server = await bindSocket(socketSettingsFor(reachableState).socketPath);

      const run = await scopedList(fixture.harness, "platform");
      expect(run.exitCode, run.stderr).toBe(0);
      const members = membersOf(run);
      expect(members.map((member) => member.repoKey)).toEqual([
        fixture.b.repoKey,
        fixture.a.repoKey,
      ]);
      const byKey = new Map(members.map((member) => [member.repoKey, member]));
      expect(byKey.get(fixture.a.repoKey)?.health).toBe("healthy");
      expect(byKey.get(fixture.a.repoKey)?.daemonReachable).toEqual({ reachable: true });
      expect(byKey.get(fixture.b.repoKey)?.health).toBe("degraded");
      expect(byKey.get(fixture.b.repoKey)?.daemonReachable).toEqual({
        reachable: false,
        reason: "socket-absent",
      });
      expect([
        "daemon-not-mounted",
        "state-absent",
        "socket-absent",
        "socket-unreachable",
      ]).toContain(byKey.get(fixture.b.repoKey)?.daemonReachable.reason ?? "daemon-not-mounted");

      const text = await scopedList(fixture.harness, "platform", false);
      expect(text.exitCode, text.stderr).toBe(0);
      const lines = text.stdout.trimEnd().split("\n");
      expect(lines[0]?.split(/\s{2,}/u)).toEqual([
        "PROJECT",
        "PROJECT REPOSITORY",
        "TRACKER",
        "STATE",
        "HEALTH",
        "DAEMON",
      ]);
      expect(lines[1]?.split(/\s{2,}/u)[0]).toBe("platform");
      expect(lines[1]?.split(/\s{2,}/u)[1]).toBe(fixture.b.repoKey);
      expect(lines[2]?.split(/\s{2,}/u)[1]).toBe(fixture.a.repoKey);
    } finally {
      if (server !== undefined) await server.close();
      fixture.dispose();
    }
  });
});

describe("TC-GRPSURF-002 text is deterministic and order follows configuration", () => {
  test("two text runs are byte-identical and reordering the document reorders members", async () => {
    const fixture = createWorkspaceFixture("grpsurf-002");
    try {
      const document = (members: readonly ("a" | "b")[]): string =>
        projectGroupsDocument({
          groupKey: "platform",
          workspaceRoot: fixture.workspace,
          members: members.map((key) => ({
            selector: "repoKey" as const,
            value: key === "a" ? fixture.a.repoKey : fixture.b.repoKey,
          })),
        });

      writeProjectGroupsConfig(fixture.harness, document(["a", "b"]));
      const firstText = await scopedList(fixture.harness, "platform", false);
      const secondText = await scopedList(fixture.harness, "platform", false);
      expect(firstText.exitCode, firstText.stderr).toBe(0);
      expect(secondText.exitCode, secondText.stderr).toBe(0);
      expect(secondText.stdout).toBe(firstText.stdout);

      const firstJson = await scopedList(fixture.harness, "platform");
      const secondJson = await scopedList(fixture.harness, "platform");
      expect(dataOf(secondJson)).toEqual(dataOf(firstJson));
      expect(firstJson.exitCode, firstJson.stderr).toBe(0);
      expect(secondJson.exitCode, secondJson.stderr).toBe(0);

      writeProjectGroupsConfig(fixture.harness, document(["b", "a"]));
      const reordered = await scopedList(fixture.harness, "platform");
      expect(reordered.exitCode, reordered.stderr).toBe(0);
      expect(membersOf(reordered).map((member) => member.repoKey)).toEqual([
        fixture.b.repoKey,
        fixture.a.repoKey,
      ]);
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPAGG-001 one degraded member yields a classified partial result at exit 0", () => {
  test("a state-unavailable member degrades the read without failing it", async () => {
    const fixture = createWorkspaceFixture("grpagg-001");
    try {
      // Member b's state location is a regular file: the member classifies
      // state-unavailable while member a stays readable.
      const unavailableState = projectStateRoot(fixture.host.hostRoot, fixture.b.repoKey);
      mkdirSync(join(fixture.host.hostRoot, "projects"), { recursive: true });
      writeFileSync(unavailableState, "not a state directory\n");
      writeProjectGroupsConfig(
        fixture.harness,
        projectGroupsDocument({
          groupKey: "platform",
          members: [
            { selector: "root", value: fixture.a.root },
            { selector: "root", value: fixture.b.root },
          ],
        }),
      );

      const run = await scopedList(fixture.harness, "platform");
      expect(run.exitCode, run.stderr).toBe(0);
      const data = dataOf(run);
      expect(data.partial).toBe(true);
      expect(data.degradedMembers).toEqual([
        { repoKey: fixture.b.repoKey, outcome: "state-unavailable" },
      ]);

      const members = membersOf(run);
      expect(members).toHaveLength(2);
      const byKey = new Map(members.map((member) => [member.repoKey, member]));
      expect(byKey.get(fixture.b.repoKey)?.health).toBe("state-unavailable");
      expect(byKey.get(fixture.a.repoKey)?.health).not.toBe("state-unavailable");
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPSURF-003 mixed tracker kinds classify not-yet-supported", () => {
  test("an unimplemented kind is accepted, classified, and never fails the read", async () => {
    const fixture = createWorkspaceFixture("grpsurf-003");
    try {
      writeProjectGroupsConfig(
        fixture.harness,
        projectGroupsDocument({
          groupKey: "platform",
          workspaceRoot: fixture.workspace,
          members: [
            { selector: "repoKey", value: fixture.a.repoKey },
            { selector: "repoKey", value: fixture.b.repoKey, trackerKind: "jira" },
          ],
        }),
      );
      const run = await scopedList(fixture.harness, "platform");
      expect(run.exitCode, run.stderr).toBe(0);
      expect(errorCodeOf(run)).toBeUndefined();
      const members = membersOf(run);
      const byKey = new Map(members.map((member) => [member.repoKey, member]));
      expect(byKey.get(fixture.a.repoKey)?.trackerKind).toBe("github");
      expect(byKey.get(fixture.b.repoKey)?.trackerKind).toBe("jira");
      expect(byKey.get(fixture.b.repoKey)?.health).toBe("not-yet-supported");
      expect(Object.hasOwn(dataOf(run), "partial")).toBe(false);
    } finally {
      fixture.dispose();
    }
  });
});

describe("F-4 a corrupt host index is an empty resolution aid on the group surface", () => {
  test("index-dependent members classify unregistered at exit 0; others still resolve", async () => {
    const fixture = createWorkspaceFixture("grp-corrupt-index");
    try {
      // No workspaceRoot: the repoKey-selected member can only be located by the
      // index, while the root-selected member resolves from its identity marker.
      writeProjectGroupsConfig(
        fixture.harness,
        projectGroupsDocument({
          groupKey: "platform",
          members: [
            { selector: "repoKey", value: fixture.a.repoKey },
            { selector: "root", value: fixture.b.root },
          ],
        }),
      );
      mkdirSync(projectStateRoot(fixture.host.hostRoot, fixture.b.repoKey), {
        recursive: true,
        mode: 0o700,
      });
      mkdirSync(fixture.host.hostRoot, { recursive: true });
      writeFileSync(hostIndexDocumentPath(fixture.host.hostRoot), "{ not json\n");

      // The group surface, the scoped read, and both group-scoped work reads all
      // treat the corrupt index as empty and stay at exit 0 (GH-309 F-4).
      for (const run of [
        await fixture.harness.run(["projects", "list", "--json"]),
        await scopedList(fixture.harness, "platform"),
        await fixture.harness.run(["queue", "list", "--project", "platform", "--json"]),
        await fixture.harness.run(["status", "--project", "platform", "--json"]),
      ]) {
        expect(run.exitCode, run.stderr).toBe(0);
        expect(errorCodeOf(run)).toBeUndefined();
      }

      const members = membersOf(await scopedList(fixture.harness, "platform"));
      const byKey = new Map(members.map((member) => [member.repoKey, member]));
      expect(byKey.get(fixture.a.repoKey)?.health).toBe("unregistered");
      expect(byKey.get(fixture.b.repoKey)?.health).not.toBe("unregistered");
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPREN-004 the default form returns project-groups.v1, not the flat payload", () => {
  test("the three synopsis forms are distinct on one host", async () => {
    const fixture = createWorkspaceFixture("grpren-004");
    try {
      writeProjectGroupsConfig(
        fixture.harness,
        projectGroupsDocument({
          groupKey: "platform",
          workspaceRoot: fixture.workspace,
          members: [
            { selector: "repoKey", value: fixture.a.repoKey },
            { selector: "repoKey", value: fixture.b.repoKey },
          ],
        }),
      );

      // Default: every configured group.
      const byDefault = await fixture.harness.run(["projects", "list", "--json"]);
      expect(byDefault.exitCode, byDefault.stderr).toBe(0);
      const defaultData = dataOf(byDefault);
      expect(Array.isArray(defaultData.groups)).toBe(true);
      expect(defaultData.projects).toBeUndefined();
      expect((defaultData.groups as readonly Record<string, unknown>[])[0]?.groupKey).toBe(
        "platform",
      );
      expect(JSON.stringify(defaultData)).not.toContain("projectKey");

      // Scoped: exactly the requested group.
      const scoped = await scopedList(fixture.harness, "platform");
      expect(scoped.exitCode, scoped.stderr).toBe(0);
      expect(groupsOf(scoped)).toHaveLength(1);
      expect(groupsOf(scoped)[0]?.groupKey).toBe("platform");

      // Alias: the delivered flat payload, not a group record set.
      const alias = await fixture.harness.run(["projects", "list", "--flat", "--json"]);
      expect(alias.exitCode, alias.stderr).toBe(0);
      const aliasData = dataOf(alias);
      expect(Array.isArray(aliasData.projects)).toBe(true);
      expect(aliasData.groups).toBeUndefined();
      expect(JSON.stringify(aliasData)).not.toContain("groupKey");
    } finally {
      fixture.dispose();
    }
  });
});
