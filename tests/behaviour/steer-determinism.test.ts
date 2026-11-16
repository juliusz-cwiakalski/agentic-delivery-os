/**
 * TC-STEER-081 — two runs over unchanged facts are byte-identical on all four
 * forms, permutations are invisible, and identities stay unique.
 */
import { describe, expect, test } from "bun:test";
import { asksWith, ownerAsk } from "../fixtures/steer/ask-matrix";
import { lifecycleMatrix } from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";
import { NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

type Form = "send" | "list" | "read" | "complete";

const makeHarness = (reverse = false): ReturnType<typeof createSteerHarness> => {
  const harness = createSteerHarness({
    phase: NO_PHASE_RECORD,
    asks: asksWith({ facts: [ownerAsk({ id: "q-1" })] }),
  });
  const matrix = lifecycleMatrix();
  const messages = reverse ? [...matrix.messages].reverse() : matrix.messages;
  const outcomes = reverse ? [...matrix.outcomes].reverse() : matrix.outcomes;
  for (const message of messages) harness.seedMessage(message);
  for (const outcome of outcomes) harness.seedOutcome(outcome);
  for (const completion of matrix.completions) harness.seedCompletion(completion);
  return harness;
};

const argvFor = (form: Form): readonly string[] => {
  switch (form) {
    case "send":
      return ["send", "deterministic note"];
    case "list":
      return ["list"];
    case "read":
      return ["read"];
    case "complete":
      return ["complete", "msg-landed", "--ref", "doc/proof.md"];
  }
};

const runForm = async (
  form: Form,
  reverse = false,
): Promise<{ readonly human: string; readonly data: string; readonly store: string }> => {
  const harness = makeHarness(reverse);
  try {
    const human = await harness.run(argvFor(form), { json: false });
    const machine = await harness.run(argvFor(form));
    return {
      human: human.stdout,
      data: JSON.stringify(machine.data ?? machine.envelope?.error),
      store: harness.ledgerText(),
    };
  } finally {
    harness.cleanup();
  }
};

describe("TC-STEER-081 byte-identical repeats and permutation independence", () => {
  for (const form of ["send", "list", "read", "complete"] as const) {
    test(`${form} is byte-identical across two runs and a reversed store`, async () => {
      const first = await runForm(form);
      const second = await runForm(form);
      expect(first.human).toBe(second.human);
      expect(first.data).toBe(second.data);
      const reversed = await runForm(form, true);
      expect(reversed.human).toBe(first.human);
      expect(reversed.data).toBe(first.data);
      // The store ends byte-identical between the two identical runs (the
      // reversed fixture seeds in a different order by construction).
      expect(second.store).toBe(first.store);
    });
  }

  test("identities are unique across every array and group", async () => {
    const harness = makeHarness();
    try {
      const list = await harness.run(["list"]);
      const read = await harness.run(["read"]);
      const groups = ["queued", "landed", "expired"] as const;
      const allGroups = groups.flatMap((group) =>
        Array.isArray(list.data?.[group])
          ? (list.data?.[group] as readonly Record<string, unknown>[])
          : [],
      );
      const groupIds = allGroups.map((row) => String(row.id));
      expect(new Set(groupIds).size).toBe(groupIds.length);
      const notes = read.data?.notes;
      const asks = read.data?.asks;
      if (!Array.isArray(notes) || !Array.isArray(asks)) {
        throw new Error("the read answer carries no notes or asks");
      }
      const noteIds = (notes as readonly Record<string, unknown>[]).map((note) => String(note.id));
      expect(new Set(noteIds).size).toBe(noteIds.length);
      const askIds = (asks as readonly Record<string, unknown>[]).map((ask) => String(ask.id));
      expect(new Set(askIds).size).toBe(askIds.length);
    } finally {
      harness.cleanup();
    }
  });
});
