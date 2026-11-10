/**
 * TC-HOLDDOCTOR-001..004/007 (GH-280) — an active owner hold annotates an
 * otherwise-`ok` provider check with the single non-failing reason `owner-hold`
 * and an appended bounded detail; a real provider defect wins unchanged; the
 * machine delta is exactly the reason and detail; and the whole hold segment
 * survives the detail clamp while the existing detail yields.
 */
import { describe, expect, test } from "bun:test";
import {
  DOCTOR_MAX_DETAIL_CHARS,
  type DoctorCheck,
  type OwnerHoldFact,
} from "../../packages/core/src/contracts/index";
import { aggregateDoctorReport } from "../../packages/core/src/domain/index";
import {
  doctorWorld,
  FOLD_OK,
  parkRecord,
  runDoctorCli,
  type DoctorWorld,
} from "../fixtures/doctor/harness";

const HOLD: OwnerHoldFact = {
  active: true,
  source: "marker",
  reason: "peak-hour cost pause",
};
const HOLD_NO_REASON: OwnerHoldFact = { active: true, source: "env" };

const providerCheckOf = (world: DoctorWorld = {}): DoctorCheck => {
  const check = aggregateDoctorReport(doctorWorld(world)).checks.find(
    (candidate) => candidate.area === "provider",
  );
  if (check === undefined) throw new Error("provider check is missing");
  return check;
};

const holdWorld = (ownerHold: OwnerHoldFact = HOLD, extra: DoctorWorld = {}): DoctorWorld => ({
  ...extra,
  provider: { ...extra.provider, ownerHold },
});

describe("TC-HOLDDOCTOR-001 healthy provider + hold keeps ok and appends reason plus detail", () => {
  test("the check stays ok with the annotation reason and the appended segment", () => {
    const control = providerCheckOf();
    const held = providerCheckOf(holdWorld());
    expect(held.verdict).toBe("ok");
    expect(held.evidence.reasons).toEqual([...control.evidence.reasons, "owner-hold"]);
    expect(held.detail).toBe(`${control.detail}; owner hold active (marker): peak-hour cost pause`);
    expect(held.fixHint).toBeUndefined();
    expect(held.evidence.sources).toEqual(control.evidence.sources);
    expect(held.detail.length).toBeLessThanOrEqual(DOCTOR_MAX_DETAIL_CHARS);
  });

  test("the CLI exits 0 and the human provider row carries the segment", async () => {
    const run = await runDoctorCli(["doctor"], holdWorld());
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain(
      "provider ok          provider chain and credentials resolve; no active park; owner hold active (marker): peak-hour cost pause",
    );
  });
});

describe("TC-HOLDDOCTOR-002 a reasonless hold names only the source", () => {
  test("the segment omits the reason", () => {
    const held = providerCheckOf(holdWorld(HOLD_NO_REASON));
    expect(held.verdict).toBe("ok");
    expect(held.detail.endsWith("owner hold active (env)")).toBe(true);
    expect(held.evidence.reasons).toContain("owner-hold");
  });
});

describe("TC-HOLDDOCTOR-003 an existing provider defect wins and omits owner-hold", () => {
  test("configuration, credential, park-credential, and fold defects keep their verdict and reason", () => {
    const cases: ReadonlyArray<[string, DoctorWorld, string]> = [
      [
        "config-invalid",
        { provider: { config: { ok: false, reason: "config-invalid" }, ownerHold: HOLD } },
        "config-invalid",
      ],
      [
        "credential-unavailable",
        {
          provider: {
            credentials: [{ providerName: "provider-a", sourceKey: "X", ok: false }],
            ownerHold: HOLD,
          },
        },
        "credential-unavailable",
      ],
      [
        "park-credential-cause",
        {
          provider: {
            fold: {
              ok: true,
              parks: [parkRecord({ subjectName: "provider-a", cause: "credential-rejected" })],
              announcements: [],
            },
            ownerHold: HOLD,
          },
        },
        "park-credential-cause",
      ],
      [
        "state-unreadable",
        { provider: { fold: { ok: false, reason: "state-unreadable" }, ownerHold: HOLD } },
        "state-unreadable",
      ],
    ];
    for (const [label, world, reason] of cases) {
      const check = providerCheckOf(world);
      expect(check.verdict, label).not.toBe("ok");
      expect(check.evidence.reasons, label).toContain(reason);
      expect(check.evidence.reasons, label).not.toContain("owner-hold");
      expect(check.detail, label).not.toContain("owner hold active");
    }
  });
});

describe("TC-HOLDDOCTOR-004 held versus no-hold differs only by the additive reason and detail", () => {
  test("verdict, counts, evidence sources, and every other check are identical", () => {
    const control = aggregateDoctorReport(doctorWorld());
    const held = aggregateDoctorReport(doctorWorld(holdWorld()));
    expect(held.summary).toEqual(control.summary);
    expect(held.verdict).toBe(control.verdict);
    const otherChecks = (report: typeof control) =>
      report.checks.filter((check) => check.area !== "provider");
    expect(otherChecks(held)).toEqual(otherChecks(control));
    const heldProvider = held.checks.find((check) => check.area === "provider");
    const controlProvider = control.checks.find((check) => check.area === "provider");
    if (heldProvider === undefined || controlProvider === undefined) {
      throw new Error("provider check is missing");
    }
    expect(heldProvider.verdict).toBe(controlProvider.verdict);
    expect(heldProvider.evidence.sources).toEqual(controlProvider.evidence.sources);
    expect(heldProvider.evidence.failureCode).toBe(controlProvider.evidence.failureCode);
    expect(heldProvider.fixHint).toBe(controlProvider.fixHint);
    expect(heldProvider.detail).toBe(
      `${controlProvider.detail}; owner hold active (marker): peak-hour cost pause`,
    );
  });
});

describe("TC-HOLDDOCTOR-007 the whole hold segment survives the detail clamp", () => {
  test("the existing detail yields and the hold segment is kept intact", () => {
    const longSubject = `provider-${"x".repeat(140)}`;
    const world: DoctorWorld = {
      provider: {
        fold: {
          ok: true,
          parks: [parkRecord({ subjectName: longSubject, cause: "quota-exhausted" })],
          announcements: [],
        },
        ownerHold: HOLD,
      },
    };
    const check = providerCheckOf(world);
    expect(check.verdict).toBe("ok");
    expect(check.evidence.reasons).toContain("owner-hold");
    expect(check.fixHint).toBeUndefined();
    expect(Array.from(check.detail).length).toBe(DOCTOR_MAX_DETAIL_CHARS);
    expect(check.detail.endsWith("; owner hold active (marker): peak-hour cost pause")).toBe(true);
    expect(check.detail.startsWith("1 active park(s): provider-")).toBe(true);
  });

  test("a fold failure is unaffected by the hold (defect precedence is real)", () => {
    const check = providerCheckOf({
      provider: { fold: { ok: false, reason: "state-unreadable" }, ownerHold: HOLD },
    });
    expect(check.verdict).toBe("unreachable");
    expect(check.evidence.reasons).toEqual(["state-unreadable"]);
  });
});

describe("TC-HOLDDOCTOR-005 (spot) inactive hold is byte-identical", () => {
  test("an absent or inactive hold leaves the report identical", () => {
    const delivered = aggregateDoctorReport(doctorWorld());
    expect(
      JSON.stringify(
        aggregateDoctorReport(doctorWorld({ provider: { ownerHold: { active: false } } })),
      ),
    ).toBe(JSON.stringify(delivered));
    expect(
      JSON.stringify(aggregateDoctorReport(doctorWorld({ provider: { fold: FOLD_OK } }))),
    ).toBe(JSON.stringify(delivered));
  });
});
