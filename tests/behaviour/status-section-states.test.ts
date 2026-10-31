/**
 * TC-STATUS-003 / TC-STATUS-004 — six-section totality and the Appendix A
 * derivation matrix, including item-unknown vs section-unknown twins.
 */
import { describe, expect, test } from "bun:test";
import type { StatusDigest, StatusSection } from "../../packages/core/src/contracts/index";
import {
  STATUS_EVIDENCE_OUTCOMES,
  STATUS_EVIDENCE_REASONS,
  STATUS_EVIDENCE_SOURCES,
  STATUS_SECTION_ORDER,
  STATUS_SECTION_STATES,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus } from "../../packages/core/src/domain/index";
import {
  baseFacts,
  failedPipelineRunRead,
  failedWorkItemRead,
  pipelineRunRead,
  sectionById,
  workItemRead,
} from "../fixtures/status/harness";
import { matrixCases } from "../fixtures/status/matrix/cases";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCounts = (value: unknown): boolean =>
  isRecord(value) &&
  Object.keys(value).sort().join(",") === "observed,omitted,total,unknown" &&
  [value.observed, value.unknown, value.total, value.omitted].every(
    (count) => typeof count === "number" && Number.isInteger(count) && count >= 0,
  ) &&
  (value.observed as number) + (value.unknown as number) <= (value.total as number);

const shapeFailures = (value: unknown): string[] => {
  const failures: string[] = [];
  if (!isRecord(value)) return ["digest is not an object"];
  const sections = value.sections;
  if (!Array.isArray(sections)) return ["sections is not an array"];
  if (sections.length !== 6) failures.push(`sections length ${sections.length} != 6`);
  const ids = sections.map((section) => (isRecord(section) ? section.id : undefined));
  if (JSON.stringify(ids) !== JSON.stringify(STATUS_SECTION_ORDER)) {
    failures.push(`section ids ${JSON.stringify(ids)} != ${JSON.stringify(STATUS_SECTION_ORDER)}`);
  }
  for (const section of sections) {
    if (!isRecord(section)) {
      failures.push("a section is not an object");
      continue;
    }
    const id = String(section.id);
    if (typeof section.title !== "string" || section.title.length === 0) {
      failures.push(`${id}: title is not a non-empty string`);
    }
    if (!(STATUS_SECTION_STATES as readonly unknown[]).includes(section.state)) {
      failures.push(`${id}: invalid state ${String(section.state)}`);
    }
    const evidence = section.evidence;
    if (!isRecord(evidence)) {
      failures.push(`${id}: evidence is missing`);
    } else {
      const sources = evidence.sources;
      if (!Array.isArray(sources) || sources.length < 1 || sources.length > 6) {
        failures.push(`${id}: evidence.sources must have 1..6 entries`);
      } else {
        for (const source of sources) {
          if (!isRecord(source)) {
            failures.push(`${id}: evidence source is not an object`);
            continue;
          }
          if (!(STATUS_EVIDENCE_SOURCES as readonly unknown[]).includes(source.source)) {
            failures.push(`${id}: invalid source ${String(source.source)}`);
          }
          if (!(STATUS_EVIDENCE_OUTCOMES as readonly unknown[]).includes(source.outcome)) {
            failures.push(`${id}: invalid outcome ${String(source.outcome)}`);
          }
        }
      }
      const reasons = evidence.reasons;
      if (!Array.isArray(reasons) || reasons.length < 1 || reasons.length > 6) {
        failures.push(`${id}: evidence.reasons must have 1..6 entries`);
      } else {
        if (new Set(reasons).size !== reasons.length) failures.push(`${id}: duplicate reasons`);
        for (const reason of reasons) {
          if (!(STATUS_EVIDENCE_REASONS as readonly unknown[]).includes(reason)) {
            failures.push(`${id}: invalid reason ${String(reason)}`);
          }
        }
      }
    }
    if (!isCounts(section.counts)) failures.push(`${id}: counts shape is invalid`);
    if (typeof section.truncated !== "boolean") failures.push(`${id}: truncated is not boolean`);
    if (id === "tracker") {
      if (!Array.isArray(section.families) || section.families.length !== 4) {
        failures.push(`${id}: families must have four entries`);
      }
    }
    if (id === "changes-and-prs") {
      if (!isRecord(section.activeChange)) failures.push(`${id}: activeChange missing`);
      if (!Array.isArray(section.pullRequests)) failures.push(`${id}: pullRequests missing`);
    }
    if (id === "ci") {
      if (!isRecord(section.commit)) failures.push(`${id}: commit missing`);
      if (typeof section.result !== "string") failures.push(`${id}: result missing`);
      if (!Array.isArray(section.runs)) failures.push(`${id}: runs missing`);
    }
    if (id === "lanes-or-queue") {
      if (section.capability !== "queue-lane-engine") failures.push(`${id}: capability wrong`);
      if (section.expectedStory !== "M2-S1") failures.push(`${id}: expectedStory wrong`);
      if (!Array.isArray(section.items) || section.items.length !== 0) {
        failures.push(`${id}: items must be empty`);
      }
    }
    if (id === "providers") {
      if (!isRecord(section.chain)) failures.push(`${id}: chain missing`);
      if (!Array.isArray(section.entries)) failures.push(`${id}: entries missing`);
      if (!Array.isArray(section.parks)) failures.push(`${id}: parks missing`);
    }
    if (id === "parked-work") {
      if (!isRecord(section.source)) failures.push(`${id}: source missing`);
      if (!Array.isArray(section.items)) failures.push(`${id}: items missing`);
    }
  }
  return failures;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const sectionOf = (digest: StatusDigest, id: string): StatusSection =>
  sectionById(digest.sections, id);

describe("TC-STATUS-003 six-section totality and shape", () => {
  test("the fully observed digest has all six sections in fixed order", () => {
    const digest = aggregateStatus(baseFacts());
    expect(shapeFailures(digest)).toEqual([]);
    expect(digest.sections.map((section) => section.id)).toEqual([...STATUS_SECTION_ORDER]);
  });

  test("no provider-native payload key crosses the digest", () => {
    const digest = aggregateStatus(
      baseFacts({
        tracker: workItemRead([]),
        changes: baseFacts().changes,
      }),
    );
    const serialized = JSON.stringify(digest);
    for (const native of [
      "reviewDecision",
      "check_suite",
      "check_runs",
      "issue_links",
      "updated_at",
      "review_threads",
    ]) {
      expect(serialized).not.toContain(native);
    }
  });

  test("removing a section fails the shape validator", () => {
    const digest = clone(aggregateStatus(baseFacts()));
    const mutated = { ...digest, sections: digest.sections.slice(0, 5) };
    expect(shapeFailures(mutated).some((line) => line.includes("sections length"))).toBe(true);
  });

  test("renaming a state fails the shape validator", () => {
    const digest = clone(aggregateStatus(baseFacts()));
    const first = digest.sections[0];
    if (first !== undefined) {
      (first as unknown as Record<string, unknown>).state = "clear";
    }
    expect(shapeFailures(digest).some((line) => line.includes("invalid state clear"))).toBe(true);
  });

  test("dropping truncated fails the shape validator", () => {
    const digest = clone(aggregateStatus(baseFacts()));
    const first = digest.sections[0];
    if (first !== undefined) {
      delete (first as unknown as Record<string, unknown>).truncated;
    }
    expect(shapeFailures(digest).some((line) => line.includes("truncated is not boolean"))).toBe(
      true,
    );
  });
});

describe("TC-STATUS-004 Appendix A derivation matrix", () => {
  for (const matrixCase of matrixCases) {
    test(`matrix: ${matrixCase.name}`, () => {
      const digest = aggregateStatus(matrixCase.facts);
      expect(shapeFailures(digest)).toEqual([]);
      expect(sectionOf(digest, "lanes-or-queue").state).toBe("not-delivered");
      for (const [id, expectation] of Object.entries(matrixCase.expected)) {
        const section = sectionOf(digest, id);
        expect(section.state, `${matrixCase.name}: ${id} state`).toBe(expectation.state);
        if (expectation.reason !== undefined) {
          expect(section.evidence.reasons, `${matrixCase.name}: ${id} reasons`).toContain(
            expectation.reason,
          );
        }
      }
    });
  }

  test("item-level unknown stays inside an observed tracker section", () => {
    const digest = aggregateStatus(
      baseFacts({
        tracker: workItemRead([
          {
            identity: { systemName: "github", entityId: "1" },
            title: "No timestamp",
            status: { nativeStatus: "open", deliveryState: "ready" },
            labels: ["hand-back"],
            relations: [],
          },
        ]),
      }),
    );
    const tracker = sectionOf(digest, "tracker");
    expect(tracker.state).toBe("observed");
    const stalls = tracker.families?.find((family) => family.family === "stalls");
    expect(stalls?.state).toBe("observed");
    expect(stalls?.items).toHaveLength(1);
    expect(stalls?.items[0]?.itemState).toBe("unknown");
    expect(stalls?.counts.unknown).toBe(1);
    expect(tracker.evidence.reasons).toContain("item-signal-absent");
  });

  test("a failed read yields section unknown, not an observed-empty claim", () => {
    const digest = aggregateStatus(baseFacts({ tracker: failedWorkItemRead() }));
    const tracker = sectionOf(digest, "tracker");
    expect(tracker.state).toBe("unknown");
    expect(tracker.counts.total).toBe(0);
    expect(tracker.evidence.reasons).toContain("read-failed");
  });

  test("restoring a failed read reaches observed (non-vacuous control)", () => {
    const restored = aggregateStatus(baseFacts({ tracker: workItemRead([]) }));
    expect(sectionOf(restored, "tracker").state).toBe("observed");
    const failed = aggregateStatus(baseFacts({ ci: failedPipelineRunRead() }));
    expect(sectionOf(failed, "ci").state).toBe("unknown");
    const ciRestored = aggregateStatus(baseFacts({ ci: pipelineRunRead([]) }));
    expect(sectionOf(ciRestored, "ci").state).toBe("observed");
  });
});
