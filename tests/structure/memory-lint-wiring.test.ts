/**
 * GH-301 gate wiring parity and inventory equality
 * (TC-MEMGATE-004, TC-MEMGUARD-002).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAPSULE_EVENT_KINDS,
  DOCTOR_AREAS,
  DOMAIN_KINDS,
  ERROR_TABLE,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const MANIFEST_PATH = "package.json";
const CI_PATH = ".github/workflows/ci.yml";

type Manifest = { readonly scripts?: Record<string, string> };

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const jobBlock = (text: string, jobId: string): string => {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === `  ${jobId}:`);
  if (start === -1) return "";
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^ {2}[a-z0-9-]+:\s*$/.test(lines[index] as string)) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
};

/** The path operand `check:memory` resolves to (never the raw script string). */
export const resolveMemoryInvocation = (manifest: Manifest): string | undefined => {
  const script = manifest.scripts?.["check:memory"];
  if (script === undefined) return undefined;
  return /^bun run (\S+)$/.exec(script)?.[1];
};

/** Return every parity defect between the two surfaces. */
export const parityViolations = (manifest: Manifest, ci: string): string[] => {
  const violations: string[] = [];
  const aggregate = manifest.scripts?.check ?? "";
  if (!aggregate.includes("pnpm check:memory")) {
    violations.push("the aggregate gate does not chain pnpm check:memory");
  }
  const resolved = resolveMemoryInvocation(manifest);
  if (resolved === undefined || resolved !== "scripts/checks/memory-lint.ts") {
    violations.push("check:memory does not resolve to scripts/checks/memory-lint.ts");
  }
  const job = jobBlock(ci, "ts-invariants");
  if (resolved !== undefined && !job.includes(`bun run ${resolved}`)) {
    violations.push("the ts-invariants job does not cite the resolved invocation");
  }
  return violations;
};

describe("TC-MEMGATE-004 aggregate and CI wiring parity", () => {
  const manifest = JSON.parse(read(MANIFEST_PATH)) as Manifest;
  const ci = read(CI_PATH);

  test("both gate surfaces resolve to the same invocation", () => {
    expect(parityViolations(manifest, ci)).toEqual([]);
    expect(resolveMemoryInvocation(manifest)).toBe("scripts/checks/memory-lint.ts");
    expect(jobBlock(ci, "ts-invariants")).toContain("bun run scripts/checks/memory-lint.ts");
  });

  test("mutating either surface makes the parity assertion fail loudly", () => {
    const withoutAggregate: Manifest = {
      scripts: { ...(manifest.scripts ?? {}), check: "pnpm lint" },
    };
    expect(parityViolations(withoutAggregate, ci).length).toBeGreaterThan(0);
    expect(
      parityViolations(manifest, ci.replace("scripts/checks/memory-lint.ts", "")).length,
    ).toBeGreaterThan(0);
  });

  test("the inventory lists every new module and the scanner's home", () => {
    const inventory = JSON.parse(read("tests/structure/inventory.json")) as Record<
      string,
      string[]
    >;
    expect(inventory.core).toContain("src/contracts/memory-record.ts");
    expect(inventory.core).toContain("src/domain/memory-lint.ts");
    expect(inventory.adapters).toContain("src/file/memory-scan.ts");
  });
});

describe("TC-MEMGUARD-002 no new public surface", () => {
  test("the CLI command inventory carries no memory subcommand", () => {
    const commands = readdirSync(join(ROOT, "packages/cli/src/commands"));
    expect(commands.filter((name) => /memory/i.test(name))).toEqual([]);
    expect(read("packages/cli/src/commands/index.ts")).not.toContain("createMemory");
  });

  test("the doctor keeps exactly five areas with no memory member", () => {
    expect([...DOCTOR_AREAS]).toEqual(["repo", "tracker", "provider", "state", "ci"]);
    expect(DOCTOR_AREAS.some((area) => /memory/i.test(area))).toBe(false);
  });

  test("the error table and domain kinds gain no memory identity", () => {
    expect(ERROR_TABLE.some((row) => row.code.startsWith("memory."))).toBe(false);
    expect([...DOMAIN_KINDS].some((kind) => /memory/i.test(kind))).toBe(false);
  });

  test("the capsule event topics are unchanged", () => {
    expect(CAPSULE_EVENT_KINDS.some((kind) => /memory/i.test(kind))).toBe(false);
  });
});
