/**
 * TC-TAX-001 / TC-TAX-009 / TC-TAX-010 — the conformance-level tracker error
 * taxonomy maps four class ids onto delivered identities, is total over five
 * observable outcomes in fixed order, and proves the capability class
 * structurally rather than by a fixture family.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ADAPTER_OPERATIONS,
  DELIVERY_RESULT_PROJECTION_CLASSES,
  DELIVERY_RESULT_TAXONOMY,
  DOMAIN_KINDS,
  ERROR_TABLE,
  STATUS_SOURCE_PIPELINE_LIMIT,
} from "@delivery-os/core/contracts";
import {
  CONFORMANCE_ADAPTERS,
  CONFORMANCE_FLOWS,
  classifyTrackerFailure,
  classifyTrackerOutcome,
  createMockTenantTransport,
  runConformance,
  runtimeCoverageViolations,
  structuralCoverageViolations,
  TRACKER_ERROR_CLASS_IDS,
  TRACKER_ERROR_TAXONOMY,
  TRACKER_FAMILY_OUTCOMES,
  TRACKER_TRAP_FAMILIES,
  type TrackerErrorClass,
} from "@delivery-os/testkit";
import { createGitHubClient } from "../../packages/adapters/src/github/client";
import { createGitLabClient } from "../../packages/adapters/src/gitlab/client";
import type { ProviderReadResult } from "../../packages/adapters/src/io/provider-transport";
import { createJiraClient } from "../../packages/adapters/src/jira/client";
import { createCanaryCredentialPort, loadMockTenant, loadMockTenants } from "./support/fixtures";

const CLOCK = "2026-10-31T00:00:00Z";

const mockReport = async () => {
  const tenants = loadMockTenants();
  return runConformance({
    adapters: CONFORMANCE_ADAPTERS,
    tenants,
    credentials: createCanaryCredentialPort(),
    transportFactory: (provider) => {
      const tenant = tenants[provider as keyof typeof tenants];
      if (tenant === undefined) throw new Error(`missing tenant ${provider}`);
      return createMockTenantTransport(tenant);
    },
    nowIso: CLOCK,
    runId: "taxonomy-run",
    tier: "mock",
  });
};

const PROVIDER_WORDS = /github|gitlab|jira/i;

/** Validate a taxonomy table against the declared closed shape. */
const taxonomyViolations = (table: readonly TrackerErrorClass[]): string[] => {
  const violations: string[] = [];
  const ids = new Set<string>();
  for (const entry of table) {
    if (ids.has(entry.id)) violations.push(`${entry.id}: duplicate class id`);
    ids.add(entry.id);
  }
  for (const id of TRACKER_ERROR_CLASS_IDS) {
    if (!ids.has(id)) violations.push(`${id}: class id is missing`);
  }
  for (const id of ids) {
    if (!(TRACKER_ERROR_CLASS_IDS as readonly string[]).includes(id)) {
      violations.push(`${id}: class id is outside the closed set`);
    }
  }
  if (ids.size !== TRACKER_ERROR_CLASS_IDS.length) {
    violations.push(`expected ${TRACKER_ERROR_CLASS_IDS.length} class ids, found ${ids.size}`);
  }
  for (const entry of table as readonly unknown[]) {
    if (typeof entry !== "object" || entry === null) {
      violations.push("a class entry is not an object");
      continue;
    }
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "unknown";
    if (
      typeof record.deliveredIdentity !== "string" ||
      record.deliveredIdentity.trim().length === 0
    ) {
      violations.push(`${id}: no delivered identity`);
    }
    if (typeof record.discriminator !== "string" || record.discriminator.trim().length === 0) {
      violations.push(`${id}: no structured discriminator`);
    }
    if (PROVIDER_WORDS.test(JSON.stringify(record))) {
      violations.push(`${id}: taxonomy table carries a provider name`);
    }
    if (record.unit !== undefined) violations.push(`${id}: a class carries an extra identity`);
  }
  return violations;
};

/** A local sibling of the total rule with rules (2) and (3) swapped. */
const swappedRule = (outcome: Parameters<typeof classifyTrackerOutcome>[0]): string => {
  if (outcome.kind === "capability-gap") return "tracker.capability.unsupported";
  if (outcome.kind === "adapter-refusal") return "tracker.transport.failed";
  if (outcome.kind === "no-response") return "tracker.payload.invalid";
  return classifyTrackerOutcome(outcome);
};

describe("TC-TAX-001 the taxonomy is four class ids over delivered identities", () => {
  test("exactly four ids, one delivered identity each, and no provider name", () => {
    expect([...TRACKER_ERROR_CLASS_IDS]).toEqual([
      "tracker.capability.unsupported",
      "tracker.auth.rejected",
      "tracker.transport.failed",
      "tracker.payload.invalid",
    ]);
    expect(TRACKER_ERROR_TAXONOMY.length).toBe(4);
    expect(taxonomyViolations(TRACKER_ERROR_TAXONOMY)).toEqual([]);
    expect(new Set(TRACKER_ERROR_TAXONOMY.map((entry) => entry.id))).toEqual(
      new Set(TRACKER_ERROR_CLASS_IDS),
    );
    for (const entry of TRACKER_ERROR_TAXONOMY) {
      expect(entry.deliveredIdentity).toBe(
        entry.id === "tracker.capability.unsupported"
          ? "capability-gap"
          : "provider.payload.invalid",
      );
    }
    expect(JSON.stringify(TRACKER_ERROR_TAXONOMY)).not.toMatch(PROVIDER_WORDS);
  });

  test("the six families are closed and each declares its outcome", () => {
    expect([...TRACKER_TRAP_FAMILIES]).toEqual([
      "auth-shape",
      "transport-failure",
      "rate-limit",
      "payload-shape",
      "workflow-state-mismatch",
      "pagination-truncation",
    ]);
    expect(Object.keys(TRACKER_FAMILY_OUTCOMES).sort()).toEqual([...TRACKER_TRAP_FAMILIES].sort());
    expect(TRACKER_FAMILY_OUTCOMES["pagination-truncation"].proves).toBe("bounded-observation");
  });

  test("the class vocabulary never reaches a delivered identity surface", () => {
    const trackerRows = ERROR_TABLE.filter((row) => row.code.startsWith("tracker."));
    expect(trackerRows).toEqual([]);
    expect(DOMAIN_KINDS.filter((kind) => kind.startsWith("tracker."))).toEqual([]);
    expect(
      DELIVERY_RESULT_PROJECTION_CLASSES.filter((entry) => entry.startsWith("tracker.")),
    ).toEqual([]);
    expect(DELIVERY_RESULT_TAXONOMY.filter((entry) => entry.token.startsWith("tracker."))).toEqual(
      [],
    );
    expect(ADAPTER_OPERATIONS.filter((operation) => operation.startsWith("tracker."))).toEqual([]);
  });

  test("the class ids are never returned as a failure code", () => {
    const outcomes = [
      classifyTrackerFailure(
        { ok: false, code: "provider.payload.invalid", httpStatus: 401 },
        { operationKind: "read" },
      ),
      classifyTrackerFailure(
        { ok: false, code: "provider.payload.invalid" },
        { operationKind: "read" },
      ),
      classifyTrackerFailure(
        { ok: false, code: "provider.payload.invalid", httpStatus: 500 },
        { operationKind: "write" },
      ),
      classifyTrackerOutcome({ kind: "capability-gap" }),
    ];
    for (const classification of outcomes) {
      expect(TRACKER_ERROR_CLASS_IDS).toContain(
        classification as (typeof TRACKER_ERROR_CLASS_IDS)[number],
      );
      expect([
        "provider.payload.invalid",
        "provider.not-found",
        "config.credential.missing",
      ]).not.toContain(classification);
    }
  });

  test("mutation controls: a fifth id, a second identity, a provider name", () => {
    const fifth = [
      ...TRACKER_ERROR_TAXONOMY,
      {
        id: "tracker.rate.limited" as never,
        deliveredIdentity: "provider.payload.invalid" as const,
        discriminator: "status-other-or-refusal-or-undecodable" as const,
        provingFamilies: [] as never,
        provingMechanism: "family" as const,
      },
    ];
    expect(
      taxonomyViolations(fifth).some((message) => message.includes("tracker.rate.limited")),
    ).toBe(true);
    const secondIdentity = TRACKER_ERROR_TAXONOMY.map((entry, index) =>
      index === 1 ? { ...entry, unit: "second-identity" } : entry,
    ) as unknown as readonly TrackerErrorClass[];
    expect(
      taxonomyViolations(secondIdentity).some((message) => message.includes("extra identity")),
    ).toBe(true);
    const providerName = TRACKER_ERROR_TAXONOMY.map((entry, index) =>
      index === 0 ? { ...entry, discriminator: "github-operation-membership" as never } : entry,
    );
    expect(
      taxonomyViolations(providerName).some((message) => message.includes("provider name")),
    ).toBe(true);
  });
});

describe("TC-TAX-009 the decision rule is total, ordered, and deterministic", () => {
  test("every observable outcome resolves exactly once, deterministically", () => {
    expect(classifyTrackerOutcome({ kind: "capability-gap" })).toBe(
      "tracker.capability.unsupported",
    );
    expect(classifyTrackerOutcome({ kind: "adapter-refusal" })).toBe("tracker.payload.invalid");
    expect(classifyTrackerOutcome({ kind: "no-response" })).toBe("tracker.transport.failed");
    expect(classifyTrackerOutcome({ kind: "read-not-found" })).toBe("outside-taxonomy");
    expect(classifyTrackerOutcome({ kind: "status", httpStatus: 401, operationKind: "read" })).toBe(
      "tracker.auth.rejected",
    );
    expect(classifyTrackerOutcome({ kind: "status", httpStatus: 403, operationKind: "read" })).toBe(
      "tracker.auth.rejected",
    );
    expect(classifyTrackerOutcome({ kind: "status", httpStatus: 500, operationKind: "read" })).toBe(
      "tracker.payload.invalid",
    );
    expect(
      classifyTrackerOutcome({
        kind: "status",
        httpStatus: 200,
        operationKind: "read",
        undecodable: true,
      }),
    ).toBe("tracker.payload.invalid");
    // The undecodable discriminant is load-bearing: an undecodable body decides
    // the payload class even when the transport carried an auth status, while the
    // same status with a decoded body stays auth.rejected.
    expect(
      classifyTrackerOutcome({
        kind: "status",
        httpStatus: 401,
        operationKind: "read",
        undecodable: true,
      }),
    ).toBe("tracker.payload.invalid");
    expect(classifyTrackerOutcome({ kind: "status", httpStatus: 401, operationKind: "read" })).toBe(
      "tracker.auth.rejected",
    );
    expect(classifyTrackerOutcome({ kind: "decoded-success" })).toBe("success");
    const once = classifyTrackerOutcome({ kind: "no-response" });
    expect(classifyTrackerOutcome({ kind: "no-response" })).toBe(once);
  });

  test("a read 404 stays outside while a write 404 stays the payload class", () => {
    expect(classifyTrackerOutcome({ kind: "read-not-found" })).toBe("outside-taxonomy");
    expect(classifyTrackerOutcome({ kind: "status", httpStatus: 404, operationKind: "read" })).toBe(
      "outside-taxonomy",
    );
    expect(
      classifyTrackerOutcome({ kind: "status", httpStatus: 404, operationKind: "write" }),
    ).toBe("tracker.payload.invalid");
    expect(
      classifyTrackerFailure(
        { ok: false, code: "provider.not-found", httpStatus: 404 },
        { operationKind: "write" },
      ),
    ).toBe("tracker.payload.invalid");
    expect(
      classifyTrackerFailure(
        { ok: false, code: "config.credential.missing" },
        { operationKind: "read" },
      ),
    ).toBe("outside-taxonomy");
  });

  test("an ambiguity set proves order: a refusal beats a status-less failure", () => {
    const ambiguous = { kind: "adapter-refusal" } as const;
    expect(classifyTrackerOutcome(ambiguous)).toBe("tracker.payload.invalid");
    expect(swappedRule(ambiguous)).toBe("tracker.transport.failed");
    const statusless = { kind: "no-response" } as const;
    expect(classifyTrackerOutcome(statusless)).toBe("tracker.transport.failed");
    expect(swappedRule(statusless)).toBe("tracker.payload.invalid");
    // A stimulus that is both a refusal and would present without a response:
    // the refusal rule precedes the no-response rule in the declared order.
    const refusalOverTransport = { kind: "adapter-refusal" } as const;
    expect(classifyTrackerOutcome(refusalOverTransport)).toBe("tracker.payload.invalid");
    expect(
      swappedRule({ kind: "adapter-refusal" } as unknown as Parameters<
        typeof classifyTrackerOutcome
      >[0]),
    ).not.toBe(classifyTrackerOutcome(refusalOverTransport));
  });
});

describe("TC-TAX-010 the capability class is proven structurally", () => {
  test("the table declares the capability class as structural with no family", () => {
    const capability = TRACKER_ERROR_TAXONOMY.find(
      (entry) => entry.id === "tracker.capability.unsupported",
    );
    expect(capability?.provingMechanism).toBe("structural");
    expect(capability?.provingFamilies).toEqual([]);
    expect(TRACKER_FAMILY_OUTCOMES["auth-shape"].proves).not.toBe("tracker.capability.unsupported");
  });

  test("the structural and runtime coverage gates prove every declared gap", async () => {
    expect(
      structuralCoverageViolations({ flows: CONFORMANCE_FLOWS, adapters: CONFORMANCE_ADAPTERS }),
    ).toEqual([]);
    const report = await mockReport();
    expect(runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")).toEqual([]);
    for (const adapter of CONFORMANCE_ADAPTERS) {
      for (const gap of adapter.contract.capabilities.declaredGaps) {
        const step = report.steps.find(
          (candidate) =>
            candidate.provider === adapter.provider && candidate.operation === gap.operation,
        );
        expect(step?.status).not.toBe("failed");
        expect(step?.skipKind === "declared-gap" || step === undefined).toBe(true);
      }
    }
    expect(report.steps.filter((step) => step.status === "failed")).toEqual([]);
  });

  test("recording a gapped operation as a failure is refused by the runtime gate", async () => {
    const report = await mockReport();
    const target = report.steps.find(
      (step) => step.skipKind === "declared-gap" && step.status === "skipped",
    );
    expect(target).toBeDefined();
    if (target === undefined) throw new Error("expected a declared-gap step");
    const mutated = {
      ...report,
      steps: report.steps.map((step) =>
        step.provider === target.provider && step.operation === target.operation
          ? { ...step, status: "executed" as const, skipKind: null, skipReason: null }
          : step,
      ),
    };
    expect(runtimeCoverageViolations(mutated, CONFORMANCE_ADAPTERS, "mock")).toContain(
      `${target.provider}: declared gap ${target.operation} (${target.skipReason ?? ""}) was not encountered`,
    );
    const failed = {
      ...report,
      steps: report.steps.map((step) =>
        step.provider === target.provider && step.operation === target.operation
          ? { ...step, status: "failed" as const, skipKind: null, skipReason: null }
          : step,
      ),
    };
    expect(
      runtimeCoverageViolations(failed, CONFORMANCE_ADAPTERS, "mock").some((message) =>
        message.includes("failed step counted as passed"),
      ),
    ).toBe(true);
  });
});

// --- TAX-003..008: family replay through the production clients -------------

type FamilyStimulus = {
  readonly kind: "response" | "transport-failure" | "transition" | "read-pipeline-run";
  readonly status?: number;
  readonly body?: unknown;
  readonly deliveryState?: string;
};

type FamilyReplay =
  | {
      readonly kind: "failure";
      readonly result: { readonly ok: false; readonly code: string; readonly httpStatus?: number };
      readonly requests: number;
      readonly ownsStatus: boolean;
    }
  | {
      readonly kind: "pagination";
      readonly bound: string;
      readonly count: string;
      readonly requests: number;
      readonly url: string;
    }
  | { readonly kind: "success" };

const ACCOUNTING = "tests/fixtures/providers/conformance/families/accounting.json";
const accounting = JSON.parse(readFileSync(join(process.cwd(), ACCOUNTING), "utf8")) as {
  providers: Record<
    string,
    Record<string, { posture: string; recordedClass?: string; gapReason?: string }>
  >;
};

const stimulusOf = (provider: string, family: string): FamilyStimulus =>
  (
    JSON.parse(
      readFileSync(
        join(process.cwd(), "tests/fixtures/providers", provider, "families", `${family}.json`),
        "utf8",
      ),
    ) as { stimulus: FamilyStimulus }
  ).stimulus;

const replayFamily = async (
  provider: string,
  family: string,
  override?: Partial<FamilyStimulus>,
  limit?: number,
): Promise<FamilyReplay> => {
  const stimulus = { ...stimulusOf(provider, family), ...override };
  const tenant = loadMockTenant(provider);
  const requests: string[] = [];
  const transport = {
    send: async (request: { method: string; url: string }) => {
      requests.push(`${request.method} ${request.url}`);
      if (stimulus.kind === "transport-failure") throw new Error("network down");
      return { status: stimulus.status ?? 200, body: stimulus.body };
    },
  };
  const credentials = createCanaryCredentialPort();
  let result: ProviderReadResult<unknown>;
  const addressing = tenant.addressing;
  if (provider === "github") {
    if (addressing.provider !== "github") throw new Error("github addressing missing");
    const client = createGitHubClient({
      instance: tenant.instance,
      credentials,
      repository: { owner: addressing.owner, name: addressing.repo },
      transport,
    });
    if (family === "pagination-truncation") {
      const read = await client.readPipelineRun(
        addressing.commitSha,
        limit === undefined ? undefined : limit,
      );
      if (!read.ok) {
        return {
          kind: "failure",
          result: read,
          requests: requests.length,
          ownsStatus: Object.hasOwn(read, "httpStatus"),
        };
      }
      const url = requests[0] ?? "";
      return {
        kind: "pagination",
        bound: url.includes("per_page=") ? "declared" : "none",
        count: "reported",
        requests: requests.length,
        url,
      };
    }
    result =
      family === "workflow-state-mismatch"
        ? await client.transitionWorkItem({
            entityId: String(addressing.issueNumber),
            deliveryState: (stimulus.deliveryState ?? "canceled") as never,
          })
        : await client.readWorkItem(addressing.issueNumber);
  } else if (provider === "gitlab") {
    if (addressing.provider !== "gitlab") throw new Error("gitlab addressing missing");
    const client = createGitLabClient({
      instance: tenant.instance,
      credentials,
      projectPath: addressing.projectPath,
      transport,
    });
    if (family === "pagination-truncation") {
      const read = await client.readPipelineRun(addressing.commitSha);
      if (!read.ok) {
        return {
          kind: "failure",
          result: read,
          requests: requests.length,
          ownsStatus: Object.hasOwn(read, "httpStatus"),
        };
      }
      const url = requests[0] ?? "";
      return {
        kind: "pagination",
        bound: url.includes("per_page=") ? "declared" : "none",
        count: "absent",
        requests: requests.length,
        url,
      };
    }
    result = await client.readDeliveryRequest(addressing.mrIid);
  } else {
    if (addressing.provider !== "jira") throw new Error("jira addressing missing");
    const client = createJiraClient({ instance: tenant.instance, credentials, transport });
    result =
      family === "workflow-state-mismatch"
        ? await client.transitionWorkItem({
            issueKey: addressing.issueKey,
            deliveryState: (stimulus.deliveryState ?? "planned") as never,
          })
        : await client.readWorkItem(addressing.issueKey);
  }
  if (result.ok) return { kind: "success" };
  return {
    kind: "failure",
    result,
    requests: requests.length,
    ownsStatus: Object.hasOwn(result, "httpStatus") && result.httpStatus !== undefined,
  };
};

const classOf = (replay: FamilyReplay, operationKind: "read" | "write"): string => {
  if (replay.kind !== "failure") throw new Error("expected a failure replay");
  return classifyTrackerFailure(replay.result, {
    operationKind,
    adapterRefusal: replay.requests === 0,
  });
};

describe("TC-TAX-003 the auth-shape posture", () => {
  test("the status-bearing arm classifies a 401/403 as auth.rejected and stays distinguishable", async () => {
    for (const status of [401, 403]) {
      const replay = await replayFamily("github", "auth-shape", { status });
      expect(classOf(replay, "read")).toBe("tracker.auth.rejected");
      if (replay.kind !== "failure") throw new Error("expected failure");
      expect(replay.result.httpStatus).toBe(status);
      expect(replay.ownsStatus).toBe(true);
    }
    expect(
      classifyTrackerFailure(
        { ok: false, code: "config.credential.missing" },
        { operationKind: "read" },
      ),
    ).toBe("outside-taxonomy");
  });

  test("the recorded-difference arm on GitLab and Jira matches the recorded class and cannot produce auth.rejected", async () => {
    for (const provider of ["gitlab", "jira"]) {
      const cell = accounting.providers[provider]?.["auth-shape"];
      expect(cell?.posture).toBe("recorded-difference");
      const replay = await replayFamily(provider, "auth-shape");
      expect(classOf(replay, "read")).toBe(cell?.recordedClass);
      expect(classOf(replay, "read")).toBe("tracker.transport.failed");
      if (replay.kind !== "failure") throw new Error("expected failure");
      expect(replay.ownsStatus).toBe(false);
    }
  });
});

describe("TC-TAX-004 the transport-failure posture", () => {
  test("a thrown transport carries no status and the class differs from every status-bearing class", async () => {
    for (const provider of ["github", "gitlab", "jira"]) {
      const replay = await replayFamily(provider, "transport-failure");
      expect(classOf(replay, "read")).toBe("tracker.transport.failed");
      if (replay.kind !== "failure") throw new Error("expected failure");
      expect(replay.ownsStatus).toBe(false);
    }
    const auth = await replayFamily("github", "auth-shape", { status: 401 });
    const other = await replayFamily("github", "rate-limit", { status: 500 });
    expect(classOf(auth, "read")).toBe("tracker.auth.rejected");
    expect(classOf(other, "read")).toBe("tracker.payload.invalid");
  });
});

describe("TC-TAX-005 the rate-limit posture", () => {
  test("GitHub classifies a 429 as the payload class with its status, independent of prose", async () => {
    const body = { message: "request quota exceeded" };
    const first = await replayFamily("github", "rate-limit", { status: 429, body });
    const second = await replayFamily("github", "rate-limit", {
      status: 429,
      body: { message: "unrelated prose" },
    });
    expect(classOf(first, "read")).toBe("tracker.payload.invalid");
    expect(classOf(second, "read")).toBe("tracker.payload.invalid");
    if (first.kind !== "failure") throw new Error("expected failure");
    expect(first.result.httpStatus).toBe(429);
  });

  test("a 403 throttle is outside the covered rate-limit classification", async () => {
    const replay = await replayFamily("github", "rate-limit", { status: 403 });
    expect(classOf(replay, "read")).toBe("tracker.auth.rejected");
    expect(classOf(replay, "read")).not.toBe("tracker.payload.invalid");
  });

  test("the status-less arms match their recorded class", async () => {
    for (const provider of ["gitlab", "jira"]) {
      const replay = await replayFamily(provider, "rate-limit", { status: 429 });
      expect(classOf(replay, "read")).toBe("tracker.transport.failed");
      expect(classOf(replay, "read")).toBe(
        accounting.providers[provider]?.["rate-limit"]?.recordedClass,
      );
    }
  });
});

describe("TC-TAX-006 the payload-shape posture", () => {
  test("GitHub stamps the received status on an undecodable 2xx and on a prose-contradicted non-2xx", async () => {
    const undecodable = await replayFamily("github", "payload-shape", {
      status: 200,
      body: { unexpected: "shape" },
    });
    expect(classOf(undecodable, "read")).toBe("tracker.payload.invalid");
    if (undecodable.kind !== "failure") throw new Error("expected failure");
    expect(undecodable.result.httpStatus).toBe(200);

    const contradicted = await replayFamily("github", "payload-shape", {
      status: 500,
      body: { message: "success" },
    });
    expect(classOf(contradicted, "read")).toBe("tracker.payload.invalid");
    if (contradicted.kind !== "failure") throw new Error("expected failure");
    expect(contradicted.result.httpStatus).toBe(500);
  });

  test("GiLab and Jira produce status-less failures that match their recorded class", async () => {
    for (const provider of ["gitlab", "jira"]) {
      const replay = await replayFamily(provider, "payload-shape", {
        status: 200,
        body: { unexpected: "shape" },
      });
      expect(classOf(replay, "read")).toBe("tracker.transport.failed");
      if (replay.kind !== "failure") throw new Error("expected failure");
      expect(replay.ownsStatus).toBe(false);
    }
  });
});

describe("TC-TAX-007 the workflow-state-mismatch posture", () => {
  test("GitHub and Jira refuse before dispatch with zero provider requests", async () => {
    for (const provider of ["github", "jira"]) {
      const replay = await replayFamily(provider, "workflow-state-mismatch");
      expect(classOf(replay, "write")).toBe("tracker.payload.invalid");
      if (replay.kind !== "failure") throw new Error("expected failure");
      expect(replay.requests).toBe(0);
      expect(replay.ownsStatus).toBe(false);
    }
  });

  test("GitLab is gap-backed on its own transition operation with the exact reason", () => {
    const cell = accounting.providers.gitlab?.["workflow-state-mismatch"];
    expect(cell?.posture).toBe("gap-backed");
    expect(cell?.gapReason).toBe("adapter-not-implemented");
  });
});

describe("TC-TAX-008 the pagination-truncation posture", () => {
  test("GitHub declares a bound and reports a count, with the bound reaching the wire", async () => {
    const replay = await replayFamily("github", "pagination-truncation");
    expect(replay.kind).toBe("pagination");
    if (replay.kind !== "pagination") throw new Error("expected pagination");
    expect(replay.bound).toBe("declared");
    expect(replay.count).toBe("reported");
    expect(replay.requests).toBe(1);
    expect(replay.url).toContain(`per_page=${STATUS_SOURCE_PIPELINE_LIMIT}`);
    const different = await replayFamily(
      "github",
      "pagination-truncation",
      undefined,
      STATUS_SOURCE_PIPELINE_LIMIT + 1,
    );
    if (different.kind !== "pagination") throw new Error("expected pagination");
    expect(different.url).not.toBe(replay.url);
  });

  test("GitLab declares neither a bound nor a count, and Jira is gap-backed", async () => {
    const replay = await replayFamily("gitlab", "pagination-truncation");
    expect(replay.kind).toBe("pagination");
    if (replay.kind !== "pagination") throw new Error("expected pagination");
    expect(replay.bound).toBe("none");
    expect(replay.count).toBe("absent");
    expect(replay.url).not.toContain("per_page=");
    const jira = accounting.providers.jira?.["pagination-truncation"];
    expect(jira?.posture).toBe("gap-backed");
    expect(jira?.gapReason).toBe("provider-unsupported");
  });

  test("the observation metadata matches the delivered presence facts", () => {
    const record = JSON.parse(
      readFileSync(
        join(process.cwd(), "tests/fixtures/providers/conformance/parity/observation-record.json"),
        "utf8",
      ),
    ) as { record: Record<string, Record<string, Record<string, { value?: string }>>> };
    expect(record.record.github?.["read-pipeline-run"]?.["pagination-model"]?.value).toBe(
      "bound=declared;count=reported",
    );
    expect(record.record.gitlab?.["read-pipeline-run"]?.["pagination-model"]?.value).toBe(
      "bound=none;count=absent",
    );
  });
});
