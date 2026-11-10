/**
 * TC-HOLDSTATUS-001..005 (GH-280) — the active hold is one additive
 * `providers.evidence.ownerHold` member (a sibling of `sources[]`), visible
 * across every providers section state without changing state, counts, sources,
 * reasons, truncation, findings, or entries; human mode appends the bounded
 * suffix; and the inactive digest is byte-identical to the delivered shape.
 */
import { describe, expect, test } from "bun:test";
import {
  STATUS_SECTION_ORDER,
  STATUS_SCHEMA_VERSION,
  type OwnerHoldFact,
  type StatusProviderFacts,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus, renderStatusHuman } from "../../packages/core/src/domain/index";
import { SYNTHETIC_BRAND } from "../golden/helpers";
import {
  baseFacts,
  providerConfig,
  providerConfigRead,
  providers,
} from "../fixtures/status/harness";

const HOLD: OwnerHoldFact = {
  active: true,
  source: "marker",
  reason: "peak-hour cost pause",
};
const NO_REASON: OwnerHoldFact = { active: true, source: "env" };
const INACTIVE: OwnerHoldFact = { active: false };

const withHold = (provider: StatusProviderFacts, hold: OwnerHoldFact = HOLD) => ({
  ...provider,
  ownerHold: hold,
});

const providersSection = (facts: ReturnType<typeof baseFacts>) => {
  const section = aggregateStatus(facts).sections.find((entry) => entry.id === "providers");
  if (section === undefined) throw new Error("providers section is missing");
  return section;
};

describe("TC-HOLDSTATUS-001 the evidence member is additive", () => {
  test("active adds providers.evidence.ownerHold without changing the section", () => {
    const digest = aggregateStatus(baseFacts({ providers: withHold(providers()) }));
    const section = digest.sections.find((entry) => entry.id === "providers");
    if (section === undefined) throw new Error("providers section is missing");
    expect(section.evidence.ownerHold).toEqual({
      source: "marker",
      reason: "peak-hour cost pause",
    });
    expect(Object.hasOwn(section, "ownerHold")).toBe(false);
    expect(Object.hasOwn(section.evidence, "ownerHold")).toBe(true);
    expect(digest.sections.map((entry) => entry.id)).toEqual([...STATUS_SECTION_ORDER]);
    expect(digest.schemaVersion).toBe(STATUS_SCHEMA_VERSION);

    const control = aggregateStatus(baseFacts());
    const controlSection = control.sections.find((entry) => entry.id === "providers");
    if (controlSection === undefined) throw new Error("control providers section is missing");
    const {
      ownerHold: _ignored,
      ...evidenceWithoutHold
    } = section.evidence as typeof section.evidence & { ownerHold?: unknown };
    expect(evidenceWithoutHold).toEqual(controlSection.evidence);
    expect(section.state).toBe(controlSection.state);
    expect(section.counts).toEqual(controlSection.counts);
    expect(section.truncated).toBe(controlSection.truncated);
  });

  test("a reasonless active hold carries only the source", () => {
    const section = providersSection(baseFacts({ providers: withHold(providers(), NO_REASON) }));
    expect(section.evidence.ownerHold).toEqual({ source: "env" });
  });
});

describe("TC-HOLDSTATUS-002 the member is attached across every providers section state", () => {
  const variants: ReadonlyArray<[string, StatusProviderFacts]> = [
    ["observed", providers()],
    [
      "degraded",
      providers({
        parks: { ok: false, reason: "state-unreadable", failureCode: "state.store.torn" },
      }),
    ],
    ["unknown", providers({ config: { ok: false, reason: "config-invalid" } })],
    [
      "unavailable",
      providers({
        config: providerConfigRead(
          providerConfig({ defaultChain: undefined, chains: {}, entries: {} }),
        ),
      }),
    ],
  ];

  for (const [label, provider] of variants) {
    test(`${label} keeps its state and gains the member`, () => {
      const control = providersSection(baseFacts({ providers: provider }));
      const held = providersSection(baseFacts({ providers: withHold(provider) }));
      expect(held.state).toBe(control.state);
      expect(held.evidence.ownerHold).toEqual({
        source: "marker",
        reason: "peak-hour cost pause",
      });
      const { ownerHold: _ignored, ...rest } = held.evidence as typeof held.evidence & {
        ownerHold?: unknown;
      };
      expect(rest).toEqual(control.evidence);
    });
  }
});

describe("TC-HOLDSTATUS-003 human status appends the bounded suffix", () => {
  test("the providers line ends with owner-hold or owner-hold: reason", () => {
    const withReason = renderStatusHuman(
      aggregateStatus(baseFacts({ providers: withHold(providers()) })),
      SYNTHETIC_BRAND,
    );
    const line = withReason.split("\n").find((entry) => entry.startsWith("providers  "));
    expect(line).toBeDefined();
    expect(line?.endsWith("| owner-hold: peak-hour cost pause")).toBe(true);

    const noReason = renderStatusHuman(
      aggregateStatus(baseFacts({ providers: withHold(providers(), NO_REASON) })),
      SYNTHETIC_BRAND,
    );
    const bare = noReason.split("\n").find((entry) => entry.startsWith("providers  "));
    expect(bare?.endsWith("| owner-hold")).toBe(true);
  });
});

describe("TC-HOLDSTATUS-005 the inactive digest is byte-identical and the vocabulary is unchanged", () => {
  test("an inactive fact adds no member and no byte", () => {
    const inactive = aggregateStatus(baseFacts({ providers: withHold(providers(), INACTIVE) }));
    const delivered = aggregateStatus(baseFacts());
    expect(JSON.stringify(inactive)).toBe(JSON.stringify(delivered));
    const section = inactive.sections.find((entry) => entry.id === "providers");
    expect(section === undefined ? undefined : Object.hasOwn(section.evidence, "ownerHold")).toBe(
      false,
    );
  });
});
