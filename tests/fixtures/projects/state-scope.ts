/**
 * State-isolation fixtures for the two-layer state scope (GH-288 NFR-8,
 * RSK-12, TC-PROJ-038).
 *
 * Every suite that opens a store gets a per-test host root under the
 * repository-local approved base, a home that is a distinct directory, and the
 * brand-derived absolute override pointing at the host root. `guardStateFixtureRoot`
 * refuses the live checkout, any ancestor of it, the home-derived real state
 * directory, and anything outside the approved base or the OS temp root, so a
 * fixture can never write into the operator's real state directory.
 */
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  ensureProjectIdentityMarkerText,
  readProjectIdentityMarker,
} from "../../../packages/adapters/src/file/project-identity";
import {
  findGitRoot,
  nodeRepositoryIo,
  readCheckoutIdentity,
} from "../../../packages/adapters/src/repo/index";
import {
  type ProjectScopeInput,
  type ProjectScopeOutcome,
  resolveProjectScope,
} from "../../../packages/core/src/app/state-scope";
import { resolveBrandIdentity } from "../../../packages/core/src/branding/index";
import type { BrandIdentity } from "../../../packages/core/src/contracts/index";

/** The approved fixture base: repository-local, never the OS temp root. */
export const APPROVED_BASE = join(process.cwd(), "tmp", "tmpdir");

/** Resolve the production brand for a neutral working name (no literal). */
export const brandOf = (workingName = "delivery-os"): BrandIdentity => {
  const resolved = resolveBrandIdentity({ workingName });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
};

/** The brand-derived absolute override variable name. */
export const stateOverrideVariable = (brand: BrandIdentity): string =>
  `${brand.environmentPrefix.toUpperCase().replace(/_+$/u, "")}_STATE_DIR`;

/** The home-derived real state directory a leak would damage. */
export const realStateDirectory = (brand: BrandIdentity): string =>
  join(homedir(), brand.stateDirectoryName);

const isInside = (target: string, parent: string): boolean =>
  target === parent || target.startsWith(`${parent}/`);

/**
 * Refuse a fixture state root that could damage the operator's machine or the
 * live checkout. Passes only under the approved base or the OS temp root and
 * never inside the live workspace.
 */
export const guardStateFixtureRoot = (
  directory: string,
  options: { readonly brand?: BrandIdentity } = {},
): void => {
  const brand = options.brand ?? brandOf();
  const target = resolve(directory);
  const workspace = resolve(process.cwd());
  const real = resolve(realStateDirectory(brand));
  const reject = (reason: string): never => {
    throw new Error(`refusing fixture state root ${target}: ${reason}`);
  };
  if (target === "/") reject("the filesystem root");
  if (target === workspace || workspace.startsWith(`${target}/`)) {
    reject("the live workspace root or an ancestor of it");
  }
  if (target === real || isInside(target, real)) {
    reject("the home-derived real state directory");
  }
  if (isInside(target, resolve(APPROVED_BASE))) return;
  if (isInside(target, workspace)) reject("inside the live workspace");
  const tempRoot = resolve(tmpdir());
  if (isInside(target, tempRoot)) return;
  // The repository's parent hosts the non-checkout fixtures when the gate puts
  // `TMPDIR` inside the checkout (GH-273 fallback, TC-PROJ-038 step 6). The
  // parent itself is an ancestor of the workspace and stays refused above.
  if (isInside(target, dirname(workspace))) return;
  reject("outside the approved base and the OS temp root");
};

/** A read-only fingerprint of the real state directory (or its absence). */
export const realStateFingerprint = (brand: BrandIdentity): string => {
  const directory = realStateDirectory(brand);
  let entries: string[];
  try {
    entries = readdirSync(directory).sort();
  } catch {
    return "absent";
  }
  return entries
    .map((name) => {
      try {
        const stat = statSync(join(directory, name));
        return `${name}:${String(stat.size)}:${String(stat.mtimeMs)}`;
      } catch {
        return `${name}:unreadable`;
      }
    })
    .join("|");
};

/** A directory proven to be outside every git work tree (the GH-273 rule). */
export const nonCheckoutDirectory = (label: string): string => {
  const candidates = [tmpdir(), dirname(process.cwd()), resolve(APPROVED_BASE)];
  for (const parent of candidates) {
    mkdirSync(parent, { recursive: true });
    const directory = mkdtempSync(join(parent, `gh288-non-checkout-${label}-`));
    const root = findGitRoot(directory, nodeRepositoryIo());
    if (root === undefined) return directory;
    rmSync(directory, { recursive: true, force: true });
  }
  throw new Error(`no directory outside every git work tree is available for ${label}`);
};

export type HostFixture = {
  readonly brand: BrandIdentity;
  readonly hostRoot: string;
  readonly home: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly dispose: () => void;
};

/** One per-test host root plus a home that is a distinct directory (TR-10). */
export const createHostFixture = (
  label: string,
  options: { readonly brand?: BrandIdentity } = {},
): HostFixture => {
  const brand = options.brand ?? brandOf();
  mkdirSync(APPROVED_BASE, { recursive: true });
  const hostRoot = mkdtempSync(join(APPROVED_BASE, `gh288-${label}-host-`));
  const home = mkdtempSync(join(APPROVED_BASE, `gh288-${label}-home-`));
  guardStateFixtureRoot(hostRoot, { brand });
  guardStateFixtureRoot(home, { brand });
  if (hostRoot === home || isInside(hostRoot, home) || isInside(home, hostRoot)) {
    throw new Error("the fixture host root and home must be distinct directories");
  }
  const environment = {
    HOME: home,
    [stateOverrideVariable(brand)]: hostRoot,
  };
  return {
    brand,
    hostRoot,
    home,
    environment,
    dispose: () => {
      rmSync(hostRoot, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    },
  };
};

/**
 * Resolve one checkout's scope through the delivered policy and the delivered
 * adapter seam (the same call the composition makes). Nothing is injected: the
 * key comes from the marker, the root from the override.
 */
export const projectScopeFor = (input: {
  readonly cwd: string;
  readonly hostRoot: string;
  readonly home?: string;
  readonly brand?: BrandIdentity;
}): ProjectScopeOutcome => {
  const brand = input.brand ?? brandOf();
  const scopeInput: ProjectScopeInput = {
    environment: {
      ...(input.home === undefined ? {} : { HOME: input.home }),
      [stateOverrideVariable(brand)]: input.hostRoot,
    },
    environmentPrefix: brand.environmentPrefix,
    stateDirectoryName: brand.stateDirectoryName,
    ...(input.home === undefined ? {} : { homeDirectory: input.home }),
    checkout: readCheckoutIdentity({ cwd: input.cwd, io: nodeRepositoryIo() }),
    ports: {
      readMarker: (commonDir) => readProjectIdentityMarker(commonDir),
      writeMarker: (commonDir, text) => ensureProjectIdentityMarkerText(commonDir, text),
      newProjectIdentifier: () => globalThis.crypto.randomUUID().replace(/-/gu, ""),
    },
  };
  const scope = resolveProjectScope(scopeInput);
  if (!scope.ok) throw new Error(`scope resolution failed: ${scope.error.code}`);
  return scope.value;
};
