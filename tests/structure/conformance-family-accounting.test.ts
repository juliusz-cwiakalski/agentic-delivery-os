/**
 * TC-TAX-011 / TC-TAX-012 — the 18-cell per-adapter × per-family accounting in
 * its delivered 9 covered / 7 recorded-difference / 2 gap-backed posture, and
 * bidirectional catalog↔family wiring over the family-wired subset.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFORMANCE_ADAPTERS, PARITY_MATRIX, TRACKER_TRAP_FAMILIES } from "@delivery-os/testkit";
import { loadCatalogs, validateCatalogs } from "./trap-catalog.test";

const ROOT = process.cwd();
const ACCOUNTING = "tests/fixtures/providers/conformance/families/accounting.json";

type Posture = "covered" | "recorded-difference" | "gap-backed";

type Cell = {
  readonly posture: Posture;
  readonly operation: string;
  readonly catalogEntries?: readonly string[];
  readonly fixture?: string;
  readonly registerId?: string;
  readonly recordedClass?: string;
  readonly gapReason?: string;
};

type Accounting = {
  readonly provenance: string;
  readonly providers: Readonly<Record<string, Readonly<Record<string, Cell>>>>;
};

const loadAccounting = (): Accounting =>
  JSON.parse(readFileSync(join(ROOT, ACCOUNTING), "utf8")) as Accounting;

const ACCOUNTING_DOC = loadAccounting();
const CATALOGS = loadCatalogs(ROOT);

const OBSERVATION = (
  JSON.parse(
    readFileSync(
      join(ROOT, "tests/fixtures/providers/conformance/parity/observation-record.json"),
      "utf8",
    ),
  ) as { record: Record<string, Record<string, Record<string, unknown>>> }
).record;

const EXPECTED_TABLE: Readonly<Record<string, Readonly<Record<string, Posture>>>> = {
  github: {
    "auth-shape": "covered",
    "transport-failure": "covered",
    "rate-limit": "covered",
    "payload-shape": "covered",
    "workflow-state-mismatch": "covered",
    "pagination-truncation": "covered",
  },
  gitlab: {
    "auth-shape": "recorded-difference",
    "transport-failure": "covered",
    "rate-limit": "recorded-difference",
    "payload-shape": "recorded-difference",
    "workflow-state-mismatch": "gap-backed",
    "pagination-truncation": "recorded-difference",
  },
  jira: {
    "auth-shape": "recorded-difference",
    "transport-failure": "covered",
    "rate-limit": "recorded-difference",
    "payload-shape": "recorded-difference",
    "workflow-state-mismatch": "covered",
    "pagination-truncation": "gap-backed",
  },
};

const adapterFor = (provider: string) =>
  CONFORMANCE_ADAPTERS.find((entry) => entry.provider === provider);

const catalogNames = (provider: string): readonly string[] =>
  CATALOGS[provider]?.entries.map((entry) => String(entry.trapName)) ?? [];

/** Validate the accounting; every failure names adapter and family. */
export const accountingViolations = (
  accounting: Accounting,
  catalogs: Readonly<Record<string, { entries: readonly Record<string, unknown>[] }>> = CATALOGS,
  observation: Record<string, Record<string, Record<string, unknown>>> = OBSERVATION,
): string[] => {
  const violations: string[] = [];
  const providers = CONFORMANCE_ADAPTERS.map((entry) => entry.provider);
  const keys = Object.keys(accounting.providers);
  for (const provider of providers) {
    const cellSet = accounting.providers[provider];
    if (cellSet === undefined) {
      violations.push(`${provider}: no accounting cells`);
      continue;
    }
    for (const family of TRACKER_TRAP_FAMILIES) {
      const cell = cellSet[family];
      const where = `${provider}/${family}`;
      if (cell === undefined) {
        violations.push(`${where}: family is unaccounted`);
        continue;
      }
      const adapter = adapterFor(provider);
      if (adapter === undefined) {
        violations.push(`${where}: no registration`);
        continue;
      }
      const supported = adapter.contract.capabilities.supportedOperations as readonly string[];
      const gaps = adapter.contract.capabilities.declaredGaps;
      const declaredGap = gaps.find((gap) => gap.operation === cell.operation);
      const expected = EXPECTED_TABLE[provider]?.[family];
      if (expected !== undefined && cell.posture !== expected) {
        violations.push(`${where}: expected ${expected}, observed ${cell.posture}`);
      }
      if (supported.includes(cell.operation) && declaredGap !== undefined) {
        violations.push(`${where}: ${cell.operation} is both supported and a declared gap`);
      }
      if (cell.posture === "covered") {
        if (!supported.includes(cell.operation)) {
          violations.push(`${where}: covered posture names unsupported ${cell.operation}`);
        }
        if (cell.gapReason !== undefined) violations.push(`${where}: dual posture`);
        const entries = cell.catalogEntries ?? [];
        if (entries.length === 0)
          violations.push(`${where}: covered posture names no catalog entry`);
        for (const name of entries) {
          if (!catalogNames(provider).includes(name)) {
            violations.push(`${where}: catalog entry ${name} does not exist`);
          }
        }
        if (cell.fixture === undefined || !existsSync(join(ROOT, cell.fixture))) {
          violations.push(`${where}: fixture reference does not resolve`);
        }
        if (family === "pagination-truncation") {
          const value = observation[provider]?.[cell.operation]?.["pagination-model"];
          const observed = (value as { state?: string; value?: string } | undefined)?.value ?? "";
          if (
            (value as { state?: string } | undefined)?.state !== "observed" ||
            !observed.includes("bound=declared") ||
            !observed.includes("count=reported")
          ) {
            violations.push(`${where}: vacuous covered posture, no declared bound and page count`);
          }
        }
      } else if (cell.posture === "recorded-difference") {
        if (declaredGap !== undefined) {
          violations.push(`${where}: recorded-difference on a declared gap ${cell.operation}`);
        }
        const registerEntry = PARITY_MATRIX.register.find(
          (entry) => entry.differenceId === cell.registerId,
        );
        if (registerEntry === undefined) {
          violations.push(`${where}: registerId ${String(cell.registerId)} does not resolve`);
        } else if (
          registerEntry.adapter !== provider ||
          registerEntry.operation !== cell.operation
        ) {
          violations.push(`${where}: register entry is keyed to another pair`);
        } else {
          const explaining =
            family === "pagination-truncation" ? "pagination-model" : "failure-classification";
          if (!registerEntry.differenceClasses.includes(explaining as never)) {
            violations.push(
              `${where}: class set ${registerEntry.differenceClasses.join(",")} does not explain the family`,
            );
          }
        }
        if (cell.recordedClass === undefined || cell.recordedClass.trim().length === 0) {
          violations.push(`${where}: recorded class is missing`);
        }
      } else if (cell.posture === "gap-backed") {
        if (cell.catalogEntries !== undefined || cell.fixture !== undefined) {
          violations.push(`${where}: dual posture (fixture and gap)`);
        }
        if (declaredGap === undefined) {
          violations.push(`${where}: ${cell.operation} is not a declared gap`);
        } else if (declaredGap.reason !== cell.gapReason) {
          violations.push(
            `${where}: gap reason ${String(cell.gapReason)} differs from ${declaredGap.reason}`,
          );
        }
      } else {
        violations.push(`${where}: unknown posture ${String(cell.posture)}`);
      }
    }
    for (const extra of Object.keys(cellSet).filter(
      (family) => !(TRACKER_TRAP_FAMILIES as readonly string[]).includes(family),
    )) {
      violations.push(`${provider}/${extra}: unknown family`);
    }
  }
  for (const extra of keys.filter((provider) => !providers.includes(provider))) {
    violations.push(`${extra}: unregistered adapter column`);
  }
  return violations;
};

const tally = (accounting: Accounting, posture: Posture): number =>
  Object.values(accounting.providers)
    .flatMap((cells) => Object.values(cells))
    .filter((cell) => cell.posture === posture).length;

describe("TC-TAX-011 the 18-cell posture square is total and non-vacuous", () => {
  test("the accounting is exactly providers × six families with the expected 9/7/2 table", () => {
    const cells = Object.values(ACCOUNTING_DOC.providers).flatMap((entry) => Object.keys(entry));
    expect(cells).toHaveLength(18);
    expect(TRACKER_TRAP_FAMILIES[0]).toBe("auth-shape");
    expect(accountingViolations(ACCOUNTING_DOC)).toEqual([]);
    expect(tally(ACCOUNTING_DOC, "covered")).toBe(9);
    expect(tally(ACCOUNTING_DOC, "recorded-difference")).toBe(7);
    expect(tally(ACCOUNTING_DOC, "gap-backed")).toBe(2);
    expect(
      tally(ACCOUNTING_DOC, "covered") +
        tally(ACCOUNTING_DOC, "recorded-difference") +
        tally(ACCOUNTING_DOC, "gap-backed"),
    ).toBe(18);
    for (const provider of ["github", "gitlab", "jira"]) {
      const cells = ACCOUNTING_DOC.providers[provider];
      if (cells === undefined) throw new Error("missing provider");
      expect(Object.values(cells).map((cell) => cell.posture)).toEqual(
        TRACKER_TRAP_FAMILIES.map((family) => EXPECTED_TABLE[provider]?.[family]),
      );
    }
    expect(
      Object.values(ACCOUNTING_DOC.providers.github ?? {}).filter(
        (cell) => cell.posture === "covered",
      ),
    ).toHaveLength(6);
    expect(
      Object.values(ACCOUNTING_DOC.providers.gitlab ?? {}).filter(
        (cell) => cell.posture === "covered",
      ),
    ).toHaveLength(1);
    expect(
      Object.values(ACCOUNTING_DOC.providers.jira ?? {}).filter(
        (cell) => cell.posture === "covered",
      ),
    ).toHaveLength(2);
  });

  test("the three delivered pagination postures are the delivered facts", () => {
    expect(ACCOUNTING_DOC.providers.github?.["pagination-truncation"]?.posture).toBe("covered");
    expect(ACCOUNTING_DOC.providers.gitlab?.["pagination-truncation"]).toMatchObject({
      posture: "recorded-difference",
      operation: "read-pipeline-run",
      registerId: "gitlab-read-pipeline-run",
    });
    expect(ACCOUNTING_DOC.providers.jira?.["pagination-truncation"]).toMatchObject({
      posture: "gap-backed",
      operation: "read-pipeline-run",
      gapReason: "provider-unsupported",
    });
  });

  test("removing any one of the 18 cells fails naming adapter and family", () => {
    for (const provider of ["github", "gitlab", "jira"]) {
      for (const family of TRACKER_TRAP_FAMILIES) {
        const mutated = JSON.parse(JSON.stringify(ACCOUNTING_DOC)) as Accounting;
        const cells = mutated.providers[provider];
        if (cells === undefined) continue;
        const next = { ...cells };
        delete next[family];
        const mutatedProviders = { ...mutated.providers, [provider]: next };
        const violations = accountingViolations({ ...mutated, providers: mutatedProviders });
        expect(violations.some((message) => message.startsWith(`${provider}/${family}`))).toBe(
          true,
        );
      }
    }
  });

  test("a vacuous covered, a dual posture and an unreachable class all fail by name", () => {
    const vacuous = JSON.parse(JSON.stringify(ACCOUNTING_DOC)) as Accounting;
    const gitlab = vacuous.providers.gitlab;
    if (gitlab === undefined) throw new Error("gitlab missing");
    (gitlab as Record<string, Cell>)["pagination-truncation"] = {
      posture: "covered",
      operation: "read-pipeline-run",
      catalogEntries: ["GL339-PAGINATION-TRUNCATION"],
      fixture: "tests/fixtures/providers/gitlab/families/pagination-truncation.json",
    };
    expect(
      accountingViolations(vacuous).some((message) => message.includes("vacuous covered posture")),
    ).toBe(true);

    const dual = JSON.parse(JSON.stringify(ACCOUNTING_DOC)) as Accounting;
    const github = dual.providers.github;
    if (github === undefined) throw new Error("github missing");
    (github as Record<string, Cell>)["auth-shape"] = {
      ...(github["auth-shape"] as Cell),
      gapReason: "adapter-not-implemented",
    };
    expect(accountingViolations(dual).some((message) => message.includes("dual posture"))).toBe(
      true,
    );

    const unreachable = JSON.parse(JSON.stringify(ACCOUNTING_DOC)) as Accounting;
    const gitlabUnreachable = unreachable.providers.gitlab;
    if (gitlabUnreachable === undefined) throw new Error("gitlab missing");
    (gitlabUnreachable as Record<string, Cell>)["auth-shape"] = {
      posture: "covered",
      operation: "read-delivery-request",
      catalogEntries: ["GL339-AUTH-SHAPE"],
      fixture: "tests/fixtures/providers/gitlab/families/auth-shape.json",
    };
    expect(
      accountingViolations(unreachable).some(
        (message) => message.includes("gitlab/auth-shape") && message.includes("expected"),
      ),
    ).toBe(true);
  });

  test("recording failure-classification for the GitLab pagination cell fails naming the class set", () => {
    const mutated = JSON.parse(JSON.stringify(ACCOUNTING_DOC)) as Accounting;
    const gitlab = mutated.providers.gitlab;
    if (gitlab === undefined) throw new Error("gitlab missing");
    (gitlab as Record<string, Cell>)["pagination-truncation"] = {
      posture: "recorded-difference",
      operation: "read-pipeline-run",
      registerId: "gitlab-read-delivery-request",
      recordedClass: "pagination-model",
      catalogEntries: ["GL339-PAGINATION-TRUNCATION"],
    };
    expect(
      accountingViolations(mutated).some(
        (message) =>
          message.includes("does not explain the family") || message.includes("another pair"),
      ),
    ).toBe(true);
  });
});

describe("TC-TAX-012 catalog-family wiring over the family-wired subset", () => {
  const wired = (): string[] =>
    Object.values(ACCOUNTING_DOC.providers)
      .flatMap((cells) => Object.values(cells))
      .flatMap((cell) => cell.catalogEntries ?? []);

  test("the wired subset is non-empty and bidirectional with the catalog names", () => {
    const referenced = wired();
    expect(referenced.length).toBeGreaterThan(0);
    expect(new Set(referenced).size).toBe(referenced.length);
    const catalogNamesAll = Object.keys(CATALOGS).flatMap((provider) => catalogNames(provider));
    expect(referenced.filter((name) => !catalogNamesAll.includes(name))).toEqual([]);
    expect(catalogNamesAll.filter((name) => referenced.includes(name)).sort()).toEqual(
      [...referenced].sort(),
    );
    expect(validateCatalogs(ROOT, CATALOGS)).toEqual([]);
  });

  test("the frozen trap-name pin and its digest are byte-identical and still a prefix", () => {
    const pinPath = join(ROOT, "tests/fixtures/pins/trap-names.json");
    const bytes = readFileSync(pinPath);
    const pin = JSON.parse(bytes.toString("utf8")) as Record<string, string[]>;
    const digest = readFileSync(join(ROOT, "tests/fixtures/pins/trap-names.sha256"), "utf8").trim();
    expect(digest).toBe(createHash("sha256").update(bytes).digest("hex"));
    for (const provider of ["github", "gitlab", "jira"]) {
      const delivered = CATALOGS[provider]?.entries.map((entry) => String(entry.trapName)) ?? [];
      expect(delivered.slice(0, pin[provider]?.length)).toEqual(pin[provider]);
    }
  });

  test("a renamed family, an absent entry, a broken pointer and a fifth field all fail by name", () => {
    const renamed = JSON.parse(JSON.stringify(ACCOUNTING_DOC)) as Accounting;
    const gl = renamed.providers.gitlab;
    if (gl === undefined) throw new Error("gitlab missing");
    (gl as Record<string, Cell>)["auth-shapes"] = gl["auth-shape"] as Cell;
    delete (gl as Record<string, Cell>)["auth-shape"];
    expect(accountingViolations(renamed).some((message) => message.includes("auth-shapes"))).toBe(
      true,
    );

    const absent = JSON.parse(JSON.stringify(ACCOUNTING_DOC)) as Accounting;
    const gh = absent.providers.github;
    if (gh === undefined) throw new Error("github missing");
    (gh as Record<string, Cell>)["auth-shape"] = {
      ...(gh["auth-shape"] as Cell),
      catalogEntries: ["NO-SUCH-ENTRY"],
    };
    expect(accountingViolations(absent).some((message) => message.includes("does not exist"))).toBe(
      true,
    );

    const broken = JSON.parse(JSON.stringify(CATALOGS)) as Record<
      string,
      { entries: Record<string, unknown>[] }
    >;
    const first = broken.github?.entries[0];
    if (first === undefined) throw new Error("catalog entry missing");
    first.fixtureReference = "tests/fixtures/providers/github/families/missing.json#/stimulus";
    expect(validateCatalogs(ROOT, broken).length).toBeGreaterThan(0);

    const fifth = JSON.parse(JSON.stringify(CATALOGS)) as Record<
      string,
      { entries: Record<string, unknown>[] }
    >;
    const entry = fifth.github?.entries[0];
    if (entry === undefined) throw new Error("catalog entry missing");
    entry.family = "auth-shape";
    expect(
      validateCatalogs(ROOT, fifth).some((message) => message.includes("four DM-2 fields")),
    ).toBe(true);
  });
});
