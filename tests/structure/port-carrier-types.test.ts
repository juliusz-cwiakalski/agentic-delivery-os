/**
 * TC-PORT-004 typing half — carrier selection is constrained to a declared
 * carrier union with no `string` escape hatch. The compile-time probe lives in
 * `tests/types/port-carrier-types.type-test.ts` and is chained into typecheck.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { CARRIER_KINDS } from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CAPABILITIES_PATH = "packages/core/src/contracts/adapter-capabilities.ts";

export const validateCarrierSelectionConstraint = (text: string): string[] => {
  const source = ts.createSourceFile(
    CAPABILITIES_PATH,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const failures: string[] = [];
  let found = false;
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== "CarrierSelectionInput") {
      continue;
    }
    found = true;
    const parameter = statement.typeParameters?.[0];
    if (parameter?.constraint === undefined) {
      failures.push("CarrierSelectionInput: missing declared-carrier constraint");
      continue;
    }
    const constraint = parameter.constraint.getText(source).replace(/\s+/g, " ");
    if (constraint !== "readonly CarrierKind[]") {
      failures.push(`CarrierSelectionInput: constraint ${constraint} widens the carrier union`);
    }
    const members = ts.isTypeLiteralNode(statement.type) ? statement.type.members : [];
    const carrier = members.find(
      (member): member is ts.PropertySignature =>
        ts.isPropertySignature(member) && member.name.getText(source) === "carrier",
    );
    const carrierType = carrier?.type?.getText(source) ?? "";
    if (carrierType.replace(/\s+/g, " ") !== "Declared[number]") {
      failures.push(`CarrierSelectionInput: carrier type ${carrierType} has a string escape`);
    }
  }
  if (!found) failures.push("CarrierSelectionInput is missing");
  return failures;
};

describe("TC-PORT-004 declared-carrier typing (contract)", () => {
  test("CARRIER_KINDS is a closed `as const` set of the three carrier forms", () => {
    expect(CARRIER_KINDS).toEqual([
      "invisible-comment-block",
      "provider-custom-field",
      "compact-marker",
    ]);
  });

  test("the live selection input is constrained to a declared carrier union", () => {
    expect(
      validateCarrierSelectionConstraint(readFileSync(join(ROOT, CAPABILITIES_PATH), "utf8")),
    ).toEqual([]);
  });

  test("widening the carrier union to string is detectable", () => {
    const widened = readFileSync(join(ROOT, CAPABILITIES_PATH), "utf8").replace(
      "Declared extends readonly CarrierKind[]",
      "Declared extends readonly string[]",
    );
    expect(
      validateCarrierSelectionConstraint(widened).some((message) => message.includes("widens")),
    ).toBe(true);
  });

  test("the type-test project is chained into the root typecheck script", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts.typecheck).toContain("tests/types/tsconfig.json");
  });
});
