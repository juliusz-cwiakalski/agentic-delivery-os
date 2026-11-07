/**
 * TC-BLK-020 — TDR-0011's executable residual: unregistered token-like prose on
 * non-credential-missing paths is accepted (no shape refusal), while registered
 * values are refused by layer 1 and value-shaped credential-missing questions
 * are refused by layer 2. No generic pattern layer exists.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  REGISTERED_SECRET,
  secrets,
  UNREGISTERED_TOKEN_LIKE,
} from "../fixtures/blockers/credentials";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { makeQuestion } from "../fixtures/blockers/records";

const ROOT = process.cwd();
const DOMAIN = "packages/core/src/domain/blockers.ts";

describe("TC-BLK-020 TDR-0011 negative controls", () => {
  test("unregistered token-like prose is accepted on spec-ambiguity, options, and answers", async () => {
    const harness = createBlockersHarness({
      secrets: secrets(),
      seedQuestions: [
        makeQuestion({ id: "q-s", type: "spec-ambiguity", audience: "owner", options: [] }),
        makeQuestion({ id: "q-e", type: "external-wait", audience: "coordinator", options: [] }),
      ],
    });
    try {
      expect(
        (
          await harness.run([
            "publish",
            "spec-ambiguity",
            "--lane",
            "L2",
            `prose ${UNREGISTERED_TOKEN_LIKE}`,
          ])
        ).exitCode,
      ).toBe(0);
      expect(
        (
          await harness.run([
            "publish",
            "decision-needed",
            "--lane",
            "L5",
            "--options",
            `a,${UNREGISTERED_TOKEN_LIKE}`,
            "pick",
          ])
        ).exitCode,
      ).toBe(0);
      expect(
        (await harness.run(["answer", "q-e", "--text", `answer ${UNREGISTERED_TOKEN_LIKE}`]))
          .exitCode,
      ).toBe(0);
      expect(harness.read().answers[0]?.text).toBe(`answer ${UNREGISTERED_TOKEN_LIKE}`);
    } finally {
      harness.cleanup();
    }
  });

  test("a credential-missing answer carrying the variable name and no value is accepted", async () => {
    const harness = createBlockersHarness({
      secrets: secrets(),
      seedQuestions: [
        makeQuestion({
          id: "q-c",
          type: "credential-missing",
          audience: "owner",
          question: "GITHUB_TOKEN",
          options: [],
        }),
      ],
    });
    try {
      const run = await harness.run(["answer", "q-c", "--text", "GITHUB_TOKEN"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.text).toBe("GITHUB_TOKEN");
    } finally {
      harness.cleanup();
    }
  });

  test("the same unregistered value-shaped string is refused as credential-missing", async () => {
    const harness = createBlockersHarness({ secrets: secrets() });
    try {
      const run = await harness.run([
        "publish",
        "credential-missing",
        "--lane",
        "L4",
        UNREGISTERED_TOKEN_LIKE,
      ]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "blockers.credential-value-rejected" });
      expect(harness.read().verifiedEmpty).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("a registered value is refused by layer 1 on every path", async () => {
    const harness = createBlockersHarness({
      secrets: secrets(),
      seedQuestions: [
        makeQuestion({ id: "q-s", type: "spec-ambiguity", audience: "owner", options: [] }),
      ],
    });
    try {
      const paths: readonly (readonly string[])[] = [
        ["publish", "spec-ambiguity", "--lane", "L2", `x ${REGISTERED_SECRET}`],
        ["publish", "external-wait", "--lane", "L3", `x ${REGISTERED_SECRET}`],
        ["answer", "q-s", "--text", `x ${REGISTERED_SECRET}`],
      ];
      for (const argv of paths) {
        const run = await harness.run(argv);
        expect(run.exitCode, argv.join(" ")).toBe(1);
        expect(run.envelope?.error, argv.join(" ")).toMatchObject({
          code: "blockers.credential-value-rejected",
        });
      }
    } finally {
      harness.cleanup();
    }
  });

  test("no token-shape pattern layer exists beyond the one name-shape datum", () => {
    const text = readFileSync(join(ROOT, DOMAIN), "utf8");
    expect(text.match(/new RegExp\(/g) ?? []).toHaveLength(1);
    expect(text.includes("privacy")).toBe(false);
    expect(text.includes("TOKEN_PATTERN")).toBe(false);
    expect(text.includes("PATTERNS")).toBe(false);
  });
});
