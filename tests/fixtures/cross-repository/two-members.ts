/**
 * Hermetic two-member world (GH-310 NFR-3, AC-NFR3-1): one per-case base under
 * the gate `TMPDIR`, a per-case host root/home, and two real local member
 * checkouts with their own branch and pushed head. Each member's durable
 * `repoKey` is minted through the delivered scope policy from a pre-written
 * deterministic identity marker, so goldens stay stable. Nothing reaches the
 * network or the operator's home.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  projectKeyFor,
  sanitizeProjectBasename,
  serializeProjectIdentityMarker,
} from "../../../packages/core/src/app/state-scope";
import { resolveBrandIdentity } from "../../../packages/core/src/branding/index";
import {
  PROJECT_IDENTITY_MARKER_NAME,
  PROJECT_IDENTITY_SCHEMA,
} from "../../../packages/core/src/contracts/projects";
import { guardStateFixtureRoot, projectScopeFor } from "../projects/state-scope";
import { createRepository, git, removeDirectory } from "../projects/temp-repos";
import { API_MEMBER, DOCS_MEMBER, type MemberFixture, WEB_MEMBER } from "./constants";

export type WorldMember = {
  readonly label: string;
  readonly repoKey: string;
  readonly root: string;
  readonly branch: string;
  readonly pullRequest: string;
  readonly headSha: string;
};

export type TwoMemberWorld = {
  readonly base: string;
  readonly hostRoot: string;
  readonly home: string;
  readonly members: readonly WorldMember[];
  readonly dispose: () => void;
};

const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
})();

/** The deterministic 32-hex identifier behind each fixture member key. */
const identifiers: Readonly<Record<string, string>> = {
  [API_MEMBER.repoKey]: "1a2b3c4d000000000000000000000000",
  [WEB_MEMBER.repoKey]: "5e6f7a8b000000000000000000000000",
  [DOCS_MEMBER.repoKey]: "9c0d1e2f000000000000000000000000",
};

/** Write the create-once marker the scope policy reads (deterministic key). */
const writeIdentityMarker = (root: string, repoKey: string): void => {
  const identifier = identifiers[repoKey];
  if (identifier === undefined) throw new Error(`no fixture identifier for ${repoKey}`);
  const basename = repoKey.slice(0, repoKey.length - 9);
  const commonDir = git(root, ["rev-parse", "--git-common-dir"]).trim();
  const text = serializeProjectIdentityMarker({
    schema: PROJECT_IDENTITY_SCHEMA,
    projectKey: projectKeyFor(sanitizeProjectBasename(basename), identifier),
    projectIdentifier: identifier,
    basename,
  });
  writeFileSync(join(resolve(root, commonDir), PROJECT_IDENTITY_MARKER_NAME), text, {
    mode: 0o600,
  });
};

const materialize = (
  base: string,
  hostRoot: string,
  home: string,
  fixture: MemberFixture,
): WorldMember => {
  const root = createRepository(base, fixture.label);
  writeIdentityMarker(root, fixture.repoKey);
  const scope = projectScopeFor({ cwd: root, hostRoot, home, brand });
  if (scope.scope.kind !== "project") {
    throw new Error(`fixture checkout ${root} did not resolve to a project scope`);
  }
  if (scope.scope.projectKey !== fixture.repoKey) {
    throw new Error(`fixture key ${scope.scope.projectKey} != declared ${fixture.repoKey}`);
  }
  git(root, ["checkout", "-b", fixture.branch]);
  writeFileSync(join(root, `${fixture.label}.txt`), `${fixture.branch}\n`);
  git(root, ["add", `${fixture.label}.txt`]);
  git(root, ["commit", "-m", `fixture: ${fixture.branch}`]);
  const headSha = git(root, ["rev-parse", "HEAD"]).trim();
  return {
    label: fixture.label,
    repoKey: fixture.repoKey,
    root,
    branch: fixture.branch,
    pullRequest: fixture.pullRequest,
    headSha,
  };
};

/** Create a per-case base, host, and real member checkouts. */
export const createMemberWorld = (
  label: string,
  fixtures: readonly MemberFixture[],
): TwoMemberWorld => {
  // The gate TMPDIR sits inside this checkout's parent git work tree in some
  // environments, so the per-case base uses the approved external temp root:
  // it is outside every work tree and never the operator's home.
  mkdirSync("/tmp/opencode", { recursive: true });
  const base = mkdtempSync(join("/tmp/opencode", `gh310-${label}-`));
  const hostRoot = join(base, "host");
  const home = join(base, "home");
  mkdirSync(hostRoot, { recursive: true });
  mkdirSync(home, { recursive: true });
  guardStateFixtureRoot(hostRoot, { brand });
  guardStateFixtureRoot(home, { brand });
  const members = fixtures.map((fixture) => materialize(base, hostRoot, home, fixture));
  return {
    base,
    hostRoot,
    home,
    members,
    dispose: () => {
      rmSync(hostRoot, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      removeDirectory(base);
    },
  };
};

/** Create a per-case base, host, and two real member checkouts. */
export const createTwoMemberWorld = (label: string): TwoMemberWorld =>
  createMemberWorld(label, [API_MEMBER, WEB_MEMBER]);

/** Create a per-case base with a third, pull-request-less member. */
export const createThreeMemberWorld = (label: string): TwoMemberWorld =>
  createMemberWorld(label, [API_MEMBER, WEB_MEMBER, DOCS_MEMBER]);
