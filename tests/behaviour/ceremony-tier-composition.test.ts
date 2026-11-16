/**
 * TC-CEREMONY-067 — the tier engine is composed into the shipped family: the
 * runtime evaluates the tier verdict from the delivered plan `tier` and
 * pm-notes `variant`, `ceremony list` populates `data.tier` with per-ceremony
 * obligations, `ceremony run` records the consumed tier facts on the run
 * record, escalations are evidence-gated against the recorded lifecycle truth,
 * and an explicit run of a non-obligated ceremony still executes
 * (AC-F7-1..F7-5, DM-7).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCeremonyCommandRuntime } from "../../packages/cli/src/edge";
import {
  type CeremonyTierInput,
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT,
} from "../../packages/core/src/contracts/index";
import { appendPhaseTransition, readCeremonyRuns } from "../../packages/core/src/state/index";
import { makeCeremonyState, NOW_MS } from "../fixtures/ceremony/state";

const WORKSPACE = "workspace-tier";
const CHANGE_REF = "GH-999";

type Composed = ReturnType<typeof createCeremonyCommandRuntime>;

const makeRuntime = (options: {
  readonly tierContext?: CeremonyTierInput;
  readonly seedTransitions?: boolean;
}): {
  readonly runtime: Composed;
  readonly store: ReturnType<typeof makeCeremonyState>["store"];
  readonly changesDirectory: string;
  readonly dispose: () => void;
} => {
  const state = makeCeremonyState("tier");
  const root = mkdtempSync(join(tmpdir(), "ceremony-tier-"));
  const changesDirectory = join(root, "doc", "changes");
  const monthDirectory = join(changesDirectory, "2026-11");
  const changeFolder = join(monthDirectory, `2026-11-15--${CHANGE_REF}--ctx`);
  mkdirSync(changeFolder, { recursive: true });
  if (options.seedTransitions === true) {
    const appended = appendPhaseTransition(state.store, {
      changeRef: CHANGE_REF,
      phaseId: "review_fix",
      operation: "reopen",
      timestamp: "2026-11-16T08:00:00.000Z",
      fenceToken: "fence-tier-transitions",
      reason: "review verdict of rework",
    });
    if (!appended.ok) throw new Error("transition seed failed");
  }
  const runtime = createCeremonyCommandRuntime({
    store: state.store,
    stateDirectory: state.root,
    changesDirectory,
    workspaceId: WORKSPACE,
    clock: { nowMs: () => NOW_MS },
    newRunId: () => "run-tier-0001",
    newFenceToken: () => "fence-tier",
    gitRoot: root,
    configurationDirectoryName: ".delivery",
    repositoryId: "github.com/example/repo",
    ...(options.tierContext === undefined ? {} : { tierContext: options.tierContext }),
  });
  return {
    runtime,
    store: state.store,
    changesDirectory,
    dispose: () => {
      state.dispose();
      rmSync(root, { recursive: true, force: true });
    },
  };
};

const liteContext = (
  evidence?: Record<string, boolean>,
  triggers?: readonly string[],
): CeremonyTierInput => ({
  plan: {
    tier: {
      name: "lite",
      ...(triggers === undefined ? {} : { escalationTriggers: [...triggers] }),
    },
  },
  variant: "lite",
  ...(evidence === undefined ? {} : { evidence: evidence as CeremonyTierInput["evidence"] }),
});

const obligationOf = (data: unknown, id: string): boolean | undefined =>
  ((data as { ceremonies?: { id: string; obligated?: boolean }[] }).ceremonies ?? []).find(
    (entry) => entry.id === id,
  )?.obligated;

describe("TC-CEREMONY-067 the composed list carries the tier verdict and obligations", () => {
  test("a lite verdict names the delivered phase set and obligates only lite ceremonies", async () => {
    const composed = makeRuntime({ tierContext: liteContext() });
    try {
      const list = await composed.runtime.list();
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      const data = list.data as { ceremonies: unknown[]; tier: Record<string, unknown> };
      expect(data.tier.effectiveTier).toBe("lite");
      expect(data.tier.phaseSet).toEqual([...PM_NOTES_REQUIRED_PHASES_BY_VARIANT.lite]);
      expect(data.tier.phaseSetSource).toBe("PM_NOTES_REQUIRED_PHASES_BY_VARIANT.lite");
      expect(data.tier.declaredTier).toBe("lite");
      expect(data.tier.declaredVariant).toBe("lite");
      expect(obligationOf(data, "morning-brief")).toBe(true);
      expect(obligationOf(data, "retro-evidence-pass")).toBe(true);
      expect(obligationOf(data, "night-watch")).toBe(true);
      expect(obligationOf(data, "sprint-rollover")).toBe(false);
      expect(obligationOf(data, "testing-session-assessment")).toBe(false);
      expect(obligationOf(data, "decision-record-mirror-sync")).toBe(false);
    } finally {
      composed.dispose();
    }
  });

  test("a full verdict obligates every built-in", async () => {
    const composed = makeRuntime({
      tierContext: { plan: { tier: { name: "full" } }, variant: "full" },
    });
    try {
      const list = await composed.runtime.list();
      if (!list.ok) throw new Error("list failed");
      const data = list.data as { ceremonies: { obligated: boolean }[] };
      expect(data.ceremonies.every((entry) => entry.obligated === true)).toBe(true);
    } finally {
      composed.dispose();
    }
  });

  test("no resolvable delivery context leaves the list without a tier verdict", async () => {
    const composed = makeRuntime({});
    try {
      const list = await composed.runtime.list();
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      const data = list.data as { ceremonies: { obligated?: boolean }[]; tier?: unknown };
      expect(data.tier).toBeUndefined();
      expect(data.ceremonies.every((entry) => entry.obligated === undefined)).toBe(true);
    } finally {
      composed.dispose();
    }
  });
});

describe("TC-CEREMONY-067 the run record carries the consumed tier facts", () => {
  test("a lite run records effectiveTier lite, phaseSetSize six, and no escalations", async () => {
    const composed = makeRuntime({ tierContext: liteContext() });
    try {
      const run = await composed.runtime.run({ name: "morning-brief", apply: false });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const runs = readCeremonyRuns(composed.store);
      expect(runs.ok).toBe(true);
      if (!runs.ok) return;
      const record = runs.value.records.at(-1);
      expect(record?.tier).toEqual({
        effectiveTier: "lite",
        phaseSetSize: PM_NOTES_REQUIRED_PHASES_BY_VARIANT.lite.length,
        escalations: [],
      });
    } finally {
      composed.dispose();
    }
  });

  test("declared review-rework with recorded evidence escalates the run to full", async () => {
    const composed = makeRuntime({
      tierContext: liteContext({ "review-rework": true }, ["review-rework"]),
    });
    try {
      const run = await composed.runtime.run({ name: "morning-brief", apply: false });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const data = run.data as {
        tier: {
          effectiveTier: string;
          phaseSet: readonly string[];
          escalations: { trigger: string; evidence: string }[];
          escalationTriggers: { trigger: string; state: string }[];
        };
      };
      expect(data.tier.effectiveTier).toBe("full");
      expect(data.tier.phaseSet).toEqual([...PM_NOTES_REQUIRED_PHASES_BY_VARIANT.full]);
      expect(data.tier.escalations).toHaveLength(1);
      expect(data.tier.escalations[0]?.trigger).toBe("review-rework");
      expect(data.tier.escalations[0]?.evidence).toBe("recorded:review-rework");
      expect(data.tier.escalationTriggers[0]?.state).toBe("matched");
      const runs = readCeremonyRuns(composed.store);
      if (!runs.ok) throw new Error("runs unreadable");
      expect(runs.value.records.at(-1)?.tier.effectiveTier).toBe("full");
    } finally {
      composed.dispose();
    }
  });
});

describe("TC-CEREMONY-067 an explicit run of a non-obligated ceremony still executes", () => {
  test("a full-only ceremony runs under a lite verdict and records the lite facts", async () => {
    const composed = makeRuntime({ tierContext: liteContext() });
    try {
      const run = await composed.runtime.run({
        name: "sprint-rollover",
        window: { start: "2026-11-01T00:00:00.000Z", end: "2026-11-15T23:59:59.999Z" },
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const data = run.data as { verdict: string; tier: { effectiveTier: string } };
      expect(data.verdict).toBe("verified");
      expect(data.tier.effectiveTier).toBe("lite");
    } finally {
      composed.dispose();
    }
  });
});

describe("TC-CEREMONY-067 the runtime resolves the checkout delivery context", () => {
  test("recorded transitions select the change; committed documents supply the mapping", async () => {
    const composed = makeRuntime({ seedTransitions: true });
    const changesDirectory = composed.changesDirectory;
    writeFileSync(
      join(
        changesDirectory,
        "2026-11",
        `2026-11-15--${CHANGE_REF}--ctx`,
        `chg-${CHANGE_REF}-pm-notes.yaml`,
      ),
      "change_id: GH-999\nvariant: lite\nblockers:\n  - text: an open owner question\n",
      "utf8",
    );
    writeFileSync(
      join(
        changesDirectory,
        "2026-11",
        `2026-11-15--${CHANGE_REF}--ctx`,
        `chg-${CHANGE_REF}-plan.yaml`,
      ),
      "schemaVersion: delivery.plan.v1\ntier:\n  name: lite\n  escalationTriggers:\n    - review-rework\n",
      "utf8",
    );
    try {
      const list = await composed.runtime.list();
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      const data = list.data as { tier: Record<string, unknown> };
      // The recorded variant supplies the phase set; the recorded reopen of
      // review_fix is the review-rework evidence, so the verdict escalates.
      expect(data.tier.declaredVariant).toBe("lite");
      expect(data.tier.declaredTier).toBe("lite");
      expect(data.tier.effectiveTier).toBe("full");
      expect(data.tier.escalations).toHaveLength(1);
      expect(data.tier.escalations[0]).toMatchObject({
        trigger: "review-rework",
        evidence: "recorded:review-rework",
      });
    } finally {
      composed.dispose();
    }
  });

  test("the recorded variant governs a plan tier disagreement as a finding", async () => {
    const composed = makeRuntime({ seedTransitions: true });
    const changesDirectory = composed.changesDirectory;
    writeFileSync(
      join(
        changesDirectory,
        "2026-11",
        `2026-11-15--${CHANGE_REF}--ctx`,
        `chg-${CHANGE_REF}-pm-notes.yaml`,
      ),
      "change_id: GH-999\nvariant: full\n",
      "utf8",
    );
    writeFileSync(
      join(
        changesDirectory,
        "2026-11",
        `2026-11-15--${CHANGE_REF}--ctx`,
        `chg-${CHANGE_REF}-plan.yaml`,
      ),
      "schemaVersion: delivery.plan.v1\ntier:\n  name: lite\n",
      "utf8",
    );
    try {
      const list = await composed.runtime.list();
      if (!list.ok) throw new Error("list failed");
      const data = list.data as {
        tier: {
          effectiveTier: string;
          findings: { kind: string; subject: string }[];
        };
      };
      expect(data.tier.effectiveTier).toBe("full");
      expect(data.tier.findings).toHaveLength(1);
      expect(data.tier.findings[0]?.kind).toBe("tier-mismatch");
      expect(data.tier.findings[0]?.subject).toContain("lite");
      expect(data.tier.findings[0]?.subject).toContain("full");
    } finally {
      composed.dispose();
    }
  });
});

describe("TC-CEREMONY-067 catch-up intake obeys the effective tier", () => {
  test("a non-obligated ceremony is absent from the automated catch-up report", async () => {
    const composed = makeRuntime({ tierContext: liteContext() });
    try {
      const report = await composed.runtime.catchUp({});
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      const data = report.data as { ceremonies: { ceremony: string }[] };
      const ids = data.ceremonies.map((entry) => entry.ceremony);
      expect(ids).not.toContain("sprint-rollover");
      expect(ids).not.toContain("testing-session-assessment");
      expect(ids).not.toContain("decision-record-mirror-sync");
      expect(ids).toContain("morning-brief");
    } finally {
      composed.dispose();
    }
  });

  test("a full verdict keeps every built-in in the automated report", async () => {
    const composed = makeRuntime({
      tierContext: { plan: { tier: { name: "full" } }, variant: "full" },
    });
    try {
      const report = await composed.runtime.catchUp({});
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      const data = report.data as { ceremonies: { ceremony: string }[] };
      const ids = data.ceremonies.map((entry) => entry.ceremony);
      expect(ids).toContain("sprint-rollover");
      expect(ids).toContain("morning-brief");
    } finally {
      composed.dispose();
    }
  });
});
