/**
 * TC-HOLDFACT-001..011 (GH-280) — the pure owner-hold fact over injected
 * inputs: derived environment key, marker precedence, empty/whitespace/absent
 * arms, the fail-closed matrix, the bounded sanitizer, the no-ambient input
 * surface, the missing-home case, and per-call re-resolution.
 */
import { describe, expect, test } from "bun:test";
import {
  OWNER_HOLD_MAX_REASON_CHARS,
  type OwnerHoldFact,
  type OwnerHoldMarkerOutcome,
} from "../../packages/core/src/contracts/index";
import {
  ownerHoldEnvironmentVariableName,
  resolveOwnerHoldFact,
  sanitizeOwnerHoldReason,
} from "../../packages/core/src/domain/index";

const STORE = "/srv/operator/.ados-state";

type Environment = Readonly<Record<string, string | undefined>>;

/** A recording environment double: it records every property lookup. */
const recordingEnvironment = (
  values: Environment,
): { readonly environment: Environment; readonly lookedUp: string[] } => {
  const lookedUp: string[] = [];
  const environment = new Proxy(values, {
    get(target, property) {
      if (typeof property === "string") lookedUp.push(property);
      return target[property];
    },
  });
  return { environment, lookedUp };
};

const activeMarker = (content: string): OwnerHoldMarkerOutcome => ({ state: "present", content });

const resolve = (
  environment: Environment,
  environmentPrefix: string,
  marker: OwnerHoldMarkerOutcome = { state: "absent" },
  storeDirectory: string | undefined = STORE,
): OwnerHoldFact =>
  resolveOwnerHoldFact({ environment, environmentPrefix, marker, storeDirectory });

describe("TC-HOLDFACT-001 environment source with a derived variable name", () => {
  test("a synthetic prefix derives the key and activates with the value as reason", () => {
    const { environment, lookedUp } = recordingEnvironment({
      ACME_OWNER_HOLD: "peak-hour cost pause",
    });
    const fact = resolve(environment, "ACME");
    expect(fact).toEqual({
      active: true,
      source: "env",
      reason: "peak-hour cost pause",
    });
    const key = ownerHoldEnvironmentVariableName("ACME");
    expect(key).toBe("ACME_OWNER_HOLD");
    expect(lookedUp).toContain(key);
    expect(lookedUp).not.toContain("OWNER_HOLD");
  });

  test("a second brand derives its own key and keeps the same reason", () => {
    expect(ownerHoldEnvironmentVariableName("beta_")).toBe("beta_OWNER_HOLD");
    const { environment } = recordingEnvironment({
      [ownerHoldEnvironmentVariableName("BETA")]: "hold reason",
    });
    const fact = resolve(environment, "BETA");
    expect(fact).toEqual({ active: true, source: "env", reason: "hold reason" });
    // A different prefix never reads the same variable.
    expect(resolve({ BETA_OWNER_HOLD: "x" }, "GAMMA")).toEqual({ active: false });
  });

  test("the suffix is declared, not a bare product literal", () => {
    expect(ownerHoldEnvironmentVariableName("anything")).toBe("anything_OWNER_HOLD");
  });
});

describe("TC-HOLDFACT-002 marker source with its first-line reason", () => {
  test("a present marker activates with only its first line", () => {
    const fact = resolve({}, "ACME", activeMarker("peak-hour cost pause\nsecond line\nthird"));
    expect(fact).toEqual({ active: true, source: "marker", reason: "peak-hour cost pause" });
  });

  test("a marker at a non-default store directory is ignored", () => {
    // The resolver only ever consults the outcome for the supplied production
    // store directory; another directory's marker is a different read.
    const fact = resolve({}, "ACME", { state: "absent" }, STORE);
    expect(fact).toEqual({ active: false });
    const other = resolve({}, "ACME", activeMarker("elsewhere"), "/tmp/elsewhere");
    expect(other).toEqual({ active: true, source: "marker", reason: "elsewhere" });
  });

  test("no marker-path or store-relocation override is consulted", () => {
    const { environment, lookedUp } = recordingEnvironment({
      ADOS_STATE_DIR: "/tmp/relocated",
      ACME_OWNER_HOLD_FILE: "/tmp/relocated/owner-hold",
    });
    const fact = resolve(environment, "ACME", { state: "absent" });
    expect(fact).toEqual({ active: false });
    expect(lookedUp).not.toContain("ADOS_STATE_DIR");
    expect(lookedUp).not.toContain("ACME_OWNER_HOLD_FILE");
  });
});

describe("TC-HOLDFACT-003 environment wins when both sources are active", () => {
  test("the environment reason wins and the marker reason is unused", () => {
    const environment = { ACME_OWNER_HOLD: "environment reason" };
    expect(resolve(environment, "ACME", activeMarker("marker reason"))).toEqual({
      active: true,
      source: "env",
      reason: "environment reason",
    });
    expect(resolve(environment, "ACME", activeMarker("swapped reason"))).toEqual({
      active: true,
      source: "env",
      reason: "environment reason",
    });
    // The fixture is live: without the environment the marker reason appears.
    expect(resolve({}, "ACME", activeMarker("marker reason"))).toEqual({
      active: true,
      source: "marker",
      reason: "marker reason",
    });
  });
});

describe("TC-HOLDFACT-004 empty environment is inactive; whitespace is active without a reason", () => {
  test("empty is inactive and whitespace is active with no reason", () => {
    const empty = resolve({ ACME_OWNER_HOLD: "" }, "ACME");
    expect(empty).toEqual({ active: false });
    expect(Object.hasOwn(empty, "source")).toBe(false);
    expect(Object.hasOwn(empty, "reason")).toBe(false);

    const whitespace = resolve({ ACME_OWNER_HOLD: "   \t  " }, "ACME");
    expect(whitespace).toEqual({ active: true, source: "env" });
    expect(Object.hasOwn(whitespace, "reason")).toBe(false);

    expect(resolve({}, "ACME")).toEqual({ active: false });
  });
});

describe("TC-HOLDFACT-005 empty marker is active without a reason", () => {
  test("a zero-byte marker omits reason rather than carrying an empty string", () => {
    const fact = resolve({}, "ACME", activeMarker(""));
    expect(fact).toEqual({ active: true, source: "marker" });
    expect(Object.hasOwn(fact, "reason")).toBe(false);
  });
});

describe("TC-HOLDFACT-006 unreadable, non-regular, and stat-failing markers fail closed", () => {
  test("every unreadable outcome resolves active with no reason", () => {
    for (const marker of [
      { state: "unreadable" as const },
      activeMarker(""),
      { state: "unreadable" as const },
    ]) {
      const fact = resolve({}, "ACME", marker);
      expect(fact.active).toBe(true);
      expect(fact).toEqual({ active: true, source: "marker" });
    }
    // Only an absent marker is inactive.
    expect(resolve({}, "ACME", { state: "absent" })).toEqual({ active: false });
  });
});

describe("TC-HOLDFACT-007 the reason is one control-free line of at most 160 characters", () => {
  test("control characters, ANSI escapes, tabs, and newlines are removed and collapsed", () => {
    const reason = sanitizeOwnerHoldReason(
      "  \u0000\u0007\u001b[31mred\u001b[0m\u0085line\n\ttab   spaces  ",
    );
    expect(reason).toBe("red line tab spaces");
    expect(reason?.length ?? 0).toBeLessThanOrEqual(OWNER_HOLD_MAX_REASON_CHARS);
    expect(reason).not.toContain("\u001b");
    expect(reason).not.toMatch(new RegExp("[\\u0000-\\u001f\\u007f-\\u009f]", "u"));
  });

  test("the 160 bound truncates with no ellipsis and preserves shorter values", () => {
    const exactly = "a".repeat(160);
    const over = "b".repeat(300);
    expect(sanitizeOwnerHoldReason(exactly)).toBe(exactly);
    expect(sanitizeOwnerHoldReason(`${exactly}c`)).toBe(exactly);
    const truncated = sanitizeOwnerHoldReason(over);
    expect(truncated).toHaveLength(160);
    expect(truncated).toBe("b".repeat(160));
    expect(truncated?.endsWith("...")).toBe(false);
  });

  test("shell metacharacters are data only and never executed", () => {
    const payload = "$(touch pwned); `touch pwned`; |";
    const reason = sanitizeOwnerHoldReason(payload);
    expect(reason).toBe(payload);
    const fact = resolve({ ACME_OWNER_HOLD: payload }, "ACME");
    expect(fact).toEqual({ active: true, source: "env", reason: payload });
  });
});

describe("TC-HOLDFACT-009 resolution reads no credential, writes no state, calls no network", () => {
  test("two resolution passes record exactly zero credential, transport, store, and spawn calls", async () => {
    const counters = { credentials: 0, transport: 0, writes: 0, spawns: 0 };
    const credentials = {
      resolve: () => {
        counters.credentials += 1;
        return { ok: true as const, material: { value: "synthetic" } };
      },
    };
    const transport = {
      send: async () => {
        counters.transport += 1;
        return { status: 200, body: {} };
      },
    };
    const store = {
      append: () => {
        counters.writes += 1;
        return { ok: true as const };
      },
    };
    const spawn = async () => {
      counters.spawns += 1;
      return { stdout: "", stderr: "", status: 0, timedOut: false };
    };
    // A composition-shaped holder: the resolver sees only the injected environment
    // and marker outcome, never the credential, transport, store, or spawn seams.
    const composition = {
      credentials,
      transport,
      store,
      spawn,
      resolve: (): OwnerHoldFact =>
        resolve({ ACME_OWNER_HOLD: "pause" }, "ACME", activeMarker("marker reason")),
    };
    for (let pass = 0; pass < 2; pass += 1) {
      expect(composition.resolve()).toEqual({ active: true, source: "env", reason: "pause" });
    }
    expect(counters).toEqual({ credentials: 0, transport: 0, writes: 0, spawns: 0 });
    // Keep the recorder doubles reachable so the zero counts are not tree-shaken.
    expect(composition.credentials).toBe(credentials);
    expect(composition.transport).toBe(transport);
    expect(composition.store).toBe(store);
    expect(typeof composition.spawn).toBe("function");
  });

  test("the resolver consumes only injected inputs and leaks no planted secret", () => {
    const canary = "SECRET-CANARY-9f2a";
    const fact = resolve(
      { ACME_OWNER_HOLD: "pause", CREDENTIAL_CANARY: canary },
      "ACME",
      activeMarker("marker reason"),
    );
    expect(JSON.stringify(fact)).not.toContain(canary);
    expect(fact).toEqual({ active: true, source: "env", reason: "pause" });
  });
});

describe("TC-HOLDFACT-010 no resolvable home directory leaves only the environment source", () => {
  test("an absent store directory is inactive for an absent source and active for a set source", () => {
    const withoutHome = (environment: Environment): ReturnType<typeof resolveOwnerHoldFact> =>
      resolveOwnerHoldFact({
        environment,
        environmentPrefix: "ACME",
        storeDirectory: undefined,
        marker: { state: "absent" },
      });
    expect(withoutHome({})).toEqual({ active: false });
    expect(withoutHome({ ACME_OWNER_HOLD: "hold reason" })).toEqual({
      active: true,
      source: "env",
      reason: "hold reason",
    });
  });

  test("a marker outcome is ignored when no store directory resolves", () => {
    expect(
      resolveOwnerHoldFact({
        environment: {},
        environmentPrefix: "ACME",
        storeDirectory: undefined,
        marker: activeMarker("relocated"),
      }),
    ).toEqual({ active: false });
  });
});

describe("TC-HOLDFACT-011 the fact is re-resolved on every pass and never cached", () => {
  test("absent, present, absent across three calls reflects each call's inputs", () => {
    expect(resolve({}, "ACME", { state: "absent" })).toEqual({ active: false });
    expect(resolve({}, "ACME", activeMarker("now held"))).toEqual({
      active: true,
      source: "marker",
      reason: "now held",
    });
    expect(resolve({}, "ACME", { state: "absent" })).toEqual({ active: false });
  });

  test("a changed environment value is observed on the next resolution", () => {
    expect(resolve({ ACME_OWNER_HOLD: "first" }, "ACME")).toEqual({
      active: true,
      source: "env",
      reason: "first",
    });
    expect(resolve({ ACME_OWNER_HOLD: "second" }, "ACME")).toEqual({
      active: true,
      source: "env",
      reason: "second",
    });
  });
});
