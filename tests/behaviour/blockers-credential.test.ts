/**
 * TC-BLK-017/018 — layer 1 refuses registered secret values on every content
 * path with zero persisted bytes, no leak, and the name-only hint; the injected
 * registered-secrets record is the oracle.
 */
import { describe, expect, test } from "bun:test";
import {
  bothSecrets,
  OPTION_WITH_SECRET,
  PROSE_WITH_SECRET,
  REGISTERED_SECRET,
  REGISTERED_SECRET_B,
  secrets,
  secretsB,
} from "../fixtures/blockers/credentials";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { makeQuestion } from "../fixtures/blockers/records";

const withoutSecret = (text: string): string => text.split(REGISTERED_SECRET).join("");

describe("TC-BLK-017 layer 1 refusals on every content path", () => {
  test("question text carrying a registered secret is refused with zero bytes", async () => {
    const harness = createBlockersHarness({ secrets: secrets() });
    try {
      const before = harness.ledgerBytes();
      const run = await harness.run([
        "publish",
        "spec-ambiguity",
        "--lane",
        "L2",
        PROSE_WITH_SECRET,
      ]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({
        code: "blockers.credential-value-rejected",
        category: "user",
        retryable: false,
        consequence: "not_landed",
      });
      expect(run.data).toBeUndefined();
      expect(harness.ledgerBytes().equals(before)).toBe(true);
      const error = run.envelope?.error as Record<string, unknown>;
      expect(String(error.remediationHint)).toContain("variable name only");
      expect(String(error.remediationHint)).toContain("environment");
      for (const text of [run.stdout, run.stderr, JSON.stringify(run.envelope)]) {
        expect(text.includes(REGISTERED_SECRET)).toBe(false);
      }
    } finally {
      harness.cleanup();
    }
  });

  test("an option value carrying a registered secret is refused with zero bytes", async () => {
    const harness = createBlockersHarness({ secrets: secrets() });
    try {
      const run = await harness.run([
        "publish",
        "decision-needed",
        "--lane",
        "L5",
        "--options",
        `a,${OPTION_WITH_SECRET}`,
        "pick one",
      ]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "blockers.credential-value-rejected" });
      expect(harness.read().verifiedEmpty).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("answer text carrying a registered secret is refused and the question stays open", async () => {
    const harness = createBlockersHarness({
      secrets: secrets(),
      seedQuestions: [
        makeQuestion({ id: "q-open", type: "spec-ambiguity", audience: "owner", options: [] }),
      ],
    });
    try {
      const before = harness.ledgerBytes();
      const run = await harness.run(["answer", "q-open", "--text", PROSE_WITH_SECRET]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "blockers.credential-value-rejected" });
      expect(harness.ledgerBytes().equals(before)).toBe(true);
      const open = await harness.run(["list", "--open"]);
      const openQuestions = open.data?.questions as Record<string, unknown>[] | undefined;
      expect(openQuestions?.[0]?.status).toBe("open");
      expect(open.stdout.includes(REGISTERED_SECRET)).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  test("a valid publish immediately after a refusal still succeeds", async () => {
    const harness = createBlockersHarness({ secrets: secrets() });
    try {
      expect(
        (await harness.run(["publish", "spec-ambiguity", "--lane", "L2", PROSE_WITH_SECRET]))
          .exitCode,
      ).toBe(1);
      expect(
        (await harness.run(["publish", "spec-ambiguity", "--lane", "L2", "clean question"]))
          .exitCode,
      ).toBe(0);
      expect(harness.read().questions).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-BLK-018 the injected secrets record is the guard oracle", () => {
  test("swapping the registered record changes the verdict", async () => {
    const withA = createBlockersHarness({
      secrets: secrets(),
      seedQuestions: [
        makeQuestion({ id: "q-a", type: "spec-ambiguity", audience: "owner", options: [] }),
      ],
    });
    try {
      expect(
        (await withA.run(["answer", "q-a", "--text", `name ${REGISTERED_SECRET}`])).exitCode,
      ).toBe(1);
    } finally {
      withA.cleanup();
    }
    const withB = createBlockersHarness({
      secrets: secretsB(),
      seedQuestions: [
        makeQuestion({ id: "q-a", type: "spec-ambiguity", audience: "owner", options: [] }),
      ],
    });
    try {
      const accepted = await withB.run(["answer", "q-a", "--text", `name ${REGISTERED_SECRET}`]);
      expect(accepted.exitCode).toBe(0);
      expect(withoutSecret(String(accepted.data?.text))).toBe("name ");
    } finally {
      withB.cleanup();
    }
  });

  test("both registered values are refused; neither is accepted", async () => {
    const harness = createBlockersHarness({ secrets: bothSecrets() });
    try {
      for (const text of [`a ${REGISTERED_SECRET}`, `b ${REGISTERED_SECRET_B}`]) {
        const run = await harness.run(["publish", "spec-ambiguity", "--lane", "L2", text]);
        expect(run.exitCode, text).toBe(1);
        expect(run.envelope?.error).toMatchObject({ code: "blockers.credential-value-rejected" });
      }
      const clean = await harness.run(["publish", "spec-ambiguity", "--lane", "L2", "clean"]);
      expect(clean.exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("no registered value reaches the ledger or any output", async () => {
    const harness = createBlockersHarness({ secrets: bothSecrets() });
    try {
      await harness.run(["publish", "spec-ambiguity", "--lane", "L2", "clean question"]);
      const ledger = harness.ledgerText();
      expect(ledger.includes(REGISTERED_SECRET)).toBe(false);
      expect(ledger.includes(REGISTERED_SECRET_B)).toBe(false);
      const human = await harness.run(["list"], { json: false });
      expect(human.stdout.includes(REGISTERED_SECRET)).toBe(false);
      expect(human.stdout.includes(REGISTERED_SECRET_B)).toBe(false);
    } finally {
      harness.cleanup();
    }
  });
});
