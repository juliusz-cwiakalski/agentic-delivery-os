/**
 * TC-MSG-001..010 — the deterministic skeleton, noise/budget bundle, exactly
 * one constrained call, deterministic validation with one retry, and the marked
 * template fallback.
 */
import { describe, expect, test } from "bun:test";
import { withCommitHarness } from "../fixtures/commit/harness";
import {
  COMMIT_REF,
  commitDataOf,
  errorCodeOf,
  lastMessage,
  seedDirtyTree,
  telemetryPayloads,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;

describe("TC-MSG-001 deterministic skeleton", () => {
  test("the phase table owns type, scope, and the breaking default", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.coreTransport.push({
          kind: "success",
          message: { subject: `fix(${COMMIT_REF}): wrong type`, breaking: false },
        });
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(harness.coreTransport.calls).toHaveLength(2);
        expect(harness.coreTransport.calls[0]?.skeleton).toMatchObject({
          type: "feat",
          scope: COMMIT_REF,
          breaking: false,
        });
        expect(harness.coreTransport.calls[1]?.validationErrors?.join(" ")).toContain("type");
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-MSG-002 generated noise stripped and diff budget capped", () => {
  test("noise paths never reach the bundle and over-cap files stay metadata-only", async () => {
    const files: Record<string, string> = { "README.md": "# fixture\n" };
    const ordinary = Array.from(
      { length: 30 },
      (_, index) => `src/f${String(index).padStart(2, "0")}.ts`,
    );
    for (const path of ordinary) files[path] = "export const v = 1;\n";
    files["pnpm-lock.yaml"] = "lockfileVersion: 1\n";
    files["dist/app.min.js"] = "var a=1;\n";
    files["vendor/lib.js"] = "module.exports = 1;\n";
    files["assets/large.txt"] = `${"a".repeat(4000)}\n`;
    await withCommitHarness(
      async (harness) => {
        for (const path of ordinary) harness.repo.write(path, "export const v = 2;\n");
        harness.repo.write("pnpm-lock.yaml", "lockfileVersion: 2\n");
        harness.repo.write("dist/app.min.js", "var a=2;\n");
        harness.repo.write("vendor/lib.js", "module.exports = 2;\n");
        harness.repo.write("assets/large.txt", `${"b".repeat(4000)}\n`);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        const request = harness.coreTransport.calls[0];
        if (request === undefined) throw new Error("expected a transport call");
        const paths = request.bundle.files.map((file) => file.path);
        expect(paths).not.toContain("pnpm-lock.yaml");
        expect(paths).not.toContain("dist/app.min.js");
        expect(paths).not.toContain("vendor/lib.js");
        expect(paths).toContain("assets/large.txt");
        expect(paths).toEqual([...paths].sort());
        expect(request.bundle.files.find((file) => file.path === "assets/large.txt")).toMatchObject(
          {
            overCap: true,
          },
        );
        expect(request.bundle.totalInputChars).toBeLessThanOrEqual(8000);
        const excluded = commitDataOf(run).excluded;
        expect(excluded.noiseStripped).toEqual([
          "dist/app.min.js",
          "pnpm-lock.yaml",
          "vendor/lib.js",
        ]);
      },
      { seedFiles: files },
    );
  });
});

describe("TC-MSG-003 exactly one constrained call", () => {
  test("the request carries the schema, temperature, cap, and a subject within 72", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(harness.coreTransport.calls).toHaveLength(1);
        const request = harness.coreTransport.calls[0];
        expect(request?.schemaId).toBe("delivery.commit.message.v1");
        expect(request?.temperature).toBeLessThanOrEqual(0.1);
        expect(request?.maxOutputTokens).toBe(512);
        expect(commitDataOf(run).subject.length).toBeLessThanOrEqual(72);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-MSG-005 invented tracker references never land", () => {
  test("fabricated refs are removed and never reach the landed message", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.coreTransport.push({
          kind: "success",
          message: {
            subject: "feat(GH-999): add thing",
            body: "references GH-888",
            breaking: false,
          },
        });
        harness.coreTransport.push({
          kind: "success",
          message: validMessage(`feat(${COMMIT_REF}): add thing`),
        });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        const message = lastMessage(harness);
        expect(message).not.toContain("GH-999");
        expect(message).not.toContain("GH-888");
        expect(message).toContain(COMMIT_REF);
        expect(commitDataOf(run).messageSource).toBe("model");
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-MSG-006 off-list type/long subject → one retry with lint feedback", () => {
  test("exactly two calls and the retry carries the validation errors", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.coreTransport.push({
          kind: "success",
          message: {
            subject: `wip(${COMMIT_REF}): ${"x".repeat(90)}`,
            breaking: false,
          },
        });
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(harness.coreTransport.calls).toHaveLength(2);
        const errors = harness.coreTransport.calls[1]?.validationErrors ?? [];
        expect(errors.join(" ")).toContain("type");
        expect(errors.join(" ")).toContain("characters");
        expect(commitDataOf(run).messageSource).toBe("model");
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-MSG-007 second validation failure falls back to the marked template", () => {
  test("two calls, then the deterministic template lands as success", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        for (let index = 0; index < 2; index += 1) {
          harness.coreTransport.push({
            kind: "success",
            message: { subject: `wip(${COMMIT_REF}): invalid`, breaking: false },
          });
        }
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(harness.coreTransport.calls).toHaveLength(2);
        const data = commitDataOf(run);
        expect(data.messageSource).toBe("template");
        expect(data.transport).toBe("none");
        expect(data.subject).toBe(`feat(${COMMIT_REF}): deliver the fixture change`);
        expect(lastMessage(harness)).toContain(`feat(${COMMIT_REF}):`);
        expect(telemetryPayloads(harness)[0]?.messageSource).toBe("template");
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-MSG-008 template violating repo commitlint aborts", () => {
  test("nothing is staged or committed and the user identity is returned", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        for (let index = 0; index < 3; index += 1) {
          harness.commitlint.push({ status: "invalid", errors: ["template is forbidden"] });
        }
        for (let index = 0; index < 2; index += 1) {
          harness.coreTransport.push({
            kind: "success",
            message: { subject: `wip(${COMMIT_REF}): invalid`, breaking: false },
          });
        }
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(1);
        expect(errorCodeOf(run)).toBe("commit.commitlint-failed");
        expect(harness.repo.head()).toBeDefined();
        expect(harness.repo.statusPorcelain()).not.toBe("");
        expect(telemetryPayloads(harness)).toEqual([]);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-MSG-009 absent commitlint degrades to deterministic checks", () => {
  test("a valid message lands with no commitlint configuration", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(commitDataOf(run).messageSource).toBe("model");
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-MSG-010 body requirement follows the multi-area criterion", () => {
  test("a multi-area change needs a body; the retry supplies one", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        harness.repo.write("docs/guide.md", "changed\n");
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        harness.coreTransport.push({
          kind: "success",
          message: validMessage(undefined, "explains the two areas"),
        });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(harness.coreTransport.calls).toHaveLength(2);
        expect(harness.coreTransport.calls[1]?.validationErrors?.join(" ")).toContain("body");
        expect(commitDataOf(run).body).toBe("explains the two areas");
      },
      {
        seedFiles: {
          "README.md": "# fixture\n",
          "src/existing.ts": "export const v = 1;\n",
          "docs/guide.md": "original\n",
        },
      },
    );
  });
});
