/**
 * The prior-namespace migration declaration (GH-365 F-3; F-13; NG-1).
 *
 * Prior-namespace artifacts are DETECTED and one advisory line names them and
 * the delivered `install migrate` verb; nothing is moved, copied, or deleted by
 * `install` itself. The migration is the `install migrate` verb, which plans,
 * copies, verifies and backs up before it moves. The old `--migrate` flag form
 * is retired: the parser still recognises it and the command refuses it with the
 * remedy `install migrate`, so the remedy stays reachable.
 */
import type { InstallMigrationRoot } from "#contracts";
import { MIGRATION_DERIVED_ENTRIES } from "#contracts";
import { expandHome } from "./install-path-block.js";

/**
 * The declared prior identity's directory names (F-13, NG-1). The binary name is
 * DERIVED from the config directory name (a leading dot removed) rather than
 * declared: no working-name literal enters a library module, and the inventory
 * stays at its delivered product-surface size.
 */
export const PRIOR_NAMESPACE_NAMES = {
  config: ".delivery-os",
  state: ".delivery-os-state",
} as const;

/** The three brand-derived migration root classes (GH-365 F-3, DM-6). */
export const MIGRATION_ROOT_CLASSES = [
  { label: "host-configuration", priorName: PRIOR_NAMESPACE_NAMES.config, derived: [] },
  {
    label: "host-state",
    priorName: PRIOR_NAMESPACE_NAMES.state,
    derived: [...MIGRATION_DERIVED_ENTRIES],
  },
  {
    label: "project-configuration",
    priorName: PRIOR_NAMESPACE_NAMES.config,
    derived: [],
  },
] as const;

/** The default backup root: inside the destination configuration root (DM-5). */
export const migrationBackupRoot = (currentConfigRoot: string): string =>
  `${currentConfigRoot.replace(/\/+$/u, "")}/migration-backups`;

/**
 * Compose the three migration roots from the resolved identities. The project
 * root is absent outside a work tree, which makes the project class `unscoped`.
 */
export const migrationRoots = (input: {
  readonly homeDirectory: string;
  readonly projectRoot?: string;
  readonly currentConfigDirectoryName: string;
  readonly currentStateDirectoryName: string;
}): readonly InstallMigrationRoot[] => {
  const hostConfigSource = `${input.homeDirectory}/${PRIOR_NAMESPACE_NAMES.config}`;
  const hostStateSource = `${input.homeDirectory}/${PRIOR_NAMESPACE_NAMES.state}`;
  const hostConfigDestination = `${input.homeDirectory}/${input.currentConfigDirectoryName}`;
  const hostStateDestination = `${input.homeDirectory}/${input.currentStateDirectoryName}`;
  const project = input.projectRoot;
  return [
    {
      label: "host-configuration",
      scope: "scoped",
      source: hostConfigSource,
      destination: hostConfigDestination,
    },
    {
      label: "host-state",
      scope: "scoped",
      source: hostStateSource,
      destination: hostStateDestination,
      derivedEntries: [...MIGRATION_DERIVED_ENTRIES],
    },
    project === undefined
      ? { label: "project-configuration", scope: "unscoped" }
      : {
          label: "project-configuration",
          scope: "scoped",
          source: `${project}/${PRIOR_NAMESPACE_NAMES.config}`,
          destination: `${project}/${input.currentConfigDirectoryName}`,
        },
  ];
};

/** The prior identity's executable name, derived from its directory name. */
export const priorBinaryName = (): string => PRIOR_NAMESPACE_NAMES.config.replace(/^\./u, "");

/** The prior-namespace paths this product may have left on a machine. */
export const priorNamespacePaths = (homeDirectory: string): readonly string[] => [
  expandHome(`~/${PRIOR_NAMESPACE_NAMES.config}`, homeDirectory),
  expandHome(`~/${PRIOR_NAMESPACE_NAMES.state}`, homeDirectory),
  expandHome(`~/${PRIOR_NAMESPACE_NAMES.config}/bin/${priorBinaryName()}`, homeDirectory),
];

/** Detect the prior-namespace artifacts that exist at this moment. */
export const detectPriorNamespace = (input: {
  readonly homeDirectory: string;
  readonly exists: (path: string) => boolean;
}): readonly string[] =>
  priorNamespacePaths(input.homeDirectory).filter((path) => input.exists(path));

/** The one advisory line: what was found and the delivered migration verb. */
export const migrationAdvisory = (found: readonly string[]): string =>
  `advisory: prior-namespace artifacts exist at ${found.join(", ")}; run ` +
  "`install migrate --dry-run` to preview the move, then `install migrate` to perform it " +
  "(nothing was moved, copied, or deleted)";
