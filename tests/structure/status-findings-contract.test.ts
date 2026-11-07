/**
 * TC-ATT-001 + TC-ATT-018 (structure half) — the closed finding-code registry,
 * severity set, dormant marker, code-to-surface map, lane attention vocabulary,
 * placeholder declarations, and the data-only contract detector.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  STATUS_DORMANT_FINDING_CODES,
  STATUS_FINDING_CODES,
  STATUS_FINDING_REGISTRY,
  STATUS_FINDING_SEVERITIES,
  STATUS_FINDING_SURFACES,
  STATUS_HYGIENE_ASSERTIONS,
  STATUS_LANE_ATTENTION_STATES,
  STATUS_PLACEHOLDER_SECTION_IDS,
  STATUS_READY_CLASSES,
  STATUS_SECTION_KINDS,
  STATUS_SECTION_ORDER,
  type StatusFindingCode,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/status.ts";

type RegistryEntry = (typeof STATUS_FINDING_REGISTRY)[StatusFindingCode];

const cloneRegistry = (): Record<string, RegistryEntry> =>
  JSON.parse(JSON.stringify(STATUS_FINDING_REGISTRY)) as Record<string, RegistryEntry>;

const cloneSurfaces = (): Record<string, string> =>
  JSON.parse(JSON.stringify(STATUS_FINDING_SURFACES)) as Record<string, string>;

const EXPECTED_CODES = [
  "ci.red-on-main",
  "tracker.owner-gate-escalated",
  "tracker.stalled-ticket",
  "tracker.hygiene.missing-title",
  "tracker.hygiene.missing-labels",
  "tracker.hygiene.epic-membership",
  "tracker.hygiene.story-points",
  "tracker.hygiene.in-sprint",
  "lane.idle-no-reason",
  "parked.stale-no-condition",
] as const;

const EXPECTED_SEVERITIES = [
  "high",
  "high",
  "medium",
  "low",
  "low",
  "low",
  "low",
  "low",
  "medium",
  "low",
] as const;

const registryFailures = (
  registry: Record<string, RegistryEntry>,
  surfaces: Record<string, string> = cloneSurfaces(),
): string[] => {
  const failures: string[] = [];
  const codes = Object.keys(registry);
  if (JSON.stringify(codes) !== JSON.stringify(EXPECTED_CODES)) {
    failures.push(`registry codes ${JSON.stringify(codes)} != ${JSON.stringify(EXPECTED_CODES)}`);
  }
  const dormant: string[] = [];
  for (const [index, code] of EXPECTED_CODES.entries()) {
    const entry = registry[code];
    if (entry === undefined) {
      failures.push(`missing code ${code}`);
      continue;
    }
    if (!(STATUS_FINDING_SEVERITIES as readonly string[]).includes(entry.severity)) {
      failures.push(`${code}: invalid severity ${String(entry.severity)}`);
    }
    if (entry.severity !== EXPECTED_SEVERITIES[index]) {
      failures.push(`${code}: severity ${entry.severity} != ${EXPECTED_SEVERITIES[index]}`);
    }
    if (typeof entry.meaning !== "string" || entry.meaning.length === 0) {
      failures.push(`${code}: empty meaning`);
    }
    if (entry.dormant) dormant.push(code);
    const segments = code.split(".");
    if (
      segments.length < 2 ||
      segments.length > 3 ||
      segments.some((segment) => !/^[a-z][a-z-]*$/.test(segment))
    ) {
      failures.push(`${code}: not namespaced lowercase dotted`);
    }
    if (!(STATUS_SECTION_ORDER as readonly string[]).includes(entry.surface)) {
      failures.push(`${code}: undeclared surface ${entry.surface}`);
    }
    if (surfaces[code] !== entry.surface) {
      failures.push(`${code}: surface map ${surfaces[code]} != registry ${entry.surface}`);
    }
  }
  if (JSON.stringify(dormant) !== JSON.stringify(STATUS_DORMANT_FINDING_CODES)) {
    failures.push(
      `dormant codes ${JSON.stringify(dormant)} != ${JSON.stringify(STATUS_DORMANT_FINDING_CODES)}`,
    );
  }
  return failures;
};

const DATA_ONLY_STATEMENTS = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

const dataOnlyViolations = (text: string, label = CONTRACT): string[] => {
  const source = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations: string[] = [];
  for (const statement of source.statements) {
    if (!DATA_ONLY_STATEMENTS.has(statement.kind)) {
      const name = ts.isFunctionDeclaration(statement) ? statement.name?.text : undefined;
      violations.push(
        `${label}: executable statement ${ts.SyntaxKind[statement.kind]}${name === undefined ? "" : ` ${name}`}`,
      );
    }
  }
  return violations;
};

describe("TC-ATT-001 finding-code registry", () => {
  test("the live registry is the closed Appendix A set in declared order", () => {
    expect(STATUS_FINDING_CODES).toEqual([...EXPECTED_CODES]);
    expect(registryFailures(cloneRegistry())).toEqual([]);
    expect(STATUS_FINDING_SEVERITIES).toEqual(["high", "medium", "low"]);
  });

  test("lane.idle-no-reason is medium and the only dormant code", () => {
    expect(STATUS_FINDING_REGISTRY["lane.idle-no-reason"].severity).toBe("medium");
    expect(STATUS_FINDING_REGISTRY["lane.idle-no-reason"].dormant).toBe(true);
    expect(STATUS_DORMANT_FINDING_CODES).toEqual(["lane.idle-no-reason"]);
    expect(
      Object.entries(STATUS_FINDING_REGISTRY)
        .filter(([, entry]) => entry.dormant)
        .map(([code]) => code),
    ).toEqual(["lane.idle-no-reason"]);
  });

  test("every code maps to a declared surface", () => {
    for (const code of STATUS_FINDING_CODES) {
      expect(STATUS_FINDING_SURFACES[code]).toBe(STATUS_FINDING_REGISTRY[code].surface);
      expect(STATUS_SECTION_ORDER).toContain(STATUS_FINDING_SURFACES[code]);
    }
    expect(STATUS_FINDING_SURFACES["ci.red-on-main"]).toBe("ci");
    expect(STATUS_FINDING_SURFACES["parked.stale-no-condition"]).toBe("parked-work");
  });

  test("the registry module is data-only", () => {
    const text = readFileSync(join(ROOT, CONTRACT), "utf8");
    expect(dataOnlyViolations(text)).toEqual([]);
  });

  test("an executable declaration fails the data-only detector", () => {
    const mutated = `${readFileSync(join(ROOT, CONTRACT), "utf8")}\nexport function rogue(): number {\n  return 1;\n}\n`;
    expect(dataOnlyViolations(mutated).some((line) => line.includes("rogue"))).toBe(true);
  });

  test("dropping, adding, renaming, or re-weighting a code fails by name", () => {
    const dropped = cloneRegistry();
    delete dropped["parked.stale-no-condition"];
    expect(registryFailures(dropped).some((line) => line.includes("registry codes"))).toBe(true);

    const added = { ...cloneRegistry(), "ci.new-code": cloneRegistry()["ci.red-on-main"] };
    expect(registryFailures(added).some((line) => line.includes("registry codes"))).toBe(true);

    const renamed = cloneRegistry();
    const original = renamed["ci.red-on-main"];
    if (original !== undefined) {
      delete renamed["ci.red-on-main"];
      renamed["ci.red-main"] = original;
    }
    expect(registryFailures(renamed).some((line) => line.includes("registry codes"))).toBe(true);

    const reweighted = cloneRegistry();
    const entry = reweighted["ci.red-on-main"];
    if (entry !== undefined)
      reweighted["ci.red-on-main"] = { ...entry, severity: "critical" as never };
    expect(registryFailures(reweighted).some((line) => line.includes("invalid severity"))).toBe(
      true,
    );

    const undormant = cloneRegistry();
    const lane = undormant["lane.idle-no-reason"];
    if (lane !== undefined) undormant["lane.idle-no-reason"] = { ...lane, dormant: false };
    expect(registryFailures(undormant).some((line) => line.includes("dormant codes"))).toBe(true);

    const badSurface = cloneRegistry();
    const parked = badSurface["parked.stale-no-condition"];
    if (parked !== undefined) {
      badSurface["parked.stale-no-condition"] = { ...parked, surface: "nowhere" as never };
    }
    expect(registryFailures(badSurface).some((line) => line.includes("undeclared surface"))).toBe(
      true,
    );
  });

  test("the registry is registered in the committed inventory", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(inventory.core).toContain("src/contracts/status.ts");
  });
});

describe("TC-ATT-018 lanes vocabulary and placeholder declarations", () => {
  test("the lane attention-state vocabulary is the closed three-literal set", () => {
    expect(STATUS_LANE_ATTENTION_STATES).toEqual([
      "delivering",
      "idle-with-reason",
      "idle-no-reason",
    ]);
    for (const state of STATUS_LANE_ATTENTION_STATES) expect(state).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
  });

  test("the three named hygiene assertions are declared in order", () => {
    expect(STATUS_HYGIENE_ASSERTIONS).toEqual(["epic-membership", "story-points", "in-sprint"]);
  });

  test("no section remains a placeholder: typed questions and spend are collectors", () => {
    expect(STATUS_PLACEHOLDER_SECTION_IDS).toEqual([]);
    expect(STATUS_SECTION_KINDS.spend).toBe("collector");
    expect(STATUS_SECTION_KINDS["typed-questions"]).toBe("collector");
    expect(STATUS_SECTION_KINDS["lanes-or-queue"]).toBe("declared-gap");
    expect(STATUS_SECTION_KINDS["ready-to-merge"]).toBe("collector");
    expect(
      Object.values(STATUS_SECTION_KINDS).filter((kind) => String(kind) === "placeholder"),
    ).toHaveLength(0);
  });

  test("ready classes are the closed two-value set", () => {
    expect(STATUS_READY_CLASSES).toEqual(["merge-ready", "review-pending"]);
  });

  test("the vocabulary is not mutated by reading it", () => {
    const before = [...STATUS_LANE_ATTENTION_STATES];
    const registryBefore = JSON.stringify(STATUS_FINDING_REGISTRY);
    expect([...STATUS_LANE_ATTENTION_STATES]).toEqual(before);
    expect(JSON.stringify(STATUS_FINDING_REGISTRY)).toBe(registryBefore);
    const mutable = cloneRegistry();
    mutable["ci.red-on-main"] = { ...mutable["ci.red-on-main"], severity: "low" } as RegistryEntry;
    expect(STATUS_FINDING_REGISTRY["ci.red-on-main"].severity).toBe("high");
  });
});
