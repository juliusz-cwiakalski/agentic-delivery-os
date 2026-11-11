/**
 * TC-EVT-074 — the composite additivity claim: no new wire type, record kind,
 * schema version, migration, dependency, capsule event, effect kind, state file,
 * or file location.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CAPSULE_EVENT_KINDS } from "../../packages/core/src/contracts/capsule";
import { EFFECT_KINDS } from "../../packages/core/src/contracts/effects";
import { ERROR_TABLE } from "../../packages/core/src/contracts/error-table";

const ROOT = process.cwd();
const baseline = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/events/additivity-baseline.json"), "utf8"),
) as {
  readonly dependencies: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly lockfileSha256: string;
  readonly capsuleEventKinds: readonly string[];
  readonly effectKinds: readonly string[];
  readonly stateFiles: readonly string[];
  readonly writableRoots: readonly string[];
};

const manifests = (): Record<string, Record<string, string>> => {
  const paths = ["package.json"];
  for (const entry of readdirSync(join(ROOT, "packages"), { withFileTypes: true })) {
    if (entry.isDirectory()) paths.push(`packages/${entry.name}/package.json`);
  }
  const sets: Record<string, Record<string, string>> = {};
  for (const path of paths.sort()) {
    const manifest = JSON.parse(readFileSync(join(ROOT, path), "utf8")) as {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const key = manifest.name ?? path;
    const dependencies: Record<string, string> = {};
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ] as const) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) dependencies[name] = range;
    }
    sets[key] = Object.fromEntries(
      Object.entries(dependencies).sort(([left], [right]) => (left < right ? -1 : 1)),
    );
  }
  return sets;
};

describe("TC-EVT-074 additivity inventory", () => {
  test("every package manifest keeps its dependency set and the lockfile is unchanged", () => {
    expect(manifests()).toEqual(baseline.dependencies);
    const digest = createHash("sha256")
      .update(readFileSync(join(ROOT, "pnpm-lock.yaml")))
      .digest("hex");
    expect(digest).toBe(baseline.lockfileSha256);
  });

  test("no capsule event kind was added", () => {
    expect([...CAPSULE_EVENT_KINDS]).toEqual([...baseline.capsuleEventKinds]);
  });

  test("no outbox effect kind or telemetry sink was added", () => {
    expect([...EFFECT_KINDS]).toEqual([...baseline.effectKinds]);
    const telemetry = readdirSync(join(ROOT, "packages/core/src/contracts")).filter((file) =>
      /telemetry|metric|trace/iu.test(file),
    );
    expect(telemetry).toEqual(["harness-telemetry.ts"]);
  });

  test("the state tier's file set adds no writer location", () => {
    const files = readdirSync(join(ROOT, "packages/core/src/state"))
      .filter((file) => file.endsWith(".ts"))
      .sort();
    expect(files).toEqual([...baseline.stateFiles]);
    expect(files.filter((file) => /event|taxonomy/iu.test(file))).toEqual([]);
  });

  test("the error-table kind set gains exactly the one events kind with three rows", () => {
    const kinds = [...new Set(ERROR_TABLE.map((entry) => entry.domainKind))].sort();
    expect(kinds.filter((kind) => kind === "events")).toHaveLength(1);
    expect(ERROR_TABLE.filter((entry) => entry.domainKind === "events")).toHaveLength(3);
    expect(kinds).toHaveLength(25);
  });

  test("the declared writable-root set is unchanged", () => {
    expect(baseline.writableRoots).toEqual(["<project state directory>", "<host root>"]);
  });
});
