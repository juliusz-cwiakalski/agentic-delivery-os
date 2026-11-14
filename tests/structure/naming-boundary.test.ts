/**
 * GH-309 TC-GRPBOUND-001/002, TC-GRPSREAD-003 (scan half), TC-GRPREG-002 — the
 * naming boundary over the delivered surfaces, the permanent repository
 * vocabulary, and the board's repository-key meaning.
 *
 * The boundary is one statement consumed everywhere: `repos` is the flat record
 * set of managed checkouts and `projects` is the group surface. The anchors here
 * read the delivered root help, the two M2 reference pages, and the migration
 * guide, so the four surfaces cannot drift apart silently. The negative scan
 * keeps the pre-rename meaning out of current instructions, and the second half
 * pins the vocabulary the rename deliberately did not touch: the identity
 * marker, the `<host root>/projects/<key>` container, the host-index
 * `projects[]`/`projectKey` fields, and `--project-root`.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { allHelpEntries, renderRootHelp } from "../../packages/cli/src/help";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const M2_PAGES = "doc/planning/oss-tooling/milestones/m2/commands";
const REPOS_PAGE = `${M2_PAGES}/repos.md`;
const PROJECTS_PAGE = `${M2_PAGES}/projects.md`;
const BOARD_PAGE = `${M2_PAGES}/board.md`;
const CONTRACTS = "doc/planning/oss-tooling/milestones/m2/contracts.md";
const MIGRATION_GUIDE = "doc/guides/migrating-to-per-repository-state.md";
const STATE_SCOPE_POLICY_SUITE = "tests/structure/projects-state-scope-policy.test.ts";

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const helpFor = (path: readonly string[]) =>
  allHelpEntries().find((entry) => entry.path.join(" ") === path.join(" "));

const referencePages = (): string[] =>
  readdirSync(join(ROOT, M2_PAGES))
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => `${M2_PAGES}/${name}`);

describe("TC-GRPBOUND-001 the naming boundary holds everywhere both names appear", () => {
  test("root help describes repos as the flat record set and projects as groups", () => {
    const root = renderRootHelp(SYNTHETIC_BRAND);
    expect(root).toMatch(/^ {2}repos {2}The flat record set/mu);
    expect(root).toMatch(/^ {2}projects {2}Project groups/mu);
    expect(helpFor(["repos"])?.summary.toLowerCase()).toContain("flat record set");
    expect(helpFor(["projects"])?.summary.toLowerCase()).toContain("project groups");
    expect(helpFor(["projects", "list"])?.options.map(([flag]) => flag)).toContain("--flat");
  });

  test("both reference pages state the same boundary", () => {
    const repos = read(REPOS_PAGE);
    expect(repos).toContain("the flat record set of delivery-managed checkouts");
    expect(repos).toContain("The group surface belongs to `projects`");
    const projects = read(PROJECTS_PAGE);
    expect(projects).toContain("the group surface: configured groups");
    expect(projects).toContain("`repos` is the flat record set, and `projects`");
    expect(projects).toContain("groups it");
  });

  test("the migration guide speaks the same delivered mapping", () => {
    const guide = read(MIGRATION_GUIDE);
    expect(guide).toContain("`repos list` is the **flat record set**");
    expect(guide).toContain("`projects list` is the **group surface**");
    expect(guide).toContain("`projects list --flat` is the **transition alias**");
  });

  test("no surface states the pre-rename meaning as current", () => {
    const surfaces: Record<string, string> = {
      "root help": renderRootHelp(SYNTHETIC_BRAND),
      "repos page": read(REPOS_PAGE),
      "projects page": read(PROJECTS_PAGE),
      "migration guide": read(MIGRATION_GUIDE),
    };
    const staleClaims = [
      /`projects list` is the flat record set/iu,
      /`projects` is the flat record set/iu,
      /`projects list` enumerates the flat record set/iu,
      /flat record set as `projects list`/iu,
      /the flat record set[^.\n]{0,40}`projects list`/iu,
    ];
    const failures: string[] = [];
    for (const [surface, text] of Object.entries(surfaces)) {
      for (const claim of staleClaims) {
        if (claim.test(text)) failures.push(`${surface}: ${claim.source}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("TC-GRPBOUND-002 the permanent repository vocabulary is unchanged", () => {
  const contracts = read("packages/core/src/contracts/projects.ts");

  test("the identity marker and its schema keep their repository meaning", () => {
    expect(contracts).toContain('PROJECT_IDENTITY_MARKER_NAME = "project-identity.json"');
    expect(contracts).toContain('PROJECT_IDENTITY_SCHEMA = "delivery.projects.identity.v1"');
    expect(contracts).toContain("PROJECT_KEY_PATTERN = /^[a-z0-9]");
  });

  test("the projects container and the host-index fields are unchanged", () => {
    expect(contracts).toContain('PROJECTS_CONTAINER_SEGMENT = "projects"');
    expect(contracts).toContain('HOST_INDEX_ARTIFACT_NAME = "host-index.json"');
    expect(contracts).toContain('HOST_INDEX_DOCUMENT_FIELDS = ["schema", "revision", "projects"]');
    expect(contracts).toContain('"projectKey"');
    const stateScope = read("packages/core/src/app/state-scope.ts");
    expect(stateScope).toContain("PROJECTS_CONTAINER_SEGMENT");
    const hostIndex = read("packages/core/src/app/host-index.ts");
    expect(hostIndex).toContain("projectKey");
    expect(hostIndex).toContain("projectIdentifier");
  });

  test("--project-root still denotes a repository checkout", () => {
    expect(read("packages/cli/src/commands/config.ts")).toContain('"--project-root"');
    expect(read("packages/cli/src/edge.ts")).toContain('stringFlag(flags, "--project-root")');
  });

  test("the state-scope policy suite guards the same permanent vocabulary", () => {
    expect(existsSync(join(ROOT, STATE_SCOPE_POLICY_SUITE))).toBe(true);
    const suite = read(STATE_SCOPE_POLICY_SUITE);
    expect(suite).toContain("project-identity.json");
    expect(suite).toContain("resolveProjectScope");
    expect(suite).toContain("stateScopeRoots");
  });
});

describe("TC-GRPSREAD-003 the board is never group-scoped", () => {
  test("board --project is documented as a repository key", () => {
    const board = read(BOARD_PAGE);
    expect(board).toContain("`--project <key>` takes a repository key");
    expect(board).toContain("| `--project <key>` | Narrow to one repository key. |");
    expect(board).toContain("never enumerates groups");
  });

  test("no help or reference text claims a group-scoped board", () => {
    const helpText = allHelpEntries()
      .map((entry) => `${entry.path.join(" ")}\n${entry.summary}`)
      .join("\n");
    const surfaces: Record<string, string> = {
      "root help": renderRootHelp(SYNTHETIC_BRAND),
      "all help entries": helpText,
      contracts: read(CONTRACTS),
    };
    for (const page of referencePages()) surfaces[page] = read(page);
    const groupScopeClaims = [
      "board --project <groupKey>",
      "board is group-scoped",
      "board enumerates groups",
      "board takes a group key",
    ];
    const failures: string[] = [];
    for (const [surface, text] of Object.entries(surfaces)) {
      for (const claim of groupScopeClaims) {
        if (text.includes(claim)) failures.push(`${surface}: ${claim}`);
      }
    }
    expect(failures).toEqual([]);
    const boardHelp = allHelpEntries().filter((entry) => entry.path.includes("board"));
    for (const entry of boardHelp) {
      expect(entry.options.map(([flag]) => flag).join(" ")).not.toContain("groupKey");
    }
  });
});

describe("TC-GRPREG-002 the migration guide speaks the delivered vocabulary", () => {
  const guide = read(MIGRATION_GUIDE);

  test("names all three command surfaces and keeps migration one-step operator-run", () => {
    expect(guide).toContain("`repos list`");
    expect(guide).toContain("`projects list`");
    expect(guide).toContain("`projects list --flat`");
    expect(guide.toLowerCase()).toContain("one-step");
    expect(guide.toLowerCase()).toContain("operator-run");
    expect(guide).toContain("one directory move");
  });

  test("the superseding record and the alias are the stated transition path", () => {
    expect(guide).toContain("ODR-0004-flat-record-set-rename-projects-to-repos.md");
    expect(guide).toContain("alias is the transition path");
    expect(guide).toMatch(/The alias retires at the M3\s+boundary/u);
  });

  test("no pre-rename instruction remains as current procedure", () => {
    expect(guide).not.toContain("`projects list --json`");
    expect(guide).not.toContain("Resolve the primary project's state root with `projects list`");
    expect(guide).not.toContain("## What `projects list` writes");
    expect(guide).toContain("## What `repos list` writes");
  });
});
