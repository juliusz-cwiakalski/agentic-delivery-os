/**
 * GH-289 TC-ATTEMPT-001, 002, 003, 004, 039 — the `dispatch attempts` grammar
 * and reference resolution at the command boundary.
 *
 * Every refusal asserts zero store reads, nothing appended, and the delivered
 * identity (`input.value.rejected` at exit 1), because the grammar runs before
 * any runtime call.
 */
import { describe, expect, test } from "bun:test";
import type { DispatchAttemptsData } from "../../packages/core/src/contracts/index";
import { ATTEMPTS_REF, ledgerOf, maximalAttempt } from "../fixtures/dispatch/attempt-records";
import { type AttemptsHarness, createAttemptsHarness } from "../fixtures/dispatch/attempts-harness";
import { REPOSITORY } from "../fixtures/dispatch/ledger";

const dataOf = (value: unknown): DispatchAttemptsData => value as DispatchAttemptsData;

const withHarness = async (
  options: Parameters<typeof createAttemptsHarness>[0],
  body: (harness: AttemptsHarness) => Promise<void> | void,
): Promise<void> => {
  const harness = createAttemptsHarness(options);
  try {
    await body(harness);
  } finally {
    harness.dispose();
  }
};

describe("TC-ATTEMPT-001 ref resolution", () => {
  test("an explicit flag scopes the read and declares its source", async () => {
    await withHarness({ label: "ref-flag", records: ledgerOf(5) }, async (harness) => {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--limit",
        "3",
        "--json",
      ]);
      expect(result.exit).toBe(0);
      const data = dataOf(result.data);
      expect(data.ref).toBe(ATTEMPTS_REF);
      expect(data.refSource).toBe("flag");
      expect(data.limit).toBe(3);
      expect(data.attempts).toHaveLength(3);
      expect(data.repository).toBe(REPOSITORY);
    });
  });

  test("an omitted flag resolves the active change and declares it", async () => {
    await withHarness(
      { label: "ref-active", records: ledgerOf(2), activeChange: "present" },
      async (harness) => {
        const result = await harness.invoke(["dispatch", "attempts", "--json"]);
        expect(result.exit).toBe(0);
        const data = dataOf(result.data);
        expect(data.ref).toBe(ATTEMPTS_REF);
        expect(data.refSource).toBe("active-change");
        expect(data.limit).toBe(20);
      },
    );
  });
});

describe("TC-ATTEMPT-002 unresolvable active change", () => {
  for (const state of ["absent", "unparsable", "no-active-change"] as const) {
    test(`${state} refuses at exit 1 with the context and the --ref remedy`, async () => {
      await withHarness(
        { label: `ctx-${state}`, records: ledgerOf(2), activeChange: state },
        async (harness) => {
          const appendsBefore = harness.counters.append;
          const result = await harness.invoke(["dispatch", "attempts", "--json"]);
          expect(result.exit).toBe(1);
          expect(result.error?.code).toBe("input.value.rejected");
          expect(result.error?.summary).toContain(harness.contextPath);
          expect(result.error?.summary).toContain("--ref");
          expect(result.data).toBeUndefined();
          expect(result.readCount).toBe(0);
          expect(harness.counters.append).toBe(appendsBefore);
        },
      );
    });
  }
});

describe("TC-ATTEMPT-003 limit grammar", () => {
  test("1 and 100 are accepted", async () => {
    await withHarness({ label: "limit-accept", records: ledgerOf(150) }, async (harness) => {
      for (const limit of ["1", "100"]) {
        const result = await harness.invoke([
          "dispatch",
          "attempts",
          "--ref",
          ATTEMPTS_REF,
          "--limit",
          limit,
          "--json",
        ]);
        expect(result.exit, limit).toBe(0);
        expect(dataOf(result.data).limit, limit).toBe(Number(limit));
      }
    });
  });

  test("the default page bound is 20", async () => {
    await withHarness({ label: "limit-default", records: ledgerOf(25) }, async (harness) => {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      expect(result.exit).toBe(0);
      const data = dataOf(result.data);
      expect(data.limit).toBe(20);
      expect(data.attempts.length).toBeLessThanOrEqual(20);
      expect(data.hasMore).toBe(true);
    });
  });

  for (const limit of ["0", "101", "-1", "abc", "07", "+7", " 7", "001", ""]) {
    test(`"${limit}" is refused without a store read or normalisation`, async () => {
      await withHarness({ label: "limit-refuse", records: ledgerOf(2) }, async (harness) => {
        const argv =
          limit === ""
            ? ["dispatch", "attempts", "--ref", ATTEMPTS_REF, "--limit", "--json"]
            : ["dispatch", "attempts", "--ref", ATTEMPTS_REF, "--limit", limit, "--json"];
        const result = await harness.invoke(argv);
        expect(result.exit).toBe(1);
        expect(result.error?.code).toBe("input.value.rejected");
        expect(result.readCount).toBe(0);
      });
    });
  }
});

describe("TC-ATTEMPT-004 total order through the command", () => {
  test("identical start instants order by recordedAt then attemptId across runs", async () => {
    const sameStart = [0, 1, 2].map((index) =>
      maximalAttempt({
        attemptId: `A-ORDER-${String(index + 1)}`,
        startedAt: "2026-11-08T10:00:00.000Z",
        recordedAt: index === 2 ? "2026-11-08T10:02:00.000Z" : "2026-11-08T10:01:00.000Z",
      }),
    );
    await withHarness({ label: "order", records: sameStart }, async (harness) => {
      const first = await harness.invoke(["dispatch", "attempts", "--ref", ATTEMPTS_REF, "--json"]);
      const second = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      const order = dataOf(first.data).attempts.map((row) => row.attemptId);
      expect(order).toEqual(["A-ORDER-3", "A-ORDER-1", "A-ORDER-2"]);
      expect(dataOf(second.data).attempts.map((row) => row.attemptId)).toEqual(order);
    });
  });

  test("two opposite insertion orders return the same order", async () => {
    const records = ledgerOf(4);
    const reversed = [...records].reverse();
    let forwardOrder: readonly string[] = [];
    let reverseOrder: readonly string[] = [];
    await withHarness({ label: "order-fwd", records }, async (harness) => {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      forwardOrder = dataOf(result.data).attempts.map((row) => row.attemptId);
    });
    await withHarness({ label: "order-rev", records: reversed }, async (harness) => {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      reverseOrder = dataOf(result.data).attempts.map((row) => row.attemptId);
    });
    expect(reverseOrder).toEqual(forwardOrder);
  });
});

describe("TC-ATTEMPT-039 request grammar refusals", () => {
  const cases: readonly { readonly label: string; readonly argv: readonly string[] }[] = [
    { label: "non-canonical ref", argv: ["dispatch", "attempts", "--ref", "241", "--json"] },
    { label: "unknown flag", argv: ["dispatch", "attempts", "--nope", "--json"] },
    {
      label: "unexpected positional",
      argv: ["dispatch", "attempts", "GH-289", "extra", "--json"],
    },
  ];

  for (const entry of cases) {
    test(`${entry.label} exits 1 with input.value.rejected and zero reads`, async () => {
      await withHarness({ label: "grammar", records: ledgerOf(2) }, async (harness) => {
        const appendsBefore = harness.counters.append;
        const result = await harness.invoke(entry.argv);
        expect(result.exit).toBe(1);
        expect(result.error?.code).toBe("input.value.rejected");
        expect(result.readCount).toBe(0);
        expect(harness.counters.append).toBe(appendsBefore);
        expect(`${result.stdout}${result.stderr}`).not.toMatch(/attempts\./);
      });
    });
  }
});
