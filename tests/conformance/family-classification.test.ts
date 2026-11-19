/**
 * TC-TAX-013 — every declared family posture replays through the production
 * client and satisfies its declared outcome, with the covered, recorded-
 * difference and gap-backed arms all executing on every run.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyTrackerFailure,
  TRACKER_FAMILY_OUTCOMES,
  TRACKER_TRAP_FAMILIES,
  type TrackerTrapFamily,
} from "@delivery-os/testkit";
import { createGitHubClient } from "../../packages/adapters/src/github/client";
import { createGitLabClient } from "../../packages/adapters/src/gitlab/client";
import type { ProviderReadResult } from "../../packages/adapters/src/io/provider-transport";
import { createJiraClient } from "../../packages/adapters/src/jira/client";
import { createCanaryCredentialPort, loadMockTenant } from "./support/fixtures";

const ROOT = process.cwd();
const ACCOUNTING = "tests/fixtures/providers/conformance/families/accounting.json";
const OBSERVATION = "tests/fixtures/providers/conformance/parity/observation-record.json";

type Posture = "covered" | "recorded-difference" | "gap-backed";
type Cell = {
  readonly posture: Posture;
  readonly operation: string;
  readonly catalogEntries?: readonly string[];
  readonly fixture?: string;
  readonly registerId?: string;
  readonly recordedClass?: string;
  readonly gapReason?: string;
};
type Accounting = {
  readonly providers: Readonly<Record<string, Readonly<Record<string, Cell>>>>;
};
type Stimulus = {
  readonly kind: "response" | "transport-failure" | "transition" | "read-pipeline-run";
  readonly status?: number;
  readonly body?: unknown;
  readonly deliveryState?: string;
};

const accounting = JSON.parse(readFileSync(join(ROOT, ACCOUNTING), "utf8")) as Accounting;
const observation = (
  JSON.parse(readFileSync(join(ROOT, OBSERVATION), "utf8")) as {
    record: Record<string, Record<string, Record<string, { state: string; value?: string }>>>;
  }
).record;

type ReplayResult =
  | {
      readonly kind: "failure";
      readonly result: { ok: false; code: string; httpStatus?: number };
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

const loadStimulus = (provider: string, family: string): Stimulus => {
  const path = join(ROOT, "tests/fixtures/providers", provider, "families", `${family}.json`);
  return (JSON.parse(readFileSync(path, "utf8")) as { stimulus: Stimulus }).stimulus;
};

const replay = async (
  provider: string,
  family: TrackerTrapFamily,
  cell: Cell,
): Promise<ReplayResult> => {
  const stimulus = loadStimulus(provider, family);
  const tenant = loadMockTenant(provider);
  const requests: string[] = [];
  const transport = {
    send: async (request: { method: string; url: string }) => {
      requests.push(`${request.method} ${request.url}`);
      if (stimulus.kind === "transport-failure") throw new Error("network down");
      return { status: stimulus.status ?? 200, body: stimulus.body };
    },
  };
  const context = {
    instance: tenant.instance,
    credentials: createCanaryCredentialPort(),
    transport,
  };
  let result: ProviderReadResult<unknown>;
  let url = "";
  const addressing = tenant.addressing;
  if (provider === "github") {
    if (addressing.provider !== "github") throw new Error("github addressing missing");
    const client = createGitHubClient({
      instance: tenant.instance,
      credentials: createCanaryCredentialPort(),
      repository: { owner: addressing.owner, name: addressing.repo },
      transport,
    });
    if (family === "pagination-truncation") {
      const read = await client.readPipelineRun(addressing.commitSha);
      if (!read.ok)
        return {
          kind: "failure",
          result: read,
          requests: requests.length,
          ownsStatus: Object.hasOwn(read, "httpStatus"),
        };
      url = requests[0] ?? "";
      return {
        kind: "pagination",
        bound: url.includes("per_page=") ? "declared" : "none",
        count: Number.isFinite(read.value.pageItemCount) ? "reported" : "absent",
        requests: requests.length,
        url,
      };
    }
    result =
      family === "workflow-state-mismatch"
        ? await client.transitionWorkItem({
            entityId: String(addressing.issueNumber),
            deliveryState: "canceled",
          })
        : await client.readWorkItem(addressing.issueNumber);
  } else if (provider === "gitlab") {
    if (addressing.provider !== "gitlab") throw new Error("gitlab addressing missing");
    const client = createGitLabClient({
      instance: tenant.instance,
      credentials: createCanaryCredentialPort(),
      projectPath: addressing.projectPath,
      transport,
    });
    if (family === "pagination-truncation") {
      const read = await client.readPipelineRun(addressing.commitSha);
      if (!read.ok)
        return {
          kind: "failure",
          result: read,
          requests: requests.length,
          ownsStatus: Object.hasOwn(read, "httpStatus"),
        };
      url = requests[0] ?? "";
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
    const client = createJiraClient(context);
    result =
      family === "workflow-state-mismatch"
        ? await client.transitionWorkItem({
            issueKey: addressing.issueKey,
            deliveryState: stimulus.deliveryState as never,
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

const covered = Object.entries(accounting.providers).flatMap(([provider, cells]) =>
  Object.entries(cells)
    .filter(([, cell]) => cell.posture === "covered")
    .map(([family, cell]) => ({ provider, family: family as TrackerTrapFamily, cell })),
);
const recorded = Object.entries(accounting.providers).flatMap(([provider, cells]) =>
  Object.entries(cells)
    .filter(([, cell]) => cell.posture === "recorded-difference")
    .map(([family, cell]) => ({ provider, family: family as TrackerTrapFamily, cell })),
);
const gapBacked = Object.entries(accounting.providers).flatMap(([provider, cells]) =>
  Object.entries(cells)
    .filter(([, cell]) => cell.posture === "gap-backed")
    .map(([family, cell]) => ({ provider, family: family as TrackerTrapFamily, cell })),
);

describe("TC-TAX-013 family replay classification", () => {
  test("the accounting arms are 9 covered / 7 recorded / 2 gap-backed", () => {
    expect(covered).toHaveLength(9);
    expect(recorded).toHaveLength(7);
    expect(gapBacked).toHaveLength(2);
    expect(covered.length + recorded.length).toBe(16);
  });

  for (const entry of covered) {
    test(`covered ${entry.provider}/${entry.family} replays to its declared outcome`, async () => {
      const result = await replay(entry.provider, entry.family, entry.cell);
      if (entry.family === "pagination-truncation") {
        expect(result.kind).toBe("pagination");
        if (result.kind !== "pagination") throw new Error("expected pagination");
        expect(result.bound).toBe("declared");
        expect(result.count).toBe("reported");
        expect(result.requests).toBe(1);
        const metadata = observation[entry.provider]?.[entry.cell.operation]?.["pagination-model"];
        expect(metadata?.value).toBe("bound=declared;count=reported");
        return;
      }
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("expected failure");
      const operationKind = entry.family === "workflow-state-mismatch" ? "write" : "read";
      const classification = classifyTrackerFailure(result.result, {
        operationKind,
        adapterRefusal: result.requests === 0,
      });
      const declared = TRACKER_FAMILY_OUTCOMES[entry.family];
      expect(classification).toBe(declared.proves);
      if (entry.family === "workflow-state-mismatch") expect(result.requests).toBe(0);
      if (entry.provider === "github")
        expect(result.ownsStatus).toBe(
          entry.family !== "transport-failure" && entry.family !== "workflow-state-mismatch",
        );
    });
  }

  for (const entry of recorded) {
    test(`recorded ${entry.provider}/${entry.family} replays to its recorded class`, async () => {
      const result = await replay(entry.provider, entry.family, entry.cell);
      if (entry.family === "pagination-truncation") {
        expect(result.kind).toBe("pagination");
        if (result.kind !== "pagination") throw new Error("expected pagination");
        expect(result.bound).toBe("none");
        expect(result.count).toBe("absent");
        expect(result.requests).toBe(1);
        const metadata = observation[entry.provider]?.[entry.cell.operation]?.["pagination-model"];
        expect(metadata?.value).toBe("bound=none;count=absent");
        return;
      }
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("expected failure");
      const classification = classifyTrackerFailure(result.result, {
        operationKind: "read",
        adapterRefusal: result.requests === 0,
      });
      expect(classification).toBe(entry.cell.recordedClass);
      expect(result.ownsStatus).toBe(false);
      expect(entry.cell.recordedClass).not.toBe("tracker.auth.rejected");
    });
  }

  test("gap-backed families are never replayed and cite the exact declared reason", () => {
    const replayCount = covered.length + recorded.length;
    expect(replayCount).toBe(16);
    for (const entry of gapBacked) {
      expect(entry.cell.posture).toBe("gap-backed");
      expect(entry.cell.gapReason).toBe(
        entry.provider === "jira" ? "provider-unsupported" : "adapter-not-implemented",
      );
    }
  });

  test("both posture arms are non-deletable through independent mutations", async () => {
    const unreachable = await replay(
      "gitlab",
      "auth-shape",
      accounting.providers.gitlab?.["auth-shape"] as Cell,
    );
    expect(unreachable.kind).toBe("failure");
    if (unreachable.kind !== "failure") throw new Error("expected failure");
    expect(
      classifyTrackerFailure(unreachable.result, { operationKind: "read", adapterRefusal: false }),
    ).toBe("tracker.transport.failed");
    expect(
      classifyTrackerFailure(unreachable.result, { operationKind: "read", adapterRefusal: false }),
    ).not.toBe("tracker.auth.rejected");

    const github = await replay(
      "github",
      "auth-shape",
      accounting.providers.github?.["auth-shape"] as Cell,
    );
    expect(github.kind).toBe("failure");
    if (github.kind !== "failure") throw new Error("expected failure");
    expect(
      classifyTrackerFailure(github.result, { operationKind: "read", adapterRefusal: false }),
    ).toBe("tracker.auth.rejected");
  });

  test("the family id set is the accounting key set", () => {
    for (const provider of Object.keys(accounting.providers)) {
      expect(Object.keys(accounting.providers[provider] ?? {}).sort()).toEqual(
        [...TRACKER_TRAP_FAMILIES].sort(),
      );
    }
  });
});
