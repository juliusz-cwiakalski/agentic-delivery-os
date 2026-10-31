/**
 * TC-STATUS-013..015 — changes/PRs from the local active change plus open pull
 * requests, and CI classification where `none`/all-skipped are never green.
 */
import { describe, expect, test } from "bun:test";
import type { PipelineJob, PipelineRun } from "../../packages/core/src/contracts/index";
import { aggregateStatus } from "../../packages/core/src/domain/index";
import {
  activeChange,
  baseFacts,
  deliveryRequestRead,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  localContext,
  makeDeliveryRequest,
  makePipelineRun,
  malformedLocalContext,
  missingLocalContext,
  pipelineRunRead,
  REVIEWS_AVAILABLE,
  REVIEWS_UNAVAILABLE,
  repository,
  runStatusCli,
  sectionById,
  statusRuntime,
  unavailableBinding,
} from "../fixtures/status/harness";

const changes = (facts: ReturnType<typeof baseFacts>) =>
  sectionById(aggregateStatus(facts).sections, "changes-and-prs");
const ci = (facts: ReturnType<typeof baseFacts>) =>
  sectionById(aggregateStatus(facts).sections, "ci");

describe("TC-STATUS-013 changes and pull requests", () => {
  test("the active change and open PR list are reported with review signals", () => {
    const facts = baseFacts({
      changes: deliveryRequestRead(
        [
          makeDeliveryRequest({ entityId: "501", reviewState: "open" }),
          makeDeliveryRequest({ entityId: "502", reviewState: "draft" }),
        ],
        REVIEWS_AVAILABLE,
      ),
    });
    const section = changes(facts);
    expect(section.state).toBe("observed");
    expect(section.activeChange).toMatchObject({
      state: "observed",
      workItemRef: "GH-175",
      branch: "feat/GH-175/status-v1",
    });
    expect(section.pullRequests?.map((item) => item.entityId)).toEqual(["501", "502"]);
    for (const item of section.pullRequests ?? []) {
      expect(item.reviewState).toBe("observed");
      expect(item.reviewThreads).toBe("observed");
    }
  });

  test("an observed-empty active change is distinct from unknown", () => {
    const empty = changes(baseFacts({ localContext: localContext({}) }));
    expect(empty.state).toBe("observed");
    expect(empty.activeChange).toMatchObject({ state: "observed-empty" });
    const missing = changes(baseFacts({ localContext: missingLocalContext() }));
    expect(missing.state).toBe("degraded");
    expect(missing.activeChange).toMatchObject({ state: "unknown" });
    expect(missing.evidence.reasons).toContain("local-context-missing");
    const malformed = changes(baseFacts({ localContext: malformedLocalContext() }));
    expect(malformed.state).toBe("degraded");
    expect(malformed.activeChange).toMatchObject({ state: "unknown" });
    expect(malformed.evidence.reasons).toContain("local-context-malformed");
  });

  test("unavailable review signals are unknown and degrade the section", () => {
    const section = changes(
      baseFacts({
        changes: deliveryRequestRead(
          [makeDeliveryRequest({ entityId: "501" })],
          REVIEWS_UNAVAILABLE,
        ),
      }),
    );
    expect(section.state).toBe("degraded");
    expect(section.pullRequests?.[0]?.reviewState).toBe("unknown");
    expect(section.pullRequests?.[0]?.reviewThreads).toBe("unknown");
    expect(section.evidence.reasons).toContain("signal-unavailable");
  });

  test("a partial PR failure is degraded while the active change is preserved", () => {
    const section = changes(
      baseFacts({
        changes: failedDeliveryRequestRead(),
        localContext: localContext({ activeChange: activeChange() }),
      }),
    );
    expect(section.state).toBe("degraded");
    expect(section.activeChange).toMatchObject({ state: "observed", workItemRef: "GH-175" });
    expect(section.evidence.reasons).toContain("partial-evidence");
    expect(section.evidence.reasons).toContain("read-failed");
    expect(changes(baseFacts()).state).toBe("observed");
  });

  test("the PR list is capped and ordered independently of input order", () => {
    const items = Array.from({ length: 9 }, (_, index) =>
      makeDeliveryRequest({
        entityId: String(600 + index),
        reviewState: index % 2 === 0 ? "open" : "draft",
      }),
    );
    const forward = changes(baseFacts({ changes: deliveryRequestRead(items, REVIEWS_AVAILABLE) }));
    const reversed = changes(
      baseFacts({ changes: deliveryRequestRead([...items].reverse(), REVIEWS_AVAILABLE) }),
    );
    expect(forward.pullRequests).toHaveLength(8);
    expect(forward.counts.omitted).toBe(1);
    expect(forward.pullRequests?.map((item) => item.entityId)).toEqual(
      reversed.pullRequests?.map((item) => item.entityId),
    );
  });
});

describe("TC-STATUS-014 CI result classification", () => {
  const runWith = (jobs: readonly PipelineJob[]): PipelineRun =>
    makePipelineRun({ entityId: "800", jobs });

  const cases: Array<[string, readonly PipelineRun[], string]> = [
    ["failed", [runWith([{ jobName: "a", jobState: "failed" }])], "failed"],
    [
      "pending running",
      [
        runWith([
          { jobName: "a", jobState: "running" },
          { jobName: "b", jobState: "succeeded" },
        ]),
      ],
      "pending",
    ],
    ["pending queued", [runWith([{ jobName: "a", jobState: "queued" }])], "pending"],
    ["succeeded", [runWith([{ jobName: "a", jobState: "succeeded" }])], "succeeded"],
    [
      "succeeded plus skipped",
      [
        runWith([
          { jobName: "a", jobState: "succeeded" },
          { jobName: "b", jobState: "skipped" },
        ]),
      ],
      "succeeded",
    ],
    ["canceled", [runWith([{ jobName: "a", jobState: "canceled" }])], "canceled"],
    ["none no runs", [], "none"],
    ["none all skipped", [runWith([{ jobName: "a", jobState: "skipped" }])], "none"],
  ];

  for (const [name, runs, expected] of cases) {
    test(`classifies ${name} as ${expected}`, () => {
      const section = ci(baseFacts({ ci: pipelineRunRead(runs) }));
      expect(section.state).toBe("observed");
      expect(section.result).toBe(expected);
      if (expected === "none") expect(section.result).not.toBe("succeeded");
    });
  }

  test("precedence: failed beats pending, pending beats canceled, canceled beats succeeded", () => {
    expect(
      ci(
        baseFacts({
          ci: pipelineRunRead([
            runWith([{ jobName: "a", jobState: "failed" }]),
            runWith([{ jobName: "b", jobState: "running" }]),
          ]),
        }),
      ).result,
    ).toBe("failed");
    expect(
      ci(
        baseFacts({
          ci: pipelineRunRead([
            runWith([{ jobName: "a", jobState: "running" }]),
            runWith([{ jobName: "b", jobState: "canceled" }]),
          ]),
        }),
      ).result,
    ).toBe("pending");
    expect(
      ci(
        baseFacts({
          ci: pipelineRunRead([
            runWith([{ jobName: "a", jobState: "canceled" }]),
            runWith([{ jobName: "b", jobState: "succeeded" }]),
          ]),
        }),
      ).result,
    ).toBe("canceled");
  });

  test("commit carries the branch and SHA and the read is invoked once", async () => {
    const facts = baseFacts();
    const recorder = { calls: [] as string[] };
    const run = await runStatusCli(["--json", "status"], statusRuntime(facts, recorder));
    expect(run.exitCode).toBe(0);
    expect(recorder.calls.filter((call) => call === "readPipelineRuns")).toHaveLength(1);
    const section = ci(facts);
    expect(section.commit).toMatchObject({
      branch: "feat/GH-175/status-v1",
      sha: "1111111111111111111111111111111111111111",
    });
  });

  test("runs are capped at eight", () => {
    const runs = Array.from({ length: 9 }, (_, index) =>
      makePipelineRun({ entityId: String(900 + index) }),
    );
    const section = ci(baseFacts({ ci: pipelineRunRead(runs) }));
    expect(section.runs).toHaveLength(8);
    expect(section.counts.omitted).toBe(1);
  });
});

describe("TC-STATUS-015 CI failures are unknown, never green", () => {
  test("unresolved SHA, failed read, credential, and no binding are not green", () => {
    const unresolved = ci(baseFacts({ repository: repository({ head: { detached: true } }) }));
    expect(unresolved.state).toBe("unknown");
    expect(unresolved.result).toBe("unknown");
    expect(unresolved.evidence.reasons).toContain("commit-unresolved");

    const failed = ci(baseFacts({ ci: failedPipelineRunRead("read-failed") }));
    expect(failed.state).toBe("unknown");
    expect(failed.result).toBe("unknown");
    expect(failed.evidence.reasons).toContain("read-failed");

    const credential = ci(baseFacts({ ci: failedPipelineRunRead("credential-unavailable") }));
    expect(credential.state).toBe("unknown");
    expect(credential.evidence.reasons).toContain("credential-unavailable");

    const noBinding = ci(baseFacts({ repository: repository({ binding: unavailableBinding() }) }));
    expect(noBinding.state).toBe("unavailable");
    expect(noBinding.result).toBe("unknown");
    expect(noBinding.evidence.reasons).toContain("addressing-unresolved");
  });

  test("restoring the SHA and read reaches observed", () => {
    expect(ci(baseFacts()).state).toBe("observed");
  });
});
