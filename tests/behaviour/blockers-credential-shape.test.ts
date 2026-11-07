/**
 * TC-BLK-019 — layer 2 makes `credential-missing` question text value-free by
 * construction; the rule is path-scoped and data-driven, and layer 1 wins.
 */
import { describe, expect, test } from "bun:test";
import { evaluateBlockerGuard } from "../../packages/core/src/domain/blockers";
import {
  INVALID_CREDENTIAL_TEXTS,
  REGISTERED_SECRET,
  secrets,
  VALID_NAMES,
} from "../fixtures/blockers/credentials";
import { createBlockersHarness } from "../fixtures/blockers/harness";

describe("TC-BLK-019 layer 2 variable-name shape", () => {
  test("name-shaped credential-missing questions are accepted and rendered name-only", async () => {
    const harness = createBlockersHarness({ secrets: secrets() });
    try {
      for (const name of VALID_NAMES) {
        const run = await harness.run(["publish", "credential-missing", "--lane", "L4", name]);
        expect(run.exitCode, name).toBe(0);
        const question = run.data?.question as Record<string, unknown> | undefined;
        expect(question?.question).toBe(name);
      }
      const list = await harness.run(["list"]);
      for (const name of VALID_NAMES) expect(list.stdout).toContain(name);
      expect(list.stdout.includes("=")).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  test("prose and value-shaped credential-missing texts are refused with zero bytes", async () => {
    const harness = createBlockersHarness({ secrets: secrets() });
    try {
      for (const text of INVALID_CREDENTIAL_TEXTS) {
        const before = harness.ledgerBytes();
        const run = await harness.run(["publish", "credential-missing", "--lane", "L4", text]);
        expect(run.exitCode, text).toBe(1);
        expect(run.envelope?.error, text).toMatchObject({
          code: "blockers.credential-value-rejected",
          consequence: "not_landed",
        });
        expect(harness.ledgerBytes().equals(before)).toBe(true);
      }
      expect(harness.read().verifiedEmpty).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("the same prose is accepted on non-credential-missing types (path-scoped)", async () => {
    const harness = createBlockersHarness({ secrets: secrets() });
    try {
      const text = "token: abc123";
      expect(
        (await harness.run(["publish", "spec-ambiguity", "--lane", "L2", text])).exitCode,
      ).toBe(0);
      expect((await harness.run(["publish", "external-wait", "--lane", "L3", text])).exitCode).toBe(
        0,
      );
      expect(harness.read().questions).toHaveLength(2);
    } finally {
      harness.cleanup();
    }
  });

  test("the name pattern is injectable data", () => {
    expect(
      evaluateBlockerGuard({ type: "credential-missing", question: "github_token", secrets: [] }),
    ).toMatchObject({ ok: false, code: "blockers.credential-value-rejected" });
    expect(
      evaluateBlockerGuard(
        { type: "credential-missing", question: "github_token", secrets: [] },
        { namePattern: "^[a-z_]+$" },
      ),
    ).toEqual({ ok: true });
    expect(
      evaluateBlockerGuard(
        { type: "credential-missing", question: "GITHUB_TOKEN", secrets: [] },
        { namePattern: "^[a-z_]+$" },
      ),
    ).toMatchObject({ ok: false });
  });

  test("layer 1 wins over layer 2 when a name-shaped text carries a registered value", () => {
    const verdict = evaluateBlockerGuard({
      type: "credential-missing",
      question: `BLOCKER_${REGISTERED_SECRET.toUpperCase()}`,
      secrets: [REGISTERED_SECRET.toUpperCase()],
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.summary).toContain("registered credential value");
  });
});
