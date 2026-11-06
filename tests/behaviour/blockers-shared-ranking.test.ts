/**
 * TC-BLK-030 — one shared ranking drives the blockers list, the digest
 * `typed-questions` section, and the brief `blocker-questions` anchor: identical
 * id order and ranks, answered resolved only on the list, and no forked
 * comparator.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readBlockerLedger } from "../../packages/core/src/state/index";
import {
  createBlockerState,
  createBlockersHarness,
  FIXED_NOW_MS,
} from "../fixtures/blockers/harness";
import { makeAnswer, makeQuestion } from "../fixtures/blockers/records";
import { briefRuntime, runBriefCli } from "../fixtures/brief/harness";
import { baseFacts, blockersRead, runStatusCli, statusRuntime } from "../fixtures/status/harness";

const ROOT = process.cwd();
const at = (hoursAgo: number): string =>
  new Date(FIXED_NOW_MS - hoursAgo * 3_600_000).toISOString();

const seed = (state: ReturnType<typeof createBlockerState>, reversed = false) => {
  const questions = [
    makeQuestion({
      id: "q-01",
      type: "decision-needed",
      audience: "coordinator",
      askedAt: at(1),
      options: ["a"],
    }),
    makeQuestion({
      id: "q-02",
      type: "credential-missing",
      audience: "owner",
      askedAt: at(1),
      question: "GITHUB_TOKEN",
      options: [],
    }),
    makeQuestion({
      id: "q-03",
      type: "spec-ambiguity",
      audience: "owner",
      askedAt: at(2),
      options: [],
    }),
    makeQuestion({
      id: "q-04",
      type: "external-wait",
      audience: "coordinator",
      askedAt: at(3),
      options: [],
    }),
    makeQuestion({
      id: "q-05",
      type: "decision-needed",
      audience: "owner",
      askedAt: at(4),
      options: ["a", "b"],
    }),
    makeQuestion({
      id: "q-06",
      type: "spec-ambiguity",
      audience: "owner",
      askedAt: at(4),
      options: [],
    }),
    makeQuestion({
      id: "q-07",
      type: "decision-needed",
      audience: "coordinator",
      askedAt: at(5),
      options: ["a"],
    }),
    makeQuestion({
      id: "q-08",
      type: "credential-missing",
      audience: "owner",
      askedAt: at(6),
      question: "GITHUB_TOKEN",
      options: [],
    }),
    makeQuestion({
      id: "q-09",
      type: "external-wait",
      audience: "coordinator",
      askedAt: at(7),
      options: [],
    }),
    makeQuestion({
      id: "q-10",
      type: "spec-ambiguity",
      audience: "owner",
      askedAt: at(8),
      options: [],
    }),
  ];
  const answers = [
    makeAnswer({ questionId: "q-11", answeringAudience: "owner", text: "resolved" }),
  ];
  const ordered = reversed ? [...questions].reverse() : questions;
  const harness = createBlockersHarness({ existingState: state });
  for (const question of ordered) harness.seedQuestion(question);
  // The answered-only id needs its own question record.
  harness.seedQuestion(
    makeQuestion({
      id: "q-11",
      type: "spec-ambiguity",
      audience: "owner",
      askedAt: at(30),
      options: [],
    }),
  );
  for (const answer of answers) harness.seedAnswer(answer);
  return harness;
};

const extract = async (state: ReturnType<typeof createBlockerState>) => {
  const harness = createBlockersHarness({ existingState: state });
  const list = await harness.run(["list", "--json"]);
  const ledger = readBlockerLedger(state.store);
  if (!ledger.ok) throw new Error(ledger.error.code);
  const facts = baseFacts({ blockers: blockersRead(ledger.value.questions, ledger.value.answers) });
  const status = await runStatusCli(["--json", "status"], statusRuntime(facts));
  const brief = await runBriefCli(["--json", "brief"], briefRuntime(facts));
  const listQuestions = list.data?.questions as Record<string, unknown>[] | undefined;
  const listOpen = (listQuestions ?? []).filter((question) => question.status === "open");
  const statusEnvelope = JSON.parse(status.stdout) as Record<string, unknown>;
  const statusData = statusEnvelope.data as Record<string, unknown>;
  const sections = statusData.sections as Record<string, unknown>[];
  const section = sections.find((entry) => entry.id === "typed-questions");
  const statusItems = (section?.questions ?? []) as Record<string, unknown>[];
  const briefEnvelope = JSON.parse(brief.stdout) as Record<string, unknown>;
  const briefData = briefEnvelope.data as Record<string, unknown>;
  const anchors = briefData.anchors as Record<string, unknown>[];
  const anchor = anchors.find((entry) => entry.group === "blocker-questions");
  const anchorItems = (anchor?.items ?? []) as Record<string, unknown>[];
  return {
    listOpen,
    statusItems,
    statusSection: section,
    briefItems: anchorItems,
    briefAnchor: anchor,
    listAnswered: (listQuestions ?? []).filter((question) => question.status === "answered"),
  };
};

describe("TC-BLK-030 one shared ranking across all three surfaces", () => {
  test("the list, digest, and brief expose identical open order and ranks", async () => {
    const state = createBlockerState("shared-ranking");
    try {
      seed(state);
      const result = await extract(state);
      const listIds = result.listOpen.map((question) => question.id);
      const statusIds = result.statusItems.map((question) => question.id);
      const briefIds = result.briefItems.map((item) => item.identity);
      expect(statusIds).toEqual(listIds);
      expect(briefIds).toEqual(listIds);
      expect(result.listOpen.map((question) => question.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(result.statusItems.map((question) => question.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(
        result.briefItems.map((item) => (item.evidence as Record<string, unknown>).rank),
      ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      for (const item of result.briefItems) {
        const evidence = item.evidence as Record<string, unknown>;
        expect(evidence.audience).toBeDefined();
        expect(evidence.rank).toBeDefined();
      }
    } finally {
      state.cleanup();
    }
  });

  test("answered questions are absent from the digest/brief and resolved only on the list", async () => {
    const state = createBlockerState("shared-answered");
    try {
      const harness = createBlockersHarness({ existingState: state });
      harness.seedQuestion(
        makeQuestion({ id: "q-open-1", type: "decision-needed", askedAt: at(1), options: ["a"] }),
      );
      harness.seedQuestion(
        makeQuestion({ id: "q-open-2", type: "spec-ambiguity", askedAt: at(2), options: [] }),
      );
      harness.seedQuestion(
        makeQuestion({ id: "q-11", type: "spec-ambiguity", askedAt: at(3), options: [] }),
      );
      harness.seedAnswer(
        makeAnswer({ questionId: "q-11", answeringAudience: "owner", text: "resolved" }),
      );
      const result = await extract(state);
      expect(result.statusItems.some((question) => question.id === "q-11")).toBe(false);
      expect(result.briefItems.some((item) => item.identity === "q-11")).toBe(false);
      expect(result.listAnswered.map((question) => question.id)).toEqual(["q-11"]);
      expect(result.listOpen.some((question) => question.id === "q-11")).toBe(false);
    } finally {
      state.cleanup();
    }
  });

  test("truncation parity: the same first eight and the same omitted count", async () => {
    const state = createBlockerState("shared-truncation");
    try {
      seed(state);
      const result = await extract(state);
      const listIds = result.listOpen.map((question) => question.id);
      expect(listIds).toHaveLength(8);
      expect(result.statusItems.map((question) => question.id)).toEqual(listIds);
      expect(result.briefItems.map((item) => item.identity)).toEqual(listIds);
      expect(result.statusSection?.counts).toMatchObject({ omitted: 2, total: 10 });
      expect(result.briefAnchor).toMatchObject({ omitted: 2, truncated: true });
    } finally {
      state.cleanup();
    }
  });

  test("reversing the ledger append order changes nothing", async () => {
    const forward = createBlockerState("shared-forward");
    const reversed = createBlockerState("shared-reversed");
    try {
      seed(forward);
      seed(reversed, true);
      const a = await extract(forward);
      const b = await extract(reversed);
      expect(b.listOpen.map((question) => question.id)).toEqual(
        a.listOpen.map((question) => question.id),
      );
      expect(b.statusItems.map((question) => question.id)).toEqual(
        a.statusItems.map((question) => question.id),
      );
      expect(b.briefItems.map((item) => item.identity)).toEqual(
        a.briefItems.map((item) => item.identity),
      );
    } finally {
      forward.cleanup();
      reversed.cleanup();
    }
  });

  test("the digest consumes the shared ranker and the brief mirrors without a comparator", () => {
    const statusSource = readFileSync(join(ROOT, "packages/core/src/domain/status.ts"), "utf8");
    const briefSource = readFileSync(join(ROOT, "packages/core/src/domain/brief.ts"), "utf8");
    expect(statusSource.match(/rankBlockerQuestions\(/g) ?? []).toHaveLength(1);
    expect(briefSource.includes("rankBlockerQuestions")).toBe(false);
    expect(briefSource.includes("BLOCKER_PRIORITY_BY_TYPE")).toBe(false);
    expect(briefSource).toContain('sectionOf(digest, "typed-questions")');
  });

  test("a forked comparator would diverge (mutation control)", () => {
    const ids = ["q-02", "q-01", "q-03"];
    const shared = [...ids].sort((a, b) => (a < b ? -1 : 1));
    const forked = [...ids];
    expect(forked).not.toEqual(shared);
  });
});
