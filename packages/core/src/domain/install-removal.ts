/**
 * The removal matrix and the residual-set computation (F-10; Appendix C.3,
 * NFR-11).
 *
 * `uninstall` removes the artifact, the slot, the record, and only the managed
 * PATH block, and always prints the residual set — the absolute paths that
 * exist at that moment under the configuration and state roots — as what
 * `purge` would additionally delete. `purge` additionally removes both roots.
 * The order is artifact, slot, record, block, then the roots, so a partial
 * failure leaves the recoverable members in place.
 */
import type { InstallPathBlockRecord } from "../contracts/install.js";

/** The declared removal order; the roots come last and only under purge. */
export const INSTALL_REMOVAL_ORDER = [
  "artifact",
  "slot",
  "record",
  "path-block",
  "configuration-root",
  "state-roots",
] as const;
export type InstallRemovalMember = (typeof INSTALL_REMOVAL_ORDER)[number];

/** One removal member with its absolute path and presence. */
export type RemovalMember = {
  readonly member: InstallRemovalMember;
  readonly path: string;
  readonly exists: boolean;
  readonly recursive: boolean;
};

/** The inputs the matrix decides from: only what exists at this moment. */
export type RemovalFacts = {
  readonly destinationPath: string;
  readonly destinationExists: boolean;
  readonly slotPath: string;
  readonly slotExists: boolean;
  readonly recordPath: string;
  readonly recordExists: boolean;
  readonly pathBlock?: InstallPathBlockRecord;
  readonly pathBlockExists: boolean;
  readonly configRoot: string;
  readonly configRootExists: boolean;
  readonly stateRoots: readonly { readonly path: string; readonly exists: boolean }[];
};

/** The `uninstall` member set, in the declared order. */
export const uninstallMembers = (facts: RemovalFacts): readonly RemovalMember[] => [
  {
    member: "artifact",
    path: facts.destinationPath,
    exists: facts.destinationExists,
    recursive: false,
  },
  { member: "slot", path: facts.slotPath, exists: facts.slotExists, recursive: false },
  { member: "record", path: facts.recordPath, exists: facts.recordExists, recursive: false },
  ...(facts.pathBlock === undefined
    ? []
    : [
        {
          member: "path-block" as const,
          path: facts.pathBlock.file,
          exists: facts.pathBlockExists,
          recursive: false,
        },
      ]),
];

/** The `purge` member set: the uninstall set plus both roots. */
export const purgeMembers = (facts: RemovalFacts): readonly RemovalMember[] => [
  ...uninstallMembers(facts),
  {
    member: "configuration-root",
    path: facts.configRoot,
    exists: facts.configRootExists,
    recursive: true,
  },
  ...facts.stateRoots.map((root) => ({
    member: "state-roots" as const,
    path: root.path,
    exists: root.exists,
    recursive: true,
  })),
];

/**
 * The residual set: what exists at this moment under the configuration and
 * state roots. It is the same set `purge --dry-run` lists and `purge --yes`
 * removes at the same machine state (NFR-11).
 */
export const residualSet = (input: {
  readonly configRoot: string;
  readonly configRootEntries: readonly string[];
  readonly stateRoots: readonly { readonly path: string; readonly entries: readonly string[] }[];
}): readonly string[] => {
  const paths: string[] = [];
  for (const entry of input.configRootEntries) paths.push(`${input.configRoot}/${entry}`);
  for (const root of input.stateRoots) {
    paths.push(...root.entries.map((entry) => `${root.path}/${entry}`));
  }
  return [...new Set(paths)].sort();
};

/** The label the residual set always prints under. */
export const RESIDUAL_LABEL = "purge would additionally delete:" as const;

/** The confirmed-purge answer for a machine with nothing to remove. */
export const NOTHING_TO_REMOVE = "nothing to remove" as const;
