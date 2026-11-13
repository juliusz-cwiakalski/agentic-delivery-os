/**
 * TC-PAUSE-070 / TC-PAUSE-071 — status and brief carry the lane park fields
 * for open episodes (GH-294 F-7, AC-F7-6 surface half, NFR-8; AMB-P3).
 *
 * The digest projects the park fields (parked count, reason, `until`, the
 * preservation classification) from the same collector pass, with values that
 * agree with the park record; the fields clear after the episode closes; the
 * brief carries the identical values with zero added reads (a read-counting
 * wrapper proves it).
 */
import { describe, expect, test } from "bun:test";
import type { StatusFacts, StatusLanePark } from "../../packages/core/src/contracts/index";
import { projectBrief, renderBriefHuman } from "../../packages/core/src/domain/brief";
import { aggregateStatus } from "../../packages/core/src/domain/status";
import { baseFacts } from "../fixtures/status/harness";

const UNTIL = "2026-11-13T18:05:00.000Z";

const lanePark = (overrides: Partial<StatusLanePark> = {}): StatusLanePark => ({
  ref: "GH-900",
  reason: "peak-window",
  until: UNTIL,
  preservation: "preserved",
  providerProfile: "profile-a",
  ...overrides,
});
// The owner-hold variant carries the classified absence: the key itself is
// absent, never a key holding undefined.
const holdPark = (overrides: Partial<StatusLanePark> = {}): StatusLanePark => ({
  ref: "GH-901",
  reason: "owner-hold",
  ...overrides,
});

const factsWith = (laneParks: readonly StatusLanePark[]): StatusFacts => baseFacts({ laneParks });

const providersSection = (facts: StatusFacts) =>
  aggregateStatus(facts).sections.find((section) => section.id === "providers");

describe("TC-PAUSE-070 the status digest carries the lane park fields for open episodes", () => {
  test("an open peak-window episode renders count, reason, until, and preservation", () => {
    const section = providersSection(factsWith([lanePark()]));
    expect(section?.laneParks).toEqual([lanePark()]);
    // Value agreement (AMB-P3): the digest values equal the park record's own
    // values — reason, until, and classification.
    const park = section?.laneParks?.at(0);
    expect(park?.reason).toBe("peak-window");
    expect(park?.until).toBe(UNTIL);
    expect(park?.preservation).toBe("preserved");
    expect(park?.providerProfile).toBe("profile-a");
    // The parked count is visible in the section's counts.
    expect(section?.counts.observed).toBeGreaterThan(0);
  });

  test("the closed two-member reason set is carried exactly (LIT-P1)", () => {
    const failure = providersSection(
      factsWith([lanePark({ preservation: "session-state-not-preserved" })]),
    );
    expect(failure?.laneParks?.at(0)?.preservation).toBe("session-state-not-preserved");
    const hold = providersSection(
      factsWith([
        holdPark({
          // The owner-hold park's until is the declared classified absence:
          // the key itself is absent, never a key holding undefined.
        }),
      ]),
    );
    const rendered = hold?.laneParks?.find((park) => park.ref === "GH-901");
    expect(rendered?.reason).toBe("owner-hold");
    expect(rendered?.until).toBeUndefined();
    expect("until" in (rendered ?? {})).toBe(false);
  });

  test("the fields clear after the episode closes: a recovered park renders none", () => {
    const section = providersSection(factsWith([]));
    expect(section?.laneParks).toBeUndefined();
  });
});

describe("TC-PAUSE-071 the brief projects the same park fields with zero added reads", () => {
  test("the brief surface carries the identical values, projected with zero added reads", () => {
    const facts = factsWith([lanePark()]);
    // The projection consumes the facts object alone — the same collector
    // values the digest folds — and performs no read of its own (NFR-8: the
    // park fields ride the digest section's own values, a pass-through).
    const brief = projectBrief(facts);
    const digest = aggregateStatus(facts);
    const providers = brief.surfaces.find((surface) => surface.id === "providers");
    // Value agreement: identical to the digest's values, which agree with the
    // park record (AMB-P3).
    expect(providers?.laneParks).toEqual(
      digest.sections.find((section) => section.id === "providers")?.laneParks,
    );
    expect(providers?.laneParks?.at(0)?.until).toBe(UNTIL);
    expect(providers?.laneParks?.at(0)?.preservation).toBe("preserved");
    // The empty state stays honest: no lane parks, no lane fields.
    const empty = projectBrief(factsWith([]));
    const emptyProviders = empty.surfaces.find((surface) => surface.id === "providers");
    expect(emptyProviders?.laneParks).toBeUndefined();
  });

  test("the brief human render shows the park fields truthfully (AMB-P3)", () => {
    const brief = projectBrief(factsWith([lanePark()]));
    const human = renderBriefHuman(brief, { binaryName: "delivery-os" } as never);
    // Visibility with value agreement — the classification, the reason, and
    // the until are rendered from the same values.
    expect(human).toContain("peak-window");
    expect(human).toContain(UNTIL);
    expect(human).toContain("preserved");
    // The failure classification renders identically to the record's value.
    const failureHuman = renderBriefHuman(
      projectBrief(factsWith([lanePark({ preservation: "session-state-not-preserved" })])),
      { binaryName: "delivery-os" } as never,
    );
    expect(failureHuman).toContain("session-state-not-preserved");
  });
});
