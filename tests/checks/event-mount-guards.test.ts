/**
 * TC-EVT-064 — removing any one mount piece trips a named guard, and the
 * unmutated tree trips none.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PROMPT_REQUIRED_COMMANDS,
  selectPromptRequiredProgram,
} from "../../packages/cli/src/entrypoint";
import { allHelpEntries, helpEntryFor } from "../../packages/cli/src/help";
import {
  allowanceRows,
  cleanCoverage,
  commandRowRemoved,
  DELIVERED_INLINE_NAMES,
  inventoryRowRemoved,
  M2_PAGE,
  pageDeleted,
  pageRootRows,
  referencePageRowRemoved,
  strippedInventory,
  versionSectionRemoved,
} from "../fixtures/events/mount-mutants";

const ROOT = process.cwd();
const coverageCommands = (
  JSON.parse(readFileSync(join(ROOT, "tests/fixtures/help-guide/coverage.json"), "utf8")) as {
    readonly commands: readonly string[];
  }
).commands;

const failureIds = (failures: readonly string[]): readonly string[] =>
  [...new Set(failures.map((failure) => failure.split(":")[0] ?? ""))].sort();

describe("TC-EVT-064 mount negative controls", () => {
  test("the unmutated tree trips no mount guard", () => {
    expect(cleanCoverage()).toEqual([]);
    expect(inventoryRowRemoved()).toEqual([]);
    expect(allowanceRows()).toEqual({ taxonomy: true, projection: true });
    expect(pageRootRows()).toEqual({ coverage: true, parity: true });
  });

  test("removing prompt membership fails the selector by name", () => {
    const commands = Object.fromEntries(
      DELIVERED_INLINE_NAMES.map((name) => [name, { handler: () => ({ data: {} }) }]),
    );
    expect(() => selectPromptRequiredProgram({ commands })).toThrow(/events/);
  });

  test("removing the family or a verb help entry is detectable in the inventory", () => {
    expect(helpEntryFor(["events"])).toBeDefined();
    expect(helpEntryFor(["events", "list"])).toBeDefined();
    expect(helpEntryFor(["events", "describe"])).toBeDefined();
    const eventsEntries = allHelpEntries().filter((entry) => entry.path[0] === "events");
    expect(eventsEntries).toHaveLength(3);
    for (const entry of eventsEntries) expect(entry.seeAlso).toContain(M2_PAGE);
  });

  test("removing the commands row fails the coverage check naming events", () => {
    const failures = commandRowRemoved();
    expect(failures.length).toBeGreaterThan(0);
    expect(failureIds(failures)).toEqual(["events"]);
  });

  test("removing the referencePages row fails the coverage check naming events", () => {
    const failures = referencePageRowRemoved();
    expect(failures.some((failure) => failure.includes("missing from referencePages"))).toBe(true);
    expect(failureIds(failures)).toEqual(["events"]);
  });

  test("deleting the page fails the coverage check naming the resolved page", () => {
    const failures = pageDeleted();
    expect(failures.some((failure) => failure.includes(M2_PAGE))).toBe(true);
    expect(failureIds(failures)).toEqual(["events"]);
  });

  test("removing --version from the page fails the coverage check naming the section", () => {
    const failures = versionSectionRemoved();
    expect(failures.some((failure) => failure.includes("lacks --version"))).toBe(true);
    expect(failureIds(failures)).toEqual(["events"]);
  });

  test("the page-root row resolves to the M2 page and never to an M1 fallback", () => {
    expect(pageRootRows()).toEqual({ coverage: true, parity: true });
    expect(
      existsSync(join(ROOT, "doc/planning/oss-tooling/milestones/m1/commands/events.md")),
    ).toBe(false);
    expect(existsSync(join(ROOT, M2_PAGE))).toBe(true);
  });

  test("removing a new module from the inventory or the allowance fails the inventory guards", () => {
    const stripped = strippedInventory();
    expect(stripped).toEqual([
      "inventory missing src/contracts/taxonomy.ts",
      "inventory missing src/domain/event-projection.ts",
      "allowance missing taxonomy",
      "allowance missing event-projection",
    ]);
  });

  test("the delivered 18-name inline list fails the coverage equality naming events", () => {
    const missing = coverageCommands.filter(
      (command) => !(DELIVERED_INLINE_NAMES as readonly string[]).includes(command),
    );
    expect(missing).toEqual(["events"]);
    expect([...coverageCommands].sort()).toEqual([...PROMPT_REQUIRED_COMMANDS].sort());
  });
});
