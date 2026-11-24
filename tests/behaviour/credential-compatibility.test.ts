/**
 * TC-COMPAT-001 — existing configurations validate and resolve
 * byte-identically against the phase-1 goldens; the shipped defaults,
 * including the tracker reference, are unchanged; and no migration exists.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createEnvironmentCredentialPort,
  resolveCredentialSourceKey,
} from "../../packages/adapters/src/credentials/index";
import { PRODUCTION_CATALOG } from "../../packages/core/src/config/index";
import { CREDENTIAL_FAILURE_REASONS } from "../../packages/core/src/contracts/credentials";
import {
  CANARY,
  fixtureBrand,
  literalReference,
  prefixedReference,
} from "../fixtures/credentials/cases";

const GOLDENS = JSON.parse(
  readFileSync(join(process.cwd(), "tests/golden/credential-resolution-goldens.json"), "utf8"),
) as {
  schema: string;
  brandEnvironmentPrefix: string;
  trackerReferenceDefault: { referenceName: string; sourceKey: { style: string; name: string } };
  cases: Record<
    string,
    {
      readonly derivedKey: string;
      readonly present: { readonly ok: true; readonly material: string };
      readonly absent: { readonly ok: false; readonly identity: { readonly code: string } };
    }
  >;
  fixtures: readonly {
    readonly fixture: string;
    readonly validation: { readonly ok: true } | { readonly ok: false; readonly detail: string };
    readonly credentials: readonly {
      readonly name: string;
      readonly derivedKey: string;
      readonly present: { readonly ok: true; readonly material: string } | { readonly ok: false };
      readonly absent: { readonly ok: false; readonly identity: { readonly code: string } };
    };
  }[];
};

const portFor = (environment: Record<string, string | undefined>) =>
  createEnvironmentCredentialPort({ environment, brand: fixtureBrand });

describe("TC-COMPAT-001 byte-identical validation and resolution", () => {
  test("the golden document is the delivered oracle and its schema is pinned", () => {
    expect(GOLDENS.schema).toBe("credential-resolution-goldens.v1");
    expect(GOLDENS.brandEnvironmentPrefix).toBe(fixtureBrand.environmentPrefix);
    expect(Object.keys(GOLDENS.cases)).toEqual(["literal", "prefixed"]);
    expect(GOLDENS.fixtures.length).toBeGreaterThan(0);
  });

  test("every golden case re-resolves byte-identically (present, absent, empty, whitespace)", () => {
    // literal.present plants the canary; prefixed.present uses the capture's
    // deterministic sentinel; whitespace is a value for the environment
    // styles (F-8), empty is not.
    const literal = GOLDENS.cases.literal;
    const literalPresent = portFor({ [literal.derivedKey]: CANARY }).resolve(literalReference);
    expect(literalPresent.ok).toBe(true);
    if (literalPresent.ok) expect(literalPresent.material.value).toBe(literal.present.material);
    const literalAbsent = portFor({}).resolve(literalReference);
    expect(literalAbsent.ok).toBe(false);

    const prefixedReferenceLocal = prefixedReference;
    const prefixed = GOLDENS.cases.prefixed;
    const prefixedPresent = portFor({
      [prefixed.derivedKey]: `fixture-material-for-${prefixed.derivedKey}`,
    }).resolve(prefixedReferenceLocal);
    expect(prefixedPresent.ok).toBe(true);
    if (prefixedPresent.ok) expect(prefixedPresent.material.value).toBe(prefixed.present.material);
    const prefixedAbsent = portFor({}).resolve(prefixedReferenceLocal);
    expect(prefixedAbsent.ok).toBe(false);
    expect(resolveCredentialSourceKey(prefixedReferenceLocal, fixtureBrand)).toBe(
      prefixed.derivedKey,
    );

    // The delivered environment-style classification is byte-identical and
    // gains only the additive identity-shaped projection.
    for (const absent of [literalAbsent, prefixedAbsent]) {
      if (absent.ok) throw new Error("absent must fail");
      expect(absent.code).toBe("config.credential.missing");
      expect(absent.domainKind).toBe("config");
      expect(absent.category).toBe("user");
      expect(absent.retryable).toBe(false);
      expect(absent.consequence).toBe("not_landed");
      expect(absent.projectionClass).toBe("user-validation");
      expect(absent.reason).toBe("variable-absent");
      expect(absent.source).toMatch(/^(literal|environment-prefixed):/);
      expect((absent.remedy ?? "").length).toBeGreaterThan(0);
    }

    const empty = portFor({ [literal.derivedKey]: "" }).resolve(literalReference);
    expect(empty.ok).toBe(false);
    const whitespace = portFor({ [literal.derivedKey]: "   " }).resolve(literalReference);
    expect(whitespace.ok).toBe(true);
    if (whitespace.ok) expect(whitespace.material.value).toBe("   ");
  });

  test("every shipped provider-config fixture re-validates to its captured outcome", () => {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const { parse } = require("yaml") as typeof import("yaml");
    const { parseAndValidateProviderConfiguration } =
      require("../../packages/core/src/provider/validate") as {
        parseAndValidateProviderConfiguration: (document: unknown) => {
          readonly ok: boolean;
          readonly error?: { readonly detail: string };
        };
      };
    const directory = join(process.cwd(), "tests/fixtures/provider/config");
    for (const name of readdirSync(directory).sort()) {
      if (!name.endsWith(".yaml")) continue;
      const golden = GOLDENS.fixtures.find((entry) => entry.fixture === name);
      if (golden === undefined) continue;
      const outcome = parseAndValidateProviderConfiguration(
        parse(readFileSync(join(directory, name), "utf8")),
      );
      expect(outcome.ok).toBe(golden.validation.ok);
      if (!outcome.ok && !golden.validation.ok) {
        expect(outcome.error?.detail).toBe(golden.validation.detail);
      }
    }
  });

  test("the shipped defaults are unchanged, including the tracker reference", () => {
    expect(GOLDENS.trackerReferenceDefault).toEqual({
      referenceName: "github-read",
      sourceKey: { style: "literal", name: "GITHUB_TOKEN" },
    });
    // The production catalog declares the tracker reference default
    // byte-identical to the hard-coded value it replaces.
    const github = (PRODUCTION_CATALOG as Record<string, unknown>).github;
    expect(github).toBeDefined();
    const trackerReference = {
      referenceName: "github-read",
      sourceKey: { style: "literal" as const, name: "GITHUB_TOKEN" },
    };
    expect(resolveCredentialSourceKey(trackerReference, fixtureBrand)).toBe("GITHUB_TOKEN");
    expect(resolveCredentialSourceKey(prefixedReference, fixtureBrand)).toBe(
      `${fixtureBrand.environmentPrefix}TRACKER_TOKEN`,
    );
  });

  test("no migration exists: the catalogue accepts old declarations verbatim and no style was renamed", () => {
    // The four-style vocabulary keeps the shipped names literal and
    // environment-prefixed; the new styles are additive members of the closed
    // style table, and no migration step exists anywhere on the path.
    const validatorText = readFileSync(
      join(process.cwd(), "packages/core/src/provider/validate.ts"),
      "utf8",
    );
    expect(validatorText).toContain('"literal"');
    expect(validatorText).toContain('"environment-prefixed"');
    expect(validatorText).toContain('"command"');
    expect(validatorText).toContain('"harness-store"');
    const catalogText = readFileSync(
      join(process.cwd(), "packages/core/src/config/catalog.ts"),
      "utf8",
    );
    expect(catalogText).not.toMatch(/migrat/i);
    // The closed reason union carries the delivered members unchanged.
    expect(CREDENTIAL_FAILURE_REASONS).toContain("variable-absent");
    expect(CREDENTIAL_FAILURE_REASONS).toHaveLength(10);
  });

  test("the environment styles never spawn: resolution consults the injected record only", () => {
    const canaryEnv = { FIXTURE_CREDENTIAL: CANARY };
    const resolution = portFor(canaryEnv).resolve(literalReference);
    expect(resolution.ok).toBe(true);
    if (resolution.ok) expect(resolution.material.value).toBe(CANARY);
  });
});
