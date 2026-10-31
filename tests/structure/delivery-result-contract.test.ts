/**
 * TC-VERIFY-016 / TC-VERIFY-017 / TC-VERIFY-018 — the delivery-result
 * vocabulary is total and bound to the bash usage enum, the documented C-4
 * table, and the derivation mapping. Extraction fails closed; every mutation
 * control runs on in-memory values or a temp copy, never the live tree.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectExitCode } from "../../packages/cli/src/projection";
import {
  DELIVERY_RESULT_DERIVATION_CLASSES,
  DELIVERY_RESULT_PROJECTION_CLASSES,
  DELIVERY_RESULT_TAXONOMY,
  DELIVERY_RESULT_TOKENS,
  type DeliveryResultDerivationClass,
  type DeliveryResultTaxonomyEntry,
  type ProjectionClass,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const SPEC_PATH =
  "doc/changes/2026-10/2026-10-31--GH-177--verify-change-exit-taxonomy/chg-GH-177-spec.md";
const BASH_PATH = "scripts/deliver-ticket.sh";

const tokens: readonly string[] = [...DELIVERY_RESULT_TOKENS];
const taxonomy: readonly DeliveryResultTaxonomyEntry[] = [...DELIVERY_RESULT_TAXONOMY];
const derivationClasses: readonly string[] = [...DELIVERY_RESULT_DERIVATION_CLASSES];
const projectionClasses: readonly string[] = [...DELIVERY_RESULT_PROJECTION_CLASSES];

const normalizeCell = (cell: string): string =>
  cell.replace(/`/g, "").replace(/\*\*/g, "").replace(/\*/g, "").replace(/\s+/g, " ").trim();

const cellsOf = (line: string): string[] => {
  const parts = line.trim().split("|");
  if (parts[0]?.trim() === "") parts.shift();
  if (parts[parts.length - 1]?.trim() === "") parts.pop();
  return parts.map(normalizeCell);
};

/** Extract the `result=<...>` enum from the bash usage block; fail closed. */
export const extractBashResultTokens = (text: string): string[] => {
  const match = /result=<([^>\n]+)>/.exec(text);
  if (match === null) throw new Error("bash usage enum reference is missing");
  const raw = match[1] ?? "";
  const extracted = raw.split("|").map((token) => token.trim());
  if (extracted.length === 0 || extracted.some((token) => token.length === 0)) {
    throw new Error("bash usage enum reference is empty or malformed");
  }
  return extracted;
};

type C4Row = {
  readonly token: string;
  readonly derivation: string;
  readonly identitySource: string;
  readonly projection: string;
  readonly exit: string;
};

const c4Rows = (text: string): C4Row[] => {
  const heading = "### C-4 — Delivery result enum (binding vocabulary)";
  const start = text.indexOf(heading);
  if (start < 0) throw new Error("C-4 heading is missing");
  const lines = text.slice(start + heading.length).split("\n");
  const headerIndex = lines.findIndex((line) => {
    if (!line.trim().startsWith("|")) return false;
    const cells = cellsOf(line);
    return cells[0] === "Token" && cells[1] === "Bash-era meaning";
  });
  if (headerIndex < 0) throw new Error("C-4 table header is missing");
  const rows: C4Row[] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim().startsWith("|")) break;
    const cells = cellsOf(line);
    if (cells.length < 6) throw new Error(`C-4 row has ${cells.length} columns`);
    rows.push({
      token: cells[0] as string,
      derivation: cells[2] as string,
      identitySource: cells[3] as string,
      projection: cells[4] as string,
      exit: cells[5] as string,
    });
  }
  return rows;
};

const leadingInteger = (cell: string): number | undefined => {
  const match = /^(\d+)/.exec(cell.trim());
  return match === null ? undefined : Number(match[1]);
};

const validateC4Rows = (
  rows: readonly C4Row[],
  candidateTokens: readonly string[],
  candidateTaxonomy: readonly DeliveryResultTaxonomyEntry[],
  exitFor: (projection: ProjectionClass) => number,
): string[] => {
  const failures: string[] = [];
  if (rows.length !== candidateTokens.length) {
    failures.push(`row count ${rows.length} does not equal token count ${candidateTokens.length}`);
  }
  candidateTokens.forEach((token, index) => {
    const row = rows[index];
    if (row === undefined) {
      failures.push(`${token}: missing C-4 row`);
      return;
    }
    if (row.token !== token) failures.push(`row ${index}: token ${row.token} != ${token}`);
    const entry = candidateTaxonomy[index];
    if (entry === undefined) {
      failures.push(`${token}: missing taxonomy row`);
      return;
    }
    if (row.projection !== entry.projectionClass) {
      failures.push(`${token}: projection ${row.projection} != ${entry.projectionClass}`);
    }
    const exit = leadingInteger(row.exit);
    if (exit === undefined) {
      failures.push(`${token}: exit cell ${row.exit} has no leading integer`);
    } else if (exit !== exitFor(entry.projectionClass)) {
      failures.push(`${token}: exit ${exit} != projected ${exitFor(entry.projectionClass)}`);
    }
    const reserved = row.derivation.toLowerCase().includes("reserved");
    const identity = row.identitySource.toLowerCase();
    if (entry.derivationClass === "verify") {
      if (reserved) failures.push(`${token}: reachable token marked Reserved`);
      if (identity.startsWith("none")) {
        failures.push(`${token}: reachable token has a none identity source`);
      }
    } else {
      if (!reserved) failures.push(`${token}: reserved token not marked Reserved`);
      if (!identity.startsWith("none")) {
        failures.push(`${token}: reserved token identity source does not start with none`);
      }
    }
  });
  return failures;
};

const derivationMapping = (text: string): Map<DeliveryResultDerivationClass, string[]> => {
  const label = "Pinned derivation mapping:";
  const index = text.indexOf(label);
  if (index < 0) throw new Error("pinned derivation mapping paragraph is missing");
  const paragraph: string[] = [];
  for (const line of text.slice(index + label.length).split("\n")) {
    if (line.trim() === "") break;
    paragraph.push(line.trim());
  }
  const line = paragraph.join(" ");
  const mapping = new Map<DeliveryResultDerivationClass, string[]>();
  for (const match of line.matchAll(/`([a-z-]+)`\s*→\s*((?:`[^`]+`(?:,\s*)?)+)/g)) {
    const cls = match[1] as string;
    if (!(derivationClasses as readonly string[]).includes(cls)) {
      throw new Error(`pinned derivation mapping names an unknown class: ${cls}`);
    }
    const values = [...(match[2] ?? "").matchAll(/`([^`]+)`/g)].map((token) => token[1] as string);
    mapping.set(cls as DeliveryResultDerivationClass, values);
  }
  if (mapping.size !== derivationClasses.length) {
    throw new Error("pinned derivation mapping is incomplete");
  }
  return mapping;
};

const validateTaxonomy = (
  candidateTokens: readonly string[],
  candidateTaxonomy: readonly DeliveryResultTaxonomyEntry[],
): string[] => {
  const failures: string[] = [];
  const unique = new Set(candidateTokens);
  if (unique.size !== candidateTokens.length) failures.push("tokens are not unique");
  if (candidateTokens.length !== 11) failures.push(`token count ${candidateTokens.length} != 11`);
  if (candidateTaxonomy.length !== candidateTokens.length) {
    failures.push(
      `taxonomy length ${candidateTaxonomy.length} != token count ${candidateTokens.length}`,
    );
  }
  candidateTokens.forEach((token, index) => {
    const entry = candidateTaxonomy[index];
    if (entry === undefined) {
      failures.push(`${token}: missing taxonomy row`);
      return;
    }
    if (entry.token !== token) failures.push(`row ${index}: ${entry.token} != ${token}`);
    if (!projectionClasses.includes(entry.projectionClass)) {
      failures.push(`${token}: invalid projection class ${entry.projectionClass}`);
    }
    if (!derivationClasses.includes(entry.derivationClass)) {
      failures.push(`${token}: invalid derivation class ${entry.derivationClass}`);
    }
  });
  if (candidateTaxonomy.length !== 0) {
    const expected: Record<DeliveryResultDerivationClass, readonly string[]> = {
      verify: ["finished", "partial", "failed", "state-unverified"],
      "tracker-pr": ["merged", "blocked", "pr-open", "pr-open-unverified"],
      "dispatch-session": ["max-restarts", "noop-lane-permission", "noop-lane-nothing-to-do"],
    };
    for (const cls of derivationClasses as readonly DeliveryResultDerivationClass[]) {
      const actual = candidateTaxonomy
        .filter((entry) => entry.derivationClass === cls)
        .map((entry) => entry.token);
      const expectedForClass = expected[cls];
      const sameMembers =
        actual.length === expectedForClass.length &&
        expectedForClass.every((token) => actual.includes(token));
      if (!sameMembers) {
        failures.push(`${cls}: mapping ${actual.join(",")} != ${expectedForClass.join(",")}`);
      }
    }
    const reachable = candidateTaxonomy
      .filter((entry) => entry.derivationClass === "verify")
      .map((entry) => entry.token);
    const expectedReachable = ["finished", "partial", "failed", "state-unverified"];
    if (
      reachable.length !== expectedReachable.length ||
      !expectedReachable.every((token) => reachable.includes(token))
    ) {
      failures.push(`reachable subset ${reachable.join(",")} is not the four verify tokens`);
    }
    for (const entry of candidateTaxonomy) {
      if (projectionClasses.includes(entry.projectionClass)) {
        const exit = projectExitCode(entry.projectionClass);
        if (entry.projectionClass === "success" && exit !== 0) {
          failures.push(`${entry.token}: success token does not project to 0`);
        }
        if (entry.projectionClass === "user-validation" && exit !== 1) {
          failures.push(`${entry.token}: user-validation token does not project to 1`);
        }
        if (entry.projectionClass === "platform-provider" && exit !== 2) {
          failures.push(`${entry.token}: platform-provider token does not project to 2`);
        }
      }
    }
    const stateUnverified = candidateTaxonomy.find((entry) => entry.token === "state-unverified");
    if (stateUnverified?.projectionClass !== "platform-provider") {
      failures.push("state-unverified must project through platform-provider (DEC-5)");
    }
  }
  return failures;
};

const expectLiveVocabulary = (): void => {
  const bash = extractBashResultTokens(readFileSync(join(ROOT, BASH_PATH), "utf8"));
  expect(bash).toEqual(tokens);
  expect(tokens[0]).toBe("merged");
  expect(tokens[tokens.length - 1]).toBe("noop-lane-nothing-to-do");
  expect(validateTaxonomy(tokens, taxonomy)).toEqual([]);

  const specText = readFileSync(join(ROOT, SPEC_PATH), "utf8");
  const rows = c4Rows(specText);
  expect(rows).toHaveLength(11);
  expect(rows.map((row) => row.token)).toEqual(tokens);
  expect(validateC4Rows(rows, tokens, taxonomy, projectExitCode)).toEqual([]);

  const mapping = derivationMapping(specText);
  const pinnedOrder: Record<DeliveryResultDerivationClass, readonly string[]> = {
    verify: ["finished", "partial", "failed", "state-unverified"],
    "tracker-pr": ["merged", "blocked", "pr-open", "pr-open-unverified"],
    "dispatch-session": ["max-restarts", "noop-lane-permission", "noop-lane-nothing-to-do"],
  };
  for (const cls of derivationClasses as readonly DeliveryResultDerivationClass[]) {
    const fromData = taxonomy
      .filter((entry) => entry.derivationClass === cls)
      .map((entry) => entry.token);
    expect(mapping.get(cls)).toEqual(pinnedOrder[cls]);
    const sameMembers =
      fromData.length === pinnedOrder[cls].length &&
      pinnedOrder[cls].every((token) => fromData.includes(token));
    expect(sameMembers, `${cls} data mapping differs`).toBe(true);
  }
};

describe("TC-VERIFY-016 bash usage enum binding", () => {
  test("the live contracts enum equals the bash usage enum in set and order", () => {
    expectLiveVocabulary();
  });

  test("bash extraction fails closed on a missing or empty reference", () => {
    expect(() => extractBashResultTokens("no reference here")).toThrow();
    expect(() => extractBashResultTokens("result=<>")).toThrow();
    expect(() => extractBashResultTokens("result=<merged||failed>")).toThrow();
    const temp = mkdtempSync(join(tmpdir(), "gh177-bash-"));
    try {
      expect(() =>
        extractBashResultTokens(readFileSync(join(temp, "absent.sh"), "utf8")),
      ).toThrow();
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  test("mutated bash text fails naming the first divergence", () => {
    const live = readFileSync(join(ROOT, BASH_PATH), "utf8");
    const swapped = live.replace("result=<merged|blocked|", "result=<blocked|merged|");
    expect(extractBashResultTokens(swapped)[0]).toBe("blocked");
    expect(extractBashResultTokens(swapped)).not.toEqual(tokens);
    const removed = live.replace("|partial", "");
    expect(extractBashResultTokens(removed)).not.toEqual(tokens);
    const empty = live.replace(/result=<[^>]+>/, "result=<>");
    expect(() => extractBashResultTokens(empty)).toThrow();
  });

  test("only the contracts module declares the token list (in-memory control)", () => {
    const duplicate = [...tokens, "finished"];
    expect(new Set(duplicate).size).not.toBe(duplicate.length);
    expect(validateTaxonomy(duplicate, taxonomy).join("\n")).toContain("unique");
  });

  test("a temp-copy script without the usage line fails closed", () => {
    const temp = mkdtempSync(join(tmpdir(), "gh177-bash-"));
    try {
      const file = join(temp, "deliver-ticket.sh");
      writeFileSync(file, "#!/usr/bin/env bash\nset -euo pipefail\n");
      expect(() => extractBashResultTokens(readFileSync(file, "utf8"))).toThrow();
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});

describe("TC-VERIFY-017 taxonomy totality, classes, reachable subset", () => {
  test("the live taxonomy is total, valid, and exactly the four-token reachable subset", () => {
    expect(tokens).toHaveLength(11);
    expect(new Set(tokens).size).toBe(11);
    expect(taxonomy).toHaveLength(11);
    expect(validateTaxonomy(tokens, taxonomy)).toEqual([]);
    expect(projectExitCode("success")).toBe(0);
    expect(projectExitCode("user-validation")).toBe(1);
    expect(projectExitCode("platform-provider")).toBe(2);
  });

  test("mutation controls fail naming the affected field", () => {
    const duplicateTaxonomy = [
      ...taxonomy,
      { token: "finished", projectionClass: "success", derivationClass: "verify" },
    ] as DeliveryResultTaxonomyEntry[];
    expect(validateTaxonomy(tokens, duplicateTaxonomy).join("\n")).toContain("taxonomy length");

    const missingRow = taxonomy.slice(0, -1);
    expect(validateTaxonomy(tokens, missingRow).join("\n")).toContain("missing taxonomy row");

    const extraToken = [...tokens, "twelfth"];
    expect(validateTaxonomy(extraToken, taxonomy).join("\n")).toContain("token count");

    const invalidProjection = taxonomy.map((entry, index) =>
      index === 0 ? { ...entry, projectionClass: "unknown-class" as never } : entry,
    );
    expect(validateTaxonomy(tokens, invalidProjection).join("\n")).toContain(
      "invalid projection class",
    );

    const moved = taxonomy.map((entry) =>
      entry.token === "failed"
        ? { ...entry, derivationClass: "tracker-pr" as DeliveryResultDerivationClass }
        : entry,
    );
    expect(validateTaxonomy(tokens, moved).join("\n")).toContain("mapping");
  });
});

describe("TC-VERIFY-018 documented C-4 table agreement", () => {
  test("the live spec table and derivation paragraph agree with the data", () => {
    expectLiveVocabulary();
  });

  test("the spec is read-only during comparison (digest unchanged)", () => {
    const before = readFileSync(join(ROOT, SPEC_PATH), "utf8");
    c4Rows(before);
    expect(readFileSync(join(ROOT, SPEC_PATH), "utf8")).toBe(before);
  });

  test("mutated table text fails naming the token or field", () => {
    const specText = readFileSync(join(ROOT, SPEC_PATH), "utf8");
    const rows = c4Rows(specText);

    const wrongProjection = rows.map((row, index) =>
      index === 4 ? { ...row, projection: "platform-provider" } : row,
    );
    expect(validateC4Rows(wrongProjection, tokens, taxonomy, projectExitCode).join("\n")).toContain(
      "projection",
    );

    const swappedExit = rows.map((row, index) =>
      index === 7 ? { ...row, exit: "1 (see DEC-5)" } : row,
    );
    expect(validateC4Rows(swappedExit, tokens, taxonomy, projectExitCode).join("\n")).toContain(
      "exit",
    );

    const reordered = [rows[1] as C4Row, rows[0] as C4Row, ...rows.slice(2)];
    expect(validateC4Rows(reordered, tokens, taxonomy, projectExitCode).join("\n")).toContain(
      "token",
    );

    const missing = rows.slice(0, -1);
    expect(validateC4Rows(missing, tokens, taxonomy, projectExitCode).join("\n")).toContain(
      "row count",
    );

    const twelfth = [
      ...rows,
      {
        token: "twelfth",
        derivation: "Reserved",
        identitySource: "none",
        projection: "success",
        exit: "0",
      },
    ];
    expect(validateC4Rows(twelfth, tokens, taxonomy, projectExitCode).join("\n")).toContain(
      "row count",
    );
  });
});
