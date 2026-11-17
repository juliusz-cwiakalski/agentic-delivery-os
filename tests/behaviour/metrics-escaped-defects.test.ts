/**
 * TC-METRICS-060/061/062/063 — escaped defects is a curated floor over three
 * closed classes with artefact-plus-anchor citations, `UNAVAILABLE` for no
 * evidence, non-evidence excluded and disclosed, and the display cap counted.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { scanMetricsCorpus } from "../../packages/adapters/src/file/index";
import { METRICS_ESCAPED_DEFECTS_FLOOR_CAVEAT } from "../../packages/core/src/contracts/index";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { corpusDocument, type EvidenceInput } from "../fixtures/metrics/corpus";
import {
  DAY_MS,
  documentText,
  entriesById,
  METRICS_NOW_MS,
  METRICS_REF,
  type MetricsFixture,
  makeMetricsFixture,
  runMetrics,
} from "../fixtures/metrics/harness";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const at = (daysAgo: number): string => new Date(METRICS_NOW_MS - daysAgo * DAY_MS).toISOString();

/** A fixture with one committed evidence artifact per citation. */
const evidenceCase = (
  label: string,
  rows: readonly EvidenceInput[],
  docs: Readonly<Record<string, string>>,
): MetricsFixture => {
  const fixture = makeMetricsCase({ label, evidence: rows });
  fixtures.push(fixture);
  for (const [relative, text] of Object.entries(docs)) {
    fixture.project.set(relative, text);
  }
  // The evidence rows are declared in the same document the corpus scan reads.
  fixture.setCorpusDocument(
    "2026-11/2026-11-16--GH-299--metrics-spend/chg-GH-299-pm-notes.yaml",
    corpusDocument({ ci: [], evidence: rows }),
  );
  return fixture;
};

const escaped = async (fixture: MetricsFixture): Promise<Record<string, unknown>> => {
  const run = await runMetrics(fixture, ["metrics", "--json"]);
  expect(run.exitCode).toBe(0);
  return entriesById(run.envelope?.data as Record<string, unknown>)["escaped-defects"] ?? {};
};

describe("TC-METRICS-060 the curated floor counts the three closed classes", () => {
  test("three cited incidents land with their classes and the verbatim floor caveat", async () => {
    const paths = {
      review: "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/post-gate.md",
      ci: "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/ci-red.md",
      retro: "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/retro.md",
    } as const;
    const fixture = evidenceCase(
      "escaped-three",
      [
        {
          path: paths.review,
          anchor: "FINDING-1",
          class: "post-gate-review",
          observedAt: at(1),
          ref: METRICS_REF,
        },
        {
          path: paths.ci,
          anchor: "CI-RED-HEAD",
          class: "landed-ci-failure",
          observedAt: at(2),
          ref: METRICS_REF,
        },
        {
          path: paths.retro,
          anchor: "RETRO-DEFECT",
          class: "retro-attributed",
          observedAt: at(3),
          ref: METRICS_REF,
        },
      ],
      {
        "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/post-gate.md":
          "# Review\nFINDING-1: a defect landed after the gates were green.\n",
        "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/ci-red.md":
          "# CI\nCI-RED-HEAD: the landed head was red.\n",
        "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/retro.md":
          "# Retro\nRETRO-DEFECT: attributed to the landed change.\n",
      },
    );
    const entry = await escaped(fixture);
    expect(entry.measurementKind).toBe("curated-count");
    expect(entry.basis).toBe("committed-evidence-corpus");
    expect(entry.definitionRef).toBeUndefined();
    expect(entry.value).toBe(3);
    const incidents = entry.incidents as readonly Record<string, unknown>[];
    expect(incidents.map((row) => row.class).sort()).toEqual([
      "landed-ci-failure",
      "post-gate-review",
      "retro-attributed",
    ]);
    for (const incident of incidents) {
      expect(String(incident.artifact).length).toBeGreaterThan(0);
      expect(String(incident.anchor).length).toBeGreaterThan(0);
      expect(incident.observedAt).toBeDefined();
      const cited = documentText(fixture, String(incident.artifact));
      expect(cited).toContain(String(incident.anchor));
    }
    const sample = entry.sample as Record<string, number>;
    expect(sample.n).toBe(3);
    expect(
      (sample.postGateReview ?? 0) + (sample.landedCiFailure ?? 0) + (sample.retroAttributed ?? 0),
    ).toBe(3);
    expect(entry.limitation).toBe(METRICS_ESCAPED_DEFECTS_FLOOR_CAVEAT);
    expect(JSON.stringify(entry)).not.toMatch(/MET-/u);
  });

  test("conforming but uncounted rows never enter the incidents or the counts", async () => {
    const entry = await escaped(
      evidenceCase(
        "escaped-uncounted",
        [
          {
            path: "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/post-gate.md",
            anchor: "FINDING-1",
            class: "post-gate-review",
            observedAt: at(1),
            ref: METRICS_REF,
          },
          {
            path: "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/foreign.md",
            anchor: "FOREIGN-1",
            class: "retro-attributed",
            observedAt: at(1),
            ref: "GH-999",
          },
          {
            path: "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/no-class.md",
            anchor: "NO-CLASS",
            class: null,
            observedAt: at(1),
            ref: METRICS_REF,
          },
        ],
        {
          "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/post-gate.md":
            "FINDING-1 defect after green gates\n",
          "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/foreign.md":
            "FOREIGN-1 attributed to another change\n",
          "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/no-class.md":
            "NO-CLASS an uncited claim\n",
        },
      ),
    );
    expect(entry.value).toBe(1);
    expect((entry.incidents as readonly unknown[]).length).toBe(1);
  });
});

describe("TC-METRICS-061 no committed evidence is UNAVAILABLE, never zero", () => {
  test("an empty corpus is UNAVAILABLE with an empty incident list and named absence", async () => {
    const fixture = makeMetricsCase({ label: "escaped-empty", evidence: [] });
    fixtures.push(fixture);
    const entry = await escaped(fixture);
    expect(entry.status).toBe("UNAVAILABLE");
    expect(entry.value).toBeUndefined();
    expect(entry.incidents ?? []).toEqual([]);
    expect(String(entry.limitation)).toContain("Curated floor, not a census");
    const human = (await runMetrics(fixture, ["metrics"])).human;
    expect(human).toContain("escaped-defects  curated-count  UNAVAILABLE");
    expect(human).not.toContain("0 escaped defects");
  });

  test("a corpus of only out-of-window rows is UNAVAILABLE", async () => {
    const entry = await escaped(
      evidenceCase(
        "escaped-out-of-window",
        [
          {
            path: "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/old.md",
            anchor: "OLD-DEFECT",
            class: "post-gate-review",
            observedAt: at(400),
            ref: METRICS_REF,
          },
        ],
        {
          "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/old.md":
            "OLD-DEFECT long ago\n",
        },
      ),
    );
    expect(entry.status).toBe("UNAVAILABLE");
    expect(entry.value).toBeUndefined();
  });

  test("the one-incident control proves the absence is attributable to the evidence", async () => {
    const entry = await escaped(
      evidenceCase(
        "escaped-one",
        [
          {
            path: "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/one.md",
            anchor: "ONE-DEFECT",
            class: "post-gate-review",
            observedAt: at(1),
            ref: METRICS_REF,
          },
        ],
        {
          "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/one.md":
            "ONE-DEFECT counted\n",
        },
      ),
    );
    expect(entry.value).toBe(1);
    expect((entry.incidents as readonly Record<string, unknown>[])[0]?.anchor).toBe("ONE-DEFECT");
  });
});

describe("TC-METRICS-062 non-evidence is never counted and is disclosed", () => {
  test("prohibited paths, uncited claims, and unresolvable anchors are excluded", async () => {
    const fixturesCase = evidenceCase(
      "escaped-non-evidence",
      [
        {
          path: "tmp/scratch/defect.md",
          anchor: "TMP-DEFECT",
          class: "post-gate-review",
          observedAt: at(1),
          ref: METRICS_REF,
        },
        {
          path: ".ai/local/defect.md",
          anchor: "LOCAL-DEFECT",
          class: "post-gate-review",
          observedAt: at(1),
          ref: METRICS_REF,
        },
        {
          path: "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/uncited.md",
          anchor: null,
          class: "post-gate-review",
          observedAt: at(1),
          ref: METRICS_REF,
        },
        {
          path: "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/missing-anchor.md",
          anchor: "ANCHOR-NOT-PRESENT",
          class: "retro-attributed",
          observedAt: at(1),
          ref: METRICS_REF,
        },
        {
          path: "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/conforming.md",
          anchor: "CONFORMING-DEFECT",
          class: "landed-ci-failure",
          observedAt: at(1),
          ref: METRICS_REF,
        },
        {
          path: "doc/changes/../../etc/passwd",
          anchor: "ROOT-SECRET",
          class: "post-gate-review",
          observedAt: at(1),
          ref: METRICS_REF,
        },
      ],
      {
        "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/uncited.md":
          "no anchor here\n",
        "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/missing-anchor.md":
          "nothing to resolve\n",
        "doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/conforming.md":
          "CONFORMING-DEFECT counted\n",
        "doc/changes/../../etc/passwd": "ROOT-SECRET outside the tree\n",
      },
    );
    const entry = await escaped(fixturesCase);
    expect(entry.value).toBe(1);
    const incidents = entry.incidents as readonly Record<string, unknown>[];
    expect(incidents.map((row) => row.anchor)).toEqual(["CONFORMING-DEFECT"]);
    expect((entry.sample as Record<string, number>).excludedNonEvidence).toBeGreaterThan(0);
    expect(JSON.stringify(entry)).not.toContain("ROOT-SECRET");
    const before = fixturesCase.snapshot();
    await runMetrics(fixturesCase, ["metrics", "--json"]);
    expect(fixturesCase.snapshot()).toBe(before);
    // The fixture tree is unchanged: no evidence artifact was created or edited.
    for (const row of incidents) {
      expect(fixturesCase.project.exists(`${fixturesCase.root}/${String(row.artifact)}`)).toBe(
        true,
      );
    }
  });

  test("the scan rejects an interior traversal segment in a committed-relative path", () => {
    const fixture = makeMetricsFixture({ label: "corpus-traversal", activeRef: METRICS_REF });
    fixtures.push(fixture);
    fixture.setCorpusDocument(
      "x/corpus.yaml",
      corpusDocument({
        ci: [
          {
            ref: "GH-1",
            path: "doc/../../etc/passwd",
            observed: true,
            outcome: "red",
            observedAt: at(1),
          },
        ],
        evidence: [
          {
            path: "doc/../../etc/passwd",
            anchor: "ROOT-SECRET",
            class: "post-gate-review",
            observedAt: at(1),
            ref: METRICS_REF,
          },
        ],
      }),
    );
    fixture.project.set("doc/../../etc/passwd", "ROOT-SECRET\n");
    const read = scanMetricsCorpus({
      projectRoot: fixture.root,
      changesDirectory: "doc/changes",
      fs: fixture.project,
    });
    // The CI row is dropped outright; the evidence row remains but never resolves.
    expect(read.rows.filter((row) => row.kind === "ci-observation")).toEqual([]);
    expect(read.rows).toHaveLength(1);
    expect(read.rows[0]).toMatchObject({
      kind: "evidence",
      citation: "unresolved",
    });
  });
});

describe("TC-METRICS-063 the incident display cap counts its omissions", () => {
  const manyRows = (count: number): readonly EvidenceInput[] =>
    Array.from({ length: count }, (_, index) => ({
      path: `doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/incident-${String(index)}.md`,
      anchor: `INCIDENT-${String(index)}`,
      class:
        index % 3 === 0
          ? ("post-gate-review" as const)
          : index % 3 === 1
            ? ("landed-ci-failure" as const)
            : ("retro-attributed" as const),
      observedAt: at((index % 20) + 1),
      ref: METRICS_REF,
    }));

  const docs = (count: number): Readonly<Record<string, string>> =>
    Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/review/incident-${String(index)}.md`,
        `INCIDENT-${String(index)} cited\n`,
      ]),
    );

  test("eleven incidents list eight with three counted omissions while the total stays eleven", async () => {
    const fixture = evidenceCase("escaped-cap-11", manyRows(11), docs(11));
    const entry = await escaped(fixture);
    const incidents = entry.incidents as readonly Record<string, unknown>[];
    expect(incidents.length).toBe(8);
    expect(entry.value).toBe(11);
    const sample = entry.sample as Record<string, number>;
    expect(
      (sample.postGateReview ?? 0) + (sample.landedCiFailure ?? 0) + (sample.retroAttributed ?? 0),
    ).toBe(11);
    const data = (await runMetrics(fixture, ["metrics", "--json"])).envelope?.data as {
      omitted: number;
      truncated: boolean;
    };
    expect(data.omitted).toBe(3);
    expect(data.truncated).toBe(true);
  });

  test("two incidents render in full with no omission", async () => {
    const fixture = evidenceCase("escaped-cap-2", manyRows(2), docs(2));
    const entry = await escaped(fixture);
    expect((entry.incidents as readonly unknown[]).length).toBe(2);
    const data = (await runMetrics(fixture, ["metrics", "--json"])).envelope?.data as {
      omitted: number;
      truncated: boolean;
    };
    expect(data.omitted).toBe(0);
    expect(data.truncated).toBe(false);
  });

  test("the listing order is stable under a shuffled corpus", async () => {
    const rows = manyRows(5);
    const first = await escaped(evidenceCase("escaped-order-a", rows, docs(5)));
    const shuffled = [...rows].reverse();
    const second = await escaped(evidenceCase("escaped-order-b", shuffled, docs(5)));
    expect(
      (second.incidents as readonly Record<string, unknown>[]).map((row) => row.artifact),
    ).toEqual((first.incidents as readonly Record<string, unknown>[]).map((row) => row.artifact));
  });
});
