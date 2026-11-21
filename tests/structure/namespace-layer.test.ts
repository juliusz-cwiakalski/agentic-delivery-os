/**
 * TC-LAYER-001 (AC-F1-1) — the committed project layer is the tracked current
 * layer, byte-identical to the pre-move blob, and nothing is tracked under a
 * prior-namespace root.
 *
 * The pre-move digest and the pre-move parsed value are committed literals: a
 * comparison against a moving base branch would only hold at the change's own PR.
 * The digest literal is the blob digest captured with the move; the parsed digest
 * pins the document's structure so a key reorder cannot pass as a byte change and
 * a value change cannot pass as a reorder.
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

/** The pre-move blob digest of the document, captured once with the move. */
const PRE_MOVE_SHA256 = "fa1d82b53afda848bcb1dbea5ecf79939b6f9c7518fc931aca59768ab203fb09";
/** The canonical (recursively key-sorted) parsed digest of the pre-move document. */
const PRE_MOVE_PARSED_SHA256 = "06bdf687ab8ac4e74ca3049c57cd93fc5ed4fc47e0dc6f58d4ea9a613df59651";

const git = (...args: readonly string[]): string =>
  execFileSync("git", [...args], { cwd: ROOT, encoding: "utf8" });

const sha256 = (data: string): string => createHash("sha256").update(data).digest("hex");

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record: Record<string, unknown> = { ...value };
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return `${JSON.stringify(value)}`;
};

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

  test("the working-tree and index blobs equal the recorded pre-move digest", () => {
    const workingTree = readFileSync(join(ROOT, LAYER), "utf8");
    expect(sha256(workingTree)).toBe(PRE_MOVE_SHA256);

    const indexBlob = git("show", `:${LAYER}`);
    expect(sha256(indexBlob)).toBe(PRE_MOVE_SHA256);
  });

  test("the parsed document is structurally unchanged across the two live branches", () => {
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

    expect(sha256(canonical(document))).toBe(PRE_MOVE_PARSED_SHA256);
  });
});
