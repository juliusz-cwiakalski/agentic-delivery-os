/**
 * TC-PORT-005 / TC-PORT-006 / TC-PORT-008 — credential resolution returns the
 * material once, classifies missing credentials exactly, and derives keys from
 * declared data plus the branding seam.
 */
import { describe, expect, test } from "bun:test";
import {
  createEnvironmentCredentialPort,
  resolveCredentialSourceKey,
} from "../../packages/adapters/src/credentials/index";
import { classifyDomainKind, classifyThrown } from "../../packages/cli/src/classify";
import {
  type CredentialReference,
  ERROR_TABLE,
  FALLBACK_INTERNAL_CODE,
} from "../../packages/core/src/contracts/index";
import {
  CANARY,
  createCaptureSink,
  fixtureBrand,
  literalReference,
  prefixedReference,
} from "../fixtures/credentials/cases";

const MISSING_ROW = ERROR_TABLE.find((entry) => entry.code === "config.credential.missing");

const portFor = (environment: Record<string, string | undefined>) =>
  createEnvironmentCredentialPort({ environment, brand: fixtureBrand });

describe("TC-PORT-005 credential success without leaks", () => {
  test("the secret material is returned exactly once through the port result", () => {
    const result = portFor({ FIXTURE_CREDENTIAL: CANARY }).resolve(literalReference);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.material.value).toBe(CANARY);
    const serialized = JSON.stringify(result);
    const escapedCanary = JSON.stringify(CANARY).slice(1, -1);
    expect(serialized.split(escapedCanary).length - 1).toBe(1);
    expect(Object.keys(result).sort()).toEqual(["material", "ok"]);
    expect(Object.keys(result.material)).toEqual(["value"]);
  });

  test("a capture sink observes no diagnostics, logs, or errors carrying the canary", () => {
    const sink = createCaptureSink();
    const success = portFor({ FIXTURE_CREDENTIAL: CANARY }).resolve(literalReference);
    const failure = portFor({}).resolve(literalReference);
    sink.capture(success);
    sink.capture(failure);
    // The port emits nothing itself: the sink only holds what the caller chose
    // to capture. Failure payloads must never carry the canary in raw or
    // JSON-escaped form.
    for (const value of sink.entries.slice(1)) {
      const text = JSON.stringify(value);
      expect(text).not.toContain(CANARY);
      expect(text).not.toContain(JSON.stringify(CANARY).slice(1, -1));
    }
  });

  test("the host process environment is never consulted", () => {
    const previous = process.env.FIXTURE_CREDENTIAL;
    process.env.FIXTURE_CREDENTIAL = "host-only-value";
    try {
      const absent = portFor({}).resolve(literalReference);
      expect(absent.ok).toBe(false);
      const injected = portFor({ FIXTURE_CREDENTIAL: "injected-value" }).resolve(literalReference);
      expect(injected.ok).toBe(true);
      if (injected.ok) expect(injected.material.value).toBe("injected-value");
    } finally {
      if (previous === undefined) delete process.env.FIXTURE_CREDENTIAL;
      else process.env.FIXTURE_CREDENTIAL = previous;
    }
  });

  test("resolution is deterministic across repeats", () => {
    const port = portFor({ FIXTURE_CREDENTIAL: CANARY });
    expect(port.resolve(literalReference)).toEqual(port.resolve(literalReference));
  });
});

describe("TC-PORT-006 missing credential classified", () => {
  test("an absent key carries the exact `config.credential.missing` identity", () => {
    const result = portFor({}).resolve(literalReference);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result).toMatchObject({
      ok: false,
      code: "config.credential.missing",
      domainKind: "config",
      category: "user",
      retryable: false,
      consequence: "not_landed",
      projectionClass: "user-validation",
    });
    expect(MISSING_ROW).toBeDefined();
    if (MISSING_ROW !== undefined) {
      expect({
        code: result.code,
        domainKind: result.domainKind,
        category: result.category,
        retryable: result.retryable,
        consequence: result.consequence,
        projectionClass: result.projectionClass,
      }).toEqual({
        code: MISSING_ROW.code,
        domainKind: MISSING_ROW.domainKind,
        category: MISSING_ROW.category,
        retryable: MISSING_ROW.retryable,
        consequence: MISSING_ROW.consequence,
        projectionClass: MISSING_ROW.projectionClass,
      });
    }
  });

  test("an empty-string value carries the same identity", () => {
    const result = portFor({ FIXTURE_CREDENTIAL: "" }).resolve(literalReference);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("config.credential.missing");
  });

  test("a whitespace-only value is a value and resolves (OQ-F)", () => {
    const result = portFor({ FIXTURE_CREDENTIAL: "   " }).resolve(literalReference);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.material.value).toBe("   ");
  });

  test("the failure never falls to containment and leaves classification intact", () => {
    const failure = portFor({}).resolve(literalReference);
    expect(failure.ok).toBe(false);
    const residue = JSON.stringify(failure);
    expect(residue).not.toContain(FALLBACK_INTERNAL_CODE);
    expect(residue).not.toContain("fallback.");
    expect(residue).not.toContain(CANARY);
    const classified = classifyThrown({ kind: "config", code: "config.credential.missing" });
    expect(classified.code).toBe("config.credential.missing");
    expect(() => classifyDomainKind("config")).toThrow();
    expect(classifyDomainKind("provider", "provider.quota.exceeded").code).toBe(
      "provider.quota.exceeded",
    );
    expect(() => classifyDomainKind("provider")).toThrow();
    expect(classifyDomainKind("input").code).toBe("input.value.rejected");
  });
});

describe("TC-PORT-008 declared reference and brand-neutral source key", () => {
  test("the external system name does not influence the declared source key", () => {
    const renamed: CredentialReference = {
      ...literalReference,
      referenceName: "some-other-system",
    };
    expect(resolveCredentialSourceKey(renamed, fixtureBrand)).toBe(
      resolveCredentialSourceKey(literalReference, fixtureBrand),
    );
  });

  test("a prefixed source key derives from the branding seam", () => {
    expect(resolveCredentialSourceKey(prefixedReference, fixtureBrand)).toBe(
      `${fixtureBrand.environmentPrefix}TRACKER_TOKEN`,
    );
    const other = { ...fixtureBrand, environmentPrefix: "OTHER_" };
    expect(resolveCredentialSourceKey(prefixedReference, other)).toBe("OTHER_TRACKER_TOKEN");
    const resolved = portFor({
      [`${fixtureBrand.environmentPrefix}TRACKER_TOKEN`]: "derived-canary",
    }).resolve(prefixedReference);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.material.value).toBe("derived-canary");
  });
});
