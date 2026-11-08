/**
 * TC-POLL-001..003 — base→max backoff, success reset, minimum spacing, and the
 * configuration-only cadence.
 */
import { describe, expect, test } from "bun:test";
import {
  nextPollDelayMs,
  pollDue,
  pollFailure,
  pollIssued,
  pollSuccess,
} from "../../packages/core/src/domain/poll-policy";
import { createResidentPolling } from "../../packages/core/src/app/polling";
import { resolvePollSettings } from "../../packages/core/src/config/index";

const settings = { baseIntervalMs: 1_000, maxIntervalMs: 8_000, minSpacingMs: 500 };

describe("GH-238 polling policy", () => {
  test("failure backs off from base to max and success resets", () => {
    expect(nextPollDelayMs(settings, 0)).toBe(1_000);
    expect(nextPollDelayMs(settings, 1)).toBe(2_000);
    expect(nextPollDelayMs(settings, 2)).toBe(4_000);
    expect(nextPollDelayMs(settings, 3)).toBe(8_000);
    expect(nextPollDelayMs(settings, 10)).toBe(8_000);
    expect(pollSuccess().failures).toBe(0);
    expect(pollFailure({ failures: 2 }).failures).toBe(3);
  });

  test("the delay never falls below the minimum spacing", () => {
    expect(nextPollDelayMs({ ...settings, baseIntervalMs: 100, minSpacingMs: 500 }, 0)).toBe(500);
  });

  test("the minimum spacing gates a request and the injected clock drives it", () => {
    const state = pollIssued({ failures: 0 }, 10_000);
    expect(pollDue(state, settings, 10_499)).toBe(false);
    expect(pollDue(state, settings, 10_500)).toBe(true);
  });

  test("changing only configuration changes the observed cadence", () => {
    const fast = resolvePollSettings({
      poll: { github: { "base-interval": 2_000, "max-interval": 20_000, "min-spacing": 250 } },
    });
    const slow = resolvePollSettings({
      poll: { github: { "base-interval": 4_000, "max-interval": 40_000, "min-spacing": 250 } },
    });
    expect(fast.ok && slow.ok).toBe(true);
    if (!fast.ok || !slow.ok) return;
    expect(fast.value.github.baseIntervalMs).toBe(2_000);
    expect(slow.value.github.baseIntervalMs).toBe(4_000);
  });

  test("the resident controller uses only the injected clock", () => {
    let now = 0;
    const polling = createResidentPolling({
      settings,
      clock: {
        nowMs: () => now,
        nowIso: () => new Date(now).toISOString(),
        sleep: async () => undefined,
      },
    });
    expect(polling.due()).toBe(true);
    polling.issued();
    expect(polling.due()).toBe(false);
    now = 500;
    expect(polling.due()).toBe(true);
    polling.fail();
    expect(polling.delayMs()).toBe(2_000);
  });
});
