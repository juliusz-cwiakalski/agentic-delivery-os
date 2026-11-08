/**
 * TC-PILOT-002 — the full J1 sequence returns the expected next action.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readCloseoutHistory, readMergeTransactions } from "../../../packages/core/src/state/index";
import {
  createPilot,
  PILOT_REF,
  type Pilot,
  type PilotSequence,
} from "../../fixtures/pilot/harness";
import { PILOT_BASE, PILOT_BRANCH } from "../../fixtures/pilot/repo";

let pilot: Pilot | undefined;
let sequence: PilotSequence | undefined;

const fixture = (): Pilot => {
  if (pilot === undefined) throw new Error("pilot fixture was not created");
  return pilot;
};

const sequenceOf = (): PilotSequence => {
  if (sequence === undefined) throw new Error("pilot sequence was not run");
  return sequence;
};

beforeAll(async () => {
  pilot = await createPilot();
  sequence = await pilot.runSequence();
});

afterAll(() => {
  pilot?.cleanup();
});

const dataOf = (envelope: Record<string, unknown> | undefined): Record<string, unknown> => {
  const data = envelope?.data;
  return typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
};

describe("TC-PILOT-002 J1 sequence", () => {
  test("status returns the digest with the open typed question", () => {
    const run = sequenceOf().status;
    expect(run.exitCode).toBe(0);
    const data = dataOf(run.envelope);
    expect(Array.isArray(data.sections)).toBe(true);
    const sections = data.sections as readonly { readonly id?: string }[];
    expect(sections.map((section) => section.id)).toContain("typed-questions");
    expect(run.stdout).toContain("Q-0001");
  });

  test("blockers answer records the coordinator answer", () => {
    const run = sequenceOf().answer;
    expect(run.exitCode).toBe(0);
    const data = dataOf(run.envelope);
    expect(data.answered).toBe("Q-0001");
    expect(data.choice).toBe("lite");
  });

  test("verify change and phase list report the finalized lifecycle", () => {
    const verify = sequenceOf().verify;
    expect(verify.exitCode).toBe(0);
    expect(dataOf(verify.envelope).result).toBe("finished");

    const phaseList = sequenceOf().phaseList;
    expect(phaseList.exitCode).toBe(0);
    const phases = dataOf(phaseList.envelope).phases as
      | Record<string, { readonly completed?: string | null }>
      | undefined;
    expect(typeof phases?.delivery?.completed).toBe("string");
  });

  test("merge lands one real squash commit on the base and deletes the branch", () => {
    const run = sequenceOf().merge;
    expect(run.exitCode).toBe(0);
    const data = dataOf(run.envelope);
    expect(data.result).toBe("merged");
    const squashSha = data.squashSha;
    expect(typeof squashSha).toBe("string");
    if (typeof squashSha === "string") {
      const contained = fixture().repo.run(["merge-base", "--is-ancestor", squashSha, PILOT_BASE]);
      expect(contained.status).toBe(0);
    }
    expect(fixture().repo.branchHead(PILOT_BRANCH)).toBeUndefined();
    const transactions = readMergeTransactions(fixture().store, PILOT_REF);
    expect(transactions.ok).toBe(true);
    if (transactions.ok) {
      expect(transactions.records.at(-1)?.result).toBe("merged");
    }
  });

  test("closeout applies the mechanical sweep through the real state ledger", () => {
    // GH-240: an applied run that leaves judgment residue returns the additive
    // data-bearing `attention` outcome (exit 1). The pilot fixture does not
    // configure a retro registry, so the retro-coverage step reports a gap and
    // that gap is disclosed as residue; the sweep itself still applies.
    const run = sequenceOf().closeout;
    expect(run.exitCode).toBe(1);
    const data = dataOf(run.envelope);
    expect(data.mode).toBe("applied");
    const residue = data.residue as readonly { readonly kind?: string }[] | undefined;
    expect(residue?.some((item) => item.kind === "retro-coverage-unavailable")).toBe(true);
    const history = readCloseoutHistory(fixture().store, PILOT_REF);
    expect(history.ok).toBe(true);
    if (history.ok) expect(history.value.length).toBeGreaterThan(0);
  });

  test("queue plan selects the expected next ref with a reason", () => {
    const run = sequenceOf().queuePlan;
    expect(run.exitCode).toBe(0);
    const actions = sequenceOf().nextActions;
    expect(actions[0]?.ref).toBe("GH-320");
    expect(actions[0]?.reason.length).toBeGreaterThan(0);
  });

  test("no gh/glab process is spawned; only the local git binary runs", () => {
    const files = new Set(fixture().spawns.map((spawn) => spawn.file));
    expect([...files]).toEqual(["git"]);
  });
});
