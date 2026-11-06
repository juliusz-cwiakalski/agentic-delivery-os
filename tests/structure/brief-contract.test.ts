/**
 * TC-BRIEF-001 — the `delivery.brief.v1` contract is declaration-only, the
 * catalog is closed at three, the surface set is exactly nine, and the bounds
 * and vocabulary are borrowed from the status contracts by reference.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  BRIEF_PLACEHOLDER_CATALOG,
  BRIEF_SCHEMA_VERSION,
  BRIEF_SURFACE_ORDER,
  STATUS_MAX_HUMAN_BYTES,
  STATUS_MAX_HUMAN_LINES,
  STATUS_MAX_MACHINE_BYTES,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/brief.ts";
const DOMAIN = "packages/core/src/domain/brief.ts";
const INVENTORY = "tests/structure/inventory.json";
const EXPECTED_SURFACES = [
  "tracker",
  "changes-and-prs",
  "ci",
  "lanes-or-queue",
  "providers",
  "parked-work",
  "typed-questions",
  "gate-sla-states",
  "lane-queue-engine",
] as const;

const sourceOf = (path: string): ts.SourceFile =>
  ts.createSourceFile(
    path,
    readFileSync(join(ROOT, path), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const payloadMembers = (): string[] => {
  const source = sourceOf(CONTRACT);
  for (const statement of source.statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === "BriefPayload") {
      const members: string[] = [];
      for (const member of statement.type.members) {
        if (ts.isPropertySignature(member) && member.name !== undefined) {
          members.push(member.name.getText(source));
        }
      }
      return members;
    }
  }
  throw new Error("BriefPayload type alias is missing");
};

describe("TC-BRIEF-001 contract surface and closed catalog", () => {
  test("the schema id is delivery.brief.v1", () => {
    expect(BRIEF_SCHEMA_VERSION).toBe("delivery.brief.v1");
  });

  test("the payload declares the seven DM-1 members", () => {
    expect(payloadMembers()).toEqual([
      "schemaVersion",
      "generatedAt",
      "repository",
      "surfaces",
      "anchors",
      "placeholders",
      "truncation",
    ]);
  });

  test("the closed surface set is exactly the nine DM-5 ids", () => {
    expect(BRIEF_SURFACE_ORDER).toEqual(EXPECTED_SURFACES);
    expect(new Set(BRIEF_SURFACE_ORDER).size).toBe(9);
    for (const id of EXPECTED_SURFACES) {
      expect(BRIEF_SURFACE_ORDER).toContain(id);
    }
  });

  test("the placeholder catalog is exactly the three DEC-6 entries", () => {
    expect(BRIEF_PLACEHOLDER_CATALOG).toEqual([
      { capability: "typed-questions", owningStory: "M1-S16", state: "not-delivered" },
      { capability: "gate-sla-states", owningStory: "M1-S5", state: "not-delivered" },
      { capability: "lane-queue-engine", owningStory: "M1-S17", state: "not-delivered" },
    ]);
    expect(BRIEF_PLACEHOLDER_CATALOG).toHaveLength(3);
    expect(BRIEF_PLACEHOLDER_CATALOG.some((entry) => entry.capability === "spend")).toBe(false);
  });

  test("the bounds are the status values consumed by reference", () => {
    expect(STATUS_MAX_HUMAN_LINES).toBe(32);
    expect(STATUS_MAX_HUMAN_BYTES).toBe(6144);
    expect(STATUS_MAX_MACHINE_BYTES).toBe(65536);
    const contract = readFileSync(join(ROOT, CONTRACT), "utf8");
    const domain = readFileSync(join(ROOT, DOMAIN), "utf8");
    for (const text of [contract, domain]) {
      expect(text).not.toMatch(/(?:const|let|var)\s+BRIEF_[A-Z_]*MAX[A-Z_]*\s*=\s*\d/);
      expect(text).not.toMatch(/(?:const|let|var)\s+STATUS_MAX_(?:HUMAN|MACHINE)_[A-Z]+\s*=\s*\d/);
    }
    expect(domain).toContain("STATUS_MAX_HUMAN_LINES");
    expect(domain).toContain("STATUS_MAX_HUMAN_BYTES");
  });

  test("the contract module is declaration-only with no executable statement", () => {
    const source = sourceOf(CONTRACT);
    const allowed = new Set<number>([
      ts.SyntaxKind.TypeAliasDeclaration,
      ts.SyntaxKind.InterfaceDeclaration,
      ts.SyntaxKind.ImportDeclaration,
      ts.SyntaxKind.ExportDeclaration,
      ts.SyntaxKind.VariableStatement,
      ts.SyntaxKind.EndOfFileToken,
    ]);
    for (const statement of source.statements) {
      expect(allowed.has(statement.kind), ts.SyntaxKind[statement.kind]).toBe(true);
    }
    const visit = (node: ts.Node): void => {
      expect(ts.isCallExpression(node), node.getText(source).slice(0, 60)).toBe(false);
      expect(ts.isNewExpression(node), node.getText(source).slice(0, 60)).toBe(false);
      ts.forEachChild(node, visit);
    };
    visit(source);
  });

  test("the new sources are registered in the committed inventory", () => {
    const inventory = JSON.parse(readFileSync(join(ROOT, INVENTORY), "utf8")) as Record<
      string,
      string[]
    >;
    expect(inventory.core).toContain("src/contracts/brief.ts");
    expect(inventory.core).toContain("src/domain/brief.ts");
    expect(inventory.cli).toContain("src/commands/brief.ts");
  });

  test("no product literal appears in the brief contract or domain module", () => {
    const seeds = ["a" + "dos", "A" + "DOS_", "~/" + "." + "ad" + "os"];
    for (const path of [CONTRACT, DOMAIN]) {
      const text = readFileSync(join(ROOT, path), "utf8");
      for (const seed of seeds) expect(text.includes(seed), `${path}: ${seed}`).toBe(false);
    }
  });
});
