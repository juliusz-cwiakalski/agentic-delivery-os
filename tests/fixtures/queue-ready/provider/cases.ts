/**
 * `provider-available` cases (TC-QREADY-011/012) built from the committed
 * provider fixture bytes under `tests/fixtures/queue-ready/providers/*.json`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ProviderConfiguration,
  ProviderParkView,
  QueueReadyConditionState,
  QueueReadyReason,
  StatusProviderFacts,
} from "../../../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const PROVIDERS_DIR = join(ROOT, "tests/fixtures/queue-ready/providers");

type ProviderFixture = {
  readonly config: ProviderConfiguration | null;
  readonly configFailure: {
    readonly reason: "config-invalid" | "provider-chain-unresolved";
    readonly failureCode?: string;
  } | null;
  readonly parks: readonly ProviderParkView[];
  readonly parkFailure: {
    readonly reason: "state-unreadable";
    readonly failureCode?: string;
    readonly failureClass?: string;
  } | null;
};

export const providerFixture = (name: string): StatusProviderFacts => {
  const fixture = JSON.parse(
    readFileSync(join(PROVIDERS_DIR, `${name}.json`), "utf8"),
  ) as ProviderFixture;
  if (fixture.configFailure !== null) {
    return {
      config: {
        ok: false,
        reason: fixture.configFailure.reason,
        ...(fixture.configFailure.failureCode === undefined
          ? {}
          : { failureCode: fixture.configFailure.failureCode }),
      },
      parks:
        fixture.parkFailure !== null
          ? {
              ok: false,
              reason: "state-unreadable",
              ...(fixture.parkFailure.failureCode === undefined
                ? {}
                : { failureCode: fixture.parkFailure.failureCode }),
              ...(fixture.parkFailure.failureClass === undefined
                ? {}
                : { failureClass: fixture.parkFailure.failureClass }),
            }
          : { ok: true, parks: fixture.parks },
    };
  }
  if (fixture.config === null) throw new Error(`fixture ${name} lacks a config`);
  return {
    config: { ok: true, config: fixture.config },
    parks:
      fixture.parkFailure !== null
        ? {
            ok: false,
            reason: "state-unreadable",
            ...(fixture.parkFailure.failureCode === undefined
              ? {}
              : { failureCode: fixture.parkFailure.failureCode }),
            ...(fixture.parkFailure.failureClass === undefined
              ? {}
              : { failureClass: fixture.parkFailure.failureClass }),
          }
        : { ok: true, parks: fixture.parks },
  };
};

export type ProviderCase = {
  readonly fixture: string;
  readonly state: QueueReadyConditionState;
  readonly reason: QueueReadyReason;
  readonly source: "provider-config" | "provider-parks";
  readonly detail?: string;
};

export const providerCases: readonly ProviderCase[] = [
  {
    fixture: "chain-default",
    state: "satisfied",
    reason: "no-active-park",
    source: "provider-parks",
    detail: "chain:primary",
  },
  {
    fixture: "chain-partial-park",
    state: "satisfied",
    reason: "no-active-park",
    source: "provider-parks",
    detail: "chain:primary",
  },
  {
    fixture: "chain-all-parked",
    state: "unsatisfied",
    reason: "all-entries-parked",
    source: "provider-parks",
    detail: "chain:primary",
  },
  {
    fixture: "chain-parked",
    state: "unsatisfied",
    reason: "chain-parked",
    source: "provider-parks",
    detail: "chain:primary; until:2026-11-01T06:00:00Z; cause:peak-window",
  },
  {
    fixture: "chain-parked-t-minus-1",
    state: "satisfied",
    reason: "no-active-park",
    source: "provider-parks",
    detail: "chain:primary",
  },
  {
    fixture: "no-chain",
    state: "unknown",
    reason: "provider-chain-not-declared",
    source: "provider-config",
  },
  {
    fixture: "unresolved-chain",
    state: "unknown",
    reason: "provider-chain-unresolved",
    source: "provider-config",
  },
  {
    fixture: "unresolved-chain-command",
    state: "unknown",
    reason: "provider-chain-unresolved",
    source: "provider-config",
    detail: "failureCode:config.value.invalid",
  },
  {
    fixture: "config-invalid",
    state: "unknown",
    reason: "config-invalid",
    source: "provider-config",
    detail: "failureCode:config.value.invalid",
  },
  {
    fixture: "park-fold-torn",
    state: "unknown",
    reason: "state-unreadable",
    source: "provider-parks",
    detail: "failureCode:state.store.torn",
  },
  {
    fixture: "no-enabled",
    state: "unsatisfied",
    reason: "no-enabled-entry",
    source: "provider-config",
    detail: "chain:primary",
  },
  {
    fixture: "non-matching-parks",
    state: "satisfied",
    reason: "no-active-park",
    source: "provider-parks",
    detail: "chain:primary",
  },
];
