/**
 * `install` — the composed install lifecycle family (GH-346 F-4..F-13; TDR-0044).
 *
 * Five entry points registered unconditionally in both composed programs:
 * `install`, `install status`, `install rollback`, `install uninstall`, and
 * `install purge`. The destination is never an input; every failure is a
 * registered identity; the family owns the artifact, its slot, its record, and
 * the managed PATH block while the shell installers own repository artifacts.
 *
 * The command maps grammar to handlers and handlers to data: the exit digit is
 * produced only by the delivered projection module.
 */

import {
  classifyInstallDestination,
  INSTALL_PROBE_BYTES,
  isCompiledArtifactAtPath,
  launcherTargetOf,
  readProfileText,
  writeInstallRecordText,
  writeProfileText,
} from "@delivery-os/adapters/file";
import {
  compatibilityAdvisories as advisoriesOf,
  applyMigrationPlan,
  buildMigrationPlan,
  evaluateInstallAdmission,
  type InstallRecordRead,
  incompatibleRoots,
  installTargetStability,
  judgeStateFormat,
  mergePathBlock,
  migrationAdvisory,
  migrationBackupPath,
  migrationConflictPaths,
  migrationUnavailableSummary,
  parseInstallRecord,
  planReplace,
  planRootsData,
  provenanceOfAdmission,
  purgeMembers,
  type RemovalFacts,
  type ReplacePlan,
  readInstallRecord,
  reconciliationRecordOf,
  removePathBlock,
  renderPathBlock,
  replacingRecordOf,
  residualSet,
  resolveProfilePath,
  rollbackCauseSentence,
  rollbackPrecondition,
  rollbackRecordOf,
  type StateRootObservation,
  serializeInstallRecord,
  slotCondition,
  uninstallMembers,
} from "@delivery-os/core";
import type {
  InstallArtifactIdentity,
  InstallDaemonState,
  InstallMigrationRoot,
  InstallOutcome,
  InstallRecord,
  InstallRecordState,
  InstallRuntime,
  InstallSlotReport,
  InstallStateFormatVerdict,
  InstallStateRootVerdict,
  MigrationPlanPayload,
} from "@delivery-os/core/contracts";
import {
  INSTALL_DEV_BUILD_CODE,
  INSTALL_MAX_JUDGED_ROOTS,
  INSTALL_MIGRATION_PLAN_SCHEMA,
} from "@delivery-os/core/contracts";
import type { CommandDefinition, CommandInvocation } from "../index.js";
import {
  renderInstallFailure,
  renderInstallOutcome,
  renderInstallPlan,
  renderInstallStatus,
} from "../output/install-text.js";

/** The subcommand vocabulary; every other token is the delivered grammar refusal. */
export const INSTALL_SUBCOMMANDS = ["migrate", "status", "rollback", "uninstall", "purge"] as const;
export type InstallSubcommand = (typeof INSTALL_SUBCOMMANDS)[number];

/** The build entry the dev-build refusal names. */
const BUILD_ENTRY = "bun run build:binary";

/** The artifact path convention the dev-build refusal names. */
const ARTIFACT_CONVENTION = "dist/<binary-name>";

type InstallCommandInput = {
  readonly runtime: InstallRuntime;
  readonly invocation: CommandInvocation;
};

type Refusal = { readonly error: unknown };

const refusal = (code: string, summary: string, kind = "install"): Refusal => ({
  error: { kind, code, summary },
});

const internalFailure = (summary: string): Refusal =>
  refusal("fallback.internal", summary, "fallback");

const boolFlag = (command: InstallCommandInput, name: string): boolean =>
  command.invocation.flags[name] === true;

const stringFlag = (command: InstallCommandInput, name: string): string | undefined => {
  const value = command.invocation.flags[name];
  return typeof value === "string" ? value : undefined;
};

/** The one line the non-owning identity answers, carrying the three declared facts. */
export const notOwningRefusal = (runtime: InstallRuntime): Refusal =>
  refusal(
    "install.identity.not-owning",
    `refused: ${runtime.invokedIdentity} does not own installation; installation is owned by ` +
      "the primary identity — run the lifecycle through the installed product binary " +
      "(see `install --help` and the local install guide); nothing was written",
  );

/** A dev run and a linked worktree are the two admission refusals. */
export const admissionRefusal = (admission: {
  readonly code: "install.dev-build" | "install.target.worktree";
  readonly target?: string;
  readonly gitDir?: string;
  readonly commonDir?: string;
}): Refusal => {
  if (admission.code === INSTALL_DEV_BUILD_CODE) {
    return refusal(
      INSTALL_DEV_BUILD_CODE,
      `refused: this run carries no injected build identity; build the artifact with ` +
        `\`${BUILD_ENTRY}\` and run ${ARTIFACT_CONVENTION}; nothing was written`,
    );
  }
  return refusal(
    "install.target.worktree",
    `refused: the install target ${String(admission.target)} is a linked git worktree ` +
      `(git dir ${String(admission.gitDir)} differs from common dir ${String(admission.commonDir)}). ` +
      "Install from the primary checkout or a prepared directory holding a released artifact; " +
      "a lane worktree is deleted after merge. Nothing was written.",
  );
};

/** The daemon guard: one typed refusal naming the holder and the remedy. */
const daemonRefusal = (state: InstallDaemonState): Refusal =>
  refusal(
    "install.daemon.running",
    `refused: a live daemon holds this artifact (instance ${state.instanceId ?? "unknown"}` +
      `${state.pid === undefined ? "" : `, pid ${String(state.pid)}`}); stop it, or re-run with ` +
      "`--stop-daemon` so it stops through the delivered stop path before the swap; nothing was written",
  );

/**
 * The step-1 daemon gate: evaluate before any write, and stop through the
 * delivered path before the first rename when `--stop-daemon` is present.
 */
const daemonGate = async (
  runtime: InstallRuntime,
  stopDaemon: boolean,
): Promise<
  | { readonly ok: true; readonly state: "absent" | "stopped" }
  | { readonly ok: false; readonly refusal: Refusal }
> => {
  const state = await runtime.daemon.status();
  if (!state.running) return { ok: true, state: "absent" };
  if (!stopDaemon) return { ok: false, refusal: daemonRefusal(state) };
  const stopped = await runtime.daemon.stop();
  if (!stopped.ok) return { ok: false, refusal: daemonRefusal(state) };
  return { ok: true, state: "stopped" };
};

/**
 * The daemon disposition every dry-run reports: the dry-run branch is entered
 * before the guard, so a dry-run neither reads the live instance nor stops it
 * (F-11, NFR-5). The claim is "not acted upon", never a guess at the state.
 */
const DRY_RUN_DAEMON = "unchecked" as const;

/** The plan line that states the dry-run daemon disposition without a read. */
const DRY_RUN_DAEMON_LINE =
  `${DRY_RUN_DAEMON} — a dry-run neither reads nor stops the daemon; a real run refuses a live ` +
  "holder unless `--stop-daemon` and otherwise stops it before the swap or removal";

/** The running artifact's directory, or the empty string when unresolved. */
const artifactDirectoryOf = (runtime: InstallRuntime): string =>
  runtime.runningArtifactPath.replace(/\/[^/]+$/u, "");

/** The state-format verdict over the declared roots (read-only, bounded). */
export const stateFormatVerdict = (runtime: InstallRuntime): InstallStateFormatVerdict => {
  // The composition that capped the list knows whether it truncated it; the
  // slice fallback keeps an injected uncapped list honest on the same rule.
  const truncated =
    runtime.stateRootsTruncated ?? runtime.stateRoots.length > INSTALL_MAX_JUDGED_ROOTS;
  const judgedRoots = runtime.stateRoots.slice(0, INSTALL_MAX_JUDGED_ROOTS);
  const observations: StateRootObservation[] = judgedRoots.map((root) => {
    const stats = runtime.fs.stat(root);
    const exists = stats !== undefined && stats.kind === "directory";
    const headers = exists
      ? runtime.fs.list(root).filter((name) => name.startsWith("header."))
      : [];
    const texts = headers.map((name) => runtime.fs.readText(`${root}/${name}`));
    return {
      root,
      exists,
      headerTexts: texts,
      unreadable: exists && texts.some((t) => t === undefined),
    };
  });
  return judgeStateFormat({
    accepted: runtime.acceptedStateSchemaVersion,
    observations,
    judged: judgedRoots.length,
    truncated,
  });
};

/** The write-path advisory lines (one per not-accepted or unreadable root). */
export const compatibilityAdvisories = (runtime: InstallRuntime): readonly string[] =>
  advisoriesOf(stateFormatVerdict(runtime));

/** The running identity group of every outcome. */
const runningOf = (runtime: InstallRuntime) => ({
  version: runtime.runningIdentity?.version ?? "0.0.0",
  commit: runtime.runningIdentity?.commit ?? "dev",
  builtAt: runtime.runningIdentity?.builtAt ?? "",
  dirty: runtime.runningIdentity?.dirty ?? false,
  channel: runtime.runningIdentity?.channel ?? "dev",
  artifactPath: runtime.runningArtifactPath,
});

const readRecord = (runtime: InstallRuntime): InstallRecordRead =>
  readInstallRecord({
    exists: runtime.fs.exists,
    readText: runtime.fs.readText,
    path: runtime.recordPath,
  });

const recordStateOf = (
  read: InstallRecordRead,
  running: InstallArtifactIdentity | undefined,
): InstallRecordState => {
  if (read.kind === "absent") return "absent";
  if (read.kind === "unreadable") return "unreadable";
  if (running === undefined) return "record-stale";
  const record = read.record;
  return record.version === running.version &&
    record.commit === running.commit &&
    record.builtAt === running.builtAt &&
    record.dirty === running.dirty &&
    record.channel === running.channel
    ? "current"
    : "record-stale";
};

const writeRecord = (runtime: InstallRuntime, record: InstallRecord): boolean =>
  writeInstallRecordText({
    fs: runtime.fs,
    path: runtime.recordPath,
    text: serializeInstallRecord(record),
  });

/** The slot report, read from disk and named only by a readable record. */
const slotReportOf = (runtime: InstallRuntime, read: InstallRecordRead): InstallSlotReport => {
  const stats = runtime.fs.stat(runtime.slotPath);
  const probe = stats?.kind === "file" && stats.size > 0 && stats.executable;
  // The verdict needs the two shebang bytes, never the ~100 MB artifact: a
  // bounded prefix read keeps `status` and every dry-run from touching it whole.
  const prefix = probe ? runtime.fs.readPrefix(runtime.slotPath, INSTALL_PROBE_BYTES) : undefined;
  const condition = slotCondition({
    stats,
    script: prefix !== undefined && prefix[0] === 0x23 && prefix[1] === 0x21,
    // The same unreadable bytes the rollback predicate refuses: `status` must
    // not claim a rollback-ready slot that `rollback` answers `invalid`.
    unreadable: probe && prefix === undefined,
    ...(read.kind === "record" && read.record.previous !== undefined
      ? { identity: read.record.previous }
      : {}),
  });
  return { path: runtime.slotPath, ...condition };
};

/**
 * The residual set: every absolute path that exists at this moment under the
 * configuration and state roots, as `purge` would additionally delete it.
 */
export const residualSetOf = (runtime: InstallRuntime): readonly string[] =>
  residualSet({
    configRoot: runtime.configRoot,
    configRootEntries: runtime.fs.exists(runtime.configRoot)
      ? runtime.fs.list(runtime.configRoot)
      : [],
    stateRoots: runtime.stateRoots.map((path) => ({
      path,
      entries: runtime.fs.exists(path) ? runtime.fs.list(path) : [],
    })),
  });

/** The removal facts the matrix decides from (only what exists at this moment). */
const removalFactsOf = (
  runtime: InstallRuntime,
  pathBlock?: InstallRecord["pathBlock"],
): RemovalFacts => ({
  destinationPath: runtime.destinationPath,
  destinationExists: runtime.fs.exists(runtime.destinationPath),
  slotPath: runtime.slotPath,
  slotExists: runtime.fs.exists(runtime.slotPath),
  recordPath: runtime.recordPath,
  recordExists: runtime.fs.exists(runtime.recordPath),
  ...(pathBlock === undefined ? {} : { pathBlock }),
  pathBlockExists: pathBlock === undefined ? false : runtime.fs.exists(pathBlock.file),
  configRoot: runtime.configRoot,
  configRootExists: runtime.fs.exists(runtime.configRoot),
  stateRoots: runtime.stateRoots.map((path) => ({ path, exists: runtime.fs.exists(path) })),
});

/** The declared install plan content (Appendix C.4). */
const installPlanLines = (input: {
  readonly runtime: InstallRuntime;
  readonly plan: ReplacePlan;
  readonly advisories: readonly string[];
  readonly daemon: string;
  readonly addToPath: boolean;
  readonly shellProfile?: string;
}): readonly string[] => {
  const { runtime, plan } = input;
  return [
    `running: ${runtime.runningIdentity?.version ?? "0.0.0"} (build ${runtime.runningIdentity?.commit ?? "dev"}) from ${runtime.runningArtifactPath}`,
    `destination: ${runtime.destinationPath}`,
    plan.agreement
      ? "step 4: the destination's content is this artifact — the run would stop, with no staging file, no rename and no slot swap"
      : `disposition: ${plan.disposition}${plan.launcherTarget === undefined ? "" : ` (the launcher's recorded target ${plan.launcherTarget} is discarded and is not preserved)`}`,
    ...(plan.reconcilesRecord ? ["record: would be reconciled in place"] : []),
    `slot: ${runtime.slotPath}${plan.slotSwap ? " (would receive the displaced artifact)" : " (unchanged)"}`,
    `record: ${runtime.recordPath}`,
    ...(input.addToPath
      ? [
          `profile: ${input.shellProfile ?? "the declared shell mapping"}`,
          "block: one export line between the declared markers",
        ]
      : []),
    `daemon: ${input.daemon}`,
    ...input.advisories,
  ];
};

/** Read the destination class and the two digests the plan needs. */
const destinationFacts = (runtime: InstallRuntime) => {
  const destinationClass = classifyInstallDestination(runtime.fs, runtime.destinationPath);
  return {
    destinationClass,
    destinationDigest:
      destinationClass === "compiled-artifact"
        ? runtime.fs.digest(runtime.destinationPath)
        : undefined,
    runningDigest: runtime.fs.digest(runtime.runningArtifactPath),
    launcherTarget:
      destinationClass === "launcher"
        ? launcherTargetOf(runtime.fs, runtime.destinationPath)
        : undefined,
  };
};

/**
 * Write the managed PATH block exactly once for the resolved profile, and
 * answer a typed refusal when the write fails. The caller never records a block
 * that is not on disk.
 *
 * The refusal declares its class plainly (`internal failure`, the reserved
 * containment identity) because a profile write fails on permissions or space,
 * not on an input the declared user-validation rows describe; it still names
 * the operator remedy.
 */
const applyPathBlock = (
  runtime: InstallRuntime,
  profile: {
    readonly file?: string;
    readonly merged?: string;
    readonly block?: ReturnType<typeof renderPathBlock>;
  },
  after: { readonly artifactInstalled: boolean; readonly slotSwapped: boolean },
): { readonly ok: true } | { readonly ok: false; readonly refusal: Refusal } => {
  if (profile.file === undefined || profile.block === undefined) return { ok: true };
  if (writeProfileText({ fs: runtime.fs, path: profile.file, text: profile.merged ?? "" })) {
    return { ok: true };
  }
  const state = after.artifactInstalled
    ? `the artifact is now installed at ${runtime.destinationPath}` +
      (after.slotSwapped ? " and the previous artifact is in the rollback slot" : "")
    : "the destination is this artifact and is untouched";
  return {
    ok: false,
    refusal: internalFailure(
      `internal failure: ${state}, but the managed PATH block was not written to ${profile.file}; ` +
        "the record was not updated and no block is claimed — fix the profile's rights or pass " +
        "another `--shell-profile`, then re-run install to record the install",
    ),
  };
};

/**
 * The replacing install (TDR-0048 §2). The agreement gate is evaluated BEFORE
 * staging, so a no-op creates no staging file at all.
 */
const runInstall = async (
  command: InstallCommandInput,
  options: {
    readonly dryRun: boolean;
    readonly stopDaemon: boolean;
    readonly addToPath: boolean;
    readonly shellProfile?: string;
    readonly migrate: boolean;
  },
): Promise<unknown> => {
  const { runtime } = command;
  if (options.migrate && !options.dryRun) {
    return refusal("install.migration.unavailable", migrationUnavailableSummary("M4-S2"));
  }
  if (runtime.runningArtifactPath.length === 0) {
    return internalFailure(
      "the running artifact path composition fact is unresolved; no install was attempted",
    );
  }
  if (runtime.runningIdentity === undefined) {
    return admissionRefusal({ code: INSTALL_DEV_BUILD_CODE });
  }
  const running = runtime.runningIdentity;
  const artifactDirectory = artifactDirectoryOf(runtime);
  const admission = evaluateInstallAdmission({
    artifactDirectory,
    identity: running,
    git: runtime.git.readCheckout(artifactDirectory),
  });
  if (!admission.ok) return admissionRefusal(admission);

  // Everything up to the dry-run branch is read-only, so the plan can be
  // produced without any daemon action. The guard is evaluated after the branch
  // (below), before the first write of a real run.
  const verdict = stateFormatVerdict(runtime);
  const priorAdvisory =
    runtime.priorNamespaceArtifacts.length === 0
      ? []
      : [migrationAdvisory(runtime.priorNamespaceArtifacts)];
  const migrationPlanLine = options.migrate
    ? "migration: nothing would be migrated (M4-S2 owns the move; the detection list above is advisory only)"
    : undefined;
  const advisories = [...advisoriesOf(verdict), ...priorAdvisory];
  const record = readRecord(runtime);
  const recordState = recordStateOf(record, running);
  const facts = destinationFacts(runtime);
  const plan = planReplace({
    destinationClass: facts.destinationClass,
    ...(facts.destinationDigest === undefined
      ? {}
      : { destinationDigest: facts.destinationDigest }),
    ...(facts.runningDigest === undefined ? {} : { runningDigest: facts.runningDigest }),
    recordState,
  });
  const plannedPlan: ReplacePlan =
    facts.launcherTarget === undefined ? plan : { ...plan, launcherTarget: facts.launcherTarget };
  const provenance = provenanceOfAdmission(admission);
  const installedAt = runtime.clock.nowIso();
  const profilePlan = (():
    | {
        readonly ok: true;
        readonly file?: string;
        readonly blockText?: string;
        readonly merged?: string;
        readonly block?: ReturnType<typeof renderPathBlock>;
      }
    | { readonly ok: false; readonly refusal: Refusal } => {
    if (!options.addToPath) return { ok: true };
    const file = resolveProfilePath({
      ...(options.shellProfile === undefined ? {} : { explicit: options.shellProfile }),
      ...(runtime.environment.SHELL === undefined ? {} : { shell: runtime.environment.SHELL }),
      homeDirectory: runtime.homeDirectory,
    });
    if (file === undefined) {
      return {
        ok: false,
        refusal: refusal(
          "install.shell-profile.unresolved",
          "refused: `--add-to-path` found no identifiable shell and no explicit `--shell-profile`; " +
            "pass `--shell-profile <path>` or set SHELL to zsh, bash, or sh; no profile file was written",
        ),
      };
    }
    const block = renderPathBlock({
      binaryName: runtime.invokedIdentity,
      installDirectory: runtime.installDirectory,
      file,
    });
    const existing = readProfileText({ fs: runtime.fs, path: file });
    return {
      ok: true,
      file,
      blockText: block.text,
      merged: mergePathBlock(existing, block),
      block,
    };
  })();
  if (options.dryRun) {
    if (!profilePlan.ok) return profilePlan.refusal;
    return {
      data: {
        outcome: "plan",
        running: runningOf(runtime),
        destination: runtime.destinationPath,
        disposition: plannedPlan.disposition,
        slot: slotReportOf(runtime, record),
        recordPath: runtime.recordPath,
        recordState,
        daemon: DRY_RUN_DAEMON,
        advisories,
        plan: [
          ...installPlanLines({
            runtime,
            plan: plannedPlan,
            advisories,
            daemon: DRY_RUN_DAEMON_LINE,
            addToPath: options.addToPath,
            ...(options.shellProfile === undefined ? {} : { shellProfile: options.shellProfile }),
          }),
          ...(profilePlan.file === undefined
            ? []
            : [
                `profile: ${profilePlan.file}`,
                `block: ${String(profilePlan.blockText).replace(/\n/gu, " / ")}`,
              ]),
          ...(migrationPlanLine === undefined ? [] : [migrationPlanLine]),
        ],
      } satisfies InstallOutcome,
    };
  }

  // A real run: the guard stays before every write, and before the shell-profile
  // refusal it precedes, so the delivered refusal order is unchanged.
  const gate = await daemonGate(runtime, options.stopDaemon);
  if (!gate.ok) return gate.refusal;
  if (!profilePlan.ok) return profilePlan.refusal;

  if (runtime.fault?.failAt("identity-compare") === true) {
    return internalFailure("the artifact-agreement step was injected to fail; nothing is staged");
  }

  // Step 4: the artifact-agreement gate and the in-place record reconciliation.
  if (plannedPlan.agreement) {
    // The managed PATH block is written once on the agreement path, before the
    // reconciliation records it.
    const block = applyPathBlock(runtime, profilePlan, {
      artifactInstalled: false,
      slotSwapped: false,
    });
    if (!block.ok) return block.refusal;
    let reconciliation: InstallOutcome["reconciliation"];
    if (plannedPlan.reconcilesRecord) {
      const reconciled = reconciliationRecordOf({
        running,
        stateSchemaVersion: runtime.acceptedStateSchemaVersion,
        ...provenance,
        installedAt,
        record,
        ...(profilePlan.block === undefined
          ? record.kind === "record" && record.record.pathBlock !== undefined
            ? { pathBlock: record.record.pathBlock }
            : {}
          : { pathBlock: { file: profilePlan.block.file, marker: profilePlan.block.marker } }),
      });
      if (runtime.fault?.failAt("record-write") === true) {
        return internalFailure(
          "the record write was injected to fail; the destination is this artifact and is untouched",
        );
      }
      const written = writeRecord(runtime, reconciled.record);
      reconciliation = { from: recordState, previous: reconciled.previous };
      if (!written) {
        return internalFailure(
          "the record could not be reconciled; the destination and slot are untouched",
        );
      }
    }
    return {
      data: {
        outcome: "unchanged",
        running: runningOf(runtime),
        destination: runtime.destinationPath,
        disposition: "unchanged",
        slot: slotReportOf(runtime, readRecord(runtime)),
        recordPath: runtime.recordPath,
        recordState: plannedPlan.reconcilesRecord ? "current" : recordState,
        ...(reconciliation === undefined ? {} : { reconciliation }),
        daemon: gate.state,
        advisories,
      } satisfies InstallOutcome,
    };
  }

  // Step 2: stage the running artifact's bytes beside the destination.
  if (runtime.fault?.failAt("stage") === true) {
    return internalFailure("the staging step was injected to fail; the destination is untouched");
  }
  if (!runtime.fs.mkdirp(runtime.installDirectory)) {
    return internalFailure(`the install directory ${runtime.installDirectory} cannot be created`);
  }
  // A staged copy orphaned by a crashed run is this run's own artifact class: it
  // is swept before a new copy is staged, so a recovery leaves no temporary file.
  for (const name of runtime.fs.list(runtime.installDirectory)) {
    if (name.startsWith(`.${runtime.destinationPath.split("/").pop() ?? ""}.staged-`)) {
      runtime.fs.remove(`${runtime.installDirectory}/${name}`);
    }
  }
  const staged = runtime.fs.copyStaged(runtime.destinationPath, runtime.runningArtifactPath, 0o755);
  if (!staged.ok) return internalFailure(staged.reason);

  // Step 3: verify the staged copy completely.
  const stagedStat = runtime.fs.stat(staged.stagedPath);
  const verified =
    stagedStat !== undefined &&
    stagedStat.size > 0 &&
    stagedStat.executable &&
    runtime.fs.digest(staged.stagedPath) === facts.runningDigest;
  if (runtime.fault?.failAt("verify") === true || !verified) {
    runtime.fs.remove(staged.stagedPath);
    return internalFailure("the staged copy did not verify; the destination is untouched");
  }

  // Step 5: move the destination into the slot (only a differing compiled
  // artifact); a launcher is discarded with a report and a symlink is replaced
  // without write-through — neither is promoted.
  if (plannedPlan.disposition === "launcher-discarded") {
    runtime.fs.remove(runtime.destinationPath);
  }
  if (plannedPlan.slotSwap) {
    const moved = runtime.fs.rename(runtime.destinationPath, runtime.slotPath);
    if (!moved) {
      runtime.fs.remove(staged.stagedPath);
      return internalFailure(
        "the displaced artifact could not be moved into the slot; nothing was replaced",
      );
    }
  }
  if (runtime.fault?.failAt("destination-to-slot") === true) {
    return internalFailure(
      "the destination-to-slot step was injected to fail; the slot holds a runnable artifact and a re-run recovers",
    );
  }

  // Step 6: the staged copy becomes the destination.
  if (runtime.fault?.failAt("staged-to-destination") === true) {
    return internalFailure(
      "the staged-to-destination step was injected to fail; the slot holds a runnable artifact and a re-run recovers",
    );
  }
  if (!runtime.fs.rename(staged.stagedPath, runtime.destinationPath)) {
    runtime.fs.remove(staged.stagedPath);
    return internalFailure("the staged artifact could not be renamed into place");
  }

  // Step 7: the managed PATH block (once on this path), then the record, staged
  // and renamed.
  if (runtime.fault?.failAt("record-write") === true) {
    return internalFailure(
      "the record write was injected to fail; both artifacts are valid and install status reports record-stale",
    );
  }
  const block = applyPathBlock(runtime, profilePlan, {
    artifactInstalled: true,
    slotSwapped: plannedPlan.slotSwap,
  });
  if (!block.ok) return block.refusal;
  const recordToWrite = replacingRecordOf({
    running,
    stateSchemaVersion: runtime.acceptedStateSchemaVersion,
    ...(facts.destinationClass === "symlink"
      ? { launcherDisposition: plannedPlan.launcherDisposition }
      : {}),
    ...provenance,
    installedAt,
    plan: plannedPlan,
    record,
    ...(profilePlan.block === undefined
      ? record.kind === "record" && record.record.pathBlock !== undefined
        ? { pathBlock: record.record.pathBlock }
        : {}
      : { pathBlock: { file: profilePlan.block.file, marker: profilePlan.block.marker } }),
  });
  const written = writeRecord(runtime, recordToWrite);
  const finalRecord = readRecord(runtime);

  return {
    data: {
      outcome: "installed",
      running: runningOf(runtime),
      destination: runtime.destinationPath,
      disposition: plannedPlan.disposition,
      ...(plannedPlan.launcherTarget === undefined
        ? {}
        : { launcherTarget: plannedPlan.launcherTarget }),
      ...(recordToWrite.previous === undefined ? {} : { previous: recordToWrite.previous }),
      slot: slotReportOf(runtime, finalRecord),
      recordPath: runtime.recordPath,
      recordState: written ? "current" : "record-stale",
      daemon: gate.state,
      advisories,
      ...(profilePlan.block === undefined
        ? finalRecord.kind === "record" && finalRecord.record.pathBlock !== undefined
          ? { pathBlock: finalRecord.record.pathBlock }
          : {}
        : { pathBlock: { file: profilePlan.block.file, marker: profilePlan.block.marker } }),
    } satisfies InstallOutcome,
  };
};

/** `install status` — read-only, deterministic, never repairing (DM-4). */
const runStatus = async (runtime: InstallRuntime): Promise<unknown> => {
  const verdict = stateFormatVerdict(runtime);
  const record = readRecord(runtime);
  const recordState = recordStateOf(record, runtime.runningIdentity);
  const installed =
    record.kind === "record"
      ? {
          version: record.record.version,
          commit: record.record.commit,
          builtAt: record.record.builtAt,
          dirty: record.record.dirty,
          channel: record.record.channel,
        }
      : null;
  const payload = {
    schemaVersion: "install.status.v1",
    running: runningOf(runtime),
    installed,
    recordState,
    recordPath: runtime.recordPath,
    rollback: slotReportOf(runtime, record),
    targetStability: installTargetStability(runtime.git.readCheckout(artifactDirectoryOf(runtime))),
    stateFormat: verdict,
    pathBlock: record.kind === "record" ? (record.record.pathBlock ?? null) : null,
  };
  const incompatible = incompatibleRoots(verdict);
  if (incompatible.length === 0) return { data: payload };
  const first = incompatible[0] as InstallStateRootVerdict;
  return refusal(
    "install.state.incompatible",
    `the judged state root ${first.root} declares ${String(first.observed)}; this artifact accepts ` +
      `${verdict.accepted} (judged ${String(verdict.judged)} root(s), ` +
      `${String(verdict.truncated ? "truncated" : "complete")})`,
  );
};

/** `install rollback` — the ordered refusals, then the reverse swap. */
const runRollback = async (
  command: InstallCommandInput,
  options: { readonly dryRun: boolean; readonly stopDaemon: boolean },
): Promise<unknown> => {
  const { runtime } = command;
  const slotStat = runtime.fs.stat(runtime.slotPath);
  if (slotStat === undefined) {
    return refusal(
      "install.slot.absent",
      `refused: no rollback slot exists at ${runtime.slotPath}; install a different compiled ` +
        "artifact first; nothing was written",
    );
  }
  if (!isCompiledArtifactAtPath(runtime.fs, runtime.slotPath)) {
    return refusal(
      "install.slot.invalid",
      `refused: the rollback slot at ${runtime.slotPath} is not a compiled artifact or is ` +
        "unreadable; nothing was written",
    );
  }
  const record = readRecord(runtime);
  const destinationIsArtifact = isCompiledArtifactAtPath(runtime.fs, runtime.destinationPath);
  const destinationIsRunning =
    runtime.runningArtifactPath.length > 0 &&
    destinationIsArtifact &&
    runtime.fs.digest(runtime.destinationPath) === runtime.fs.digest(runtime.runningArtifactPath);
  const running = runtime.runningIdentity;
  const precondition = rollbackPrecondition({
    record,
    running: running ?? {
      version: "0.0.0",
      commit: "dev",
      builtAt: "",
      dirty: false,
      channel: "dev",
    },
    destinationIsRunning,
    destinationIsArtifact,
  });

  if (options.dryRun) {
    const plan = precondition.ok
      ? [
          `restore: ${precondition.claimedCurrent.version} (build ${precondition.claimedCurrent.commit}) from the slot`,
          `displace: ${precondition.claimedPrevious.version} (build ${precondition.claimedPrevious.commit}) into the slot`,
          `rename 1: destination -> ${runtime.slotPath}.rollback-tmp (the displaced artifact moves aside)`,
          "rename 2: slot -> destination (the restored artifact)",
          `rename 3: ${runtime.slotPath}.rollback-tmp -> slot (the displaced artifact becomes the new slot)`,
          "record: current = the slot's claimed artifact, previous = the displaced destination",
        ]
      : [
          "refusal: install.record.unreadable",
          `cause: ${rollbackCauseSentence(precondition.cause)}`,
          "remedy: install the artifact held in the rollback slot; nothing would be written",
        ];
    return {
      data: {
        outcome: "plan",
        running: runningOf(runtime),
        destination: runtime.destinationPath,
        slot: slotReportOf(runtime, record),
        recordPath: runtime.recordPath,
        recordState: recordStateOf(record, running),
        daemon: DRY_RUN_DAEMON,
        advisories: [],
        plan,
      } satisfies InstallOutcome,
    };
  }

  if (!precondition.ok) {
    return refusal(
      "install.record.unreadable",
      `refused: ${rollbackCauseSentence(precondition.cause)} at ${runtime.recordPath}; install the ` +
        "artifact held in the rollback slot; nothing was written",
    );
  }

  // The ordered set is decided before the daemon stop: a refused rollback
  // performs no daemon action even with --stop-daemon.
  const gate = await daemonGate(runtime, options.stopDaemon);
  if (!gate.ok) return gate.refusal;

  // The involutive swap: the destination moves aside, the slot takes its place,
  // and the displaced destination becomes the new slot.
  const swapTemp = `${runtime.slotPath}.rollback-tmp`;
  if (!runtime.fs.rename(runtime.destinationPath, swapTemp)) {
    return internalFailure(
      "the rollback could not move the destination aside; nothing was swapped",
    );
  }
  if (!runtime.fs.rename(runtime.slotPath, runtime.destinationPath)) {
    runtime.fs.rename(swapTemp, runtime.destinationPath);
    return internalFailure("the rollback could not restore the slot artifact; nothing was swapped");
  }
  if (!runtime.fs.rename(swapTemp, runtime.slotPath)) {
    return internalFailure("the rollback could not place the displaced artifact in the slot");
  }

  const recordToWrite = rollbackRecordOf({
    precondition,
    stateSchemaVersion: runtime.acceptedStateSchemaVersion,
    provenance: record.kind === "record" ? record.record.provenance : "unverified",
    installedAt: runtime.clock.nowIso(),
    launcherDisposition: "none",
    ...(record.kind === "record" && record.record.pathBlock !== undefined
      ? { pathBlock: record.record.pathBlock }
      : {}),
  });
  if (runtime.fault?.failAt("record-write") === true) {
    return internalFailure(
      "the record write was injected to fail; both artifacts are valid and install status reports record-stale",
    );
  }
  const written = writeRecord(runtime, recordToWrite);
  return {
    data: {
      outcome: "rolled-back",
      running: runningOf(runtime),
      destination: runtime.destinationPath,
      disposition: "replaced",
      previous: precondition.claimedCurrent,
      slot: slotReportOf(runtime, readRecord(runtime)),
      recordPath: runtime.recordPath,
      recordState: written ? "current" : "record-stale",
      daemon: gate.state,
      advisories: [],
    } satisfies InstallOutcome,
  };
};

/** Remove the managed block from the recorded profile, when it was recorded. */
const removeRecordedBlock = (runtime: InstallRuntime, record: InstallRecordRead): boolean => {
  if (record.kind !== "record" || record.record.pathBlock === undefined) return true;
  const block = renderPathBlock({
    binaryName: runtime.invokedIdentity,
    installDirectory: runtime.installDirectory,
    file: record.record.pathBlock.file,
  });
  const current = readProfileText({ fs: runtime.fs, path: record.record.pathBlock.file });
  const next = removePathBlock(current, { ...block, marker: record.record.pathBlock.marker });
  return next === current
    ? true
    : writeProfileText({ fs: runtime.fs, path: record.record.pathBlock.file, text: next });
};

/** `install uninstall` — removal matrix minus the roots; residual always printed. */
const runUninstall = async (
  command: InstallCommandInput,
  options: { readonly dryRun: boolean; readonly stopDaemon: boolean },
): Promise<unknown> => {
  const { runtime } = command;
  const record = readRecord(runtime);
  const facts = removalFactsOf(
    runtime,
    record.kind === "record" ? record.record.pathBlock : undefined,
  );
  const members = uninstallMembers(facts).filter((member) => member.exists);
  const residual = residualSetOf(runtime).filter(
    (path) => !members.some((member) => member.path === path),
  );
  if (options.dryRun) {
    return {
      data: {
        outcome: "plan",
        running: runningOf(runtime),
        destination: runtime.destinationPath,
        slot: slotReportOf(runtime, record),
        recordPath: runtime.recordPath,
        recordState: recordStateOf(record, runtime.runningIdentity),
        daemon: DRY_RUN_DAEMON,
        advisories: [],
        removed: members.map((member) =>
          member.member === "path-block" ? `${member.path} (managed block only)` : member.path,
        ),
        residual,
      } satisfies InstallOutcome,
    };
  }
  // A real run: the guard is evaluated after the read-only plan and before the
  // first removal.
  const gate = await daemonGate(runtime, options.stopDaemon);
  if (!gate.ok) return gate.refusal;
  const removed: string[] = [];
  for (const member of members) {
    if (member.member === "path-block") {
      if (removeRecordedBlock(runtime, record)) removed.push(`${member.path} (managed block only)`);
      continue;
    }
    if (!runtime.fs.remove(member.path)) break;
    removed.push(member.path);
  }
  return {
    data: {
      outcome: "uninstalled",
      running: runningOf(runtime),
      destination: runtime.destinationPath,
      slot: { path: runtime.slotPath, state: "absent" },
      recordPath: runtime.recordPath,
      recordState: "absent",
      daemon: gate.state,
      advisories: [],
      removed,
      residual,
    } satisfies InstallOutcome,
  };
};

/** `install purge` — confirmation required even when both roots are absent. */
const runPurge = async (
  command: InstallCommandInput,
  options: { readonly dryRun: boolean; readonly stopDaemon: boolean; readonly confirmed: boolean },
): Promise<unknown> => {
  const { runtime } = command;
  if (!options.confirmed && !options.dryRun) {
    return refusal(
      "install.purge.unconfirmed",
      `refused: purge removes ${runtime.configRoot} and ${runtime.stateRoot}; re-run with ` +
        "`--yes` to confirm; nothing was removed",
    );
  }
  const record = readRecord(runtime);
  const facts = removalFactsOf(
    runtime,
    record.kind === "record" ? record.record.pathBlock : undefined,
  );
  const members = purgeMembers(facts).filter((member) => member.exists);
  const residual = residualSetOf(runtime);
  const removal = [...new Set([...members.map((member) => member.path), ...residual])].sort(
    (left, right) => right.split("/").length - left.split("/").length || left.localeCompare(right),
  );
  if (options.dryRun) {
    return {
      data: {
        outcome: "plan",
        running: runningOf(runtime),
        destination: runtime.destinationPath,
        slot: slotReportOf(runtime, record),
        recordPath: runtime.recordPath,
        recordState: recordStateOf(record, runtime.runningIdentity),
        daemon: DRY_RUN_DAEMON,
        advisories: [],
        plan: removal,
        residual,
      } satisfies InstallOutcome,
    };
  }
  // A real run: the guard is evaluated after the read-only plan and before the
  // first removal.
  const gate = await daemonGate(runtime, options.stopDaemon);
  if (!gate.ok) return gate.refusal;
  if (removal.length === 0) {
    return {
      data: {
        outcome: "purged",
        running: runningOf(runtime),
        destination: runtime.destinationPath,
        slot: { path: runtime.slotPath, state: "absent" },
        recordPath: runtime.recordPath,
        recordState: "absent",
        daemon: gate.state,
        advisories: ["nothing to remove"],
        removed: [],
      } satisfies InstallOutcome,
    };
  }
  const removed: string[] = [];
  let blockRemoved = false;
  for (const path of removal) {
    if (path === (record.kind === "record" ? record.record.pathBlock?.file : undefined)) {
      blockRemoved = removeRecordedBlock(runtime, record);
      if (blockRemoved) removed.push(`${path} (managed block only)`);
      else break;
      continue;
    }
    if (!runtime.fs.exists(path)) continue;
    const stats = runtime.fs.stat(path);
    const ok = stats?.kind === "directory" ? runtime.fs.removeTree(path) : runtime.fs.remove(path);
    if (!ok) break;
    removed.push(path);
  }
  return {
    data: {
      outcome: "purged",
      running: runningOf(runtime),
      destination: runtime.destinationPath,
      slot: { path: runtime.slotPath, state: "absent" },
      recordPath: runtime.recordPath,
      recordState: "absent",
      daemon: gate.state,
      advisories: [],
      removed,
    } satisfies InstallOutcome,
  };
};

/** The input-value refusal's plain class (the table supplies the projection). */
const inputRefusal = (summary: string): Refusal => ({
  error: { kind: "input", code: "input.value.rejected", summary },
});

const stateRefusal = (code: string, summary: string): Refusal => ({
  error: { kind: "state", code, summary },
});

const absolutePath = (path: string): boolean => path.startsWith("/");

const insideSourceRoot = (path: string, roots: readonly InstallMigrationRoot[]): boolean => {
  const normalized = path.replace(/\/+$/u, "");
  return roots.some((root) => {
    if (root.scope !== "scoped" || root.source === undefined) return false;
    const source = root.source.replace(/\/+$/u, "");
    return normalized === source || normalized.startsWith(`${source}/`);
  });
};

const migrationPayload = (input: {
  readonly plan: Parameters<typeof planRootsData>[0];
  readonly runId: string;
  readonly verdict: MigrationPlanPayload["verdict"];
  readonly daemon: MigrationPlanPayload["daemon"];
  readonly backupPath?: string;
  readonly conflicts: readonly string[];
  readonly residuals: readonly string[];
  readonly retiredRoots: readonly string[];
}): MigrationPlanPayload => ({
  schemaId: INSTALL_MIGRATION_PLAN_SCHEMA,
  runId: input.runId,
  verdict: input.verdict,
  daemon: input.daemon,
  ...(input.backupPath === undefined ? {} : { backupPath: input.backupPath }),
  roots: planRootsData(input.plan),
  conflicts: [...input.conflicts],
  residuals: [...input.residuals],
  retiredRoots: [...input.retiredRoots],
});

/** The bounded, ANSI-free human block (API-2, NFR-2). */
export const renderMigrationHuman = (payload: MigrationPlanPayload): string => {
  const lines: string[] = [];
  for (const root of payload.roots) {
    if (root.scope === "unscoped") {
      lines.push(`${root.label}: unscoped (outside a work tree) · 0 entries`);
      continue;
    }
    lines.push(
      `${root.label}: ${root.scope} · ${root.source ?? ""} → ${root.destination ?? ""}` +
        (root.verdict === undefined ? "" : ` · ${root.verdict}`),
    );
    for (const entry of root.entries) {
      lines.push(
        `  ${entry.disposition} ${entry.relativePath} · ${String(entry.files)} file(s) · ${String(entry.bytes)} byte(s)`,
      );
    }
  }
  for (const conflict of payload.conflicts) lines.push(`conflict: ${conflict}`);
  for (const residual of payload.residuals) lines.push(`residual: ${residual}`);
  for (const retired of payload.retiredRoots) lines.push(`retired: ${retired}`);
  if (payload.backupPath !== undefined) lines.push(`backup: ${payload.backupPath}`);
  lines.push(`verdict: ${payload.verdict}`);
  if (payload.daemon === "unchecked") lines.push("daemon: unchecked");
  if (lines.length > 60) {
    const kept = lines.slice(0, 59);
    kept.push(`… ${String(lines.length - 59)} more`);
    return kept.join("\n");
  }
  return lines.join("\n");
};

/** The migration verb: admission, plan, daemon guard, apply (API-1/API-2). */
const runMigration = async (
  command: InstallCommandInput,
  options: {
    readonly dryRun: boolean;
    readonly stopDaemon: boolean;
    readonly backupDir?: string;
  },
): Promise<unknown> => {
  const { runtime } = command;
  const migration = runtime.migration;
  if (migration === undefined) {
    return internalFailure("the migration runtime is not composed; nothing was moved");
  }
  if (options.backupDir !== undefined) {
    if (!absolutePath(options.backupDir)) {
      return inputRefusal(
        `refused: --backup-dir must be an absolute path; received "${options.backupDir}" — nothing was moved`,
      );
    }
    if (insideSourceRoot(options.backupDir, migration.roots)) {
      return inputRefusal(
        "refused: --backup-dir must not be inside a source root — nothing was moved",
      );
    }
  }
  if (runtime.runningIdentity === undefined) {
    return admissionRefusal({ code: INSTALL_DEV_BUILD_CODE });
  }
  const artifactDirectory = artifactDirectoryOf(runtime);
  const admission = evaluateInstallAdmission({
    artifactDirectory,
    identity: runtime.runningIdentity,
    git: runtime.git.readCheckout(artifactDirectory),
  });
  if (!admission.ok) return admissionRefusal(admission);

  const backupRoot = options.backupDir ?? migration.backupRoot;
  const runId = migration.runId();
  const createdAt = migration.clock.nowIso();
  const plan = buildMigrationPlan({ roots: migration.roots, fs: runtime.fs });

  if (options.dryRun) {
    return {
      data: migrationPayload({
        plan,
        runId,
        verdict: plan.verdict,
        daemon: "unchecked",
        backupPath: migrationBackupPath(backupRoot, createdAt),
        conflicts: migrationConflictPaths(plan),
        residuals: [],
        retiredRoots: [],
      }),
    };
  }

  let daemon: MigrationPlanPayload["daemon"] = "unchecked";
  const live = await runtime.daemon.status();
  if (live.running) {
    if (!options.stopDaemon) {
      return refusal(
        "install.daemon.running",
        "refused: a live daemon would race the state move; re-run with --stop-daemon — " +
          "nothing was moved, copied, or deleted",
      );
    }
    const stopped = await runtime.daemon.stop();
    if (!stopped.ok) {
      return internalFailure("the live daemon could not be stopped; nothing was moved");
    }
    daemon = "stopped";
  }

  const applied = applyMigrationPlan({
    plan,
    fs: runtime.fs,
    runId,
    createdAt,
    ...(migration.artifactIdentity === undefined
      ? {}
      : { artifactIdentity: migration.artifactIdentity }),
    backupRoot,
    ...(migration.failAtOrdinal === undefined ? {} : { failAtOrdinal: migration.failAtOrdinal }),
    ...(migration.onMove === undefined ? {} : { onMove: migration.onMove }),
    ...(migration.managedPathBlock === undefined
      ? {}
      : { managedPathBlock: migration.managedPathBlock }),
    priorPrefixes: migration.priorPrefixes,
  });
  if (applied.failureCode !== undefined) {
    return stateRefusal(
      applied.failureCode,
      `internal failure: ${applied.failureDetail ?? "the migration could not complete"}; ` +
        "no non-derived byte was moved, copied, or deleted",
    );
  }
  return {
    data: migrationPayload({
      plan: applied.plan,
      runId,
      verdict: applied.verdict,
      daemon,
      ...(applied.backupPath === undefined ? {} : { backupPath: applied.backupPath }),
      conflicts: migrationConflictPaths(applied.plan),
      residuals: applied.residuals,
      retiredRoots: applied.retiredRoots,
    }),
  };
};

/** The family definition: one grammar, five handlers, the owning-role gate. */
export const createInstallCommandDefinition = (runtime: InstallRuntime): CommandDefinition => ({
  positionals: { max: 1 },
  flags: ["--add-to-path", "--migrate", "--dry-run", "--stop-daemon", "--yes"],
  requiresValue: ["--shell-profile", "--backup-dir"],
  humanSuccess: true,
  humanText: (data) => {
    if (typeof data !== "object" || data === null) return undefined;
    const record = data as Record<string, unknown>;
    if (record.schemaId === INSTALL_MIGRATION_PLAN_SCHEMA) {
      return renderMigrationHuman(data as MigrationPlanPayload);
    }
    if (record.schemaVersion === "install.status.v1") return renderInstallStatus(record);
    if (record.outcome === "plan") return renderInstallPlan(data as InstallOutcome);
    return renderInstallOutcome(data as InstallOutcome);
  },
  exitProjection: (data) => {
    if (typeof data === "object" && data !== null) {
      const record = data as Record<string, unknown>;
      if (record.schemaId === INSTALL_MIGRATION_PLAN_SCHEMA) {
        const verdict = record.verdict;
        return verdict === "partial" || verdict === "conflict" || verdict === "blocked"
          ? "attention"
          : "success";
      }
    }
    return "success";
  },
  humanFailureText: (error, brand) => renderInstallFailure(error, brand),
  handler: async (invocation) => {
    if (!runtime.ownsInstallation) return notOwningRefusal(runtime);
    const command: InstallCommandInput = { runtime, invocation };
    const [subcommand] = invocation.positionals;
    if (subcommand !== undefined && subcommand !== "") {
      if (!(INSTALL_SUBCOMMANDS as readonly string[]).includes(subcommand)) {
        return refusal(
          "fallback.invocation",
          `unknown install subcommand "${subcommand}"; the declared entry points are ` +
            `install, ${INSTALL_SUBCOMMANDS.map((name) => `install ${name}`).join(", ")}`,
          "fallback",
        );
      }
      if (subcommand === "migrate") {
        return runMigration(command, {
          dryRun: boolFlag(command, "--dry-run"),
          stopDaemon: boolFlag(command, "--stop-daemon"),
          ...(stringFlag(command, "--backup-dir") === undefined
            ? {}
            : { backupDir: stringFlag(command, "--backup-dir") as string }),
        });
      }
      if (subcommand === "status") return runStatus(runtime);
      if (subcommand === "rollback") {
        return runRollback(command, {
          dryRun: boolFlag(command, "--dry-run"),
          stopDaemon: boolFlag(command, "--stop-daemon"),
        });
      }
      if (subcommand === "uninstall") {
        return runUninstall(command, {
          dryRun: boolFlag(command, "--dry-run"),
          stopDaemon: boolFlag(command, "--stop-daemon"),
        });
      }
      return runPurge(command, {
        dryRun: boolFlag(command, "--dry-run"),
        stopDaemon: boolFlag(command, "--stop-daemon"),
        confirmed: boolFlag(command, "--yes"),
      });
    }
    return runInstall(command, {
      dryRun: boolFlag(command, "--dry-run"),
      stopDaemon: boolFlag(command, "--stop-daemon"),
      addToPath: boolFlag(command, "--add-to-path"),
      ...(stringFlag(command, "--shell-profile") === undefined
        ? {}
        : { shellProfile: stringFlag(command, "--shell-profile") as string }),
      migrate: boolFlag(command, "--migrate"),
    });
  },
});

/** Re-export the record parser so the record suite asserts the same one writer. */
export { parseInstallRecord };
