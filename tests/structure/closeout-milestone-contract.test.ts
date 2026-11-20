/**
 * TC-F4-009 / TC-F4-015 / TC-SYNC-007 — the closed milestone contract, the
 * bounded read's four distinct facts, and the unchanged engine posture
 * (GH-349 F-4, AC-F4-5/9, DM-4/DM-6/DM-9, NFR-3/NFR-9).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GITHUB_ADAPTER_CONTRACT } from "../../packages/adapters/src/github/capabilities";
import { createGitHubClient } from "../../packages/adapters/src/github/client";
import { GITLAB_ADAPTER_CONTRACT } from "../../packages/adapters/src/gitlab/capabilities";
import { JIRA_ADAPTER_CONTRACT } from "../../packages/adapters/src/jira/capabilities";
import {
  ADAPTER_OPERATIONS,
  CAPSULE_RESIDUE_KINDS,
  CLOSEOUT_MILESTONE_LOGICAL_CAP,
  CLOSEOUT_MILESTONE_PAGE_SIZE,
  CLOSEOUT_MILESTONE_WITHHELD_REASONS,
  CLOSEOUT_OPERATION_NAMES,
  CLOSEOUT_STEP_IDS,
} from "../../packages/core/src/contracts/index";
import { closeoutStepDefinitions } from "../../packages/core/src/domain/closeout";
import { SECRET_READ_ALLOWLIST } from "../../scripts/checks/secret-read-boundary";
import shapes from "../fixtures/providers/conformance/milestone/shapes.json";

const ROOT = process.cwd();
const clientSource = readFileSync(join(ROOT, "packages/adapters/src/github/client.ts"), "utf8");
const contractSource = readFileSync(join(ROOT, "packages/core/src/contracts/closeout.ts"), "utf8");
const domainSource = readFileSync(join(ROOT, "packages/core/src/domain/closeout.ts"), "utf8");

const clientWith = (
  send: (request: { readonly url: string }) => Promise<{ status: number; body: unknown }>,
) =>
  createGitHubClient({
    instance: {
      instanceName: "vcs-github",
      systemKind: "vcs",
      baseUrl: "https://api.github.example.com",
      authMethod: { mechanism: "anonymous" },
    },
    repository: { owner: "owner-placeholder", name: "project-placeholder" },
    transport: { send },
  });

describe("TC-F4-009 the close-milestone vocabulary cannot express an unsafe act", () => {
  test("the recorded operation name set is seven with close-milestone appended", () => {
    expect([...CLOSEOUT_OPERATION_NAMES]).toEqual([
      "transition-work-item",
      "write-work-item",
      "resolve-delivery-thread",
      "restore-checkout",
      "delete-branch",
      "remove-worktree",
      "close-milestone",
    ]);
  });

  test("the milestone argument shape declares exactly one operand", () => {
    const start = contractSource.indexOf("export type CloseoutMilestoneArguments = {");
    const end = contractSource.indexOf("};", start);
    const block = contractSource.slice(start, end);
    expect(block).toContain("readonly milestone: string;");
    expect(block.match(/readonly /gu)).toHaveLength(1);
    for (const forbidden of ["attach", "detach", "rename", "reopen", "create"]) {
      expect(block.toLowerCase()).not.toContain(forbidden);
    }
  });

  test("the declared provider write surface accepts only the milestone identity", () => {
    const start = clientSource.indexOf("readonly closeMilestone:");
    const end = clientSource.indexOf("};", start);
    const block = clientSource.slice(start, end);
    expect(block).toContain("readonly milestone: string;");
    expect(block).not.toMatch(/attach|detach|rename|reopen/iu);
  });

  test("one milestone-sync step definition exists with the delivered label", () => {
    expect(closeoutStepDefinitions.map((step) => step.stepId)).toEqual([...CLOSEOUT_STEP_IDS]);
    const definitions = closeoutStepDefinitions.filter((step) => step.stepId === "milestone-sync");
    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.label).toBe("milestone synchronization");
    expect(domainSource).toContain('"milestone-sync-withheld"');
  });

  test("the withheld-reason set and the residue kind are the declared closed values", () => {
    expect([...CLOSEOUT_MILESTONE_WITHHELD_REASONS]).toEqual([
      "declared-milestone-missing",
      "attachment-mismatch",
      "closure-withheld",
      "attached-set-truncated",
      "milestone-signal-unavailable",
    ]);
    expect(CLOSEOUT_MILESTONE_WITHHELD_REASONS).not.toContain("unknown-state");
    expect(CAPSULE_RESIDUE_KINDS).toContain("milestone-sync-withheld");
    expect(CAPSULE_RESIDUE_KINDS[CAPSULE_RESIDUE_KINDS.length - 1]).toBe("milestone-sync-withheld");
  });
});

describe("TC-F4-015 the bounded read adds no operation and no flag", () => {
  test("the closed operation set gains exactly the one milestone close", () => {
    expect([...ADAPTER_OPERATIONS]).toHaveLength(10);
    expect(ADAPTER_OPERATIONS[9]).toBe("close-milestone");
    expect(ADAPTER_OPERATIONS.filter((operation) => operation.includes("milestone"))).toEqual([
      "close-milestone",
    ]);
  });

  test("the three declarations carry the declared postures and no read flag", () => {
    expect(GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations).toContain("close-milestone");
    expect(GITHUB_ADAPTER_CONTRACT.capabilities.declaredGaps).toEqual([]);
    expect(GITLAB_ADAPTER_CONTRACT.capabilities.declaredGaps).toContainEqual({
      operation: "close-milestone",
      reason: "adapter-not-implemented",
    });
    expect(JIRA_ADAPTER_CONTRACT.capabilities.declaredGaps).toContainEqual({
      operation: "close-milestone",
      reason: "provider-unsupported",
    });
    for (const contract of [
      GITHUB_ADAPTER_CONTRACT,
      GITLAB_ADAPTER_CONTRACT,
      JIRA_ADAPTER_CONTRACT,
    ]) {
      expect(Object.keys(contract.capabilities).sort()).toEqual([
        "declaredGaps",
        "readableCarriers",
        "supportedOperations",
        "writableCarriers",
      ]);
    }
  });

  test("both milestone surfaces ride the delivered transport and credential seam", () => {
    expect(clientSource).toContain("readMilestone: async");
    expect(clientSource).toContain("readonly readMilestone:");
    expect(clientSource).toContain("readonly closeMilestone:");
    expect(clientSource).toContain("transport.send");
  });

  test("the secret-read allowlist is exactly the delivered set", () => {
    expect(SECRET_READ_ALLOWLIST.map((entry) => `${entry.kind}:${entry.path}`)).toEqual([
      "directory:packages/adapters/src/credentials",
      "file:packages/core/src/state/driver/runtime-edge.ts",
      "file:packages/adapters/src/file/yaml-parser.ts",
      "file:packages/adapters/src/legacy/index.ts",
      "file:packages/mcp/src/serve.ts",
    ]);
  });
});

describe("TC-SYNC-007 the four read facts never collapse", () => {
  const record = shapes.records.unknown as { readonly title: string };

  test("an absent surface is the adapter's declared gap, never an empty read", () => {
    expect(GITLAB_ADAPTER_CONTRACT.capabilities.supportedOperations).not.toContain(
      "close-milestone",
    );
    expect(JIRA_ADAPTER_CONTRACT.capabilities.supportedOperations).not.toContain("close-milestone");
    expect(
      GITLAB_ADAPTER_CONTRACT.capabilities.declaredGaps.find(
        (gap) => gap.operation === "close-milestone",
      )?.reason,
    ).toBe("adapter-not-implemented");
  });

  test("an unavailable signal is a classified failure, never an empty attached set", async () => {
    const client = clientWith(async () => {
      throw new Error("transport down");
    });
    const read = await client.readMilestone({ entityId: "349" });
    expect(read.ok).toBe(false);
  });

  test("an unknown state stays unknown and is never coerced to open or closed", async () => {
    const client = clientWith(async (request) =>
      request.url.includes("milestone=")
        ? { status: 200, body: [] }
        : {
            status: 200,
            body: { number: 349, milestone: { number: 4, title: record.title, state: undefined } },
          },
    );
    const read = await client.readMilestone({ entityId: "349" });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.state).toBe("unknown");
    expect(read.value.attachedItems).toEqual([]);
  });

  test("a truncated page carries the marker and the declared page size", async () => {
    const client = clientWith(async (request) =>
      request.url.includes("milestone=")
        ? {
            status: 200,
            body: [
              { number: 1, title: "done", state: "closed", labels: [] },
              { number: 2, title: "done two", state: "closed", labels: [] },
            ],
          }
        : {
            status: 200,
            body: {
              number: 349,
              milestone: {
                number: 4,
                title: record.title,
                state: "open",
                open_issues: 0,
                closed_issues: 3,
              },
            },
          },
    );
    const read = await client.readMilestone({ entityId: "349" });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.truncation).toEqual({
      truncated: true,
      omitted: 1,
      cap: CLOSEOUT_MILESTONE_PAGE_SIZE,
    });
    expect(CLOSEOUT_MILESTONE_PAGE_SIZE).toBe(100);
    expect(CLOSEOUT_MILESTONE_LOGICAL_CAP).toBe(200);
  });

  test("the page is one bounded read with no follow-up page request", async () => {
    const requests: string[] = [];
    const client = clientWith(async (request) => {
      requests.push(request.url);
      return request.url.includes("milestone=")
        ? { status: 200, body: [] }
        : {
            status: 200,
            body: { number: 349, milestone: { number: 4, title: record.title, state: "open" } },
          };
    });
    const read = await client.readMilestone({ entityId: "349" });
    expect(read.ok).toBe(true);
    expect(requests).toHaveLength(2);
    const pageRequests = requests.filter((url) => url.includes("milestone="));
    expect(pageRequests).toHaveLength(1);
    expect(pageRequests[0]).toContain("per_page=100");
    expect(pageRequests[0]).not.toMatch(/[?&]page=/u);
  });
});
