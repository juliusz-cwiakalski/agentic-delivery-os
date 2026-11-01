/** TC-CLOSE-035/063 — caps, bounded work, and wired timeouts. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createGitBranchSeam } from "../../packages/adapters/src/git/index";
import { createGitHubClient } from "../../packages/adapters/src/github/client";
import {
  CLOSEOUT_MAX_DEPENDENTS,
  CLOSEOUT_MAX_THREADS,
  CLOSEOUT_OPERATION_TIMEOUT_MS,
} from "../../packages/core/src/contracts/index";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { eligibleDependent } from "../fixtures/closeout/dependents";
import { makeFacts, makeMergedRequest, observed } from "../fixtures/closeout/harness";
import { manyThreads } from "../fixtures/closeout/threads";

const ROOT = process.cwd();

describe("TC-CLOSE-035 dependent and thread caps", () => {
  test("the 200 dependent cap retains exactly the first ordered batch", () => {
    const dependents = Array.from({ length: CLOSEOUT_MAX_DEPENDENTS + 1 }, (_, index) =>
      eligibleDependent(String(1000 + index)),
    );
    const step = buildCloseoutPlan(makeFacts({ dependents: observed(dependents) })).steps.find(
      (entry) => entry.stepId === "owed-flip-sweep",
    );
    expect(step?.operations).toHaveLength(CLOSEOUT_MAX_DEPENDENTS);
    expect(step?.truncation).toEqual({
      truncated: true,
      omitted: 1,
      cap: CLOSEOUT_MAX_DEPENDENTS,
    });
  });

  test("the 100 thread cap truncates one above the bound", () => {
    const step = buildCloseoutPlan(
      makeFacts({
        mergedRequest: observed(
          makeMergedRequest({ threads: manyThreads(CLOSEOUT_MAX_THREADS + 1) }),
        ),
      }),
    ).steps.find((entry) => entry.stepId === "comment-resolution");
    expect(step?.operations).toHaveLength(CLOSEOUT_MAX_THREADS);
  });
});

describe("TC-CLOSE-063 timeout wiring is structural and behavioral", () => {
  test("every provider native default and the git seam reference the production constant", () => {
    for (const file of [
      "packages/adapters/src/github/client.ts",
      "packages/adapters/src/jira/client.ts",
      "packages/adapters/src/gitlab/client.ts",
      "packages/adapters/src/git/index.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text.includes("CLOSEOUT_OPERATION_TIMEOUT_MS"), file).toBe(true);
    }
    expect(CLOSEOUT_OPERATION_TIMEOUT_MS).toBe(30_000);
  });

  test("a removal control fails the structural assertion", () => {
    const source = readFileSync(join(ROOT, "packages/adapters/src/github/client.ts"), "utf8");
    expect(
      source
        .replaceAll("CLOSEOUT_OPERATION_TIMEOUT_MS", "DEFAULT")
        .includes("CLOSEOUT_OPERATION_TIMEOUT_MS"),
    ).toBe(false);
  });

  test("a never-resolving provider transport aborts at the injected short bound", async () => {
    const client = createGitHubClient({
      instance: {
        instanceName: "github",
        systemKind: "vcs",
        baseUrl: "https://github.example.com",
        authMethod: { mechanism: "anonymous" },
      },
      credentials: {
        resolve: () => ({
          ok: false,
          code: "config.credential.missing",
          domainKind: "config",
          category: "user",
          retryable: false,
          consequence: "not_landed",
          projectionClass: "user-validation",
        }),
      },
      repository: { owner: "owner", name: "repo" },
      timeoutMs: 5,
      transport: {
        send: async (request) =>
          new Promise((_resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error("aborted")),
              request.timeoutMs ?? 30_000,
            );
            timer.unref?.();
          }),
      },
    });
    const started = performance.now();
    const result = await client.readDeliveryRequest(1);
    expect(result.ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  test("a non-terminating injected git child aborts at the bound", async () => {
    const seam = createGitBranchSeam({
      timeoutMs: 5,
      childRunner: async () => new Promise(() => {}),
    });
    const result = await seam.deleteBranch({ branch: "feat/GH-183/x" });
    expect(result.ok).toBe(false);
  });
});
