/**
 * GH-301 delivery-time documentation conformance
 * (TC-MEMNFR-004; AC-NFR7-1, NFR-7).
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  MEMORY_RECORD_KINDS,
  MEMORY_RECORD_OPTIONAL_KEYS,
  MEMORY_RECORD_REQUIRED_KEYS,
  MEMORY_RECORD_SCOPES,
  MEMORY_RECORD_TRUST,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");
const DOCTOR = "doc/templates/memory-doctor-checklist-template.md";
const TEMPLATE_INDEX = "doc/templates/README.md";
const ARCHITECTURE = "doc/planning/concepts/memory-architecture.md";
const PRACTICES = "doc/planning/concepts/memory-practices.md";
const REGISTRY = "scripts/checks/forbidden-literals.registry.json";

const AUTOMATION_BOUNDARY =
  "A project whose gates run the memory invariant gets these areas checked mechanically";

const conceptExample = (): Record<string, unknown> => {
  const section = /## Record model\n([\s\S]*?)```yaml\n([\s\S]*?)```/.exec(read(ARCHITECTURE));
  const block = section?.[2];
  if (block === undefined) throw new Error("the concept Record model example is missing");
  const parsed: unknown = parse(block);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("the concept Record model example is not a mapping");
  }
  return parsed as Record<string, unknown>;
};

describe("TC-MEMNFR-004 delivery-time doc conformance", () => {
  test("the doctor checklist and its template row state the automation boundary", () => {
    const doctor = read(DOCTOR);
    expect(doctor).toContain(AUTOMATION_BOUNDARY);
    expect(doctor).toContain("ados_distribution: redistributable");
    expect(doctor).toContain("per retro");
    expect(doctor).toContain("periodic cadence");
    expect(doctor).toContain("performs nothing");
    expect(doctor).not.toContain("preferences");
    expect(doctor).not.toContain("retro archive");
    expect(doctor).not.toContain("retro-archive");
    const index = read(TEMPLATE_INDEX);
    expect(index).toContain(AUTOMATION_BOUNDARY);
  });

  test("the registry is unchanged by delivery and no new user-facing doc exists", () => {
    const registry = JSON.parse(read(REGISTRY)) as {
      allowlist?: readonly { path?: string }[];
      registered?: readonly string[];
    };
    expect((registry.allowlist ?? []).some((entry) => /memory/i.test(entry.path ?? ""))).toBe(
      false,
    );
    expect((registry.registered ?? []).includes("doc/spec/features/feature-memory-lint.md")).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "doc/spec/features/feature-memory-lint.md"))).toBe(false);
  });

  test("every delivery-touched doc keeps one valid marker block", () => {
    for (const relative of [DOCTOR, TEMPLATE_INDEX]) {
      const text = read(relative);
      expect(text.startsWith("---\n")).toBe(true);
      expect((text.match(/^ados_distribution: /gm) ?? []).length).toBe(1);
      expect(text).toMatch(/^ados_distribution: (redistributable|internal|project-generated)$/m);
    }
  });

  test("the concept Record model is schema-legal and copyable", () => {
    const example = conceptExample();
    const allowed = new Set<string>([
      ...MEMORY_RECORD_REQUIRED_KEYS,
      ...MEMORY_RECORD_OPTIONAL_KEYS,
    ]);
    for (const key of Object.keys(example)) expect(allowed.has(key)).toBe(true);
    for (const key of MEMORY_RECORD_REQUIRED_KEYS) expect(Object.keys(example)).toContain(key);
    expect(example.id).toMatch(/^(?:lesson|tacit|preference)-\d{4}-\d{3}$/);
    expect(MEMORY_RECORD_KINDS).toContain(String(example.kind));
    expect(MEMORY_RECORD_SCOPES).toContain(String(example.scope));
    expect(MEMORY_RECORD_TRUST).toContain(String(example.trust));
    expect(typeof example.evidence).toBe("string");
    expect(typeof example.source).toBe("string");
    expect(typeof example.applies_when).toBe("string");
    expect(example.valid_from).toBeUndefined();
    expect(example.rationale).toBeUndefined();
    expect(JSON.stringify(example)).not.toContain("fleet");
  });

  test("the pinned memory-practices bootstrapping checklist keeps its closed area set", () => {
    const from = read(PRACTICES).indexOf("## Bootstrapping a project");
    const section = from === -1 ? "" : read(PRACTICES).slice(from);
    expect(section).not.toContain("preferences");
    expect(section).not.toContain("retro archive");
    expect(section).not.toContain("retro-archive");
    expect(section).toContain("No\n   additional areas are provisioned");
  });

  test("the distribution and forbidden-literal guards stay green", () => {
    const distribution = spawnSync("bash", ["scripts/.tests/test-doc-distribution.sh"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(distribution.status).toBe(0);
    const forbidden = spawnSync("bun", ["run", "scripts/checks/forbidden-literals.ts"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(forbidden.status).toBe(0);
  }, 180_000);
});
