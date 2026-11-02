/** TC-CLOSE-059/061/067 — bounded output, error projection, and no leaks. */
import { describe, expect, test } from "bun:test";
import { CLOSEOUT_MAX_MACHINE_BYTES } from "../../packages/core/src/contracts/index";
import { CANARY_TEXT } from "../fixtures/closeout/canary";
import { closeoutData, errorOf, runCloseoutCli } from "../fixtures/closeout/cli";
import {
  makeFacts,
  makeMergedRequest,
  makeWorkItem,
  observed,
  WORK_ITEM_REF,
} from "../fixtures/closeout/harness";
import { fakeInvalidPayload, fakeNotFound } from "../fixtures/closeout/read-observation";

describe("TC-CLOSE-059 machine output is one bounded leak-free envelope", () => {
  test("the plan envelope is one delivery.closeout.v1 payload within the byte bound", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--json"]);
    expect(run.stdout.trim().startsWith("{")).toBe(true);
    expect(run.stdout.trim().endsWith("}")).toBe(true);
    const parsed: unknown = JSON.parse(run.stdout);
    expect(typeof parsed).toBe("object");
    const data = closeoutData(run.envelope);
    expect(data.schemaId).toBe("delivery.closeout.v1");
    expect(run.stdout.length).toBeLessThanOrEqual(CLOSEOUT_MAX_MACHINE_BYTES);
  });

  test("a planted canary in the title and comments never reaches output", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--json"], {
      facts: makeFacts({
        observedWorkItem: observed(
          makeWorkItem({
            title: `Title ${CANARY_TEXT}`,
            comments: [{ commentId: "c-1", authorAccount: "a", body: `Body ${CANARY_TEXT}` }],
          }),
        ),
      }),
    });
    expect(run.stdout.includes(CANARY_TEXT)).toBe(false);
    expect(run.stderr.includes(CANARY_TEXT)).toBe(false);
  });
});

describe("TC-CLOSE-061 four closeout identities project exactly", () => {
  test("not-found is user-validation exit 1", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--json"], {
      facts: makeFacts({ observedWorkItem: fakeNotFound() }),
    });
    expect(run.exitCode).toBe(1);
    const error = errorOf(run.envelope);
    expect(error).toMatchObject({
      code: "closeout.target.unobserved",
      category: "user",
      retryable: false,
      consequence: "not_landed",
    });
  });

  test("ambiguous on apply is user-validation exit 1", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"], {
      facts: makeFacts({
        mergedRequest: observed(makeMergedRequest({ headSha: "not-a-branch-head" })),
        branches: [
          { name: "feat/GH-183/a", head: "a".repeat(40) },
          { name: "feat/GH-183/b", head: "b".repeat(40) },
        ],
      }),
    });
    expect(run.exitCode).toBe(1);
    expect(errorOf(run.envelope).code).toBe("closeout.target.ambiguous");
  });

  test("write failure is transient exit 2", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"], {
      provider: (await import("../fixtures/closeout/harness")).makeProvider({
        writeWorkItem: { ok: false, code: "closeout.write.failed", detail: "synthetic" },
      }),
    });
    expect(run.exitCode).toBe(2);
    const error = errorOf(run.envelope);
    expect(error).toMatchObject({
      code: "closeout.write.failed",
      category: "transient",
      retryable: true,
      consequence: "unknown",
    });
  });

  test("branch refusal is user-validation exit 1", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"], {
      facts: makeFacts({ mergedRequest: observed(makeMergedRequest({ headSha: undefined })) }),
    });
    expect(run.exitCode).toBe(1);
    expect(errorOf(run.envelope).code).toBe("closeout.branch.unsafe");
  });

  test("a malformed payload is provider.payload.invalid at exit 2", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--json"], {
      facts: makeFacts({ observedWorkItem: fakeInvalidPayload() }),
    });
    expect(run.exitCode).toBe(2);
    expect(errorOf(run.envelope).code).toBe("provider.payload.invalid");
  });
});
