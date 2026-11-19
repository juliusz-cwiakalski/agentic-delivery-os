/**
 * AC-F4-2 / B1 — the production closeout composition matches the provider's
 * verbatim (prefixed) milestone title.
 *
 * The shipped `createProductionComposer` reads the change's pm-notes declaration
 * and the work item's provider-asserted milestone over one synthetic transport;
 * the resulting `planFacts` flow through `buildCloseoutPlan` and the
 * `milestone-sync` step. Only external I/O is injected, so every branch under
 * test is a production branch.
 */
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { CloseoutData } from "../../packages/core/src/contracts/index";
import {
  CLOSEOUT_PROD_MILESTONE_TITLE,
  CLOSEOUT_PROD_REF,
  createCloseoutProductionHarness,
} from "../fixtures/closeout/production-composition";

setDefaultTimeout(120_000);

const closeoutDataOf = (run: { readonly envelope?: Record<string, unknown> }): CloseoutData => {
  const data = run.envelope?.data;
  if (typeof data !== "object" || data === null) throw new Error("missing closeout data");
  return data as CloseoutData;
};

const milestoneStepOf = (data: CloseoutData) => {
  const step = data.steps.find((entry) => entry.stepId === "milestone-sync");
  if (step === undefined) throw new Error("the plan has no milestone-sync step");
  return step;
};

const milestoneResidueOf = (data: CloseoutData) =>
  (data.residue ?? []).filter((item) => item.kind === "milestone-sync-withheld");

describe("AC-F4-2 the production planFacts matches the provider-native milestone title", () => {
  test("a satisfying attached set reaches would-apply, never attachment-mismatch", async () => {
    const harness = createCloseoutProductionHarness({
      label: "gh349-milestone-satisfying",
      attached: [
        { number: 349, state: "closed" },
        { number: 352, state: "closed" },
      ],
    });
    try {
      const run = await harness.run(["--json", "closeout", CLOSEOUT_PROD_REF]);
      expect(run.exitCode).toBe(0);
      const data = closeoutDataOf(run);
      const step = milestoneStepOf(data);
      expect(step.outcome).toBe("would-apply");
      expect(step.reason).toBeUndefined();
      expect(step.evidence).toEqual(
        expect.arrayContaining([{ name: "attachment", value: "matched" }]),
      );
      expect(milestoneResidueOf(data)).toHaveLength(0);
      // The declaration and the verbatim prefixed title agree, so the read is
      // the one bounded page and no mismatch was ever produced.
      expect(
        harness.transportCalls.filter((url) => url.includes("/issues?milestone=")),
      ).toHaveLength(1);
    } finally {
      harness.dispose();
    }
  });

  test("an open attached ticket withholds closure while the attachment is verified", async () => {
    const harness = createCloseoutProductionHarness({
      label: "gh349-milestone-withheld",
      attached: [
        { number: 349, state: "closed" },
        { number: 352, state: "open" },
      ],
    });
    try {
      const run = await harness.run(["--json", "closeout", CLOSEOUT_PROD_REF]);
      expect(run.exitCode).toBe(0);
      const data = closeoutDataOf(run);
      const step = milestoneStepOf(data);
      expect(step.outcome).toBe("skipped-noop");
      expect(step.reason).toBe("closure-withheld");
      expect(step.evidence).toEqual(
        expect.arrayContaining([{ name: "attachment", value: "observed" }]),
      );
      const residue = milestoneResidueOf(data);
      expect(residue).toHaveLength(1);
      expect(residue[0]?.item).toBe("closure-withheld");
      expect(milestoneStepOf(data).reason).not.toBe("attachment-mismatch");
      expect(
        harness.transportCalls.filter((url) => url.includes("/issues?milestone=")),
      ).toHaveLength(1);
    } finally {
      harness.dispose();
    }
  });

  test("a different provider-asserted title is still a mismatch, never a similarity match", async () => {
    const harness = createCloseoutProductionHarness({
      label: "gh349-milestone-mismatch",
      attached: [{ number: 349, state: "closed" }],
      milestoneTitle: "M5: A different commitment",
    });
    try {
      const run = await harness.run(["--json", "closeout", CLOSEOUT_PROD_REF]);
      expect(run.exitCode).toBe(0);
      const data = closeoutDataOf(run);
      expect(milestoneStepOf(data).reason).toBe("attachment-mismatch");
      expect(milestoneResidueOf(data)[0]?.item).toBe("attachment-mismatch");
    } finally {
      harness.dispose();
    }
  });
});

describe("AC-F4-2 the production declaration source is the change's pm-notes", () => {
  test("the fixture's prefixed title is the provider shape under test", () => {
    expect(CLOSEOUT_PROD_MILESTONE_TITLE).toBe("M4: Jaiship-native delivery");
  });
});
