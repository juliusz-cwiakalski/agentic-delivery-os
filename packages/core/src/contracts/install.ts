/**
 * The install lifecycle contracts (GH-346 F-4..F-13; DM-2..DM-6).
 *
 * Runtime-neutral by construction: the record shape, the status payload, the
 * closed vocabularies, the declared cap, the family's runtime inputs, and the
 * optional test-only fault port. The domain functions and the CLI handlers
 * consume these types; the adapters own the I/O.
 */

/** The install record's own schema identifier (DM-2). */
export const INSTALL_RECORD_SCHEMA = "install.record.v1" as const;

/** The machine status payload's schema identifier (DM-4, Appendix D). */
export const INSTALL_STATUS_SCHEMA = "install.status.v1" as const;

/** The declared judged-root cap (DEC-9, NFR-7). */
export const INSTALL_MAX_JUDGED_ROOTS = 128 as const;

/** The declared record file name, beside the operator's configuration. */
export const INSTALL_RECORD_FILE_NAME = "install.json" as const;

/** The delivered store-format identifier the installed artifact accepts. */
export const INSTALL_STATE_ROOT_PROJECTS_DIRECTORY = "projects" as const;

/** The five compatibility outcomes for one judged root (DM-4). */
export const INSTALL_STATE_FORMAT_OUTCOMES = [
  "accepted",
  "not-accepted",
  "unreadable",
  "unchecked",
] as const;
export type InstallStateFormatOutcome = (typeof INSTALL_STATE_FORMAT_OUTCOMES)[number];

/** The four reported record conditions (DM-4). */
export const INSTALL_RECORD_STATES = ["current", "record-stale", "unreadable", "absent"] as const;
export type InstallRecordState = (typeof INSTALL_RECORD_STATES)[number];

/** The three reported slot conditions (DM-4). */
export const INSTALL_SLOT_STATES = ["present", "absent", "invalid"] as const;
export type InstallSlotState = (typeof INSTALL_SLOT_STATES)[number];

/** The target-stability findings, reported as data (DM-4). */
export const INSTALL_TARGET_STABILITY_STATES = [
  "verified",
  "unverified",
  "linked-worktree",
] as const;
export type InstallTargetStability = (typeof INSTALL_TARGET_STABILITY_STATES)[number];

/** The recorded provenance states (Appendix C.1). */
export const INSTALL_PROVENANCE_STATES = ["verified", "unverified"] as const;
export type InstallProvenance = (typeof INSTALL_PROVENANCE_STATES)[number];

/** The declared destination dispositions (Appendix C.2). */
export const INSTALL_DESTINATION_DISPOSITIONS = [
  "created",
  "unchanged",
  "replaced",
  "slot-swapped",
  "launcher-discarded",
  "symlink-replaced",
] as const;
export type InstallDestinationDisposition = (typeof INSTALL_DESTINATION_DISPOSITIONS)[number];

/** The declared launcher-disposition kinds recorded in DM-2. */
export const INSTALL_LAUNCHER_DISPOSITIONS = [
  "none",
  "launcher-discarded",
  "symlink-replaced",
] as const;
export type InstallLauncherDisposition = (typeof INSTALL_LAUNCHER_DISPOSITIONS)[number];

/** The declared shell mapping for `--add-to-path` (DM-5, OQ-TP-7). */
export const INSTALL_SHELL_PROFILE_MAPPING = {
  zsh: "~/.zshrc",
  bash: "~/.bashrc",
  sh: "~/.profile",
} as const;
export type InstallShellName = keyof typeof INSTALL_SHELL_PROFILE_MAPPING;

/** The six injectable replace steps the fault port names (FAULT-TP-1). */
export const INSTALL_FAULT_STEPS = [
  "stage",
  "verify",
  "identity-compare",
  "destination-to-slot",
  "staged-to-destination",
  "record-write",
] as const;
export type InstallFaultStep = (typeof INSTALL_FAULT_STEPS)[number];

/** The five build-identity fields the record and the payload repeat (DM-1). */
export type InstallArtifactIdentity = {
  readonly version: string;
  readonly commit: string;
  readonly builtAt: string;
  readonly dirty: boolean;
  readonly channel: string;
};

/** The managed PATH block's recorded file and marker (DM-5). */
export type InstallPathBlockRecord = {
  readonly file: string;
  readonly marker: string;
};

/** The install record at `<config root>/install.json` under `install.record.v1`. */
export type InstallRecord = {
  readonly schemaVersion: typeof INSTALL_RECORD_SCHEMA;
  readonly version: string;
  readonly commit: string;
  readonly builtAt: string;
  readonly dirty: boolean;
  readonly channel: string;
  readonly stateSchemaVersion: string;
  readonly sourceCheckout?: string;
  readonly provenance: InstallProvenance;
  readonly installedAt: string;
  readonly previous?: InstallArtifactIdentity;
  readonly launcherDisposition: InstallLauncherDisposition;
  readonly launcherDetail?: string;
  readonly pathBlock?: InstallPathBlockRecord;
};

/** One judged state root's verdict (DM-4). */
export type InstallStateRootVerdict = {
  readonly root: string;
  readonly observed: string | null;
  readonly outcome: InstallStateFormatOutcome;
  readonly reason: string;
};

/** The state-format verdict group (DM-4, Appendix D). */
export type InstallStateFormatVerdict = {
  readonly accepted: string;
  readonly roots: readonly InstallStateRootVerdict[];
  readonly judged: number;
  readonly truncated: boolean;
};

/** The running-identity group of the status payload (Appendix D). */
export type InstallRunningIdentity = InstallArtifactIdentity & {
  readonly artifactPath: string;
};

/** The slot group of the status payload (Appendix D). */
export type InstallSlotReport = {
  readonly path: string;
  readonly state: InstallSlotState;
  readonly identity?: InstallArtifactIdentity;
};

/** The `install.status.v1` machine payload (DM-4, Appendix D). */
export type InstallStatusPayload = {
  readonly schemaVersion: typeof INSTALL_STATUS_SCHEMA;
  readonly running: InstallRunningIdentity;
  readonly installed: InstallArtifactIdentity | null;
  readonly recordState: InstallRecordState;
  readonly recordPath: string;
  readonly rollback: InstallSlotReport;
  readonly targetStability: InstallTargetStability;
  readonly stateFormat?: InstallStateFormatVerdict;
  readonly pathBlock: InstallPathBlockRecord | null;
};

/** The outcome vocabulary the human renderer and the machine data share. */
export const INSTALL_OUTCOMES = [
  "installed",
  "unchanged",
  "rolled-back",
  "uninstalled",
  "purged",
  "plan",
] as const;
export type InstallOutcomeKind = (typeof INSTALL_OUTCOMES)[number];

/** The record-reconciliation report of an agreement run (F-9, AC-F9-2). */
export type InstallReconciliationReport = {
  readonly from: InstallRecordState;
  /** The predecessor the readable record named, or `"unknown"`. */
  readonly previous: InstallArtifactIdentity | "unknown";
};

/** One install/rollback/uninstall/purge outcome, as handler data. */
export type InstallOutcome = {
  readonly outcome: InstallOutcomeKind;
  readonly running: InstallRunningIdentity;
  readonly destination: string;
  readonly disposition?: InstallDestinationDisposition;
  readonly launcherTarget?: string;
  readonly slot: InstallSlotReport;
  readonly previous?: InstallArtifactIdentity;
  readonly recordPath: string;
  readonly recordState: InstallRecordState;
  readonly reconciliation?: InstallReconciliationReport;
  /**
   * The daemon disposition: `absent` or `stopped` on a real run, and
   * `unchecked` on a dry-run, whose branch is entered before the guard and so
   * never reads or stops the daemon (F-11, NFR-5).
   */
  readonly daemon: "absent" | "running" | "stopped" | "unchecked";
  readonly advisories: readonly string[];
  readonly pathBlock?: InstallPathBlockRecord;
  readonly plan?: readonly string[];
  readonly removed?: readonly string[];
  readonly residual?: readonly string[];
};

/** A file's stat facts, as the domain sees them. */
export type InstallFileStat = {
  readonly kind: "file" | "symlink" | "directory" | "other";
  readonly size: number;
  readonly executable: boolean;
  readonly mtimeMs: number;
};

/** The staged-write result: the temporary path, or a failure. */
export type InstallStagedWrite =
  | { readonly ok: true; readonly stagedPath: string }
  | { readonly ok: false; readonly reason: string };

/** The file I/O port the adapters implement and the handlers consume. */
export type InstallFilePort = {
  readonly stat: (path: string) => InstallFileStat | undefined;
  readonly readText: (path: string) => string | undefined;
  readonly readBytes: (path: string) => Uint8Array | undefined;
  /** Write `bytes` to a fresh temporary file beside `path` with `mode`. */
  readonly writeStaged: (path: string, bytes: Uint8Array, mode: number) => InstallStagedWrite;
  /** Copy `sourcePath` into a fresh temporary file beside `path` with `mode`. */
  readonly copyStaged: (path: string, sourcePath: string, mode: number) => InstallStagedWrite;
  /** The SHA-256 digest of a file's bytes, or `undefined` when unreadable. */
  readonly digest: (path: string) => string | undefined;
  readonly rename: (from: string, to: string) => boolean;
  readonly remove: (path: string) => boolean;
  readonly list: (path: string) => readonly string[];
  readonly exists: (path: string) => boolean;
  readonly mkdirp: (path: string) => boolean;
  readonly chmod: (path: string, mode: number) => boolean;
  /** Remove every file and directory under `path`, then `path` itself. */
  readonly removeTree: (path: string) => boolean;
};

/** The delivered worktree-topology read's outcome (DM-8). */
export type InstallGitRead =
  | { readonly kind: "unbound" }
  | { readonly kind: "unreadable"; readonly checkoutRoot: string }
  | {
      readonly kind: "resolved";
      readonly checkoutRoot: string;
      readonly gitDir: string;
      readonly commonDir: string;
    };

/** One live-daemon observation. */
export type InstallDaemonState = {
  readonly running: boolean;
  readonly instanceId?: string;
  readonly pid?: number;
};

/** The delivered daemon read and stop paths, composed by the edge. */
export type InstallDaemonPort = {
  readonly status: () => Promise<InstallDaemonState>;
  readonly stop: () => Promise<{ readonly ok: boolean; readonly detail?: string }>;
};

/**
 * The optional test-only fault port (FAULT-TP-1).
 *
 * It names the step to fail and answers whether this run must fail there. The
 * production composition NEVER supplies it, and the family's declared runtime
 * inputs are otherwise unchanged.
 */
export type InstallFaultPort = {
  readonly failAt: (step: InstallFaultStep) => boolean;
};

/** The family's declared runtime inputs, supplied by the production edge. */
export type InstallRuntime = {
  readonly homeDirectory: string;
  /** The brand install path with the home marker expanded. */
  readonly destinationPath: string;
  readonly installDirectory: string;
  readonly slotPath: string;
  /** `<config root>/install.json`. */
  readonly recordPath: string;
  readonly configRoot: string;
  /** The effective state host root (the override when set, else the brand default). */
  readonly stateRoot: string;
  /** The judged state roots: the host root and each first-level project root. */
  readonly stateRoots: readonly string[];
  readonly acceptedStateSchemaVersion: string;
  /** The injected identity; absent means this is a development run. */
  readonly runningIdentity?: InstallArtifactIdentity;
  /** The running artifact's real path (a declared composition fact, D7). */
  readonly runningArtifactPath: string;
  /** Whether the invoking bin owns installation (D6). */
  readonly ownsInstallation: boolean;
  /** The invoking identity's resolved binary name. */
  readonly invokedIdentity: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly clock: { readonly nowIso: () => string };
  readonly fs: InstallFilePort;
  readonly git: {
    readonly readCheckout: (directory: string) => InstallGitRead;
  };
  readonly daemon: InstallDaemonPort;
  /** Detected prior-namespace artifacts, reported and never moved (F-13). */
  readonly priorNamespaceArtifacts: readonly string[];
  /** The optional test-only fault port; production never supplies it. */
  readonly fault?: InstallFaultPort;
};

/** The identity-bearing artifact check the slot and the dev gate share. */
export const INSTALL_DEV_BUILD_CODE = "install.dev-build" as const;

/** The declared install domain identities (Appendix E). */
export const INSTALL_DOMAIN_CODES = [
  "install.target.worktree",
  "install.dev-build",
  "install.state.incompatible",
  "install.identity.not-owning",
  "install.shell-profile.unresolved",
  "install.migration.unavailable",
  "install.daemon.running",
  "install.record.unreadable",
  "install.slot.absent",
  "install.slot.invalid",
  "install.purge.unconfirmed",
] as const;
export type InstallDomainCode = (typeof INSTALL_DOMAIN_CODES)[number];
