/**
 * TC-SMAP-001/002/003 (pure halves) — the declared suite-map resolver.
 *
 * Every case resolves one raw declaration through the pure domain resolver: no
 * I/O, no clock, no environment, no default map, and every defect refused as
 * `config.value.invalid`.
 */
import { describe, expect, test } from "bun:test";
import {
  VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS,
  VERIFY_SUITE_ID_PATTERN,
  VERIFY_SUITE_MAP_CONFIG_KEY,
  VERIFY_SUITE_MAP_MAX_JOBS,
  VERIFY_SUITE_MAP_MAX_SUITES_PER_JOB,
  VERIFY_SUITE_MAP_SCHEMA_VERSION,
  VERIFY_SUITE_MAX_BREADTH,
  VERIFY_SUITE_MAX_ID_CHARS,
} from "../../packages/core/src/contracts/index";
import {
  extractVerifySuiteMapNode,
  renderSuiteMapCauseLine,
  resolveVerifySuiteBreadth,
  resolveVerifySuiteMap,
  resolveVerifySuiteMapFromConfig,
  suiteBreadthCitationOf,
} from "../../packages/core/src/domain/index";
import { createNoNetworkGuard } from "../fixtures/verify-gates/cases/network-guard";
import {
  atBoundMap,
  DEFECTS,
  disjointMap,
  mirrorAbsentMap,
  narrowedMap,
  REFERENCE_JOB,
  REFERENCE_SUITES,
  referenceDeclaration,
  reorderedLocalMap,
  twoEqualJobsMap,
  validEqualityMap,
  widerMap,
} from "../fixtures/verify-gates/suite-map/cases";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("TC-SMAP-001 the valid declaration resolves mechanically with no refusal", () => {
  test("the declared data is preserved in declared order", () => {
    const resolved = resolveVerifySuiteMap(validEqualityMap());
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || !resolved.declared) throw new Error("expected a declared map");
    expect(resolved.value.schemaVersion).toBe(VERIFY_SUITE_MAP_SCHEMA_VERSION);
    expect(resolved.value.jobs).toHaveLength(1);
    expect(resolved.value.jobs[0]?.job).toBe("job-01");
    expect(resolved.value.jobs[0]?.suites).toEqual([...REFERENCE_SUITES]);
    expect(resolved.value.local).toEqual([...REFERENCE_SUITES]);
  });

  test("two jobs are preserved in declared order and neither is merged or sorted", () => {
    const resolved = resolveVerifySuiteMap(twoEqualJobsMap(["job-02", "job-01"]));
    if (!resolved.ok || !resolved.declared) throw new Error("expected a declared map");
    expect(resolved.value.jobs.map((entry) => entry.job)).toEqual(["job-02", "job-01"]);
    expect(resolved.value.jobs[1]?.suites).toEqual([...REFERENCE_SUITES]);
  });

  test("an absent declaration is explicitly undeclared and invents no default", () => {
    const absent = resolveVerifySuiteMapFromConfig({ provider: { defaultChain: "zai" } });
    expect(absent).toEqual({ ok: true, declared: false });
    expect(resolveVerifySuiteMapFromConfig(undefined)).toEqual({ ok: true, declared: false });
    expect(resolveVerifySuiteMapFromConfig({ verify: "not-an-object" })).toEqual({
      ok: true,
      declared: false,
    });
  });

  test("the node extraction reads only verify.suite-map and nothing else", () => {
    expect(extractVerifySuiteMapNode({ verify: {} })).toEqual({ kind: "absent" });
    expect(extractVerifySuiteMapNode({ verify: { "suite-map": validEqualityMap() } })).toEqual({
      kind: "present",
      node: validEqualityMap(),
    });
    expect(extractVerifySuiteMapNode({ verify: { lane: { "restart-budget": 3 } } })).toEqual({
      kind: "absent",
    });
  });

  test("the resolution performs no I/O and does not mutate its input", () => {
    const guard = createNoNetworkGuard();
    const input = clone(validEqualityMap());
    const frozen = JSON.stringify(input);
    try {
      const first = resolveVerifySuiteMap(input);
      const second = resolveVerifySuiteMap(input);
      expect(second).toEqual(first);
      expect(JSON.stringify(input)).toBe(frozen);
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
    }
  });

  test("the six constants and the single id pattern are declared with the pinned values", () => {
    expect(VERIFY_SUITE_MAP_SCHEMA_VERSION).toBe("delivery.verify.suite-map.v1");
    expect(VERIFY_SUITE_MAP_CONFIG_KEY).toBe("verify.suite-map");
    expect(VERIFY_SUITE_MAP_MAX_JOBS).toBe(64);
    expect(VERIFY_SUITE_MAP_MAX_SUITES_PER_JOB).toBe(32);
    expect(VERIFY_SUITE_MAX_BREADTH).toBe(32);
    expect(VERIFY_SUITE_MAX_ID_CHARS).toBe(64);
    expect(VERIFY_SUITE_ID_PATTERN).toBe("^[a-z][a-z0-9-]*$");
    expect(VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS).toBe(120);
  });
});

describe("TC-SMAP-002 every closed-shape defect is refused config.value.invalid", () => {
  for (const [name, raw] of Object.entries(DEFECTS)) {
    test(`${name} is refused with no data`, () => {
      const resolved = resolveVerifySuiteMap(raw);
      expect(resolved.ok, name).toBe(false);
      if (resolved.ok) return;
      expect(resolved.code).toBe("config.value.invalid");
      expect(Object.hasOwn(resolved, "value")).toBe(false);
    });
  }

  test("a document-level defect outside the node is not interpreted", () => {
    const document = {
      provider: { unknownKey: true },
      merge: "defective",
      verify: { "suite-map": validEqualityMap() },
    };
    const resolved = resolveVerifySuiteMapFromConfig(document);
    if (!resolved.ok || !resolved.declared) throw new Error("expected the declaration honoured");
    expect(resolved.value.jobs[0]?.job).toBe("job-01");
  });

  test("run twice, every refusal is identical", () => {
    for (const raw of Object.values(DEFECTS)) {
      expect(resolveVerifySuiteMap(raw)).toEqual(resolveVerifySuiteMap(raw));
    }
  });
});

describe("TC-SMAP-003 caps, grammar, duplicates, and at-bound acceptance", () => {
  test("the at-bound pair is accepted and echoed unchanged", () => {
    const declaration = atBoundMap();
    const resolved = resolveVerifySuiteMap(declaration);
    if (!resolved.ok || !resolved.declared) throw new Error("expected the at-bound map accepted");
    expect(resolved.value.jobs).toHaveLength(VERIFY_SUITE_MAP_MAX_JOBS);
    expect(resolved.value.jobs[0]?.suites).toHaveLength(VERIFY_SUITE_MAP_MAX_SUITES_PER_JOB);
    expect(resolved.value.local).toHaveLength(VERIFY_SUITE_MAX_BREADTH);
    expect(resolved.value.jobs[0]?.suites[0]).toHaveLength(VERIFY_SUITE_MAX_ID_CHARS);
    expect(resolved.value.jobs[0]?.job.length).toBe(120);
  });

  test("the reference declaration keeps its two declared sides", () => {
    const resolved = resolveVerifySuiteMap(referenceDeclaration());
    if (!resolved.ok || !resolved.declared) throw new Error("expected the reference declaration");
    expect(resolved.value.jobs[0]?.job).toBe(REFERENCE_JOB);
    expect(resolved.value.jobs[0]?.suites).toEqual(resolved.value.local);
  });

  test("one over each cap is refused", () => {
    for (const name of ["jobs-over-cap", "suites-over-cap", "local-over-cap"]) {
      expect(resolveVerifySuiteMap(DEFECTS[name]).ok, name).toBe(false);
    }
  });

  test("each malformed identifier, duplicate, and job-class violation is refused", () => {
    const classes = [
      "id-uppercase",
      "id-leading-digit",
      "id-leading-hyphen",
      "id-underscore",
      "id-space",
      "id-empty",
      "id-over-long",
      "job-empty",
      "job-over-long",
      "job-duplicate",
      "suites-empty",
      "suites-duplicate",
      "local-duplicate",
      "job-line-break",
      "job-control-character",
      "job-tab",
      "job-leading-space",
      "job-trailing-space",
      "job-whitespace-only",
    ];
    for (const name of classes) {
      expect(resolveVerifySuiteMap(DEFECTS[name]).ok, name).toBe(false);
    }
  });
});

const workflow = (names: readonly string[], outcome: "read" | "failed" | "absent" = "read") => ({
  outcome,
  names,
});

describe("TC-SMAP-005 corroboration is exact string match", () => {
  const map = validEqualityMap();
  test("the exact declared job corroborates", () => {
    const outcome = resolveVerifySuiteBreadth({ map, workflow: workflow(["job-01"]) });
    expect(outcome.kind).toBe("equal");
  });

  for (const variant of ["Job-01", " job-01", "job-01 ", "job-01.", "job--01", "job 01"]) {
    test(`the near-match "${variant}" is uncorroborated`, () => {
      const outcome = resolveVerifySuiteBreadth({ map, workflow: workflow([variant]) });
      expect(outcome).toEqual({ kind: "uncorroborated", mirrorsJob: "job-01" });
    });
  }

  test("the cause line prints the declared job verbatim", () => {
    const outcome = resolveVerifySuiteBreadth({ map, workflow: workflow(["Job-01"]) });
    expect(renderSuiteMapCauseLine(outcome, map.local)).toBe("mirror=job-01");
  });
});

describe("TC-SRES-004 the first equality in declared order is the mirror", () => {
  test("first order wins both times and set comparison is order-insensitive", () => {
    const first = resolveVerifySuiteBreadth({
      map: twoEqualJobsMap(["job-01", "job-02"]),
      workflow: workflow(["job-01", "job-02"]),
    });
    const swapped = resolveVerifySuiteBreadth({
      map: twoEqualJobsMap(["job-02", "job-01"]),
      workflow: workflow(["job-01", "job-02"]),
    });
    expect(first.kind === "equal" ? first.mirrorsJob : undefined).toBe("job-01");
    expect(swapped.kind === "equal" ? swapped.mirrorsJob : undefined).toBe("job-02");
    expect(
      resolveVerifySuiteBreadth({ map: twoEqualJobsMap(), workflow: workflow(["job-01"]) }),
    ).toEqual(
      resolveVerifySuiteBreadth({ map: twoEqualJobsMap(), workflow: workflow(["job-01"]) }),
    );
  });

  test("the citation follows the mirror's declared order, never the local order", () => {
    const map = reorderedLocalMap();
    const outcome = resolveVerifySuiteBreadth({ map, workflow: workflow(["job-01"]) });
    if (outcome.kind !== "equal") throw new Error("expected equality");
    expect(outcome.suiteBreadth).toEqual([...REFERENCE_SUITES]);
    expect(outcome.suiteBreadth).not.toEqual(map.local);
  });
});

describe("TC-SRES-005 the four-outcome totality matrix", () => {
  const cases: readonly (readonly [string, unknown, string])[] = [
    ["equality", validEqualityMap(), "equal"],
    ["two-equal", twoEqualJobsMap(), "equal"],
    ["narrowing", narrowedMap(), "narrower"],
    ["wider", widerMap(), "unmirrored"],
    ["disjoint", disjointMap(), "unmirrored"],
    ["mirror-absent", mirrorAbsentMap(), "uncorroborated"],
  ];
  for (const [name, raw, expected] of cases) {
    test(`${name} resolves to exactly ${expected}`, () => {
      const resolved = resolveVerifySuiteMap(raw);
      if (!resolved.ok || !resolved.declared) throw new Error("expected a declared map");
      const outcome = resolveVerifySuiteBreadth({
        map: resolved.value,
        workflow: workflow(["job-01", "job-02", REFERENCE_JOB]),
      });
      expect(outcome.kind).toBe(expected);
    });
  }

  test("an invalid workflow produces no breadth outcome", () => {
    for (const facts of [
      workflow([], "read"),
      workflow(["job-01", "job-01"], "read"),
      workflow(["job-01"], "failed"),
      workflow(["job-01"], "absent"),
      workflow(
        Array.from({ length: 201 }, (_, index) => `job-${index}`),
        "read",
      ),
    ]) {
      expect(resolveVerifySuiteBreadth({ map: validEqualityMap(), workflow: facts })).toEqual({
        kind: "not-evaluated",
      });
    }
  });

  test("a wider local set is never reported as a pass", () => {
    const resolved = resolveVerifySuiteMap(widerMap());
    if (!resolved.ok || !resolved.declared) throw new Error("expected a declared map");
    const outcome = resolveVerifySuiteBreadth({
      map: resolved.value,
      workflow: workflow(["TS aggregate check"]),
    });
    expect(outcome.kind).toBe("unmirrored");
    expect(suiteBreadthCitationOf(outcome)).toBeUndefined();
  });
});
