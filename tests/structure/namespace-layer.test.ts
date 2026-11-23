/**
 * TC-LAYER-001 (AC-F1-1) — the committed project layer is the tracked current
 * layer, committed clean, and nothing is tracked under a prior-namespace root.
 *
 * The byte-identity proof belongs to the namespace migration's own evidence
 * (recorded in that change), not to a standing invariant: a literal blob digest
 * here would forbid every legitimate policy edit to the file and turn each one
 * into a migration-digest rotation. The standing invariants are the tracked set,
 * the committed-clean state (working tree = index = HEAD), and the document's
 * declared structural anchors.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();
const LAYER = ".jaiship/config.yaml";
const PRIOR_CONFIG_FILE = ".delivery-os/config.yaml";
const PRIOR_ROOTS = [".delivery-os/", ".delivery-os-state/"] as const;

const git = (...args: readonly string[]): string =>
  execFileSync("git", [...args], { cwd: ROOT, encoding: "utf8" });

const sha256 = (data: string): string => createHash("sha256").update(data).digest("hex");

describe("TC-LAYER-001 committed project layer", () => {
  test("the tracked set is exactly the current layer and empty under a prior root", () => {
    const trackedLayer = git("ls-files", "--", LAYER)
      .split("\n")
      .filter((path) => path.length > 0);
    expect(trackedLayer).toEqual([LAYER]);

    const trackedPrior = git("ls-files", "--", ".delivery-os")
      .split("\n")
      .filter((path) => path.length > 0);
    expect(trackedPrior).toEqual([]);

    const trackedDot = git("ls-files", "-z")
      .split("\0")
      .filter((path) => path.length > 0 && path.startsWith(".jaiship/"));
    expect(trackedDot).toEqual([LAYER]);

    const trackedAll = git("ls-files", "-z")
      .split("\0")
      .filter((path) => path.length > 0);
    const underPriorRoot = trackedAll.filter((path) =>
      PRIOR_ROOTS.some((prefix) => path.startsWith(prefix)),
    );
    expect(underPriorRoot).toEqual([]);
    expect(trackedAll).not.toContain(PRIOR_CONFIG_FILE);
  });

  test("the working tree, the index, and HEAD agree on the committed layer", () => {
    const workingTree = readFileSync(join(ROOT, LAYER), "utf8");
    expect(sha256(git("show", `:${LAYER}`))).toBe(sha256(workingTree));
    expect(sha256(git("show", `HEAD:${LAYER}`))).toBe(sha256(workingTree));
  });

  test("the parsed document carries the declared structural anchors", () => {
    const document = parse(readFileSync(join(ROOT, LAYER), "utf8"));
    expect(document).toBeTypeOf("object");
    expect(document).not.toBeNull();

    const record: Record<string, unknown> = { ...document };
    const verify: unknown = record.verify;
    expect(verify).toBeTypeOf("object");
    const suiteMap: unknown = (verify as Record<string, unknown>)["suite-map"];
    expect(suiteMap).toBeTypeOf("object");
    expect((suiteMap as Record<string, unknown>).schemaVersion).toBe(
      "delivery.verify.suite-map.v1",
    );
    expect(record.provider).toBeTypeOf("object");
  });
});
