/**
 * GH-289 TC-ATTEMPT-023, 024, 025, 026 — the deterministic bounded attempts
 * digest: the declared summary line, the seven cells per row, the closed
 * corroboration derivation, the human budget with its declared cut, the
 * coverage/floor pointer, and byte-identical repeated output.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DISPATCH_MAX_HUMAN_BYTES,
  DISPATCH_MAX_HUMAN_LINES,
  type DispatchAttemptsData,
} from "../../packages/core/src/contracts/index";
import { renderDispatchAttemptsText } from "../../packages/cli/src/output/dispatch-text";
import { ATTEMPTS_REF, ledgerOf, maximalAttempt } from "../fixtures/dispatch/attempt-records";
import { createAttemptsHarness } from "../fixtures/dispatch/attempts-harness";
import { corroborationFor, REPOSITORY } from "../fixtures/dispatch/ledger";

const GOLDEN = join(process.cwd(), "tests/fixtures/dispatch/golden");

const utf8Bytes = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

describe("TC-ATTEMPT-023 digest shape", () => {
  test("the three-row digest equals its reviewed golden", async () => {
    const harness = createAttemptsHarness({ label: "digest", records: ledgerOf(3) });
    try {
      const result = await harness.invoke(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      expect(result.exit).toBe(0);
      const golden = readFileSync(join(GOLDEN, "attempts.txt"), "utf8");
      expect(result.stdout).toBe(golden);
    } finally {
      harness.dispose();
    }
  });

  test("the summary line, the seven cells and the pointer are declared", async () => {
    const harness = createAttemptsHarness({ label: "digest-shape", records: ledgerOf(2) });
    try {
      const result = await harness.invoke(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      const lines = result.stdout.trimEnd().split("\n");
      expect(lines[0]).toBe(
        `attempts=2; repository=${REPOSITORY}; ref=${ATTEMPTS_REF}; has_more=false`,
      );
      const row = lines[1] ?? "";
      const cells = row.split(" ");
      expect(cells).toHaveLength(7);
      expect(cells[1]).toBe(ATTEMPTS_REF);
      expect(cells[2]).toBe("merged");
      expect(cells[3]).toMatch(/^(corroborated|uncorroborated|vacuous)$/);
      expect(cells[4]).toMatch(/^(none|DIV-.*)$/);
      expect(cells[5]).toBe("claude-code");
      expect(cells[6]).toBe("controlled-proof");
      expect(lines.at(-1)).toBe(
        `next: dispatch dual-run summary --repo ${REPOSITORY} (coverage and floor)`,
      );
      for (const key of ["result=", "pr_url=", "exit_code=", "last_message="]) {
        expect(result.stdout).not.toContain(key);
      }
    } finally {
      harness.dispose();
    }
  });

  test("an empty page prints the summary, no rows, and the pointer", async () => {
    const harness = createAttemptsHarness({ label: "digest-empty", records: [] });
    try {
      const result = await harness.invoke(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      expect(result.exit).toBe(0);
      expect(result.stdout).toBe(readFileSync(join(GOLDEN, "attempts-empty.txt"), "utf8"));
    } finally {
      harness.dispose();
    }
  });
});

/** Render one row's corroboration cell through the delivered digest. */
const renderCell = (data: DispatchAttemptsData): string => {
  const line = renderDispatchAttemptsText(data).split("\n")[1] ?? "";
  return line.split(" ")[3] ?? "";
};

describe("TC-ATTEMPT-024 the closed corroboration derivation", () => {
  const cellFor = (corroboration: ReturnType<typeof corroborationFor>): string => {
    const data = {
      repository: REPOSITORY,
      ref: ATTEMPTS_REF,
      refSource: "flag",
      limit: 20,
      matched: 1,
      hasMore: false,
      attempts: [
        {
          attemptId: "A-1",
          repository: REPOSITORY,
          ref: ATTEMPTS_REF,
          harness: "opencode",
          evidenceClass: "pilot",
          outcome: "completed",
          token: "merged",
          startedAt: "2026-11-08T10:00:00.000Z",
          endedAt: "2026-11-08T10:00:00.000Z",
          divergenceRef: null,
          corroboration,
          falseSuccess: false,
          comparison: { class: "tracker-truth", token: "merged", outcome: "match" },
          resumeMode: null,
          evidenceRefs: [],
          recordedAt: "2026-11-08T10:00:00.000Z",
        },
      ],
      excluded: { foreignRepository: 0 },
    } satisfies DispatchAttemptsData;
    return renderCell(data);
  };

  test("satisfied/satisfied/satisfied is corroborated", () => {
    expect(
      cellFor({
        pmNotes: "satisfied",
        tracker: "satisfied",
        ci: "satisfied",
      }),
    ).toBe("corroborated");
  });

  test("a single unsatisfied source is uncorroborated", () => {
    expect(
      cellFor({
        pmNotes: "satisfied",
        tracker: "unsatisfied",
        ci: "not-applicable",
      }),
    ).toBe("uncorroborated");
  });

  test("all three not-applicable is vacuous and no fourth value exists", () => {
    expect(
      cellFor({
        pmNotes: "not-applicable",
        tracker: "not-applicable",
        ci: "not-applicable",
      }),
    ).toBe("vacuous");
  });
});

describe("TC-ATTEMPT-025 human budget", () => {
  test("40 lines with the oldest rows dropped and the cut declared", async () => {
    const harness = createAttemptsHarness({ label: "digest-budget", records: ledgerOf(60) });
    try {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--limit",
        "60",
      ]);
      const lines = result.stdout.trimEnd().split("\n");
      expect(lines.length).toBeLessThanOrEqual(DISPATCH_MAX_HUMAN_LINES);
      expect(utf8Bytes(result.stdout)).toBeLessThanOrEqual(DISPATCH_MAX_HUMAN_BYTES);
      expect(result.stdout).toContain("truncation=human:bound:37,omitted:23");
      const rows = lines.filter(
        (line) =>
          line.includes(ATTEMPTS_REF) && !line.startsWith("next:") && !line.startsWith("attempts="),
      );
      expect(rows.length).toBeLessThanOrEqual(37);
      // Newest rows stay: the first dropped row is the oldest one.
      expect(rows[0]).toContain("2026-11-08T10:59:00.000Z");
      // has_more is untouched by the human cut.
      expect(lines[0]).toContain("has_more=false");
    } finally {
      harness.dispose();
    }
  });

  test("the byte budget binds before the line budget on long rows", async () => {
    const long = "D".repeat(300);
    const records = ledgerOf(60, { divergenceRef: long });
    const harness = createAttemptsHarness({ label: "digest-bytes", records });
    try {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--limit",
        "60",
      ]);
      expect(utf8Bytes(result.stdout)).toBeLessThanOrEqual(DISPATCH_MAX_HUMAN_BYTES);
      expect(result.stdout).toMatch(/truncation=human:bound:\d+,omitted:\d+/);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-ATTEMPT-026 determinism", () => {
  test("two text runs are byte-identical and two payloads structurally identical", async () => {
    const harness = createAttemptsHarness({ label: "digest-determinism", records: ledgerOf(4) });
    try {
      const firstText = await harness.invoke(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      const secondText = await harness.invoke(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      expect(secondText.stdout).toBe(firstText.stdout);
      const firstJson = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      const secondJson = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      expect(secondJson.data).toEqual(firstJson.data);
    } finally {
      harness.dispose();
    }
  });

  test("a maximal attempt stays inside the declared row shape", async () => {
    const harness = createAttemptsHarness({
      label: "digest-maximal",
      records: [maximalAttempt()],
    });
    try {
      const result = await harness.invoke(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      expect(result.exit).toBe(0);
      expect(result.stdout.split("\n")[1]).toContain("DIV-maximal");
    } finally {
      harness.dispose();
    }
  });
});
