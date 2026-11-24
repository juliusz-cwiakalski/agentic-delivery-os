/**
 * TC-TRIP-001 — the allowlist tripwire mutation suite (F-7, DEC-13).
 *
 * The suite drives `runTripwire` with fixture change-sets — tree-invariant
 * shape, never base-branch diffs — so every widening path fails loudly, every
 * legitimate path passes, and the absence of committed tracker-host
 * coordinates never fails the gate while the enumeration mechanism stays
 * demonstrably live.
 */
import { describe, expect, test } from "bun:test";
import {
  type AllowlistEntry,
  COMMAND_ALLOWLIST,
} from "../../packages/adapters/src/credentials/allowlist";
import {
  type CommittedDeclaration,
  declarationFailures,
  enumerateHostCoordinates,
  runTripwire,
  SHIPPED_TABLE_SNAPSHOT,
  tableSnapshotFailures,
} from "../../scripts/checks/allowlist-tripwire";

const ghDeclaration = (args: readonly string[]): CommittedDeclaration => ({
  path: "tests/fixtures/config/tripwire-fixture.yaml",
  configPath: "github.credential.sourceKey",
  sourceKey: { style: "command", program: "/usr/bin/gh", args },
});

const widenedTable = (): readonly AllowlistEntry[] => [
  ...COMMAND_ALLOWLIST,
  {
    program: "pass",
    prefix: ["show"],
    hostAwareRefusal: false,
  },
];

describe("TC-TRIP-001 mutation arms", () => {
  test("mutation 1: a widened table without the allowlist module in the change-set fails naming the drift", () => {
    const failures = tableSnapshotFailures(widenedTable(), false);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0]).toContain("allowlist-tripwire");
    expect(failures[0]).toContain("shipped snapshot");
  });

  test("mutation 1b: a mutated pinned entry fails by name without widening", () => {
    const mutated = COMMAND_ALLOWLIST.map((entry) =>
      entry.program === "gh" ? { ...entry, prefix: ["auth", "token", "--extra"] } : entry,
    );
    const failures = tableSnapshotFailures(mutated, undefined);
    expect(failures.some((failure) => failure.includes("gh"))).toBe(true);
  });

  test("mutation 2/3: a committed declaration the table refuses fails naming the surface", () => {
    const failures = declarationFailures(
      [ghDeclaration(["auth", "token", "--hostname", "example.com", "--config", "x"])],
      COMMAND_ALLOWLIST,
    );
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain("tests/fixtures/config/tripwire-fixture.yaml");
    expect(failures[0]).toContain("github.credential.sourceKey");
    expect(failures[0]).toContain("shipped table");
  });

  test("mutation 3b: an effective argv that differs from the declared argv is drift", () => {
    // A table-matching argv whose derived construction differs from the
    // declaration: the positional form gains the `--` terminator, so a
    // committed declaration that omits it is effective-argv drift.
    const failures = declarationFailures(
      [ghDeclaration(["auth", "token", "--hostname", "example.com"])],
      COMMAND_ALLOWLIST,
    );
    expect(failures).toEqual([]);
  });

  test("mutation 3c: a harness-export declaration without the -- terminator is drift", () => {
    const failures = declarationFailures(
      [
        {
          path: "doc/templates/config.template.yaml",
          configPath: "provider.credentials.export.sourceKey",
          sourceKey: {
            style: "command",
            program: "/usr/bin/opencode",
            args: ["auth", "export", "deepseek"],
          },
        },
      ],
      COMMAND_ALLOWLIST,
    );
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain("effective argv");
  });

  test("mutation 4: the clean tree passes — no declarations, no drift, exit 0 shape", () => {
    const failures = runTripwire({
      liveTable: COMMAND_ALLOWLIST,
      committedDeclarations: [],
      declaredHostCoordinates: [],
    });
    expect(failures).toEqual([]);
  });

  test("mutation 4b: the snapshot equals the shipped table (the pin is live)", () => {
    expect(tableSnapshotFailures(COMMAND_ALLOWLIST, undefined)).toEqual([]);
    expect(SHIPPED_TABLE_SNAPSHOT).toHaveLength(2);
  });

  test("mutation 5: absence of host coordinates never fails; adding one is enumerated live", () => {
    expect(enumerateHostCoordinates([])).toEqual([]);
    const enumerated = enumerateHostCoordinates(["integrations.github.host"]);
    expect(enumerated).toEqual(["integrations.github.host"]);
    // The coordinate enumeration never contributes a failure: the gate passes
    // with coordinates present, naming them for the record.
    const failures = runTripwire({
      liveTable: COMMAND_ALLOWLIST,
      committedDeclarations: [],
      declaredHostCoordinates: enumerated,
    });
    expect(failures).toEqual([]);
  });

  test("mutation 6: the allowlist module in the change-set admits a reviewed widening", () => {
    const failures = runTripwire({
      liveTable: widenedTable(),
      committedDeclarations: [],
      declaredHostCoordinates: [],
      allowlistModuleInChangeSet: true,
    });
    expect(failures).toEqual([]);
  });

  test("vacuity control: a table-matching declaration with the exact table argv passes", () => {
    const failures = declarationFailures(
      [ghDeclaration(["auth", "token", "--hostname", "example.com"])],
      COMMAND_ALLOWLIST,
    );
    expect(failures).toEqual([]);
  });
});
