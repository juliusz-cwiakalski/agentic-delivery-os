/**
 * GH-309 TC-GRPDOC-001..005 — the project configuration document and its
 * classified load-time validation, observed through the `projects list
 * --project <groupKey>` scoped read.
 *
 * The intermediate-state rule binds this suite: `projects list` with no flags
 * still returns the delivered flat `projects.v1` payload until the rename phase,
 * so the group surface is exercised only through the `--project` form. Every
 * configuration document is per-case fixture data written under the approved
 * temp base; no document is a committed file and no case touches `$HOME`.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PROJECT_GROUPS_CONFIG_SCHEMA } from "../../packages/core/src/contracts/projects";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  type ProductionRun,
} from "../fixtures/projects/production";
import {
  createHostFixture,
  type HostFixture,
  nonCheckoutDirectory,
} from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

type Envelope = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
};

const envelopeOf = (run: ProductionRun): Envelope | undefined =>
  run.envelope as Envelope | undefined;

const dataOf = (run: ProductionRun): Record<string, unknown> => {
  const data = envelopeOf(run)?.data;
  if (data === undefined) throw new Error(`no data envelope: ${run.stdout}${run.stderr}`);
  return data;
};

const groupsOf = (run: ProductionRun): readonly Record<string, unknown>[] => {
  const groups = dataOf(run).groups;
  if (!Array.isArray(groups)) throw new Error("data.groups is not an array");
  return groups as readonly Record<string, unknown>[];
};

const errorCodeOf = (run: ProductionRun): string | undefined => envelopeOf(run)?.error?.code;

const configPathOf = (harness: ProductionProjectsHarness): string =>
  join(harness.checkout, harness.brand.configDirectoryName, "projects.yaml");

const writeConfig = (harness: ProductionProjectsHarness, text: string): string => {
  const path = configPathOf(harness);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return path;
};

const yamlString = (value: string): string => JSON.stringify(value);

type TwoMemberFixture = {
  readonly host: HostFixture;
  readonly base: string;
  readonly alpha: string;
  readonly beta: string;
  readonly a: ProductionProjectsHarness;
  readonly b: ProductionProjectsHarness;
  readonly dispose: () => void;
};

/** Two managed checkouts in one host, both registered before the case runs. */
const twoMemberFixture = async (label: string): Promise<TwoMemberFixture> => {
  const host = createHostFixture(label);
  const base = `${host.hostRoot}-repos`;
  const alpha = createRepository(base, "alpha-repo");
  const beta = createRepository(base, "beta-repo");
  const a = createProductionProjectsHarness({
    label: `${label}-alpha`,
    host,
    workingDirectory: alpha,
    originUrl: `https://github.com/owner/${label}-alpha.git`,
  });
  const b = createProductionProjectsHarness({
    label: `${label}-beta`,
    host,
    workingDirectory: beta,
    originUrl: `https://github.com/owner/${label}-beta.git`,
  });
  const register = async (harness: ProductionProjectsHarness): Promise<void> => {
    const run = await harness.run(["queue", "list", "--json"]);
    if (run.exitCode !== 0) throw new Error(`registration failed: ${run.stderr}${run.stdout}`);
  };
  await register(a);
  await register(b);
  return {
    host,
    base,
    alpha,
    beta,
    a,
    b,
    dispose: () => {
      a.dispose();
      b.dispose();
      removeDirectory(base);
      host.dispose();
    },
  };
};

const validDocument = (fixture: TwoMemberFixture, groupKey = "core-team"): string =>
  [
    `schema: ${PROJECT_GROUPS_CONFIG_SCHEMA}`,
    "groups:",
    `  - groupKey: ${groupKey}`,
    "    name: Core Team",
    `    workspaceRoot: ${yamlString(fixture.base)}`,
    "    members:",
    `      - root: ${yamlString(fixture.alpha)}`,
    "        trackerKind: github",
    `      - repoKey: ${yamlString(fixture.b.projectKey)}`,
    "        trackerKind: github",
    "",
  ].join("\n");

describe("TC-GRPDOC-001 the configuration document loads per delivery.projects.groups.v1", () => {
  test("both declared selectors resolve with their tracker kinds through the scoped read", async () => {
    const fixture = await twoMemberFixture("grpdoc-001");
    try {
      writeConfig(fixture.a, validDocument(fixture));
      const run = await fixture.a.run(["projects", "list", "--project", "core-team", "--json"]);
      expect(run.exitCode, run.stderr).toBe(0);
      const groups = groupsOf(run);
      expect(groups).toHaveLength(1);
      const group = groups[0] ?? {};
      expect(Object.keys(group).sort()).toEqual(
        ["groupKey", "members", "name", "workspaceRoot"].sort(),
      );
      expect(group.groupKey).toBe("core-team");
      expect(group.name).toBe("Core Team");
      expect(group.workspaceRoot).toBe(fixture.base);

      const members = group.members as readonly Record<string, unknown>[];
      expect(members).toHaveLength(2);
      for (const member of members) {
        expect(Object.keys(member).sort()).toEqual(
          ["daemonReachable", "health", "repoKey", "root", "state", "trackerKind"].sort(),
        );
        expect(member.trackerKind).toBe("github");
      }
      // Declared order is preserved: the root selector first, the repoKey second.
      expect(members[0]?.root).toBe(fixture.alpha);
      expect(members[0]?.repoKey).toBe(fixture.a.projectKey);
      expect(members[1]?.root).toBe(fixture.b.checkout);
      expect(members[1]?.repoKey).toBe(fixture.b.projectKey);
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPDOC-002 a contradictory configuration is config-invalid, never silent-empty", () => {
  test("every pinned OQ-1 variant fails closed at exit 1 with projects.config-invalid", async () => {
    const fixture = await twoMemberFixture("grpdoc-002");
    try {
      const member = (selector: string): string =>
        `      - ${selector}\n        trackerKind: github`;
      const variants: ReadonlyArray<readonly [string, string]> = [
        [
          "duplicate groupKey",
          [
            `schema: ${PROJECT_GROUPS_CONFIG_SCHEMA}`,
            "groups:",
            "  - groupKey: dup",
            "    name: One",
            "    members:",
            member(`repoKey: ${yamlString(fixture.a.projectKey)}`),
            "  - groupKey: dup",
            "    name: Two",
            "    members:",
            member(`repoKey: ${yamlString(fixture.b.projectKey)}`),
            "",
          ].join("\n"),
        ],
        [
          "member with neither selector",
          [
            `schema: ${PROJECT_GROUPS_CONFIG_SCHEMA}`,
            "groups:",
            "  - groupKey: core-team",
            "    name: Core Team",
            "    members:",
            "      - trackerKind: github",
            "",
          ].join("\n"),
        ],
        [
          "member with both selectors",
          [
            `schema: ${PROJECT_GROUPS_CONFIG_SCHEMA}`,
            "groups:",
            "  - groupKey: core-team",
            "    name: Core Team",
            "    members:",
            `      - root: ${yamlString(fixture.alpha)}`,
            `        repoKey: ${yamlString(fixture.b.projectKey)}`,
            "        trackerKind: github",
            "",
          ].join("\n"),
        ],
        [
          "duplicate member selector",
          [
            `schema: ${PROJECT_GROUPS_CONFIG_SCHEMA}`,
            "groups:",
            "  - groupKey: core-team",
            "    name: Core Team",
            "    members:",
            member(`repoKey: ${yamlString(fixture.b.projectKey)}`),
            member(`repoKey: ${yamlString(fixture.b.projectKey)}`),
            "",
          ].join("\n"),
        ],
        [
          "empty members list",
          [
            `schema: ${PROJECT_GROUPS_CONFIG_SCHEMA}`,
            "groups:",
            "  - groupKey: core-team",
            "    name: Core Team",
            "    members: []",
            "",
          ].join("\n"),
        ],
        ["structurally broken YAML", `schema: ${PROJECT_GROUPS_CONFIG_SCHEMA}\ngroups: [\n`],
      ];

      for (const [label, document] of variants) {
        writeConfig(fixture.a, document);
        const run = await fixture.a.run(["projects", "list", "--project", "core-team", "--json"]);
        expect(run.exitCode, label).toBe(1);
        expect(errorCodeOf(run), label).toBe("projects.config-invalid");
        expect(envelopeOf(run)?.data, label).toBeUndefined();
      }
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPDOC-003 an unreadable document or scope is scope-unavailable at exit 2", () => {
  test("an unreadable configuration path and an unreadable invoking scope both exit 2", async () => {
    const fixture = await twoMemberFixture("grpdoc-003");
    const outside = nonCheckoutDirectory("grpdoc-003");
    let unbound: ProductionProjectsHarness | undefined;
    try {
      // A directory where the document is expected: present but unreadable.
      mkdirSync(configPathOf(fixture.a), { recursive: true });
      const unreadableDocument = await fixture.a.run([
        "projects",
        "list",
        "--project",
        "core-team",
        "--json",
      ]);
      expect(unreadableDocument.exitCode).toBe(2);
      expect(errorCodeOf(unreadableDocument)).toBe("projects.scope-unavailable");

      // An invocation outside every checkout cannot resolve the configuration
      // directory at all; it refuses rather than reporting an empty group.
      unbound = createProductionProjectsHarness({
        label: "grpdoc-003-unbound",
        workingDirectory: outside,
        originUrl: "https://github.com/owner/grpdoc-003-unbound.git",
      });
      const unreadableScope = await unbound.run([
        "projects",
        "list",
        "--project",
        "core-team",
        "--json",
      ]);
      expect(unreadableScope.exitCode).toBe(2);
      expect(errorCodeOf(unreadableScope)).toBe("projects.scope-unavailable");
    } finally {
      unbound?.dispose();
      rmSync(outside, { recursive: true, force: true });
      fixture.dispose();
    }
  });
});

describe("TC-GRPDOC-004 an unknown group key is refused at exit 1", () => {
  test("projects list --project refuses an undeclared key with projects.unknown-group", async () => {
    const fixture = await twoMemberFixture("grpdoc-004");
    try {
      writeConfig(fixture.a, validDocument(fixture));
      const run = await fixture.a.run([
        "projects",
        "list",
        "--project",
        "does-not-exist",
        "--json",
      ]);
      expect(run.exitCode).toBe(1);
      expect(errorCodeOf(run)).toBe("projects.unknown-group");
      expect(envelopeOf(run)?.data).toBeUndefined();
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPDOC-005 absent or empty configuration is a valid empty listing at exit 0", () => {
  test("an absent document, an empty groups[] document, the flipped default, and the alias", async () => {
    const fixture = await twoMemberFixture("grpdoc-005");
    try {
      // Absent document: no config file at all.
      const absent = await fixture.a.run(["projects", "list", "--project", "anything", "--json"]);
      expect(absent.exitCode, absent.stderr).toBe(0);
      expect(groupsOf(absent)).toEqual([]);

      // Empty groups[] document: legitimate zero-group truth.
      writeConfig(fixture.a, `schema: ${PROJECT_GROUPS_CONFIG_SCHEMA}\ngroups: []\n`);
      const empty = await fixture.a.run(["projects", "list", "--project", "anything", "--json"]);
      expect(empty.exitCode, empty.stderr).toBe(0);
      expect(groupsOf(empty)).toEqual([]);

      // After the rename the default form is the group envelope.
      const groups = await fixture.a.run(["projects", "list", "--json"]);
      expect(groups.exitCode, groups.stderr).toBe(0);
      const groupsData = dataOf(groups);
      expect(Array.isArray(groupsData.groups)).toBe(true);
      expect(groupsData.projects).toBeUndefined();

      // The alias alone keeps the delivered flat payload reachable (C-2).
      const flat = await fixture.a.run(["projects", "list", "--flat", "--json"]);
      expect(flat.exitCode, flat.stderr).toBe(0);
      const flatData = dataOf(flat);
      expect(Array.isArray(flatData.projects)).toBe(true);
      expect(flatData.groups).toBeUndefined();

      // Contrast: a readable-but-invalid document is never the empty success.
      writeConfig(fixture.a, `schema: ${PROJECT_GROUPS_CONFIG_SCHEMA}\ngroups: [\n`);
      const invalid = await fixture.a.run(["projects", "list", "--project", "anything", "--json"]);
      expect(invalid.exitCode).toBe(1);
      expect(errorCodeOf(invalid)).toBe("projects.config-invalid");
    } finally {
      fixture.dispose();
    }
  });
});
