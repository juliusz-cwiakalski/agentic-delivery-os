/**
 * Live read-only composition entrypoint (GH-189 F-7, F-9, DEC-10, DEC-12).
 *
 * Composition only: the flow registry, assertion code, clock, run id, writer,
 * transport, and credential port are injected. The process wrapper parses
 * `--out`, reads the ambient environment, and writes the artifact.
 */
import { writeFileSync } from "node:fs";
import { createProcessCredentialPort } from "@delivery-os/adapters/credentials";
import type { BrandIdentity, CredentialPort } from "@delivery-os/core/contracts";
import {
  CONFORMANCE_ADAPTERS,
  type ConformanceAdapterRegistration,
  type ConformanceArtifact,
  type ConformanceFailure,
  type ConformanceFlowResult,
  type ConformanceProviderResult,
  type ConformanceReport,
  type ConformanceStatus,
  type ConformanceStepResult,
  type ConformanceTransport,
  type MockTenant,
  runConformance,
  serializeConformanceArtifact,
  toConformanceArtifact,
} from "@delivery-os/testkit";
import {
  isConfigured,
  type LiveEnvironment,
  type LiveProviderConfig,
  PROVIDER_LIVE_SETTINGS,
  PROVIDER_LIVE_TOKEN_KEYS,
  readLiveConfig,
} from "./config";
import {
  createNativeFetchTransport,
  createRecordingTransport,
  type RecordedRequest,
  type RecordingTransport,
  readOnlyViolations,
} from "./recording-transport";

/** Input to the testable live composition. */
export type LiveRunInput = {
  readonly environment: LiveEnvironment;
  readonly adapters: readonly ConformanceAdapterRegistration[];
  readonly clock: string;
  readonly runId: string;
  readonly writer: (artifact: ConformanceArtifact) => void;
  readonly transportFactory: (provider: string) => ConformanceTransport;
  readonly credentials: CredentialPort;
  /** Test-only synthetic requests for the read-only guard. */
  readonly recordedRequests?: readonly RecordedRequest[];
};

/** The contracted exit result. */
export type LiveRunResult = {
  readonly status: ConformanceStatus;
  readonly exitCode: 0 | 1;
  readonly artifact: ConformanceArtifact;
};

const setting = (entry: LiveProviderConfig, name: string): string => entry.settings[name] ?? "";

const buildTenant = (entry: LiveProviderConfig): MockTenant | undefined => {
  const authMethod = {
    mechanism: "credential-reference" as const,
    reference: entry.credentialReference,
  };
  if (entry.provider === "github") {
    const baseUrl = setting(entry, "CONFORMANCE_LIVE_GITHUB_BASE_URL");
    if (baseUrl.length === 0) return undefined;
    return {
      provenance: "live-configuration",
      provider: "github",
      adapterName: "github",
      instance: { instanceName: "github", systemKind: "vcs", baseUrl, authMethod },
      credentialReferenceName: entry.credentialReference.referenceName,
      addressing: {
        provider: "github",
        owner: setting(entry, "CONFORMANCE_LIVE_GITHUB_OWNER"),
        repo: setting(entry, "CONFORMANCE_LIVE_GITHUB_REPO"),
        issueNumber: Number(setting(entry, "CONFORMANCE_LIVE_GITHUB_ISSUE_NUMBER")),
        pullNumber: Number(setting(entry, "CONFORMANCE_LIVE_GITHUB_PULL_NUMBER")),
        commitSha: setting(entry, "CONFORMANCE_LIVE_GITHUB_COMMIT_SHA"),
      },
      routes: [],
      expected: {},
    };
  }
  if (entry.provider === "gitlab") {
    const baseUrl = setting(entry, "CONFORMANCE_LIVE_GITLAB_BASE_URL");
    if (baseUrl.length === 0) return undefined;
    return {
      provenance: "live-configuration",
      provider: "gitlab",
      adapterName: "gitlab",
      instance: { instanceName: "gitlab", systemKind: "vcs", baseUrl, authMethod },
      credentialReferenceName: entry.credentialReference.referenceName,
      addressing: {
        provider: "gitlab",
        projectPath: setting(entry, "CONFORMANCE_LIVE_GITLAB_PROJECT_PATH"),
        mrIid: Number(setting(entry, "CONFORMANCE_LIVE_GITLAB_MR_IID")),
        commitSha: setting(entry, "CONFORMANCE_LIVE_GITLAB_COMMIT_SHA"),
      },
      routes: [],
      expected: {},
    };
  }
  const baseUrl = setting(entry, "CONFORMANCE_LIVE_JIRA_BASE_URL");
  if (baseUrl.length === 0) return undefined;
  return {
    provenance: "live-configuration",
    provider: "jira",
    adapterName: "jira",
    instance: { instanceName: "jira", systemKind: "tracker", baseUrl, authMethod },
    credentialReferenceName: entry.credentialReference.referenceName,
    addressing: {
      provider: "jira",
      issueKey: setting(entry, "CONFORMANCE_LIVE_JIRA_ISSUE_KEY"),
    },
    routes: [],
    expected: {},
  };
};

const totalsFor = (
  providers: readonly ConformanceProviderResult[],
  flows: readonly ConformanceFlowResult[],
  steps: readonly ConformanceStepResult[],
): ConformanceReport["totals"] => ({
  providers: providers.length,
  flows: flows.length,
  steps: steps.length,
  executed: steps.filter((step) => step.status === "executed").length,
  skipped: steps.filter((step) => step.status === "skipped").length,
  failed: steps.filter((step) => step.status === "failed").length,
});

const adapterNameFor = (
  adapters: readonly ConformanceAdapterRegistration[],
  provider: string,
): string =>
  adapters.find((registration) => registration.provider === provider)?.contract.adapterName ??
  provider;

/**
 * Run the live composition.
 *
 * Every terminal status (`passed`, `failed`, `not-configured`) writes exactly
 * one artifact through the injected writer before returning. Tokens resolve
 * only through the credential port; the config reader retains occupancy only.
 */
export const runLive = async (input: LiveRunInput): Promise<LiveRunResult> => {
  const config = readLiveConfig(input.environment);
  const configured = config.providers.filter(isConfigured);
  const configuredNames = new Set(configured.map((entry) => entry.provider));
  const configuredAdapters = input.adapters.filter((registration) =>
    configuredNames.has(registration.provider),
  );
  const tenants: Record<string, MockTenant> = {};
  for (const entry of configured) {
    const tenant = buildTenant(entry);
    if (tenant !== undefined) tenants[entry.provider] = tenant;
  }

  let providers: ConformanceProviderResult[] = [];
  let flows: ConformanceFlowResult[] = [];
  let steps: ConformanceStepResult[] = [];
  let status: ConformanceStatus;

  const recordingTransports: RecordingTransport[] = [];
  if (configuredAdapters.length > 0) {
    const report = await runConformance({
      adapters: configuredAdapters,
      tenants,
      credentials: input.credentials,
      transportFactory: (provider) => {
        const recording = createRecordingTransport(input.transportFactory(provider));
        recordingTransports.push(recording);
        return recording;
      },
      nowIso: input.clock,
      runId: input.runId,
      tier: "live",
    });
    providers = [...report.providers];
    flows = [...report.flows];
    steps = [...report.steps];
    status = report.status;
  } else {
    status = "not-configured";
  }

  for (const entry of config.providers) {
    if (configuredNames.has(entry.provider)) continue;
    providers.push({
      provider: entry.provider,
      adapterName: adapterNameFor(input.adapters, entry.provider),
      status: "not-configured",
      missingSettings: [
        ...PROVIDER_LIVE_SETTINGS[entry.provider],
        PROVIDER_LIVE_TOKEN_KEYS[entry.provider],
      ],
      flows: [],
    });
  }

  const records: readonly RecordedRequest[] = [
    ...(input.recordedRequests ?? []),
    ...recordingTransports.flatMap((transport) => transport.records),
  ];
  const mutationRequests = records.filter((record) => record.method !== "GET").length;
  const firstNonGet = records.find((record) => record.method !== "GET");
  if (firstNonGet !== undefined) {
    status = "failed";
    const target = providers[0];
    const flow = flows.find(
      (entry) => entry.provider === target?.provider && entry.flowId === "change-lifecycle",
    );
    if (target !== undefined && flow !== undefined) {
      const failure: ConformanceFailure = {
        assertion: "read-only",
        expected: "GET",
        received: firstNonGet.method,
        reference: firstNonGet.url,
        detail: readOnlyViolations(records)[0] ?? "non-GET live request",
      };
      const guardStep: ConformanceStepResult = {
        provider: target.provider,
        flowId: "change-lifecycle",
        stepId: "live-read-only.guard",
        operation: "read-work-item",
        status: "failed",
        skipReason: null,
        skipKind: null,
        assertionCount: 0,
        failure,
      };
      steps = [...steps, guardStep];
      flows = flows.map((entry) =>
        entry.provider === target.provider && entry.flowId === "change-lifecycle"
          ? { ...entry, status: "failed", steps: [...entry.steps, guardStep] }
          : entry,
      );
      providers = providers.map((entry) =>
        entry.provider === target.provider ? { ...entry, status: "failed" } : entry,
      );
    }
  }

  if (providers.some((entry) => entry.status === "failed")) status = "failed";
  else if (configured.length === 0) status = "not-configured";
  else status = "passed";

  const report: ConformanceReport = {
    runId: input.runId,
    tier: "live",
    generatedAt: input.clock,
    status,
    providers,
    flows,
    steps,
    mutationRequests,
    createdArtifacts: 0,
    totals: totalsFor(providers, flows, steps),
  };
  const artifact = toConformanceArtifact(report);
  input.writer(artifact);
  return { status, exitCode: status === "failed" ? 1 : 0, artifact };
};

const parseOut = (argv: readonly string[]): string => {
  const index = argv.indexOf("--out");
  const value = index >= 0 ? argv[index + 1] : undefined;
  return value !== undefined && value.trim().length > 0 ? value : "conformance-live.json";
};

/** The test-only brand used by the process credential port. */
const SYNTHETIC_BRAND: BrandIdentity = {
  productName: "conformance",
  binaryName: "conformance",
  packageScope: "@conformance",
  environmentPrefix: "CONFORMANCE_",
  configDirectoryName: "conformance",
  stateDirectoryName: "conformance-state",
  mcpToolPrefix: "conformance",
  telemetryNamespace: "conformance",
  docsBaseUrl: "https://example.com",
  repositoryUrl: "https://example.com",
  releaseAssetPrefix: "conformance",
  installPath: "/tmp/conformance",
};

if (import.meta.main) {
  const out = parseOut(process.argv);
  const result = await runLive({
    environment: process.env,
    adapters: CONFORMANCE_ADAPTERS,
    clock: new Date().toISOString(),
    runId: `live-${Date.now()}`,
    writer: (artifact) => writeFileSync(out, serializeConformanceArtifact(artifact)),
    transportFactory: () => createRecordingTransport(createNativeFetchTransport()),
    credentials: createProcessCredentialPort(SYNTHETIC_BRAND),
  });
  process.exit(result.exitCode);
}
