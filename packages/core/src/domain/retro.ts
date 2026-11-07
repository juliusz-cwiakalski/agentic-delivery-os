/**
 * The retro learning-plane engine (GH-232 F-1, F-5, F-6, F-7, F-9).
 *
 * Pure over injected ports and readers: collection selects the target, folds
 * the delivered GET-only sources into evidence drafts, runs the five
 * pipeline-truth checks, appends through the sidecar seam, and records one run
 * record. Reporting folds verified evidence and registry runs into the four-key
 * report data. Export is a bounded deterministic bundle. No model call, ambient
 * clock, environment, or filesystem access lives here.
 */
import {
  AUDIT_INVOCATION_PAYLOAD_SCHEMA,
  type AuditReadFailure,
  type AuditReadOutcome,
  RETRO_AUDIT_READ_LIMIT,
  RETRO_CHAIN_ANCHOR,
  RETRO_DEFAULT_LEVEL,
  RETRO_EVIDENCE_PAYLOAD_SCHEMA,
  RETRO_EXPORT_MAX_LIMIT,
  RETRO_EXPORT_SCHEMA,
  RETRO_FINDING_KINDS,
  RETRO_LEVEL_NAMES,
  RETRO_LEVEL_OWNING_STORIES,
  RETRO_NO_TARGET_REASON,
  RETRO_PAYLOAD_SCHEMAS,
  RETRO_REPORT_SCHEMA,
  RETRO_TARGET_ORDER,
  RETRO_TRUTH_CHECKS,
  type RetroChangeFacts,
  type RetroClaimedIdentity,
  type RetroCollectorRead,
  type RetroCollectSummary,
  type RetroCommandOutcome,
  type RetroConsumedVerdict,
  type RetroEvidenceDraft,
  type RetroEvidenceRecord,
  type RetroEvidenceSource,
  type RetroExportBundle,
  type RetroFailure,
  type RetroFinding,
  type RetroFollowThroughEntry,
  type RetroLevelName,
  type RetroRegistryPort,
  type RetroReportData,
  type RetroResult,
  type RetroRunCounts,
  type RetroRunRecord,
  type RetroSidecarPort,
  type RetroTargetSelection,
  type RetroTruthCheckId,
  type RetroTruthCheckOutcome,
  type RetroTruthVerdict,
  type StateFailureCode,
} from "#contracts";

/** The injected seams for one collection run. */
export type RetroCollectDeps = {
  readonly sidecar: RetroSidecarPort;
  readonly registry: RetroRegistryPort;
  readonly collectors: RetroCollectorRead;
  readonly readChanges: () => readonly RetroChangeFacts[];
  readonly clock: { readonly nowMs: () => number };
  readonly newTraceId: () => string;
  readonly newRunId: () => string;
  readonly newFenceToken: () => string;
  readonly level: RetroLevelName;
  readonly target?: string;
  readonly identity?: RetroClaimedIdentity;
  readonly sources?: readonly RetroEvidenceSource[];
  readonly context?: "collector" | "delivery-agent";
  readonly redact?: (text: string) => string;
  readonly readFollowThrough?: (
    changeRef: string,
  ) => readonly { readonly action: string; readonly artifactRef?: string }[];
  readonly verifyArtifact?: (artifactRef: string) => boolean;
};

/** The injected seams for one report fold. */
export type RetroReportDeps = {
  readonly sidecar: RetroSidecarPort;
  readonly registry: RetroRegistryPort;
  readonly level: RetroLevelName;
  readonly verifyArtifact?: (artifactRef: string) => boolean;
  readonly extraReferencedTraceIds?: readonly string[];
};

/** The injected seams for the export engine surface. */
export type RetroExportDeps = {
  readonly sidecar: RetroSidecarPort;
  readonly level: RetroLevelName;
  readonly destination: string;
  readonly limit: number;
  readonly write: (destination: string, content: string) => void;
  readonly redact?: (text: string) => string;
};

const failure = (error: RetroFailure): { readonly ok: false; readonly error: RetroFailure } => ({
  ok: false,
  error,
});

/** The delivered state failure vocabulary an audit read surface may produce. */
const STATE_FAILURE_CODES = [
  "state.store.torn",
  "state.schema.mismatch",
  "state.keys.missing",
  "state.lock.busy",
  "state.permission.denied",
  "state.write.failed",
  "state.level.unsupported",
  "state.storage.exhausted",
  "state.store.unknown",
] as const satisfies readonly StateFailureCode[];

const isStateFailureCode = (code: string): code is StateFailureCode =>
  (STATE_FAILURE_CODES as readonly string[]).includes(code);

const inputFailure = (summary: string): { readonly ok: false; readonly error: RetroFailure } =>
  failure({ kind: "input", code: "input.value.rejected", consequence: "not_landed", summary });

const fromAuditFailure = (audit: AuditReadFailure): RetroFailure => {
  if (audit.kind === "input") {
    return { kind: "input", code: "input.value.rejected", consequence: "not_landed" };
  }
  return {
    kind: "state",
    code: isStateFailureCode(audit.code) ? audit.code : "state.store.unknown",
    consequence: "not_landed",
    location: audit.location,
  };
};

/** The owning-story hint for a declared-but-unimplemented level (AC-F1-3). */
export const retroLevelRefusalHint = (level: string): string =>
  `Level "${level}" is declared but not implemented in this change; owning story: ${RETRO_LEVEL_OWNING_STORIES[level as RetroLevelName] ?? "unknown"}.`;

/** Whether a level name is declared and implemented. */
export const isImplementedRetroLevel = (level: string): boolean =>
  level === "change" && (RETRO_LEVEL_NAMES as readonly string[]).includes(level);

const validateLevel = (
  level: string,
): { readonly ok: true } | { readonly ok: false; readonly error: RetroFailure } => {
  if ((RETRO_LEVEL_NAMES as readonly string[]).includes(level)) {
    if (isImplementedRetroLevel(level)) return { ok: true };
    return {
      ok: false,
      error: {
        kind: "input",
        code: "input.value.rejected",
        consequence: "not_landed",
        summary: retroLevelRefusalHint(level),
      },
    };
  }
  return {
    ok: false,
    error: {
      kind: "input",
      code: "input.value.rejected",
      consequence: "not_landed",
      summary: `Unknown retro level "${level}"; declared levels: ${RETRO_LEVEL_NAMES.join(", ")}.`,
    },
  };
};

const completedChanges = (changes: readonly RetroChangeFacts[]): readonly RetroChangeFacts[] =>
  changes.filter((change) => change.completedAt !== undefined);

const collectibleFor = (
  changes: readonly RetroChangeFacts[],
  runs: readonly RetroRunRecord[],
  level: RetroLevelName,
): readonly RetroChangeFacts[] => {
  const collected = new Set(runs.filter((run) => run.level === level).map((run) => run.scope));
  return completedChanges(changes).filter((change) => !collected.has(change.changeRef));
};

/** Deterministic target ordering: completion DESC, then change ref ASC (PIN-5). */
export const selectRetroTarget = (
  changes: readonly RetroChangeFacts[],
  runs: readonly RetroRunRecord[],
  level: RetroLevelName,
): RetroChangeFacts | undefined =>
  [...collectibleFor(changes, runs, level)].sort((left, right) => {
    const leftAt = left.completedAt ?? "";
    const rightAt = right.completedAt ?? "";
    if (leftAt !== rightAt) return leftAt < rightAt ? 1 : -1;
    return left.changeRef < right.changeRef ? -1 : left.changeRef > right.changeRef ? 1 : 0;
  })[0];

const selectionOf = (change: RetroChangeFacts | undefined): RetroTargetSelection =>
  change === undefined
    ? { state: "empty", reason: RETRO_NO_TARGET_REASON }
    : {
        state: "selected",
        changeRef: change.changeRef,
        ...(change.completedAt === undefined ? {} : { completedAt: change.completedAt }),
      };

const windowFor = (change: RetroChangeFacts, nowMs: number): { start: number; end: number } => {
  if (change.completedAt !== undefined) {
    const parsed = Date.parse(change.completedAt);
    if (Number.isFinite(parsed)) return { start: parsed, end: nowMs };
  }
  return { start: nowMs - 3_600_000, end: nowMs };
};

const draftFor = (
  runId: string,
  level: RetroLevelName,
  source: RetroEvidenceSource,
  payloadSchemaId: string,
  payloadRefs: readonly string[],
  window: { readonly start: number; readonly end: number },
  collectedAt: number,
  identity: RetroClaimedIdentity | undefined,
): RetroEvidenceDraft => ({
  traceId: "",
  level,
  source,
  windowStart: window.start,
  windowEnd: window.end,
  collectedAt,
  ...(identity === undefined ? {} : { collectorIdentity: identity }),
  payloadRefs: [`run:${runId}`, ...payloadRefs],
  payloadSchemaId,
});

/** The five pipeline-truth checks' input facts (DEC-6). */
export type RetroTruthCheckInput = {
  readonly audit?: AuditReadOutcome;
  readonly collected: number;
  readonly completed: boolean;
  readonly hasCloseout: boolean;
  readonly orphanEvidenceRefs?: readonly string[];
  readonly danglingRefs?: readonly string[];
  readonly auditChainEvidenceRef?: string;
};

export type RetroTruthCheckOptions = {
  readonly disabled?: readonly RetroTruthCheckId[];
};

const checkOutcome = (
  id: RetroTruthCheckId,
  outcome: RetroTruthCheckOutcome["outcome"],
  findings: readonly string[],
  evidenceRefs: readonly string[],
): RetroTruthCheckOutcome => ({ id, outcome, findings, evidenceRefs });

/** Evaluate the five mechanical checks; each is individually disableable. */
export const evaluateRetroTruthChecks = (
  input: RetroTruthCheckInput,
  options: RetroTruthCheckOptions = {},
): RetroTruthVerdict => {
  const disabled = new Set(options.disabled ?? []);
  const checks: RetroTruthCheckOutcome[] = [];
  const isDisabled = (id: RetroTruthCheckId): boolean => disabled.has(id);

  const orphans = input.audit?.chain.orphans ?? [];
  checks.push(
    isDisabled("C-01")
      ? checkOutcome("C-01", "passed", [], [])
      : orphans.length === 0
        ? checkOutcome("C-01", "passed", [], [])
        : checkOutcome(
            "C-01",
            "finding",
            orphans.map(
              (orphan) =>
                `skipped audit ordinal ${String(orphan.auditSeq)} (run ${orphan.runId}, position ${String(orphan.position)})`,
            ),
            input.orphanEvidenceRefs ?? [],
          ),
  );

  const auditVerified = input.audit?.chain.verified ?? true;
  checks.push(
    isDisabled("C-02")
      ? checkOutcome("C-02", "passed", [], [])
      : input.audit !== undefined && !auditVerified
        ? checkOutcome(
            "C-02",
            "blocked",
            ["consumed audit-ledger chain failed verification (audit domain)"],
            input.auditChainEvidenceRef === undefined ? [] : [input.auditChainEvidenceRef],
          )
        : checkOutcome("C-02", "passed", [], []),
  );

  const dangling = input.danglingRefs ?? [];
  checks.push(
    isDisabled("C-03")
      ? checkOutcome("C-03", "passed", [], [])
      : dangling.length === 0
        ? checkOutcome("C-03", "passed", [], [])
        : checkOutcome(
            "C-03",
            "finding",
            dangling.map((ref) => `dangling evidence ref ${ref}`),
            [],
          ),
  );

  if (!input.completed) {
    checks.push(checkOutcome("C-04", "verified-empty", [], []));
  } else {
    const auditRecords = input.audit?.records.length ?? 0;
    const findings: string[] = [];
    if (auditRecords === 0) {
      findings.push("expected activity absent: no audit invocations in the collection window");
    }
    if (!input.hasCloseout) {
      findings.push("expected activity absent: no closeout outcome record");
    }
    checks.push(
      isDisabled("C-04")
        ? checkOutcome("C-04", "passed", [], [])
        : findings.length === 0
          ? checkOutcome("C-04", "passed", [], [])
          : checkOutcome("C-04", "finding", findings, []),
    );
  }

  checks.push(
    isDisabled("C-05")
      ? checkOutcome("C-05", "passed", [], [])
      : input.collected === 0
        ? checkOutcome(
            "C-05",
            "blocked",
            ["collection run executed and produced zero collector records"],
            [],
          )
        : checkOutcome("C-05", "passed", [], []),
  );

  const blockingCheck =
    checks.find((check) => check.id === "C-02" && check.outcome === "blocked") ??
    checks.find((check) => check.id === "C-05" && check.outcome === "blocked");
  const blocking =
    blockingCheck?.id === "C-02"
      ? "retro.evidence.tamper-flagged"
      : blockingCheck?.id === "C-05"
        ? "retro.truth.vacuous-run"
        : null;
  const clean = checks.every(
    (check) => check.outcome === "passed" || check.outcome === "verified-empty",
  );
  return { clean, blocking, checks };
};

const collectorRecords = (
  audit: AuditReadOutcome,
  families: {
    readonly transitions: readonly {
      readonly phaseId: string;
      readonly operation: string;
      readonly timestamp: string;
    }[];
    readonly closeouts: readonly unknown[];
    readonly telemetry: readonly unknown[];
  },
  notes: readonly string[],
  runId: string,
  level: RetroLevelName,
  window: { readonly start: number; readonly end: number },
  collectedAt: number,
  identity: RetroClaimedIdentity | undefined,
): {
  readonly drafts: readonly RetroEvidenceDraft[];
  readonly consumed: readonly RetroConsumedVerdict[];
} => {
  const drafts: RetroEvidenceDraft[] = [];
  const consumed: RetroConsumedVerdict[] = [];

  for (const record of audit.records) {
    drafts.push(
      draftFor(
        runId,
        level,
        "audit-ledger",
        AUDIT_INVOCATION_PAYLOAD_SCHEMA,
        [`run-id:${record.runId}`, `audit-seq:${String(record.auditSeq)}`],
        window,
        collectedAt,
        identity,
      ),
    );
  }
  for (const orphan of audit.chain.orphans) {
    drafts.push(
      draftFor(
        runId,
        level,
        "audit-ledger",
        RETRO_PAYLOAD_SCHEMAS.auditOrphan,
        [
          `audit-seq:${String(orphan.auditSeq)}`,
          `orphan-run:${orphan.runId}`,
          `position:${String(orphan.position)}`,
        ],
        window,
        collectedAt,
        identity,
      ),
    );
  }
  drafts.push(
    draftFor(
      runId,
      level,
      "audit-ledger",
      RETRO_PAYLOAD_SCHEMAS.auditChain,
      [
        `verified:${String(audit.chain.verified)}`,
        `records:${String(audit.chain.records)}`,
        ...audit.chain.breaks.map(
          (entry) => `break:${String(entry.position)}:${String(entry.auditSeq)}`,
        ),
        ...audit.chain.orphans.map(
          (entry) => `orphan:${String(entry.auditSeq)}:${entry.runId}:${String(entry.position)}`,
        ),
      ],
      window,
      collectedAt,
      identity,
    ),
  );
  consumed.push({
    source: "audit-ledger",
    verified: audit.chain.verified,
    records: audit.records.length,
    truncated: audit.truncated,
  });
  if (audit.records.length === 0) {
    drafts.push(
      draftFor(
        runId,
        level,
        "audit-ledger",
        RETRO_PAYLOAD_SCHEMAS.verifiedEmpty,
        ["check:C-04", "source:audit-ledger"],
        window,
        collectedAt,
        identity,
      ),
    );
  }

  for (const transition of families.transitions) {
    drafts.push(
      draftFor(
        runId,
        level,
        "phase-transitions",
        RETRO_PAYLOAD_SCHEMAS.phaseTransition,
        [
          `phase:${transition.phaseId}`,
          `operation:${transition.operation}`,
          `at:${transition.timestamp}`,
        ],
        window,
        collectedAt,
        identity,
      ),
    );
  }
  consumed.push({
    source: "phase-transitions",
    verified: true,
    records: families.transitions.length,
    truncated: false,
  });
  if (families.transitions.length === 0) {
    drafts.push(
      draftFor(
        runId,
        level,
        "phase-transitions",
        RETRO_PAYLOAD_SCHEMAS.verifiedEmpty,
        ["check:C-04", "source:phase-transitions"],
        window,
        collectedAt,
        identity,
      ),
    );
  }

  for (const [index, value] of families.closeouts.entries()) {
    drafts.push(
      draftFor(
        runId,
        level,
        "closeout-outcomes",
        RETRO_PAYLOAD_SCHEMAS.closeoutOutcome,
        [`closeout:${String(index)}`, `evidence:${JSON.stringify(value)}`],
        window,
        collectedAt,
        identity,
      ),
    );
  }
  consumed.push({
    source: "closeout-outcomes",
    verified: true,
    records: families.closeouts.length,
    truncated: false,
  });
  if (families.closeouts.length === 0) {
    drafts.push(
      draftFor(
        runId,
        level,
        "closeout-outcomes",
        RETRO_PAYLOAD_SCHEMAS.verifiedEmpty,
        ["check:C-04", "source:closeout-outcomes"],
        window,
        collectedAt,
        identity,
      ),
    );
  }

  for (const [index, value] of families.telemetry.entries()) {
    drafts.push(
      draftFor(
        runId,
        level,
        "commit-telemetry",
        RETRO_PAYLOAD_SCHEMAS.commitTelemetry,
        [`telemetry:${String(index)}`, `evidence:${JSON.stringify(value)}`],
        window,
        collectedAt,
        identity,
      ),
    );
  }
  consumed.push({
    source: "commit-telemetry",
    verified: true,
    records: families.telemetry.length,
    truncated: false,
  });
  if (families.telemetry.length === 0) {
    drafts.push(
      draftFor(
        runId,
        level,
        "commit-telemetry",
        RETRO_PAYLOAD_SCHEMAS.verifiedEmpty,
        ["check:C-04", "source:commit-telemetry"],
        window,
        collectedAt,
        identity,
      ),
    );
  }

  for (const [index, note] of notes.entries()) {
    drafts.push(
      draftFor(
        runId,
        level,
        "pm-notes",
        RETRO_PAYLOAD_SCHEMAS.retroNote,
        [`note:${String(index)}`, `text:${note}`],
        window,
        collectedAt,
        identity,
      ),
    );
  }
  consumed.push({
    source: "pm-notes",
    verified: true,
    records: notes.length,
    truncated: false,
  });
  if (notes.length === 0) {
    drafts.push(
      draftFor(
        runId,
        level,
        "pm-notes",
        RETRO_PAYLOAD_SCHEMAS.verifiedEmpty,
        ["check:C-03", "source:pm-notes"],
        window,
        collectedAt,
        identity,
      ),
    );
  }

  return { drafts, consumed };
};

const appendAll = (
  deps: RetroCollectDeps,
  drafts: readonly RetroEvidenceDraft[],
  level: RetroLevelName,
  window: { readonly start: number; readonly end: number },
  collectedAt: number,
): {
  readonly records: readonly RetroEvidenceRecord[];
  readonly error?: RetroFailure;
} => {
  const prepared = drafts.map((draft) => ({
    ...draft,
    traceId: deps.newTraceId(),
    level,
    windowStart: window.start,
    windowEnd: window.end,
    collectedAt,
  }));
  const appended = deps.sidecar.appendBatch(prepared, {
    fenceToken: deps.newFenceToken(),
  });
  if (!appended.ok) {
    return { records: [], error: appended.error };
  }
  return { records: appended.value };
};

const findingDrafts = (
  runId: string,
  draftId: (overrides: Partial<RetroEvidenceDraft>) => RetroEvidenceDraft,
  truth: RetroTruthVerdict,
  window: { readonly start: number; readonly end: number },
  collectedAt: number,
): readonly RetroEvidenceDraft[] =>
  truth.checks.flatMap((check) =>
    check.outcome !== "finding"
      ? []
      : check.findings.map((text) =>
          draftId({
            source: "pm-notes",
            payloadSchemaId: RETRO_PAYLOAD_SCHEMAS.finding,
            payloadRefs: [
              `run:${runId}`,
              "finding:truth-check",
              `text:${text}`,
              ...check.evidenceRefs.map((ref) => `ref:${ref}`),
            ],
            windowStart: window.start,
            windowEnd: window.end,
            collectedAt,
          }),
        ),
  );

/** One collection run over the implemented `change` level. */
export const collectRetro = (deps: RetroCollectDeps): RetroCommandOutcome => {
  const levelValidation = validateLevel(deps.level);
  if (!levelValidation.ok) return { ok: false, error: levelValidation.error };
  if (deps.context === "delivery-agent") {
    return {
      ok: false,
      error: {
        kind: "retro",
        code: "retro.evidence.denied",
        consequence: "not_landed",
        summary:
          "evidence writes are collector-owned; this delivery-agent context has no collector write authority",
      },
    };
  }

  const read = deps.registry.read();
  if (!read.ok) return { ok: false, error: read.error };
  if (read.value.malformed.length > 0) {
    const first = read.value.malformed[0];
    return {
      ok: false,
      error: {
        kind: "retro",
        code: "retro.evidence.malformed-entry",
        consequence: "not_landed",
        location: {
          ...(first === undefined ? {} : { position: first.position }),
          entriesProcessed: read.value.artifacts.length + read.value.malformed.length,
          entriesPreserved: read.value.artifacts.length,
          ...(first === undefined ? {} : { firstFlaggedPosition: first.position }),
        },
        summary: "a retro registry entry is malformed; valid entries were preserved",
      },
    };
  }
  const runs = deps.registry.runs(read.value);
  const changes = deps.readChanges();
  const explicit =
    deps.target === undefined
      ? undefined
      : completedChanges(changes).find((change) => change.changeRef === deps.target);
  if (deps.target !== undefined && explicit === undefined) {
    return { ok: false, error: inputFailure(`No completed change named "${deps.target}".`).error };
  }
  const target = explicit ?? selectRetroTarget(changes, runs, deps.level);
  if (target === undefined) {
    const summary: RetroCollectSummary = {
      level: deps.level,
      outcome: "no-target",
      selection: selectionOf(undefined),
      counts: { collected: 0, malformed: 0, skippedSource: 0 },
    };
    return { ok: true, data: summary };
  }

  const seeded = deps.registry.seed(deps.newFenceToken());
  if (!seeded.ok) return { ok: false, error: seeded.error };

  const nowMs = deps.clock.nowMs();
  const window = windowFor(target, nowMs);
  const sources = deps.sources ?? [
    "audit-ledger",
    "phase-transitions",
    "closeout-outcomes",
    "commit-telemetry",
    "pm-notes",
  ];
  const runId = deps.newRunId();
  const collectedAt = nowMs;

  const auditRead = sources.includes("audit-ledger")
    ? deps.collectors.readAuditLedger({
        limit: RETRO_AUDIT_READ_LIMIT,
        from: window.start,
        to: window.end,
      })
    : undefined;
  if (auditRead !== undefined && !auditRead.ok) {
    return { ok: false, error: fromAuditFailure(auditRead.error) };
  }
  const audit = auditRead?.ok === true ? auditRead.value : undefined;
  const needsFamilies =
    sources.includes("phase-transitions") ||
    sources.includes("closeout-outcomes") ||
    sources.includes("commit-telemetry");
  const familiesRead = needsFamilies
    ? deps.collectors.readStateFamilies(target.changeRef)
    : { ok: true as const, value: { transitions: [], closeouts: [], telemetry: [] } };
  if (!familiesRead.ok) return { ok: false, error: familiesRead.error };
  const families = familiesRead.value;
  const notesRead = sources.includes("pm-notes")
    ? deps.collectors.readNotes(target.changeRef)
    : { ok: true as const, value: { retroNotes: [] } };
  if (!notesRead.ok) return { ok: false, error: notesRead.error };
  const notes = notesRead.value;

  const baseDrafts = collectorRecords(
    audit ??
      ({
        verifiedEmpty: true,
        records: [],
        matched: 0,
        truncated: false,
        chain: {
          verified: true,
          records: 0,
          breaks: [],
          orphans: [],
          storePath: deps.sidecar.evidencePath,
        },
        storePath: deps.sidecar.evidencePath,
      } satisfies AuditReadOutcome),
    families,
    notes.retroNotes,
    runId,
    deps.level,
    window,
    collectedAt,
    deps.identity,
  );
  const metadataSchemas: ReadonlySet<string> = new Set([
    RETRO_PAYLOAD_SCHEMAS.auditChain,
    RETRO_PAYLOAD_SCHEMAS.verifiedEmpty,
    RETRO_PAYLOAD_SCHEMAS.finding,
  ]);
  const collectedItems = baseDrafts.drafts.filter(
    (draft) => !metadataSchemas.has(draft.payloadSchemaId),
  ).length;

  const truth = evaluateRetroTruthChecks({
    ...(audit === undefined ? {} : { audit }),
    collected: collectedItems,
    completed: true,
    hasCloseout: families.closeouts.length > 0,
  });

  const followThroughDrafts =
    deps.readFollowThrough === undefined
      ? []
      : deps
          .readFollowThrough(target.changeRef)
          .map((entry) =>
            draftFor(
              runId,
              deps.level,
              "pm-notes",
              RETRO_PAYLOAD_SCHEMAS.followThrough,
              [
                `action:${entry.action}`,
                ...(entry.artifactRef === undefined ? [] : [`artifact:${entry.artifactRef}`]),
              ],
              { start: window.start, end: window.end },
              collectedAt,
              deps.identity,
            ),
          );

  const allDrafts = [
    ...baseDrafts.drafts,
    ...followThroughDrafts,
    ...findingDrafts(
      runId,
      (overrides) =>
        draftFor(
          runId,
          deps.level,
          overrides.source ?? "pm-notes",
          overrides.payloadSchemaId ?? RETRO_PAYLOAD_SCHEMAS.finding,
          overrides.payloadRefs ?? [],
          { start: window.start, end: window.end },
          collectedAt,
          deps.identity,
        ),
      truth,
      window,
      collectedAt,
    ),
  ];
  const appended = appendAll(
    deps,
    allDrafts.map((draft) =>
      deps.redact === undefined
        ? draft
        : { ...draft, payloadRefs: draft.payloadRefs.map((ref) => deps.redact?.(ref) ?? ref) },
    ),
    deps.level,
    window,
    collectedAt,
  );
  if (appended.error !== undefined) {
    return { ok: false, error: appended.error };
  }

  const counts: RetroRunCounts = {
    collected: collectedItems,
    malformed: 0,
    skippedSource: 0,
  };
  const run: RetroRunRecord = {
    schemaId: "delivery.retro.run.v1",
    runId,
    level: deps.level,
    mode: "collect",
    scope: target.changeRef,
    counts,
    consumed: baseDrafts.consumed,
    truth,
  };
  const recorded = deps.registry.recordRun(run, deps.newFenceToken());
  if (!recorded.ok) return { ok: false, error: recorded.error };

  const partial = `preserved evidence records: ${appended.records.map((record) => record.traceId).join(", ")}`;
  if (truth.blocking === "retro.evidence.tamper-flagged") {
    return {
      ok: false,
      error: {
        kind: "retro",
        code: "retro.evidence.tamper-flagged",
        consequence: "not_landed",
        summary: "the consumed audit-ledger chain failed verification (audit domain)",
      },
      partial,
    };
  }
  if (truth.blocking === "retro.truth.vacuous-run") {
    return {
      ok: false,
      error: {
        kind: "retro",
        code: "retro.truth.vacuous-run",
        consequence: "not_landed",
        summary: "the collection run executed and produced zero collector records",
      },
      partial,
    };
  }

  return {
    ok: true,
    data: {
      level: deps.level,
      outcome: "collected",
      selection: selectionOf(target),
      runId,
      counts,
      truth,
    },
  };
};

const payloadRefValue = (refs: readonly string[], prefix: string): string | undefined => {
  const found = refs.find((ref) => ref.startsWith(prefix));
  return found === undefined ? undefined : found.slice(prefix.length);
};

const recordsForRun = (
  records: readonly RetroEvidenceRecord[],
  runId: string,
): readonly RetroEvidenceRecord[] =>
  records.filter((record) => record.payloadRefs.includes(`run:${runId}`));

const findingsOf = (records: readonly RetroEvidenceRecord[]): readonly RetroFinding[] => {
  const findings: RetroFinding[] = [];
  for (const record of records) {
    if (record.payloadSchemaId === RETRO_PAYLOAD_SCHEMAS.retroNote) {
      const text = payloadRefValue(record.payloadRefs, "text:");
      if (text !== undefined) {
        findings.push({ kind: "retro-note", text, evidenceRefs: [record.traceId] });
      }
      continue;
    }
    if (record.payloadSchemaId !== RETRO_PAYLOAD_SCHEMAS.finding) continue;
    const kind = payloadRefValue(record.payloadRefs, "finding:");
    const text = payloadRefValue(record.payloadRefs, "text:");
    if (kind === undefined || text === undefined) continue;
    if (!(RETRO_FINDING_KINDS as readonly string[]).includes(kind)) continue;
    const refs = record.payloadRefs
      .filter((ref) => ref.startsWith("ref:"))
      .map((ref) => ref.slice("ref:".length));
    findings.push({
      kind: kind as RetroFinding["kind"],
      text,
      evidenceRefs: [record.traceId, ...refs],
    });
  }
  return findings;
};

const followThroughOf = (
  records: readonly RetroEvidenceRecord[],
  verifyArtifact: ((ref: string) => boolean) | undefined,
): readonly RetroFollowThroughEntry[] => {
  const entries: RetroFollowThroughEntry[] = [];
  for (const record of records) {
    if (record.payloadSchemaId !== RETRO_PAYLOAD_SCHEMAS.followThrough) continue;
    const action = payloadRefValue(record.payloadRefs, "action:");
    if (action === undefined) continue;
    const artifactRef = payloadRefValue(record.payloadRefs, "artifact:");
    if (artifactRef === undefined) {
      entries.push({ action, verdict: "unknown" });
      continue;
    }
    const verified = verifyArtifact?.(artifactRef) === true;
    entries.push({
      action,
      verdict: verified ? "verified" : "unverified",
      artifactRef,
    });
  }
  return entries;
};

const emptyReport = (level: RetroLevelName): RetroReportData => ({
  level,
  findings: [],
  followThrough: [],
  evidenceRefs: [],
});

/** Fold verified evidence and registry runs into the four-key report data. */
export const reportRetro = (deps: RetroReportDeps): RetroCommandOutcome => {
  const levelValidation = validateLevel(deps.level);
  if (!levelValidation.ok) return { ok: false, error: levelValidation.error };
  const sidecar = deps.sidecar.read();
  if (!sidecar.ok) return { ok: false, error: sidecar.error };
  if (sidecar.value.malformed.length > 0) {
    const first = sidecar.value.malformed[0];
    return {
      ok: false,
      error: {
        kind: "retro",
        code: "retro.evidence.malformed-entry",
        consequence: "not_landed",
        location: {
          ...(first === undefined ? {} : { position: first.position }),
          entriesProcessed: sidecar.value.chain.records,
          entriesPreserved: sidecar.value.records.length,
          ...(first === undefined ? {} : { firstFlaggedPosition: first.position }),
        },
        summary: "an evidence entry is malformed; valid entries were preserved",
      },
      partial: `preserved evidence records: ${sidecar.value.records.map((record) => record.traceId).join(", ")}`,
    };
  }
  if (!sidecar.value.chain.verified) {
    const first = sidecar.value.chain.breaks[0];
    return {
      ok: false,
      error: {
        kind: "retro",
        code: "retro.evidence.tamper-flagged",
        consequence: "not_landed",
        location: first === undefined ? {} : { position: first.position, traceId: first.traceId },
        summary: "the evidence sidecar chain failed verification",
      },
      partial: `preserved evidence records: ${sidecar.value.records.map((record) => record.traceId).join(", ")}`,
    };
  }

  const registry = deps.registry.read();
  if (!registry.ok) return { ok: false, error: registry.error };
  if (registry.value.malformed.length > 0) {
    const first = registry.value.malformed[0];
    return {
      ok: false,
      error: {
        kind: "retro",
        code: "retro.evidence.malformed-entry",
        consequence: "not_landed",
        location: {
          ...(first === undefined ? {} : { position: first.position }),
          entriesProcessed: registry.value.artifacts.length + registry.value.malformed.length,
          entriesPreserved: registry.value.artifacts.length,
          ...(first === undefined ? {} : { firstFlaggedPosition: first.position }),
        },
        summary: "a retro registry entry is malformed; valid entries were preserved",
      },
    };
  }
  const runs = deps.registry.runs(registry.value).filter((run) => run.level === deps.level);
  const run = runs[runs.length - 1];
  if (run === undefined) return { ok: true, data: emptyReport(deps.level) };

  const selected = recordsForRun(sidecar.value.records, run.runId);
  const findings = findingsOf(selected);
  const known = new Set(sidecar.value.records.map((record) => record.traceId));
  // C-03 is live on the production fold: every folded finding's evidence refs
  // must resolve to a known trace id; consumer-declared refs are checked too.
  const referenced = new Set<string>();
  for (const ref of deps.extraReferencedTraceIds ?? []) referenced.add(ref);
  for (const finding of findings) for (const ref of finding.evidenceRefs) referenced.add(ref);
  const dangling = [...referenced].filter((ref) => !known.has(ref));
  const withDangling =
    dangling.length === 0
      ? findings
      : [
          ...findings,
          ...dangling.map((ref) => ({
            kind: "truth-check" as const,
            text: `dangling evidence ref ${ref}`,
            evidenceRefs: [],
          })),
        ];
  const sortedFindings = [...withDangling].sort((left, right) =>
    left.kind === right.kind
      ? left.text < right.text
        ? -1
        : left.text > right.text
          ? 1
          : 0
      : left.kind < right.kind
        ? -1
        : 1,
  );
  const followThrough = [...followThroughOf(selected, deps.verifyArtifact)].sort((left, right) =>
    left.action < right.action ? -1 : left.action > right.action ? 1 : 0,
  );
  const evidenceRefs = selected.map((record) => record.traceId);
  const data: RetroReportData = {
    level: deps.level,
    findings: sortedFindings,
    followThrough,
    evidenceRefs,
  };
  return { ok: true, data };
};

/** One export outcome: the bundle, or a classified refusal before any write. */
export type RetroExportOutcome =
  | { readonly ok: true; readonly bundle: RetroExportBundle; readonly content: string }
  | { readonly ok: false; readonly error: RetroFailure };

/** The bounded deterministic export engine surface (library only). */
export const exportRetroEvidence = (deps: RetroExportDeps): RetroExportOutcome => {
  if (typeof deps.destination !== "string" || deps.destination.length === 0) {
    return { ok: false, error: inputFailure("an explicit export destination is required").error };
  }
  if (!Number.isInteger(deps.limit) || deps.limit < 1 || deps.limit > RETRO_EXPORT_MAX_LIMIT) {
    return {
      ok: false,
      error: inputFailure(
        `export limit must be an integer between 1 and ${String(RETRO_EXPORT_MAX_LIMIT)}`,
      ).error,
    };
  }
  const read = deps.sidecar.read();
  if (!read.ok) return { ok: false, error: read.error };
  if (read.value.malformed.length > 0) {
    const first = read.value.malformed[0];
    return {
      ok: false,
      error: {
        kind: "retro",
        code: "retro.evidence.malformed-entry",
        consequence: "not_landed",
        location: {
          ...(first === undefined ? {} : { position: first.position }),
          entriesProcessed: read.value.chain.records,
          entriesPreserved: read.value.records.length,
        },
        summary: "an evidence entry is malformed; valid entries were preserved",
      },
    };
  }
  if (!read.value.chain.verified) {
    const first = read.value.chain.breaks[0];
    return {
      ok: false,
      error: {
        kind: "retro",
        code: "retro.evidence.tamper-flagged",
        consequence: "not_landed",
        location: first === undefined ? {} : { position: first.position, traceId: first.traceId },
        summary: "the evidence sidecar chain failed verification",
      },
    };
  }
  const truncated = read.value.records.length > deps.limit;
  const records = read.value.records.slice(0, deps.limit);
  const bundle: RetroExportBundle = {
    schemaId: RETRO_EXPORT_SCHEMA,
    level: deps.level,
    limit: deps.limit,
    truncated,
    chain: read.value.chain,
    records,
  };
  const serialized = JSON.stringify(bundle);
  const content = deps.redact === undefined ? serialized : deps.redact(serialized);
  try {
    deps.write(deps.destination, content);
  } catch {
    return {
      ok: false,
      error: {
        kind: "state",
        code: "state.write.failed",
        consequence: "not_landed",
        location: { path: deps.destination },
      },
    };
  }
  return { ok: true, bundle, content };
};

/** Structural refusal for a write attempted outside the collector seam. */
export const attemptOutOfSeamEvidenceWrite = (): {
  readonly ok: false;
  readonly error: RetroFailure;
} => ({
  ok: false,
  error: {
    kind: "retro",
    code: "retro.evidence.denied",
    consequence: "not_landed",
    summary:
      "evidence writes are collector-owned; a write outside the collector seam is refused (write-path ownership, claimed identity marking — not authentication)",
  },
});

/** Record a memory-audit run through the collector seam as evidence (F-9). */
export const recordMemoryAuditRun = (
  deps: {
    readonly sidecar: RetroSidecarPort;
    readonly newTraceId: () => string;
    readonly newFenceToken: () => string;
    readonly clock: { readonly nowMs: () => number };
    readonly level: RetroLevelName;
  },
  input: {
    readonly triggerIdentity: string;
    readonly windowStart: number;
    readonly windowEnd: number;
    readonly outcomeRefs: readonly string[];
    readonly identity?: RetroClaimedIdentity;
    readonly runId?: string;
  },
): RetroResult<readonly RetroEvidenceRecord[]> => {
  const collectedAt = deps.clock.nowMs();
  const drafts: RetroEvidenceDraft[] = input.outcomeRefs.map((outcomeRef) => ({
    traceId: deps.newTraceId(),
    level: deps.level,
    source: "memory-audit",
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    collectedAt,
    ...(input.identity === undefined ? {} : { collectorIdentity: input.identity }),
    payloadRefs: [
      ...(input.runId === undefined ? [] : [`run:${input.runId}`]),
      `trigger:${input.triggerIdentity}`,
      `outcome:${outcomeRef}`,
    ],
    payloadSchemaId: RETRO_PAYLOAD_SCHEMAS.memoryAudit,
  }));
  return deps.sidecar.appendBatch(drafts, { fenceToken: deps.newFenceToken() });
};

/** The declared target ordering constant (asserted by contract tests). */
export const RETRO_TARGET_SELECTION_ORDER = RETRO_TARGET_ORDER;

/** The report schema identity re-exported for engine consumers. */
export const RETRO_ENGINE_REPORT_SCHEMA = RETRO_REPORT_SCHEMA;

/** The default level re-exported for engine consumers. */
export const RETRO_ENGINE_DEFAULT_LEVEL = RETRO_DEFAULT_LEVEL;

/** The chain anchor re-exported for engine consumers. */
export const RETRO_ENGINE_CHAIN_ANCHOR = RETRO_CHAIN_ANCHOR;

/** The evidence schema re-exported for engine consumers. */
export const RETRO_ENGINE_EVIDENCE_SCHEMA = RETRO_EVIDENCE_PAYLOAD_SCHEMA;

/** The declared truth checks re-exported for engine consumers. */
export const RETRO_ENGINE_TRUTH_CHECKS = RETRO_TRUTH_CHECKS;
