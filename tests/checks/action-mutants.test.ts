/**
 * TC-ACTION-033 — mutant sensitivity over every honesty rule: the 23 declared
 * mutants (a)..(w) each disable one rule, produce the prohibited observable on
 * the unchanged fixture, and the unmutated modules keep the controls (NFR-1..5,
 * DEC-9, DEC-11, RSK-1).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { ACTION_AGING_STATES, ACTION_WIP_LIMIT } from "../../packages/core/src/contracts/index";
import { createRetroActionRegistryPort } from "../../packages/core/src/state/action-registry";
import { actionRecord, closureRecord, conformingDraft } from "../fixtures/action/builders";
import { clockAtDaysOpen, FILING_MS, NOW_MS, TWO_LAPSES } from "../fixtures/action/clock";
import { fileAction } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

const ROOT = process.cwd();

type Replacement = readonly [string, string];

const withMutant = async (
  relative: string,
  id: string,
  replacements: readonly Replacement[],
  body: (module: Record<string, unknown>) => Promise<void> | void,
): Promise<void> => {
  const absolute = join(ROOT, relative);
  let source = readFileSync(absolute, "utf8");
  for (const [from, to] of replacements) {
    if (!source.includes(from)) throw new Error(`${id}: mutant anchor missing: ${from}`);
    source = source.replace(from, to);
  }
  const temp = join(dirname(absolute), `.mutant-${id}.ts`);
  writeFileSync(temp, source);
  try {
    const module = (await import(`${pathToFileURL(temp).href}`)) as Record<string, unknown>;
    await body(module);
  } finally {
    rmSync(temp, { force: true });
  }
};

const fn = (
  module: Record<string, unknown>,
  name: string,
): ((...args: readonly unknown[]) => unknown) => {
  const value = module[name];
  if (typeof value !== "function") throw new Error(`${name} is not a function`);
  return (...args) => value(...args);
};

const FILING = "packages/core/src/domain/action-filing.ts";
const AGING = "packages/core/src/domain/action-aging.ts";
const CLOSURE = "packages/core/src/domain/action-closure.ts";
const RETRO = "packages/core/src/domain/retro.ts";
const CEREMONY = "packages/core/src/domain/ceremony-retro.ts";
const BOARD = "packages/core/src/domain/owner-gate-sla.ts";

/** The delivery-time refusal anchor, assembled without a template literal. */
const MISSING_MEMBER_REFUSAL = [
  "if (!isFilled(value)) return refusal(field, `missing ",
  "$",
  "{field}`);",
].join("");

const context = { actionId: "action-mutant", filedAt: FILING_MS };
const record = actionRecord({}, context);
const openSnapshot = { actions: [record], closures: [] };
const closedSnapshot = {
  actions: [record],
  closures: [closureRecord({ actionId: record.actionId, closureId: "closure-existing" })],
};

describe("TC-ACTION-033 filing mutants (a)..(c)", () => {
  test("(a) accepting a filing missing a member is detected", async () => {
    await withMutant(
      FILING,
      "a",
      [["for (const field of ACTION_CONTRACT_FIELDS) {", "for (const field of []) {"]],
      (module) => {
        const validate = fn(module, "validateActionFiling");
        const { measurableOutcome: _omitted, ...draft } = conformingDraft();
        expect((validate(draft, context) as { readonly ok: boolean }).ok).toBe(true);
        expect((validate(conformingDraft(), context) as { readonly ok: boolean }).ok).toBe(true);
      },
    );
  });

  test("(b) defaulting a missing field instead of refusing is detected", async () => {
    await withMutant(
      FILING,
      "b",
      [[MISSING_MEMBER_REFUSAL, "if (!isFilled(value)) continue;"]],
      (module) => {
        const validate = fn(module, "validateActionFiling");
        const { measurableOutcome: _omitted, ...draft } = conformingDraft();
        expect((validate(draft, context) as { readonly ok: boolean }).ok).toBe(true);
      },
    );
  });

  test("(c) inventing a verb outside the vocabulary is detected", async () => {
    await withMutant(FILING, "c", [["if (!isVerb(verb)) {", "if (false) {"]], (module) => {
      const validate = fn(module, "validateActionFiling");
      const outcome = validate(conformingDraft({ verb: "refactor" }), context) as {
        readonly ok: boolean;
      };
      expect(outcome.ok).toBe(true);
    });
  });
});

describe("TC-ACTION-033 aging mutants (d)..(i), (q)", () => {
  const aging = (module: Record<string, unknown>, days: number, input = record) =>
    fn(module, "evaluateActionAging")(input, clockAtDaysOpen(days)) as {
      readonly state: string;
      readonly ageMs: number;
      readonly openDays: number;
    };

  test("(d) off-by-one nudge threshold is detected", async () => {
    await withMutant(
      AGING,
      "d",
      [["openDays >= ACTION_AGING_NUDGE_DAYS", "openDays >= ACTION_AGING_NUDGE_DAYS + 1"]],
      (module) => {
        expect(aging(module, 14).state).toBe("current");
        expect(aging(module, 15).state).toBe("nudged");
      },
    );
  });

  test("(e) off-by-one escalation threshold is detected", async () => {
    await withMutant(
      AGING,
      "e",
      [["openDays >= ACTION_AGING_ESCALATE_DAYS", "openDays >= ACTION_AGING_ESCALATE_DAYS + 1"]],
      (module) => {
        expect(aging(module, 30).state).toBe("nudged");
        expect(aging(module, 31).state).toBe("escalated");
      },
    );
  });

  test("(f) dropping the second-miss rule is detected", async () => {
    await withMutant(
      AGING,
      "f",
      [["if (secondMissReached(record)) {", "if (false) {"]],
      (module) => {
        const twoLapses = actionRecord({ dueDateLapses: TWO_LAPSES }, context);
        expect(aging(module, 5, twoLapses).state).toBe("current");
      },
    );
  });

  test("(g) storing a fixed aging state is detected", async () => {
    await withMutant(
      AGING,
      "g",
      [
        [
          'return { basis: ACTION_AGING_BASIS, ageMs, openDays, state: "nudged" };',
          'return { basis: ACTION_AGING_BASIS, ageMs, openDays, state: "current" };',
        ],
      ],
      (module) => {
        expect(aging(module, 14).state).toBe("current");
      },
    );
  });

  test("(h) reading the wall clock is detected", async () => {
    await withMutant(
      AGING,
      "h",
      [["const ageMs = nowMs - record.filedAt;", "const ageMs = Date.now() - record.filedAt;"]],
      (module) => {
        expect(aging(module, 10).ageMs).not.toBe(clockAtDaysOpen(10) - FILING_MS);
      },
    );
  });

  test("(i) mixing aging bases is detected", async () => {
    await withMutant(
      AGING,
      "i",
      [
        [
          "const elapsed = nowMs - record.filedAt;",
          "const elapsed = nowMs - Date.parse(record.dueDate);",
        ],
      ],
      (module) => {
        // The fixture's due date is 14 days after filing; at 14 days open a
        // mixed basis reads 0 (current) while the pinned basis reads nudged.
        expect(aging(module, 14).state).toBe("current");
        expect(ACTION_AGING_STATES).toContain("nudged");
      },
    );
  });

  test("(q) a second state vocabulary is detected", async () => {
    await withMutant(
      AGING,
      "q",
      [
        [
          'state: "escalated",\n      escalationReason: "threshold-days",',
          'state: "overdue",\n      escalationReason: "threshold-days",',
        ],
      ],
      (module) => {
        const state = aging(module, 30).state;
        expect(state).toBe("overdue");
        expect(ACTION_AGING_STATES as readonly string[]).not.toContain(state);
      },
    );
  });
});

describe("TC-ACTION-033 closure mutants (j)..(l), (u)..(w)", () => {
  const evaluate = (
    module: Record<string, unknown>,
    request: Record<string, unknown>,
    snapshot = openSnapshot,
    nowMs = NOW_MS,
  ) =>
    fn(module, "evaluateActionClosure")(record, snapshot, request, {
      closureId: "closure-mutant",
      decidedAt: nowMs,
      nowMs,
    }) as { readonly ok: boolean; readonly closure?: Record<string, unknown> };

  test("(j) closing without a decision is detected", async () => {
    await withMutant(
      CLOSURE,
      "j",
      [["if (!isFilled(request.decision)) {", "if (false) {"]],
      (module) => {
        expect(evaluate(module, { decision: "", route: "done", artifact: "artifact:x" }).ok).toBe(
          true,
        );
      },
    );
  });

  test("(k) done closing the outcome plane is detected", async () => {
    await withMutant(
      CLOSURE,
      "k",
      [['const bothPlanes = route !== "done";', "const bothPlanes = true;"]],
      (module) => {
        const result = evaluate(module, {
          decision: "d",
          route: "done",
          artifact: "artifact:x",
        });
        expect(result.closure?.outcomeClosure).toBe("closed");
      },
    );
  });

  test("(l) treating out-of-window evidence as closure is detected", async () => {
    await withMutant(
      CLOSURE,
      "l",
      [['if (planes.windowState !== "open") {', "if (false) {"]],
      (module) => {
        const result = evaluate(
          module,
          { decision: "d", plane: "outcome", evidence: "metric:x" },
          closedSnapshot,
          NOW_MS + 400 * 86_400_000,
        );
        expect(result.ok).toBe(true);
      },
    );
  });

  test("(u) both-plane routes closing only the artifact plane is detected", async () => {
    await withMutant(
      CLOSURE,
      "u",
      [['const bothPlanes = route !== "done";', "const bothPlanes = false;"]],
      (module) => {
        const result = evaluate(module, {
          decision: "d",
          route: "deprioritized",
          reason: "later",
        });
        expect(result.closure?.outcomeClosure).toBe("open");
      },
    );
  });

  test("(v) mooting the window by elapsed time is detected", async () => {
    await withMutant(
      CLOSURE,
      "v",
      [
        [
          'windowState: bothPlanes ? "mooted" : verificationWindowState(record, context.nowMs),',
          "windowState: verificationWindowState(record, context.nowMs),",
        ],
      ],
      (module) => {
        const result = evaluate(
          module,
          { decision: "d", route: "deprioritized", reason: "later" },
          openSnapshot,
          NOW_MS,
        );
        expect(result.closure?.windowState).toBe("elapsed");
      },
    );
  });

  test("(w) accepting a repeat closure is detected", async () => {
    await withMutant(
      CLOSURE,
      "w",
      [['if (targetState === "closed") {', "if (false) {"]],
      (module) => {
        const result = evaluate(
          module,
          { decision: "d2", route: "done", artifact: "artifact:y" },
          closedSnapshot,
        );
        expect(result.ok).toBe(true);
      },
    );
  });
});

describe("TC-ACTION-033 WIP and board mutants (m)..(p), (t)", () => {
  test("(m) warning instead of refusing at the limit is detected", async () => {
    const fixture = makeActionStore("mutant-m");
    try {
      for (let index = 0; index < ACTION_WIP_LIMIT; index += 1) {
        expect(
          fileAction(fixture.store, conformingDraft({ window: "window-a" }), {
            actionId: `action-${String(index)}`,
            filedAt: FILING_MS,
          }).ok,
        ).toBe(true);
      }
      await withMutant(
        FILING,
        "m",
        [["if (windowAtLimit(entries, record.window)) {", "if (false) {"]],
        (module) => {
          const file = fn(module, "fileRetroAction");
          const port = createRetroActionRegistryPort(fixture.store);
          const outcome = file(port, {
            draft: conformingDraft({ window: "window-a" }),
            actionId: "action-excess",
            filedAt: FILING_MS,
            fenceToken: "fence-m",
          }) as { readonly ok: boolean };
          expect(outcome.ok).toBe(true);
        },
      );
    } finally {
      fixture.cleanup();
    }
  });

  test("(n) recording the excess row after refusing is detected", async () => {
    const fixture = makeActionStore("mutant-n");
    try {
      for (let index = 0; index < ACTION_WIP_LIMIT; index += 1) {
        expect(
          fileAction(fixture.store, conformingDraft({ window: "window-a" }), {
            actionId: `action-${String(index)}`,
            filedAt: FILING_MS,
          }).ok,
        ).toBe(true);
      }
      await withMutant(
        FILING,
        "n",
        [
          [
            "const disclosure = windowDisclosure(entries, record.window);",
            "const disclosure = windowDisclosure(entries, record.window);\n    port.appendAction(record, input.fenceToken);",
          ],
        ],
        (module) => {
          const file = fn(module, "fileRetroAction");
          const port = createRetroActionRegistryPort(fixture.store);
          const outcome = file(port, {
            draft: conformingDraft({ window: "window-a" }),
            actionId: "action-excess",
            filedAt: FILING_MS,
            fenceToken: "fence-n",
          }) as { readonly ok: boolean };
          expect(outcome.ok).toBe(false);
          const read = fixture.store.readRecords();
          expect(read.ok).toBe(true);
          if (read.ok) {
            expect(
              read.value.records.filter((entry) => entry.key === "retro.actions:action-excess"),
            ).toHaveLength(1);
          }
        },
      );
    } finally {
      fixture.cleanup();
    }
  });

  test("(o) inferring a board owner is detected", async () => {
    await withMutant(
      BOARD,
      "o",
      [
        [
          "actions.push({ ...fact, repository: repository.key });",
          'actions.push({ ...fact, repository: repository.key, owner: fact.owner.length === 0 ? "owner" : fact.owner });',
        ],
      ],
      (module) => {
        const projection = fn(
          module,
          "projectBoard",
        )(
          boardInput([
            {
              actionId: "action-1",
              owner: "",
              level: "change",
              age: 0,
              agingState: "current",
              window: "window-a",
              windowOpenCount: 0,
              windowLimit: 3,
            },
          ]),
        ) as { readonly data: { readonly actions: readonly { readonly owner: string }[] } };
        expect(projection.data.actions[0]?.owner).toBe("owner");
      },
    );
  });

  test("(p) dropping rows without counting is detected", async () => {
    await withMutant(
      BOARD,
      "p",
      [
        [
          "omittedBySection.actions += Math.max(0, actionFacts.length - BOARD_MAX_ACTIONS);",
          "omittedBySection.actions += 0;",
        ],
      ],
      (module) => {
        const actions = Array.from({ length: 10 }, (_, index) => ({
          actionId: `action-${String(index)}`,
          owner: "agent-role:reviewer",
          level: "change",
          age: 0,
          agingState: "current",
          window: "window-a",
          windowOpenCount: 10,
          windowLimit: 3,
        }));
        const projection = fn(module, "projectBoard")(boardInput(actions)) as {
          readonly data: {
            readonly actions: readonly unknown[];
            readonly omittedBySection: { readonly actions: number };
          };
        };
        expect(projection.data.actions).toHaveLength(8);
        expect(projection.data.omittedBySection.actions).toBe(0);
      },
    );
  });

  test("(t) ordering board rows by append order is detected", async () => {
    await withMutant(
      BOARD,
      "t",
      [
        [
          "const actionFacts = [...(repository.actions ?? [])].sort(\n      compareTextBy((fact) => fact.actionId),\n    );",
          "const actionFacts = [...(repository.actions ?? [])];",
        ],
      ],
      (module) => {
        const projection = fn(
          module,
          "projectBoard",
        )(
          boardInput([
            {
              actionId: "action-b",
              owner: "h:x",
              level: "change",
              age: 0,
              agingState: "current",
              window: "w",
              windowOpenCount: 0,
              windowLimit: 3,
            },
            {
              actionId: "action-a",
              owner: "h:x",
              level: "change",
              age: 0,
              agingState: "current",
              window: "w",
              windowOpenCount: 0,
              windowLimit: 3,
            },
          ]),
        ) as { readonly data: { readonly actions: readonly { readonly actionId: string }[] } };
        expect(projection.data.actions.map((row) => row.actionId)).toEqual([
          "action-b",
          "action-a",
        ]);
      },
    );
  });
});

describe("TC-ACTION-033 producer mutants (r), (s)", () => {
  test("(r) assigning a verdict from an owner claim is detected", async () => {
    await withMutant(
      CEREMONY,
      "r",
      [
        [
          "const verdict = verifyArtifact(action.verificationArtifact);",
          "const verdict = (action as { readonly ownerClaim?: string }).ownerClaim ?? verifyArtifact(action.verificationArtifact);",
        ],
      ],
      (module) => {
        const facts = fn(module, "retroActionCeremonyFacts")(
          [
            {
              actionId: "action-claimed",
              verificationArtifact: "artifact:failed",
              ownerClaim: "applied",
            },
          ],
          () => "violated-with-consequence",
        ) as {
          readonly retroRegistry: {
            readonly openActions: readonly { readonly verdict?: string }[];
          };
        };
        expect(facts.retroRegistry.openActions[0]?.verdict).toBe("applied");
      },
    );
  });

  test("(s) inventing a follow-through entry with no record is detected", async () => {
    await withMutant(
      RETRO,
      "s",
      [
        [
          "if (readFollowThrough === undefined) return [];",
          'if (readFollowThrough === undefined) return [{ action: "invented", verdict: "verified" }];',
        ],
      ],
      (module) => {
        const report = fn(
          module,
          "reportRetro",
        )({
          sidecar: {
            read: () => ({ ok: true, value: { records: [], malformed: [], chain: emptyChain() } }),
          },
          registry: {
            read: () => ({
              ok: true,
              value: { verdict: "verified-empty", artifacts: [], malformed: [], evidence: {} },
            }),
            runs: () => [],
          },
          level: "change",
        }) as {
          readonly ok: boolean;
          readonly data?: { readonly followThrough: readonly { readonly action: string }[] };
        };
        expect(report.ok).toBe(true);
        expect(report.data?.followThrough.map((entry) => entry.action)).toContain("invented");
      },
    );
  });
});

const emptyChain = () => ({
  verified: true,
  records: 0,
  breaks: [],
  anchor: "retro.chain.anchor.v1",
  affectedDomain: "retro",
  storePath: "fixture://sidecar",
});

const boardInput = (actions: readonly Record<string, unknown>[]) => ({
  audience: "owner",
  scope: "repository",
  selection: "current",
  repositories: [
    {
      key: "example-repository",
      gates: [],
      lanes: [],
      asks: [],
      parks: [],
      decisions: [],
      actions,
      actionsSource: "available",
    },
  ],
  omittedRepositories: 0,
  ownerHold: { active: false },
  policy: {
    comparator: ">=",
    escalationThresholdMs: 86_400_000,
    expiryThresholdMs: 259_200_000,
    rows: [],
  },
  nowMs: NOW_MS,
  nowIso: "2026-11-16T12:00:00Z",
});

describe("TC-ACTION-033 non-vacuity", () => {
  test("the unmutated modules keep the controls", async () => {
    const { validateActionFiling } = await import("../../packages/core/src/domain/action-filing");
    const { evaluateActionAging } = await import("../../packages/core/src/domain/action-aging");
    expect(validateActionFiling(conformingDraft(), context).ok).toBe(true);
    expect(evaluateActionAging(record, clockAtDaysOpen(14)).state).toBe("nudged");
    expect(evaluateActionAging(record, clockAtDaysOpen(30)).state).toBe("escalated");
  });
});
