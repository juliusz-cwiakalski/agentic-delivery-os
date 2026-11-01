/**
 * TC-SCAFFOLD-006 / TC-BRANDING-022 — the committed source inventory equals the
 * actual file set, and executable content is allowed only per an explicit,
 * per-file allowlist (never a global switch).
 */
import { expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const PACKAGE_NAMES = ["core", "adapters", "cli", "mcp", "opencode", "testkit"];
const inventory = JSON.parse(
  readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
) as Record<string, string[]>;

/**
 * Per-file executable allowances. The value lists the only executable exports a
 * file may declare; internal helpers are permitted inside an allowed file.
 */
const EXECUTABLE_ALLOWANCES: Record<string, string[]> = {
  "core/src/branding/index.ts": ["resolveBrandIdentity"],
  "core/src/contracts/error-table.ts": [
    "DOMAIN_KINDS",
    "ERROR_TABLE",
    "FALLBACK_INTERNAL_CODE",
    "FALLBACK_INVOCATION_CODE",
  ],
  "core/src/contracts/delivery-result.ts": [
    "DELIVERY_RESULT_DERIVATION_CLASSES",
    "DELIVERY_RESULT_PROJECTION_CLASSES",
    "DELIVERY_RESULT_TAXONOMY",
    "DELIVERY_RESULT_TOKENS",
  ],
  "core/src/contracts/result.ts": ["RESULT_SCHEMA_VERSION"],
  "core/src/contracts/adapter-capabilities.ts": ["ADAPTER_OPERATIONS", "CARRIER_KINDS"],
  "core/src/contracts/closeout.ts": [
    "BLOCKED_LABEL",
    "CHANGE_LABEL",
    "CLOSEOUT_APPLY_OUTCOMES",
    "CLOSEOUT_GAP_REASONS",
    "CLOSEOUT_INTEGRATION_BASE",
    "CLOSEOUT_MAX_DEPENDENTS",
    "CLOSEOUT_MAX_HUMAN_BYTES",
    "CLOSEOUT_MAX_HUMAN_LINES",
    "CLOSEOUT_MAX_MACHINE_BYTES",
    "CLOSEOUT_MAX_THREADS",
    "CLOSEOUT_OPERATION_NAMES",
    "CLOSEOUT_OPERATION_PAYLOAD_SCHEMA",
    "CLOSEOUT_OPERATION_RECORD_KIND",
    "CLOSEOUT_OPERATION_TIMEOUT_MS",
    "CLOSEOUT_PLAN_OUTCOMES",
    "CLOSEOUT_READ_OBSERVATIONS",
    "CLOSEOUT_REVERSE_DEPENDENT_OBSERVATIONS",
    "CLOSEOUT_SCHEMA_ID",
    "CLOSEOUT_STEP_IDS",
    "DELIVERED_LABEL",
    "LIFECYCLE_LABEL_DISPOSITIONS",
    "OWNER_ATTENTION_LABEL",
    "PROTECTED_REF_NAMES",
  ],

  "core/src/contracts/envelope.ts": [
    "DEGRADATION_REASONS",
    "ENVELOPE_KINDS",
    "ENVELOPE_MAX_BYTES",
    "ENVELOPE_SCHEMA_ID",
  ],
  "core/src/contracts/pm-notes.ts": [
    "CANONICAL_PHASE_IDS",
    "LITE_REQUIRED_PHASES",
    "PM_NOTES_COLLECTION_KEYS",
    "PM_NOTES_DEFAULT_VARIANT",
    "PM_NOTES_LINT_CODES",
    "PM_NOTES_OPTIONAL_STRING_KEYS",
    "PM_NOTES_REQUIRED_PHASES_BY_VARIANT",
    "PM_NOTES_REQUIRED_TOP_LEVEL_KEYS",
    "PM_NOTES_VARIANT_VALUES",
  ],
  "core/src/contracts/registry.ts": [
    "PHASE_STATE_DOCUMENT_NAME_PATTERN",
    "PHASE_STATE_DOCUMENT_PREFIX",
    "PHASE_STATE_DOCUMENT_SUFFIX",
    "PHASE_TRANSITION_KIND",
    "REGISTRY_SCHEMA_VERSION",
  ],
  "core/src/contracts/state.ts": ["STATE_DRIVER_KINDS", "STATE_LEVELS", "STATE_SCHEMA_VERSION"],
  "core/src/contracts/session.ts": [
    "DB_SCHEMA_VERSION",
    "DB_COMMANDS",
    "DB_MODES",
    "DB_LIVE_WINDOW_MINUTES",
    "DB_DEFAULT_OLDER_THAN_DAYS",
    "DB_MIN_OLDER_THAN_DAYS",
    "DB_MAX_OLDER_THAN_DAYS",
    "DB_DEFAULT_LIST_LIMIT",
    "DB_MAX_LIST_LIMIT",
    "DB_DEFAULT_PRUNE_LIMIT",
    "DB_MAX_PRUNE_LIMIT",
    "DB_MIN_LIMIT",
    "DB_MAX_ID_CHARS",
    "DB_MAX_TIMESTAMP_CHARS",
    "DB_MAX_PATH_CHARS",
    "DB_MAX_HUMAN_ITEMS",
    "DB_MAX_HUMAN_LINES",
    "DB_MAX_HUMAN_BYTES",
    "DB_MAX_MACHINE_BYTES",
    "DB_SESSION_ID_PATTERN",
    "DB_QUERY_TIMEOUT_MS",
    "DB_DELETE_TIMEOUT_MS",
    "DB_CHECKPOINT_TIMEOUT_MS",
  ],
  "core/src/domain/sha256.ts": ["sha256Hex"],
  "core/src/domain/closeout.ts": [
    "boundCloseoutData",
    "buildCloseoutPlan",
    "canonicalCloseoutJson",
    "closeoutStepDefinitions",
    "deriveCloseoutOperationId",
    "evaluateBranchSafety",
    "foldCloseoutOutcomes",
    "isProtectedRef",
    "renderCloseoutHuman",
    "resolveCloseoutBaseRef",
    "runCloseout",
    "selectMatchingBranch",
    "summarizeCloseout",
  ],
  "core/src/domain/session-admin.ts": [
    "computeDbCutoffMs",
    "computeDbLiveBoundaryMs",
    "isLiveDbSession",
    "classifyPruneCandidate",
    "selectPruneCandidates",
    "renderSessionAdminHuman",
  ],
  "core/src/domain/pm-notes-lint.ts": ["lintPmNotes"],
  "core/src/domain/verify-change.ts": [
    "classifyVerifyChange",
    "classifyVerifyDocument",
    "formatVerifySummary",
  ],
  "core/src/contracts/queue-ready.ts": [
    "QUEUE_READY_ASSOCIATED_COUNT_RANGE",
    "QUEUE_READY_BRANCH_SEGMENT_MIN",
    "QUEUE_READY_CLOSE_CLASSES",
    "QUEUE_READY_CONDITION_ORDER",
    "QUEUE_READY_CONDITION_STATES",
    "QUEUE_READY_EVIDENCE_REASONS",
    "QUEUE_READY_EVIDENCE_SOURCES",
    "QUEUE_READY_MAX_BRANCH_CHARS",
    "QUEUE_READY_MAX_CANDIDATES",
    "QUEUE_READY_MAX_DETAIL_CHARS",
    "QUEUE_READY_MAX_EVIDENCE_PER_CONDITION",
    "QUEUE_READY_MAX_HUMAN_BYTES",
    "QUEUE_READY_MAX_HUMAN_LINES",
    "QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES",
    "QUEUE_READY_MAX_IDENTITY_CHARS",
    "QUEUE_READY_MAX_LABELS",
    "QUEUE_READY_MAX_LABEL_CHARS",
    "QUEUE_READY_MAX_MACHINE_BYTES",
    "QUEUE_READY_MAX_OWNER_CHARS",
    "QUEUE_READY_MAX_POSITIONALS",
    "QUEUE_READY_MAX_REASONS",
    "QUEUE_READY_MAX_REF_CHARS",
    "QUEUE_READY_MAX_RELATIONS",
    "QUEUE_READY_MAX_REPO_NAME_CHARS",
    "QUEUE_READY_MAX_TIMESTAMP_CHARS",
    "QUEUE_READY_MAX_WORK_ITEM_REF_CHARS",
    "QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN",
    "QUEUE_READY_OWNER_ATTENTION_LABELS",
    "QUEUE_READY_PAYLOAD_MARKER_REASONS",
    "QUEUE_READY_RANK_CLASS_ORDER",
    "QUEUE_READY_REASON_ORDER",
    "QUEUE_READY_SCHEMA_VERSION",
    "QUEUE_READY_SOURCE_FAILURE_REASONS",
    "QUEUE_READY_SOURCE_ITEM_LIMIT",
    "QUEUE_READY_SOURCE_PIPELINE_LIMIT",
    "QUEUE_READY_TIER_LABELS",
    "QUEUE_READY_WORK_ITEM_REF_PATTERN",
  ],
  "core/src/domain/ci-result.ts": ["classifyPipelineRuns"],
  "core/src/domain/queue-ready.ts": ["evaluateQueueReady", "renderQueueReadyHuman"],
  "core/src/domain/status.ts": ["aggregateStatus", "renderStatusHuman"],
  "core/src/state/index.ts": ["createStateStore"],
  "core/src/state/closeout.ts": [
    "CLOSEOUT_OPERATION_RECORD_KEY_PREFIX",
    "appendCloseoutOutcome",
    "closeoutOperationRecordKey",
    "foldCloseoutHistory",
    "readCloseoutHistory",
  ],
  "core/src/state/registry.ts": [
    "PHASE_TRANSITION_RECORD_KEY_PREFIX",
    "appendPhaseTransition",
    "foldPhaseState",
    "phaseStateDocumentName",
    "phaseTransitionRecordKey",
    "readChangeTransitions",
    "readChangeTransitionsTolerant",
    "rebuildPhaseProjection",
    "replacePhaseProjection",
  ],
  "core/src/state/ledger.ts": [
    "CHECKSUM_HEX_LENGTH",
    "RECORD_FIELDS",
    "buildRecord",
    "checksumOfPayload",
    "parseRecordLine",
    "serializeRecord",
    "valuesFromRecords",
    "verifiedPrefixLength",
    "verifyLedger",
  ],
  "core/src/state/driver/runtime-edge.ts": ["createNodeStateEdge", "hasForeignAclGrant"],
  "core/src/state/driver/strategy.ts": ["createJsonlStrategy", "createSqliteStrategy"],
  "cli/src/classify.ts": ["classifyDomainKind", "classifyThrown", "resolveAppErrorCode"],
  "cli/src/commands/config.ts": ["createConfigCommandDefinition"],
  "cli/src/commands/closeout.ts": ["createCloseoutCommandDefinition"],
  "cli/src/commands/db.ts": ["createDbCommandDefinition"],
  "cli/src/commands/index.ts": [
    "createCloseoutCommandDefinition",
    "createConfigCommandDefinition",
    "createDbCommandDefinition",
    "createLintCommandDefinition",
    "createPhaseCommandDefinition",
    "createStatusCommandDefinition",
    "createVerifyCommandDefinition",
  ],
  "cli/src/commands/status.ts": ["collectStatusFacts", "createStatusCommandDefinition"],
  "cli/src/commands/lint.ts": ["createLintCommandDefinition"],
  "cli/src/commands/phase.ts": ["createPhaseCommandDefinition"],
  "cli/src/commands/provider.ts": ["createProviderCommandDefinition"],
  "cli/src/commands/queue.ts": ["createQueueReadyCommandDefinition"],
  "cli/src/commands/verify.ts": ["createVerifyCommandDefinition"],
  "cli/src/edge.ts": [
    "createProductionDependencies",
    "registerEdgeSecrets",
    "readShippedDefaultsManifest",
    "createConfigProgram",
    "createCloseoutCommandRuntime",
    "createCloseoutComposition",
    "createCloseoutStateRuntime",
    "createDbCommandRuntime",
    "createPhaseCommandRuntime",
    "createRegistryLintReader",
    "createStatusCommandRuntime",
    "createVerifyCommandRuntime",
  ],
  "cli/src/index.ts": ["runCli"],
  "cli/src/output/serialize.ts": ["redact", "serializeEnvelope", "writeOutput"],
  "cli/src/projection.ts": ["projectExitCode"],
  "testkit/src/result-conformance.ts": ["assertEnvelopeContract", "RULES", "loadGoldenCases"],
  "testkit/src/conformance/artifact.ts": [
    "CONFORMANCE_FLOW_STATUSES",
    "CONFORMANCE_LIMITS",
    "CONFORMANCE_PROVIDER_STATUSES",
    "CONFORMANCE_SCHEMA_ID",
    "CONFORMANCE_SKIP_KINDS",
    "CONFORMANCE_STATUSES",
    "CONFORMANCE_STEP_STATUSES",
    "CONFORMANCE_TIERS",
    "CONFORMANCE_TRUNCATION_MARKER",
    "serializeConformanceArtifact",
    "toConformanceArtifact",
    "validateConformanceArtifact",
  ],
  "testkit/src/conformance/flows.ts": ["CONFORMANCE_FLOWS", "findFlow"],
  "testkit/src/conformance/adapters.ts": ["CONFORMANCE_ADAPTERS"],
  "testkit/src/conformance/mock-tenant.ts": ["createMockTenantTransport", "decodeMockTenant"],
  "testkit/src/conformance/runner.ts": ["runConformance"],
  "testkit/src/conformance/coverage.ts": [
    "LIVE_READ_OPERATIONS",
    "runtimeCoverageViolations",
    "structuralCoverageViolations",
  ],
  "core/src/contracts/provider.ts": [
    "ANNOUNCEMENT_CODES",
    "ANNOUNCEMENT_EVIDENCE_FIELDS",
    "ANNOUNCEMENT_SEVERITIES",
    "DEFAULT_MAX_SLEEP_LOOPS",
    "PARK_CAUSES",
    "PARK_EVIDENCE_FIELDS",
    "PROVIDER_ANNOUNCEMENT_RECORD_KEY",
    "PROVIDER_ANNOUNCEMENT_SCHEMA_ID",
    "PROVIDER_CONDITION_KINDS",
    "PROVIDER_CONDITION_TIE_ORDER",
    "PROVIDER_COST_CLASSES",
    "PROVIDER_EVIDENCE_MAX_BYTES",
    "PROVIDER_EVIDENCE_MAX_FIELDS",
    "PROVIDER_PARK_RECORD_KEY",
    "PROVIDER_PARK_SCHEMA_ID",
    "PROVIDER_PARK_STATES",
    "PROVIDER_PARKS_DOCUMENT_NAME",
    "PROVIDER_PARKS_PROJECTION_SCHEMA_ID",
    "PROVIDER_PEAK_TIMEZONES",
    "PROVIDER_QUOTA_DEFAULTS",
    "PROVIDER_RECORD_KINDS",
    "PROVIDER_SKIP_REASONS",
  ],
  "core/src/provider/announcements.ts": [
    "announcementCodeForCondition",
    "createParkAnnouncement",
    "createResumedAnnouncement",
    "severityForAnnouncementCode",
  ],
  "core/src/provider/chain.ts": ["resolveProviderChain"],
  "core/src/provider/engine.ts": ["createProviderEngine"],
  "core/src/provider/conditions.ts": ["combineProviderConditions"],
  "core/src/provider/parks.ts": [
    "announcementEvidence",
    "announcementIdentity",
    "chainParkName",
    "clearParkRecord",
    "compareParks",
    "createAnnouncementRecord",
    "createParkRecord",
    "foldParks",
    "formatUtcIso",
    "parkGeneration",
    "parkView",
    "persistProviderResolution",
    "projectParkEvidence",
    "providerParkName",
    "providerParksProjection",
    "readProviderLedger",
    "readProviderParkViews",
  ],
  "core/src/provider/peak.ts": ["evaluatePeakWindow", "utcSecondsOfDay"],
  "core/src/provider/loop.ts": ["runProviderLoop"],
  "core/src/provider/quota.ts": [
    "classifyQuotaTransport",
    "evaluateQuotaResponse",
    "evaluateQuotaSnapshot",
    "normalizeQuotaEnvelopeResult",
  ],
  "core/src/provider/validate.ts": [
    "parseAndValidateProviderConfiguration",
    "parseProviderConfiguration",
    "selectProviderChain",
    "validateProviderConfiguration",
  ],
  "core/src/contracts/config.ts": ["CONFIG_LAYERS"],
  "core/src/contracts/status.ts": [
    "STATUS_CI_RESULTS",
    "STATUS_DEPENDENCY_STATES",
    "STATUS_EVIDENCE_OUTCOMES",
    "STATUS_EVIDENCE_REASONS",
    "STATUS_EVIDENCE_SOURCES",
    "STATUS_HYGIENE_FINDINGS",
    "STATUS_MAX_DETAIL_CHARS",
    "STATUS_MAX_EVIDENCE_SOURCES",
    "STATUS_MAX_HUMAN_BYTES",
    "STATUS_MAX_HUMAN_LINES",
    "STATUS_MAX_ITEMS_PER_SECTION",
    "STATUS_MAX_MACHINE_BYTES",
    "STATUS_MAX_OPEN_PULL_REQUESTS",
    "STATUS_MAX_PARKED_CHANGES",
    "STATUS_MAX_PIPELINE_RUNS",
    "STATUS_MAX_PROVIDER_ENTRIES",
    "STATUS_MAX_PROVIDER_PARKS",
    "STATUS_MAX_REASONS",
    "STATUS_MAX_TITLE_CHARS",
    "STATUS_MAX_TRACKER_FAMILY_ITEMS",
    "STATUS_OWNER_ATTENTION_LABELS",
    "STATUS_PARKED_ITEM_STATES",
    "STATUS_PROVIDER_AVAILABILITY",
    "STATUS_PROVIDER_CHAIN_STATES",
    "STATUS_SCHEMA_VERSION",
    "STATUS_SECTION_ORDER",
    "STATUS_SECTION_STATES",
    "STATUS_SECTION_TITLES",
    "STATUS_SOURCE_ITEM_LIMIT",
    "STATUS_SOURCE_PIPELINE_LIMIT",
    "STATUS_STALL_STATES",
    "STATUS_STALL_THRESHOLD_DAYS",
    "STATUS_TRACKER_FAMILIES",
    "STATUS_TRACKER_FAMILY_STATES",
  ],
  "core/src/config/catalog.ts": [
    "BOOTSTRAP_DESCRIPTOR",
    "PRODUCTION_CATALOG",
    "fieldAt",
    "catalogPaths",
  ],
  "core/src/config/defaults.ts": ["PRODUCTION_DEFAULTS", "defaultsFor"],
  "core/src/config/provenance.ts": ["descendants", "removeOrigins", "copyOrigins", "originLabel"],
  "core/src/config/resolver.ts": ["resolveConfig"],
  "core/src/config/schema.ts": [
    "generateConfigSchema",
    "PRODUCTION_SCHEMA",
    "compileTrustedSchema",
    "invalidKey",
    "serializeProductionSchema",
  ],
  "adapters/src/session/index.ts": [
    "createOpencodeSessionIo",
    "createSessionStore",
    "createSessionAdmin",
  ],
  "adapters/src/credentials/index.ts": [
    "createEnvironmentCredentialPort",
    "createProcessCredentialPort",
    "resolveCredentialSourceKey",
  ],
  "adapters/src/file/pm-notes-parser.ts": [
    "nodePmNotesFileSystemFacts",
    "parsePmNotesText",
    "readPmNotesTarget",
    "readPmNotesText",
    "stagePmNotesPhaseEntry",
  ],
  "adapters/src/file/config-source.ts": [
    "acquireFileConfig",
    "neutralEnvironmentFacts",
    "nodeFileSystemFacts",
    "runtimePlatform",
  ],
  "adapters/src/file/yaml-parser.ts": ["parseConfigYaml", "parserHostSwitchBlocked"],
  "adapters/src/io/envelope-content-policy.ts": ["buildEnvelopeContentPolicy"],
  "adapters/src/io/envelope-codec.ts": [
    "ENVELOPE_FIELD_NAME",
    "isClosedV1Payload",
    "parseEnvelope",
    "readRawCarrier",
    "serializeEnvelope",
    "stripEnvelope",
  ],
  "adapters/src/io/privacy-rules.ts": [
    "PRIVACY_CAPS",
    "PRIVACY_FINGERPRINT_DOMAIN",
    "PRIVACY_HASH_DOMAIN",
    "PRIVACY_MAX_LITERAL_LENGTH",
    "PRIVACY_RULES",
    "PRIVACY_RULE_IDS",
    "PRIVACY_SUPPRESSION_CLASSES",
    "findWindowMatches",
    "matchGenericRules",
    "normalizeLiteral",
    "privacyDigestInput",
    "privacyFingerprint",
    "suppressionClassFor",
  ],
  "adapters/src/io/provider-transport.ts": ["providerPayloadFailure"],
  "adapters/src/provider-quota/index.ts": ["createProviderQuotaTransport"],
  "adapters/src/jira/capabilities.ts": ["JIRA_ADAPTER_CONTRACT"],
  "adapters/src/jira/client.ts": ["createJiraClient"],
  "adapters/src/jira/custom-fields.ts": ["JIRA_CUSTOM_FIELD_MAPPINGS", "applyJiraCustomFields"],
  "adapters/src/jira/index.ts": ["createJiraClient", "JIRA_ADAPTER_CONTRACT"],
  "adapters/src/jira/normalize.ts": [
    "computeJiraLabelTargetSet",
    "jiraNativeLabels",
    "normalizeJiraDependentObservation",
    "normalizeJiraIssue",
    "normalizeJiraSearch",
    "normalizeJiraWorkItemObservation",
    "jiraNormalizationContext",
  ],
  "adapters/src/github/capabilities.ts": ["GITHUB_ADAPTER_CONTRACT"],
  "adapters/src/github/client.ts": ["createGitHubClient"],
  "adapters/src/github/index.ts": ["createGitHubClient", "GITHUB_ADAPTER_CONTRACT"],
  "adapters/src/github/normalize.ts": [
    "normalizeCheckRuns",
    "normalizeGithubIssue",
    "normalizeGithubIssueList",
    "normalizeGithubPullList",
    "normalizeIssueDependencies",
    "normalizeMergedDeliveryRequestList",
    "normalizePullRequest",
    "normalizeReviewThreads",
    "normalizeThreadResolution",
    "normalizeWorkItemObservation",
  ],
  "adapters/src/github/review-state.ts": [
    "GITHUB_REVIEW_DECISION_STATES",
    "GITHUB_UNKNOWN_REVIEW_DECISION_FALLBACK",
    "GITHUB_WORK_ITEM_STATUS_MAP",
    "resolveGithubReviewState",
    "workItemStatusFor",
  ],
  "adapters/src/gitlab/capabilities.ts": ["GITLAB_ADAPTER_CONTRACT"],
  "adapters/src/gitlab/client.ts": ["createGitLabClient"],
  "adapters/src/gitlab/index.ts": ["createGitLabClient", "GITLAB_ADAPTER_CONTRACT"],
  "adapters/src/gitlab/merge-status.ts": [
    "GITLAB_MERGE_STATUS_RULES",
    "createGitLabReviewStateResolver",
    "resolveGitLabReviewState",
  ],
  "adapters/src/gitlab/normalize.ts": ["normalizeMergeRequest", "normalizePipelines"],
  "adapters/src/jira/workflow-map.ts": [
    "JIRA_WORKFLOW_MAP",
    "nativeStatusForDeliveryState",
    "validateWorkflowMap",
    "stateMappingFor",
  ],
  "adapters/src/git/index.ts": ["createGitBranchSeam"],
  "adapters/src/repo/index.ts": [
    "findGitRoot",
    "nodeRepositoryIo",
    "parseGitHubRemote",
    "readRepositoryFacts",
    "resolveRepositoryRoot",
  ],
  "adapters/src/file/pm-context.ts": ["readLocalPmContext"],
  "adapters/src/legacy/index.ts": [
    "createLegacyCompat",
    "resolveProcessLegacy",
    "resolveProcessLegacyFromEnvironment",
  ],
};

const listTypeScriptFiles = (packageDir: string): string[] => {
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(packageDir, relative), { withFileTypes: true })) {
      const next = relative.length > 0 ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) results.push(next);
    }
  };
  walk("");
  return results.sort();
};

const ALLOWED_TYPES_ONLY = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.EndOfFileToken,
]);

const isExported = (node: ts.Node): boolean =>
  ((node as { modifiers?: readonly ts.Modifier[] }).modifiers ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );

export const executableViolations = (
  root: string,
  packageName: string,
  relative: string,
): string[] => {
  const file = join(root, "packages", packageName, relative);
  const label = `${packageName}/${relative}`;
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const allowance = EXECUTABLE_ALLOWANCES[`${packageName}/${relative}`];
  const violations: string[] = [];

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      const named = statement.name?.text ?? "<anonymous>";
      const exported = isExported(statement);
      if (allowance) {
        if (exported && !allowance.includes(named)) {
          violations.push(`${label}: undeclared executable export ${named}`);
        }
        continue;
      }
      if (!exported || named !== "createRuntime" || statement.body) {
        violations.push(
          `${label}: ${named === "createRuntime" ? "createRuntime must be an exported declaration without a body" : `unexpected executable function ${named}`}`,
        );
      }
      continue;
    }

    if (allowance) {
      if (ts.isVariableStatement(statement)) {
        if (isExported(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            const name = ts.isIdentifier(declaration.name)
              ? declaration.name.text
              : declaration.name.getText(source);
            if (!allowance.includes(name)) {
              violations.push(`${label}: undeclared executable export ${name}`);
            }
          }
        }
        continue;
      }
      if (!ALLOWED_TYPES_ONLY.has(statement.kind)) {
        violations.push(
          `${label}: executable statement ${ts.SyntaxKind[statement.kind]} is not permitted`,
        );
      }
      continue;
    }

    if (!ALLOWED_TYPES_ONLY.has(statement.kind)) {
      violations.push(
        `${label}: executable statement ${ts.SyntaxKind[statement.kind]} is not permitted at scaffold`,
      );
    }
  }
  return violations;
};

test("actual source file set equals the committed inventory", () => {
  const failures: string[] = [];
  for (const packageName of PACKAGE_NAMES) {
    const actual = listTypeScriptFiles(join(ROOT, "packages", packageName));
    const expected = [...(inventory[packageName] ?? [])].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(
        `${packageName}: inventory ${JSON.stringify(expected)} != actual ${JSON.stringify(actual)}`,
      );
    }
  }
  expect(failures).toEqual([]);
});

test("executable content is limited to the per-file allowlist", () => {
  const violations: string[] = [];
  for (const packageName of PACKAGE_NAMES) {
    for (const relative of inventory[packageName] ?? []) {
      violations.push(...executableViolations(ROOT, packageName, relative));
    }
  }
  expect(violations).toEqual([]);
});

const makeTempFile = (packageName: string, relative: string, content: string): string => {
  const root = mkdtempSync(join(tmpdir(), "inventory-"));
  const path = join(root, "packages", packageName, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return root;
};

test("an undeclared executable function in a types-only file fails", () => {
  const root = makeTempFile(
    "core",
    "src/domain/index.ts",
    "export function rogue(): number {\n  return 1;\n}\n",
  );
  try {
    const violations = executableViolations(root, "core", "src/domain/index.ts");
    expect(violations.some((message) => message.includes("rogue"))).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a second executable export in branding fails", () => {
  const branding = readFileSync(join(ROOT, "packages/core/src/branding/index.ts"), "utf8");
  const root = makeTempFile(
    "core",
    "src/branding/index.ts",
    `${branding}\nexport const extraHelper = () => 1;\n`,
  );
  try {
    const violations = executableViolations(root, "core", "src/branding/index.ts");
    expect(violations.some((message) => message.includes("extraHelper"))).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Scaffold-stage marker guard. The state driver edge is the one sanctioned
 * runtime home for a built-in SQLite binding (GH-174 TDR-0004); every other
 * file and every third-party engine dependency stays forbidden.
 */
const RUNTIME_ENGINE_ALLOWED = ["core/src/state/driver/runtime-edge.ts"];
const FORBIDDEN_DEPENDENCY = /sqlite|confluence|@opencode-ai\/|cliffy|^commander$|^yargs$/i;
const FORBIDDEN_MARKERS = [
  "node:sqlite",
  "better-sqlite3",
  ".mcpb",
  "registerCommand",
  "program.command(",
];

export const engineMarkerViolations = (root: string, files: Record<string, string[]>): string[] => {
  const violations: string[] = [];
  for (const packageName of PACKAGE_NAMES) {
    if (!existsSync(join(root, "packages", packageName, "package.json"))) continue;
    const manifest = JSON.parse(
      readFileSync(join(root, "packages", packageName, "package.json"), "utf8"),
    ) as Record<string, Record<string, string> | undefined>;
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        if (FORBIDDEN_DEPENDENCY.test(dependency)) {
          violations.push(
            `${packageName}: forbidden scaffold dependency ${dependency} in ${field}`,
          );
        }
      }
    }
    for (const relative of files[packageName] ?? []) {
      const label = `${packageName}/${relative}`;
      const allowed = RUNTIME_ENGINE_ALLOWED.includes(label);
      const content = readFileSync(join(root, "packages", packageName, relative), "utf8");
      for (const marker of FORBIDDEN_MARKERS) {
        if (marker === "node:sqlite" && allowed) continue;
        if (content.includes(marker)) violations.push(`${label}: forbidden marker ${marker}`);
      }
    }
  }
  return violations;
};

test("no engine, driver, or command-registration markers exist", () => {
  expect(engineMarkerViolations(ROOT, inventory)).toEqual([]);
});

test("the runtime-engine exemption is path-scoped to the state driver edge", () => {
  const root = mkdtempSync(join(tmpdir(), "engine-probe-"));
  try {
    mkdirSync(join(root, "packages/core/src/state/driver"), { recursive: true });
    writeFileSync(join(root, "packages/core/package.json"), JSON.stringify({ name: "core" }));
    writeFileSync(join(root, "packages/core/src/state/index.ts"), 'import "node:sqlite";\n');
    writeFileSync(
      join(root, "packages/core/src/state/driver/runtime-edge.ts"),
      'import "node:sqlite";\n',
    );
    const violations = engineMarkerViolations(root, {
      core: ["src/state/index.ts", "src/state/driver/runtime-edge.ts"],
    });
    expect(violations).toEqual(["core/src/state/index.ts: forbidden marker node:sqlite"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
