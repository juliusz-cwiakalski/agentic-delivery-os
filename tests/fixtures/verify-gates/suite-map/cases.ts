/**
 * The declared suite-map fixture corpus (GH-300 test plan §6.2).
 *
 * Pure typed builders returning raw declaration values and expected read
 * outcomes. No I/O, no clock, no environment: every suite deep-clones one
 * builder, applies one mutation, and exits through the same resolver.
 */
import type { VerifySuiteMap } from "../../../../packages/core/src/contracts/index";
import { VERIFY_SUITE_MAP_SCHEMA_VERSION } from "../../../../packages/core/src/contracts/index";

/** The pinned reference breadth: the eight declared suites, in declared order. */
export const REFERENCE_SUITES = [
  "tests",
  "lint",
  "format",
  "typecheck",
  "boundaries",
  "prompt-conformance",
  "help-guide-coverage",
  "exports-parity",
] as const;

export const REFERENCE_JOB = "TS aggregate check";

const map = (
  jobs: readonly { readonly job: string; readonly suites: readonly string[] }[],
  local: readonly string[],
): VerifySuiteMap => ({
  schemaVersion: VERIFY_SUITE_MAP_SCHEMA_VERSION,
  jobs: jobs.map((entry) => ({ job: entry.job, suites: [...entry.suites] })),
  local: [...local],
});

/** The fixture equality map: `job-01` mirrors the reference breadth exactly. */
export const validEqualityMap = (): VerifySuiteMap =>
  map([{ job: "job-01", suites: REFERENCE_SUITES }], REFERENCE_SUITES);

/** The reference declaration shape (same job name as the committed document). */
export const referenceDeclaration = (): VerifySuiteMap =>
  map([{ job: REFERENCE_JOB, suites: REFERENCE_SUITES }], REFERENCE_SUITES);

/** The order witness: set-equal to the mirror but declared in reverse order. */
export const reorderedLocalMap = (): VerifySuiteMap =>
  map([{ job: "job-01", suites: REFERENCE_SUITES }], [...REFERENCE_SUITES].reverse());

/** The third permutation: first and last identifiers moved into the middle. */
export const permutedLocalMap = (): VerifySuiteMap => {
  const [first, ...rest] = REFERENCE_SUITES;
  const [last] = rest.slice(-1);
  const middle = rest.slice(0, -1);
  return map(
    [{ job: "job-01", suites: REFERENCE_SUITES }],
    [
      middle[0] ?? "lint",
      middle[1] ?? "format",
      ...middle.slice(2),
      first ?? "tests",
      last ?? "exports-parity",
    ],
  );
};

/** Two jobs whose sets both equal `local`, in declared order. */
export const twoEqualJobsMap = (order: readonly string[] = ["job-01", "job-02"]): VerifySuiteMap =>
  map(
    order.map((job) => ({ job, suites: REFERENCE_SUITES })),
    REFERENCE_SUITES,
  );

/** Flow 2: `local: [tests]` against the eight-suite mirror. */
export const narrowedMap = (): VerifySuiteMap =>
  map([{ job: REFERENCE_JOB, suites: REFERENCE_SUITES }], ["tests"]);

/** A local set wider than every declared job. */
export const widerMap = (): VerifySuiteMap =>
  map([{ job: REFERENCE_JOB, suites: REFERENCE_SUITES }], [...REFERENCE_SUITES, "e2e"]);

/** A local set disjoint from every declared job. */
export const disjointMap = (): VerifySuiteMap =>
  map([{ job: "job-01", suites: REFERENCE_SUITES }], ["e2e"]);

/** An equality whose mirror is absent from the read job-name set. */
export const mirrorAbsentMap = (): VerifySuiteMap =>
  map([{ job: "not-a-workflow-job", suites: REFERENCE_SUITES }], REFERENCE_SUITES);

/** The maximal narrowing: 31 local identifiers against a 32-suite mirror. */
export const maxNarrowingMap = (): VerifySuiteMap => {
  const mirror = Array.from({ length: 32 }, (_, index) => `suite-${index + 1}`);
  return map([{ job: "j".repeat(120), suites: mirror }], mirror.slice(0, 31));
};

/** The nine-local-identifier narrowing (the 8/9 omitted boundary). */
export const nineLocalMap = (): VerifySuiteMap => {
  const mirror = Array.from({ length: 10 }, (_, index) => `suite-${index + 1}`);
  return map([{ job: REFERENCE_JOB, suites: mirror }], mirror.slice(0, 9));
};

/** The 32-entry projectable local declaration. */
export const projection32Map = (): VerifySuiteMap => {
  const mirror = Array.from({ length: 32 }, (_, index) => `suite-${index + 1}`);
  return map([{ job: REFERENCE_JOB, suites: mirror }], mirror);
};

/** The at-bound acceptance declaration (every cap inclusive). */
export const atBoundMap = (): VerifySuiteMap => {
  const longIdentifier = "a".repeat(64);
  const jobs = Array.from({ length: 64 }, (_, index) => ({
    job: index === 0 ? "j".repeat(120) : `job-at-bound-${index + 1}`,
    suites: [longIdentifier, ...Array.from({ length: 31 }, (_, inner) => `s-${inner + 1}`)],
  }));
  return map(
    jobs,
    Array.from({ length: 32 }, (_, index) => (index === 0 ? longIdentifier : `l-${index + 1}`)),
  );
};

const identifiers = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `suite-${index + 1}`);

const withJob = (job: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  schemaVersion: VERIFY_SUITE_MAP_SCHEMA_VERSION,
  jobs: [{ job, suites: ["tests"], ...extra }],
  local: ["tests"],
});

/** One declaration per closed-shape, cap, grammar, duplicate, and job-class defect. */
export const DEFECTS: Readonly<Record<string, unknown>> = {
  "schema-version-missing": { jobs: [{ job: "job-01", suites: ["tests"] }], local: ["tests"] },
  "schema-version-unsupported": {
    ...validEqualityMap(),
    schemaVersion: "delivery.verify.suite-map.v2",
  },
  "undeclared-top-level-key": { ...validEqualityMap(), extra: true },
  "jobs-missing": { schemaVersion: VERIFY_SUITE_MAP_SCHEMA_VERSION, local: ["tests"] },
  "jobs-not-list": { ...validEqualityMap(), jobs: "job-01" },
  "jobs-empty": { ...validEqualityMap(), jobs: [] },
  "local-missing": {
    schemaVersion: VERIFY_SUITE_MAP_SCHEMA_VERSION,
    jobs: validEqualityMap().jobs,
  },
  "local-not-list": { ...validEqualityMap(), local: "tests" },
  "local-empty": { ...validEqualityMap(), local: [] },
  "entry-job-missing": { ...validEqualityMap(), jobs: [{ suites: ["tests"] }] },
  "entry-suites-missing": { ...validEqualityMap(), jobs: [{ job: "job-01" }] },
  "entry-undeclared-key": {
    ...validEqualityMap(),
    jobs: [{ job: "job-01", suites: ["tests"], extra: true }],
  },
  "jobs-over-cap": {
    ...validEqualityMap(),
    jobs: Array.from({ length: 65 }, (_, index) => ({ job: `job-${index}`, suites: ["tests"] })),
  },
  "suites-over-cap": withJob("job-01", { suites: identifiers(33) }),
  "local-over-cap": { ...validEqualityMap(), local: identifiers(33) },
  "id-uppercase": withJob("job-01", { suites: ["Tests"] }),
  "id-leading-digit": withJob("job-01", { suites: ["1tests"] }),
  "id-leading-hyphen": withJob("job-01", { suites: ["-tests"] }),
  "id-underscore": withJob("job-01", { suites: ["te_sts"] }),
  "id-space": withJob("job-01", { suites: ["te sts"] }),
  "id-empty": withJob("job-01", { suites: [""] }),
  "id-over-long": withJob("job-01", { suites: ["a".repeat(65)] }),
  "job-empty": withJob(""),
  "job-over-long": withJob("j".repeat(121)),
  "job-duplicate": {
    ...validEqualityMap(),
    jobs: [
      { job: "job-01", suites: ["tests"] },
      { job: "job-01", suites: ["lint"] },
    ],
  },
  "suites-empty": withJob("job-01", { suites: [] }),
  "suites-duplicate": withJob("job-01", { suites: ["tests", "tests"] }),
  "local-duplicate": { ...validEqualityMap(), local: ["tests", "tests"] },
  "job-line-break": withJob("job\n01"),
  "job-control-character": withJob("job\u0000 01"),
  "job-tab": withJob("job\t01"),
  "job-leading-space": withJob(" job-01"),
  "job-trailing-space": withJob("job-01 "),
  "job-whitespace-only": withJob("   "),
};

/** The nine-plus local identifiers used by the cause-line `omitted` case. */
export const ninePlusUnmirroredMap = (): VerifySuiteMap => {
  const local = Array.from({ length: 9 }, (_, index) => `unmirrored-${index + 1}`);
  return map([{ job: "job-01", suites: ["tests"] }], local);
};
