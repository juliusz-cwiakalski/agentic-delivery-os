/**
 * The real-production `dispatch attempts` fixture (GH-289 §6).
 *
 * Composes the real production program over one or two real checkouts sharing a
 * single per-test host root, seeds attempt and divergence records through the
 * delivered append helpers on the checkout's project store, writes and removes
 * the local PM context, and exposes the store snapshot and marker readers the
 * read-only assertions need. Only the origin remote and the recording seams are
 * injected — there is deliberately no way to inject a state root or project key.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  dispatchIdentityMarkerPath,
  readDispatchIdentityMarkerText,
} from "../../../packages/adapters/src/file/dispatch-identity";
import { readProjectIdentityMarker } from "../../../packages/adapters/src/file/project-identity";
import {
  appendDispatchAttempt,
  appendDispatchDivergence,
} from "../../../packages/core/src/app/dispatch-ledger";
import type {
  DispatchAttemptRecord,
  DispatchDivergenceRecord,
} from "../../../packages/core/src/contracts/index";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  type ProductionRun,
} from "../projects/production";
import type { HostFixture } from "../projects/state-scope";
import { createRepository, git } from "../projects/temp-repos";

/** The store file set whose bytes, modes, and mtimes a read must not change. */
export type StoreSnapshot = Readonly<Record<string, string>>;

const walk = (root: string, relative = ""): string[] => {
  const directory = relative.length === 0 ? root : join(root, relative);
  let entries: string[];
  try {
    entries = readdirSync(directory).sort();
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const entry of entries) {
    const next = relative.length === 0 ? entry : `${relative}/${entry}`;
    const stat = statSync(join(root, next));
    if (stat.isDirectory()) results.push(...walk(root, next));
    else results.push(next);
  }
  return results;
};

/** Byte, mode, and mtime fingerprint of one directory tree. */
export const snapshotStore = (directory: string): StoreSnapshot => {
  const snapshot: Record<string, string> = {};
  for (const name of walk(directory)) {
    const stat = statSync(join(directory, name));
    snapshot[name] =
      `${String(stat.size)}:${(stat.mode & 0o777).toString(8)}:${String(stat.mtimeMs)}`;
  }
  return snapshot;
};

/** The ledger evidence files only (the delivery evidence a read must not touch). */
export const evidenceFiles = (snapshot: StoreSnapshot): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(snapshot).filter(([name]) => name.startsWith("ledger")));

export type AttemptsProductionCheckout = {
  readonly name: string;
  readonly checkout: string;
  readonly repository: string;
  readonly harness: ProductionProjectsHarness;
  /** Append attempts and divergences through the delivered helpers. */
  readonly seedAttempts: (records: readonly DispatchAttemptRecord[]) => void;
  readonly seedDivergences: (records: readonly DispatchDivergenceRecord[]) => void;
  readonly writeContext: (ref: string) => void;
  readonly removeContext: () => void;
  readonly dispatchIdentityMarker: () => string | undefined;
  /** Write a torn binding marker, so the read's non-repair is observable. */
  readonly writeDispatchIdentityMarker: (text: string) => void;
  readonly projectIdentityMarker: () => ReturnType<typeof readProjectIdentityMarker>;
  readonly run: (argv: readonly string[]) => Promise<ProductionRun>;
};

export type AttemptsProductionFixture = {
  readonly host: HostFixture;
  readonly a: AttemptsProductionCheckout;
  readonly b: AttemptsProductionCheckout;
  readonly dispose: () => void;
};

const seedStore = (harness: ProductionProjectsHarness) => ({
  attempts: (records: readonly DispatchAttemptRecord[]) => {
    for (const record of records) {
      const appended = appendDispatchAttempt(harness.store, "fixture-fence", record);
      if (!appended.ok) throw new Error(`attempt seeding failed: ${appended.code}`);
    }
  },
  divergences: (records: readonly DispatchDivergenceRecord[]) => {
    for (const record of records) {
      const appended = appendDispatchDivergence(harness.store, "fixture-fence", record);
      if (!appended.ok) throw new Error(`divergence seeding failed: ${appended.code}`);
    }
  },
});

const checkoutOf = (
  host: HostFixture,
  name: string,
  originUrl: string,
): AttemptsProductionCheckout => {
  // A real repository whose origin names the repository identity.
  const checkout = createRepository(host.hostRoot, name);
  git(checkout, ["remote", "add", "origin", originUrl]);
  const harness = createProductionProjectsHarness({
    label: `gh289-${name}`,
    workingDirectory: checkout,
    originUrl,
    host,
  });
  const seed = seedStore(harness);
  const contextPath = join(checkout, ".ai", "local", "pm-context.yaml");
  return {
    name,
    checkout,
    repository: originUrl.replace(/^https:\/\//u, "").replace(/\.git$/u, ""),
    harness,
    seedAttempts: seed.attempts,
    seedDivergences: seed.divergences,
    writeContext: (ref: string) => {
      mkdirSync(join(contextPath, ".."), { recursive: true });
      writeFileSync(
        contextPath,
        `active_change:\n  workItemRef: ${ref}\n  branch: feat/${ref}/${name}\nparked_changes: []\n`,
      );
    },
    removeContext: () => rmSync(contextPath, { force: true }),
    dispatchIdentityMarker: () => readDispatchIdentityMarkerText(join(checkout, ".git")),
    writeDispatchIdentityMarker: (text: string) => {
      writeFileSync(dispatchIdentityMarkerPath(join(checkout, ".git")), text);
    },
    projectIdentityMarker: () => readProjectIdentityMarker(join(checkout, ".git")),
    run: harness.run,
  };
};

/** One shared host root and two real checkouts with distinct origins. */
export const createAttemptsProductionFixture = (input: {
  readonly host: HostFixture;
  readonly origins: { readonly a: string; readonly b: string };
}): AttemptsProductionFixture => ({
  host: input.host,
  a: checkoutOf(input.host, "checkout-a", input.origins.a),
  b: checkoutOf(input.host, "checkout-b", input.origins.b),
  dispose: () => {
    input.host.dispose();
  },
});

/** Read one file's bytes as utf8 (used by the evidence assertions). */
export const readStoreFile = (directory: string, name: string): string =>
  readFileSync(join(directory, name), "utf8");
