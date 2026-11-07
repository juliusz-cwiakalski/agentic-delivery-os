/**
 * TC-BLK-039 — privacy: no credential value, unrelated ambient value, raw
 * provider payload, tracker title/body, or authentication evidence reaches the
 * ledger, envelope, human line, or diagnostics; legitimate content does.
 */
import { describe, expect, test } from "bun:test";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import {
  CONTENT_CANARY,
  cleanQuestion,
  PRIVACY_SECRET,
  privacySecrets,
  secretQuestion,
  UNRELATED_AMBIENT,
} from "../fixtures/blockers/privacy";
import { makeQuestion } from "../fixtures/blockers/records";

const scan = (text: string, needles: readonly string[]): readonly string[] =>
  needles.filter((needle) => text.includes(needle));

const SECRET_NEEDLES = [PRIVACY_SECRET, UNRELATED_AMBIENT];

describe("TC-BLK-039 privacy", () => {
  test("legitimate content is persisted and rendered; ambient values are absent", async () => {
    const harness = createBlockersHarness({ secrets: privacySecrets() });
    try {
      const publish = await harness.run([
        "publish",
        "spec-ambiguity",
        "--lane",
        "L2",
        cleanQuestion(),
      ]);
      expect(publish.exitCode).toBe(0);
      expect(publish.stdout).toContain(CONTENT_CANARY);
      expect(scan(harness.ledgerText(), SECRET_NEEDLES)).toEqual([]);
      const list = await harness.run(["list"], { json: false });
      expect(list.stdout).toContain(CONTENT_CANARY);
      expect(scan(list.stdout, SECRET_NEEDLES)).toEqual([]);
      expect(scan(list.stderr, SECRET_NEEDLES)).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });

  test("a credential refusal leaves the secret absent everywhere", async () => {
    const harness = createBlockersHarness({
      secrets: privacySecrets(),
      seedQuestions: [
        makeQuestion({ id: "q-open", type: "spec-ambiguity", audience: "owner", options: [] }),
      ],
    });
    try {
      const publish = await harness.run([
        "publish",
        "spec-ambiguity",
        "--lane",
        "L2",
        secretQuestion(),
      ]);
      expect(publish.exitCode).toBe(1);
      const answer = await harness.run(["answer", "q-open", "--text", secretQuestion()]);
      expect(answer.exitCode).toBe(1);
      for (const text of [
        publish.stdout,
        publish.stderr,
        JSON.stringify(publish.envelope),
        answer.stdout,
        answer.stderr,
        JSON.stringify(answer.envelope),
        harness.ledgerText(),
      ]) {
        expect(scan(text, SECRET_NEEDLES)).toEqual([]);
      }
      const error = publish.envelope?.error as Record<string, unknown>;
      expect(String(error.remediationHint)).not.toContain(PRIVACY_SECRET);
      expect(String(error.remediationHint)).toContain("variable name only");
    } finally {
      harness.cleanup();
    }
  });

  test("the ledger carries only declared record fields and no environment dump", async () => {
    const harness = createBlockersHarness({
      secrets: privacySecrets(),
      seedQuestions: [makeQuestion({ id: "q-1", options: ["a"] })],
    });
    try {
      await harness.run(["publish", "spec-ambiguity", "--lane", "L2", cleanQuestion()]);
      await harness.run(["answer", "q-1", "--choice", "1"]);
      const payloads = harness
        .ledgerText()
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      const declared = new Set([
        "schemaId",
        "id",
        "type",
        "audience",
        "lane",
        "ref",
        "question",
        "options",
        "askedAt",
        "questionId",
        "answeringAudience",
        "choice",
        "text",
        "answeredAt",
        "applied",
        "laneResume",
        "mode",
        "sessionReentry",
        "capabilitySource",
        "prefillCost",
      ]);
      const collectKeys = (value: unknown, keys: Set<string>): void => {
        if (Array.isArray(value)) {
          for (const entry of value) collectKeys(entry, keys);
        } else if (typeof value === "object" && value !== null) {
          for (const [key, entry] of Object.entries(value)) {
            keys.add(key);
            collectKeys(entry, keys);
          }
        }
      };
      const keys = new Set<string>();
      for (const payload of payloads) {
        collectKeys(payload.payload, keys);
      }
      for (const key of keys) expect(declared.has(key), key).toBe(true);
      expect(harness.ledgerText()).not.toContain("CALLER_AUDIENCE");
      expect(harness.ledgerText()).not.toContain("EXAMPLE_PRODUCT_");
      expect(harness.ledgerText()).not.toContain("token");
    } finally {
      harness.cleanup();
    }
  });

  test("the privacy scanner control finds a planted ambient value", () => {
    const fakeOutput = `status: ${UNRELATED_AMBIENT}`;
    expect(scan(fakeOutput, SECRET_NEEDLES)).toEqual([UNRELATED_AMBIENT]);
    expect(scan(`status: ${CONTENT_CANARY}`, SECRET_NEEDLES)).toEqual([]);
  });
});
