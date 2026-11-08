/**
 * TC-HAND-001 / TC-HAND-002 / TC-HAND-003 / TC-HAND-004 / TC-HAND-006 (phase 6)
 * — a met gate flips one repository and records it; a readable-but-unmet bar
 * refuses at exit 1 with no authority change; reversal restores dual-run and a
 * second reversal is a noop; the derived view equals the folded ledger; and
 * handover is isolated per repository.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendDispatchAttempt,
  readDispatchHandover,
} from "../../packages/core/src/app/dispatch-ledger";
import { readDispatchAuthority } from "../../packages/adapters/src/file/dispatch-authority";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { buildAttempts, eligibleSpecs, missingClassSpecs } from "../fixtures/dispatch/evidence-windows";
import { REPOSITORY, REPOSITORY_BETA } from "../fixtures/dispatch/ledger";

const seed = (
  scenario: ReturnType<typeof createCommandScenario>,
  specs: readonly import("../fixtures/dispatch/evidence-windows").AttemptSpec[],
): void => {
  for (const attempt of buildAttempts(specs)) {
    const appended = appendDispatchAttempt(scenario.state.store, scenario.state.fenceToken, attempt);
    if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
  }
};

const authorityFile = (root: string, workspaceId: string): string =>
  join(root, `documents.${encodeURIComponent(workspaceId)}`, "dispatch-authority.json");

describe("TC-HAND-002 a met gate flips one repository and records it", () => {
  test("alpha flips, the view is authoritative, and beta stays dual-run", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs({ repository: REPOSITORY }));
      seed(
        scenario,
        missingClassSpecs("merged", { prefix: "beta" }).map((spec) => ({
          ...spec,
          repository: REPOSITORY_BETA,
        })),
      );
      const betaBefore = readDispatchAuthority(scenario.state.root, REPOSITORY_BETA);

      const run = await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data).toMatchObject({
        repository: REPOSITORY,
        operation: "authoritative",
        recorded: true,
        noop: false,
      });

      const view = readDispatchAuthority(scenario.state.root, REPOSITORY);
      expect(view.authority).toBe("authoritative");
      expect(view.reversalAvailable).toBe(true);
      expect(view.handoverRef).toContain(REPOSITORY);

      const betaAfter = readDispatchAuthority(scenario.state.root, REPOSITORY_BETA);
      expect(betaAfter).toEqual(betaBefore);
      expect(betaAfter.authority).toBe("dual-run");

      const handover = readDispatchHandover(scenario.state.store);
      expect(handover.ok).toBe(true);
      if (!handover.ok) return;
      expect(handover.records).toHaveLength(1);
      expect(handover.records[0]?.repository).toBe(REPOSITORY);
      expect(handover.records[0]?.conditions).toMatchObject({ verdict: "eligible" });
      expect(handover.records[0]?.principal).toBe("coder@local");
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-HAND-001 a readable-but-unmet bar refuses at exit 1", () => {
  test("every unmet condition is named and no authority record is appended", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, missingClassSpecs("merged"));
      const run = await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      expect(run.exit).toBe(1);
      const data = run.envelope?.data as {
        readonly recorded?: boolean;
        readonly verdict?: string;
        readonly unmetConditions?: readonly { readonly condition: string }[];
      };
      expect(data.recorded).toBe(false);
      expect(data.verdict).toBe("ineligible");
      expect(data.unmetConditions?.map((entry) => entry.condition)).toContain("coverage");
      const handover = readDispatchHandover(scenario.state.store);
      expect(handover.ok && handover.records).toEqual([]);
      expect(readDispatchAuthority(scenario.state.root, REPOSITORY).authority).toBe("dual-run");
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-HAND-003 reversal restores dual-run; a second reversal is a noop", () => {
  test("history is retained and the replay appends nothing", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      const flip = readDispatchAuthority(scenario.state.root, REPOSITORY);
      expect(flip.authority).toBe("authoritative");

      const revert = await scenario.invoke(["dispatch", "handover", REPOSITORY, "--revert", "--json"]);
      expect(revert.exit).toBe(0);
      expect(revert.envelope?.data).toMatchObject({
        operation: "dual-run",
        recorded: true,
        noop: false,
      });
      expect(readDispatchAuthority(scenario.state.root, REPOSITORY).authority).toBe("dual-run");

      const again = await scenario.invoke(["dispatch", "handover", REPOSITORY, "--revert", "--json"]);
      expect(again.exit).toBe(0);
      expect(again.envelope?.data).toMatchObject({ recorded: false, noop: true });

      const handover = readDispatchHandover(scenario.state.store);
      expect(handover.ok).toBe(true);
      if (!handover.ok) return;
      expect(handover.records.map((record) => record.operation)).toEqual([
        "authoritative",
        "dual-run",
      ]);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-HAND-004 the derived view equals the folded ledger", () => {
  test("after a flip and a reversal the view matches the folded truth", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      await scenario.invoke(["dispatch", "handover", REPOSITORY, "--revert", "--json"]);
      const handover = readDispatchHandover(scenario.state.store);
      if (!handover.ok) throw new Error("handover read failed");
      const latest = handover.records[handover.records.length - 1];
      const view = readDispatchAuthority(scenario.state.root, REPOSITORY);
      expect(view.authority).toBe("dual-run");
      expect(view.repository).toBe(latest?.repository);
      expect(view.recordedAt).toBe(latest?.recordedAt);
      expect(view.reversalAvailable).toBe(false);
      // The document is a complete, parseable prior-or-next version.
      expect(
        JSON.parse(readFileSync(authorityFile(scenario.state.root, scenario.state.workspaceId), "utf8")),
      ).toMatchObject({ schema: "delivery.dispatch.authority.v1", authority: "dual-run" });
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-HAND-006 handover is isolated per repository", () => {
  test("flipping alpha never changes beta, and an unmet beta refuses independently", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs({ repository: REPOSITORY }));
      seed(
        scenario,
        missingClassSpecs("merged", { prefix: "beta" }).map((spec) => ({
          ...spec,
          repository: REPOSITORY_BETA,
        })),
      );
      const betaBefore = readDispatchAuthority(scenario.state.root, REPOSITORY_BETA);
      await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      expect(readDispatchAuthority(scenario.state.root, REPOSITORY).authority).toBe("authoritative");
      expect(readDispatchAuthority(scenario.state.root, REPOSITORY_BETA)).toEqual(betaBefore);

      const betaFlip = await scenario.invoke(["dispatch", "handover", REPOSITORY_BETA, "--json"]);
      expect(betaFlip.exit).toBe(1);
      expect(readDispatchAuthority(scenario.state.root, REPOSITORY_BETA).authority).toBe("dual-run");
      expect(readDispatchAuthority(scenario.state.root, REPOSITORY).authority).toBe("authoritative");
    } finally {
      scenario.dispose();
    }
  });
});
