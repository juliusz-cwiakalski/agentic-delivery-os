/**
 * TC-PRIVACY-018/019 — authoring mode: stdin-only record, no echo, no writes,
 * CI refusal under both markers, and no argv/environment input channel.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  normalizeLiteral,
  privacyDigestInput,
} from "../../packages/adapters/src/io/privacy-rules.js";
import { AUTHORING_LITERAL } from "../fixtures/privacy-literals/activation";
import {
  gitStatus,
  makeMutantCheck,
  ROOT,
  runAuthoring,
  snapshotTree,
  withoutCiEnvironment,
} from "./privacy-support";

const recompute = (literal: string): string =>
  createHash("sha256").update(privacyDigestInput(literal), "utf8").digest("hex");

const noCi = (): NodeJS.ProcessEnv => withoutCiEnvironment();

describe("TC-PRIVACY-018 authoring mode: stdin-only record, no echo, no writes", () => {
  test("a piped literal yields exactly the registry-entry-shaped record", () => {
    const snapshotBefore = snapshotTree(ROOT);
    const statusBefore = gitStatus(ROOT);
    const result = runAuthoring(`${AUTHORING_LITERAL}\n`, [], noCi());
    expect(result.status).toBe(0);
    const record = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(Object.keys(record).sort()).toEqual(
      ["algorithm", "class", "hash", "id", "length", "reason"].sort(),
    );
    expect(record.class).toBe("private-literal");
    expect(record.algorithm).toBe("sha256");
    expect(record.hash).toBe(recompute(AUTHORING_LITERAL));
    expect(record.length).toBe(normalizeLiteral(AUTHORING_LITERAL).length);
    expect(String(record.id).length).toBeGreaterThan(0);
    expect(String(record.reason).length).toBeGreaterThan(0);
    expect(Object.hasOwn(record, "content")).toBe(false);
    expect(`${result.stdout}${result.stderr}`).not.toContain(AUTHORING_LITERAL);
    expect(`${result.stdout}${result.stderr}`).not.toContain(privacyDigestInput(AUTHORING_LITERAL));
    expect(snapshotTree(ROOT)).toEqual(snapshotBefore);
    expect(gitStatus(ROOT)).toBe(statusBefore);
  });

  test("the class flag selects the emitted class", () => {
    const result = runAuthoring(`${AUTHORING_LITERAL}\n`, ["--class", "cloud-term"], noCi());
    expect(result.status).toBe(0);
    expect((JSON.parse(result.stdout) as { class: string }).class).toBe("cloud-term");
  });

  test("empty and over-512 inputs fail with no digest", () => {
    for (const input of ["", "   \n", `${"a".repeat(600)}\n`]) {
      const result = runAuthoring(input, [], noCi());
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("FAIL privacy-literals:");
      expect(result.stdout).not.toMatch(/[0-9a-f]{64}/);
      expect(result.stderr).not.toMatch(/[0-9a-f]{64}/);
    }
  });

  test("an echo-enabled mutant is caught by the absence assertion", async () => {
    const mutant = makeMutantCheck({
      replacements: [
        {
          search: "process.stdout.write(`${JSON.stringify(outcome.record)}\\n`);",
          replacement: "process.stdout.write(`${raw} ${JSON.stringify(outcome.record)}\\n`);",
        },
      ],
    });
    try {
      const clean = runAuthoring(`${AUTHORING_LITERAL}\n`, [], noCi());
      expect(clean.stdout).not.toContain(AUTHORING_LITERAL);
      const echoed = spawnSync("bun", ["run", mutant.checkPath, "--author"], {
        cwd: ROOT,
        encoding: "utf8",
        input: `${AUTHORING_LITERAL}\n`,
        env: noCi(),
      });
      expect(echoed.status).toBe(0);
      expect(`${echoed.stdout}${echoed.stderr}`).toContain(AUTHORING_LITERAL);
    } finally {
      mutant.cleanup();
    }
  });
});

describe("TC-PRIVACY-019 authoring mode: CI refusal and no argv/env channel", () => {
  test("both CI markers refuse before reading input, without echoing content", () => {
    for (const marker of ["CI", "GITHUB_ACTIONS"]) {
      const env = { ...noCi(), [marker]: "true" };
      const result = runAuthoring(`${AUTHORING_LITERAL}\n`, [], env);
      expect(result.status, marker).toBe(2);
      expect(result.stderr, marker).toContain("CI");
      expect(`${result.stdout}${result.stderr}`, marker).not.toContain(AUTHORING_LITERAL);
      expect(`${result.stdout}${result.stderr}`, marker).not.toMatch(/[0-9a-f]{64}/);
    }
  });

  test("without a marker the same invocation succeeds", () => {
    const result = runAuthoring(`${AUTHORING_LITERAL}\n`, [], noCi());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"algorithm":"sha256"');
  });

  test("argv and environment are never literal channels and are never echoed", () => {
    const viaArgv = runAuthoring("", [AUTHORING_LITERAL], noCi());
    expect(viaArgv.status).toBe(2);
    expect(`${viaArgv.stdout}${viaArgv.stderr}`).not.toContain(AUTHORING_LITERAL);
    expect(viaArgv.stderr).toContain("empty");

    const viaEnvironment = runAuthoring("", [], {
      ...noCi(),
      PRIVACY_AUTHORING_LITERAL: AUTHORING_LITERAL,
    });
    expect(viaEnvironment.status).toBe(2);
    expect(`${viaEnvironment.stdout}${viaEnvironment.stderr}`).not.toContain(AUTHORING_LITERAL);
  });
});
