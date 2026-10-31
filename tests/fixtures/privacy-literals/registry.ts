/**
 * Registry mutation fixtures for the RV-01..RV-30 fail-closed matrix and the
 * phase-tracked allowlist exact-set assertion. Mutations are applied to temp
 * copies only; the live registry is read-only.
 */

export const LIVE_REGISTRY_PATH = "scripts/checks/privacy-literals.registry.json";

export type EntryLike = {
  id: string;
  class: string;
  algorithm: string;
  hash: string;
  length: number;
  reason: string;
};

export type AllowlistLike = {
  id: string;
  kind: "file" | "directory";
  path: string;
  rules: string[];
  reason: string;
};

export type RegistryLike = {
  schemaVersion: string;
  scopeMode: string;
  enabledRuleIds: string[];
  classes: Record<string, { emptyReason: string | null; entries: EntryLike[] }>;
  allowlist: AllowlistLike[];
  exclusions: AllowlistLike[];
};

export type ExpectedAllowlist = {
  readonly id: string;
  readonly kind: "file" | "directory";
  readonly path: string;
  readonly rules: readonly string[];
};

/**
 * The Phase-4 current allowlist set. Extended (never relaxed) by tasks 5.2,
 * 6.5, and 7.2 in the same commit as each new entry.
 */
export const EXPECTED_ALLOWLIST: readonly ExpectedAllowlist[] = [
  {
    id: "privacy-rule-module",
    kind: "file",
    path: "packages/adapters/src/io/privacy-rules.ts",
    rules: ["*"],
  },
  {
    id: "privacy-registry",
    kind: "file",
    path: "scripts/checks/privacy-literals.registry.json",
    rules: ["*"],
  },
  {
    id: "privacy-imports-test",
    kind: "file",
    path: "tests/structure/privacy-imports.test.ts",
    rules: ["*"],
  },
  {
    id: "privacy-check",
    kind: "file",
    path: "scripts/checks/privacy-literals.ts",
    rules: ["*"],
  },
  {
    id: "sanitization-canary-fixture",
    kind: "file",
    path: "tests/fixtures/providers/sanitization/cases.ts",
    rules: [
      "secret.provider-token-prefix",
      "secret.private-key-block",
      "secret.credential-assignment",
    ],
  },
  {
    id: "gh-32-red-team-v3",
    kind: "file",
    path: "doc/changes/2026-03/2026-03-10--GH-32--bootstrap-onboarding-consistency/feedback/red-team-report-v3.md",
    rules: ["private.absolute-user-path"],
  },
  {
    id: "gh-32-red-team-v4",
    kind: "file",
    path: "doc/changes/2026-03/2026-03-10--GH-32--bootstrap-onboarding-consistency/feedback/red-team-report-v4.md",
    rules: ["private.absolute-user-path"],
  },
  {
    id: "gh-124-plan",
    kind: "file",
    path: "doc/changes/2026-07/2026-07-03--GH-124--batch-delivery-infrastructure/chg-GH-124-plan.md",
    rules: ["private.absolute-user-path"],
  },
  {
    id: "gh-184-readiness-iteration-1",
    kind: "file",
    path: "doc/changes/2026-10/2026-10-31--GH-184--privacy-and-no-cloud-guards/readiness-review/readiness-iter-1.md",
    rules: ["private.absolute-user-path"],
  },
  {
    id: "privacy-fixture-root",
    kind: "directory",
    path: "tests/fixtures/privacy-literals",
    rules: ["*"],
  },
  {
    id: "privacy-literals-suite",
    kind: "file",
    path: "tests/checks/privacy-literals.test.ts",
    rules: ["*"],
  },
  {
    id: "privacy-registry-suite",
    kind: "file",
    path: "tests/checks/privacy-registry.test.ts",
    rules: ["*"],
  },
  {
    id: "privacy-scope-suite",
    kind: "file",
    path: "tests/checks/privacy-scope.test.ts",
    rules: ["*"],
  },
  {
    id: "privacy-reporting-suite",
    kind: "file",
    path: "tests/checks/privacy-reporting.test.ts",
    rules: ["*"],
  },
  {
    id: "privacy-authoring-suite",
    kind: "file",
    path: "tests/checks/privacy-authoring.test.ts",
    rules: ["*"],
  },
  {
    id: "privacy-performance-suite",
    kind: "file",
    path: "tests/checks/privacy-performance.test.ts",
    rules: ["*"],
  },
  {
    id: "privacy-ci-wiring-suite",
    kind: "file",
    path: "tests/checks/privacy-ci-wiring.test.ts",
    rules: ["*"],
  },
  {
    id: "envelope-content-policy-suite",
    kind: "file",
    path: "tests/behaviour/envelope-content-policy.test.ts",
    rules: ["*"],
  },
  {
    id: "privacy-release-suite",
    kind: "file",
    path: "tests/checks/privacy-release.test.ts",
    rules: ["*"],
  },
];

export const fixtureEntry = (index: number, className: string, length = 8): EntryLike => ({
  id: `fixture-entry-${index}`,
  class: className,
  algorithm: "sha256",
  hash: index.toString(16).padStart(64, "0"),
  length,
  reason: "Synthetic registry fixture entry.",
});

const withEntries = (
  base: RegistryLike,
  privateEntries: EntryLike[],
  cloudEntries: EntryLike[],
) => ({
  ...base,
  classes: {
    "private-literal": {
      emptyReason: privateEntries.length === 0 ? base.classes["private-literal"].emptyReason : null,
      entries: privateEntries,
    },
    "cloud-term": {
      emptyReason: cloudEntries.length === 0 ? base.classes["cloud-term"].emptyReason : null,
      entries: cloudEntries,
    },
  },
});

/** Produce the named RV mutation of a valid registry. */
export const mutateRegistry = (base: RegistryLike, rv: string): RegistryLike => {
  const registry: RegistryLike = structuredClone(base);
  switch (rv) {
    case "RV-01":
      delete (registry as unknown as Record<string, unknown>).schemaVersion;
      return registry;
    case "RV-02":
      registry.schemaVersion = "privacy.registry.v2";
      return registry;
    case "RV-03":
      registry.scopeMode = "history";
      return registry;
    case "RV-04":
      registry.scopeMode = "explicit";
      return registry;
    case "RV-05":
      registry.enabledRuleIds = registry.enabledRuleIds.slice(0, 6);
      return registry;
    case "RV-06":
      registry.enabledRuleIds = [...registry.enabledRuleIds, "secret.unknown-rule"];
      return registry;
    case "RV-07":
      registry.classes["unknown-class"] = { emptyReason: null, entries: [] };
      return registry;
    case "RV-08":
      delete registry.classes["cloud-term"];
      return registry;
    case "RV-09":
      registry.classes["cloud-term"].emptyReason = " ";
      return registry;
    case "RV-10":
      registry.enabledRuleIds = [...registry.enabledRuleIds, registry.enabledRuleIds[0] as string];
      return registry;
    case "RV-11": {
      const mutated = withEntries(
        registry,
        [fixtureEntry(1, "private-literal")],
        registry.classes["cloud-term"].entries,
      );
      mutated.classes["private-literal"].entries = [42 as unknown as EntryLike];
      return mutated;
    }
    case "RV-12": {
      const first = fixtureEntry(1, "private-literal");
      const second = { ...fixtureEntry(2, "private-literal"), id: first.id, hash: "b".repeat(64) };
      return withEntries(registry, [first, second], []);
    }
    case "RV-13": {
      const first = fixtureEntry(1, "private-literal");
      const second = {
        ...fixtureEntry(2, "private-literal"),
        hash: first.hash,
        length: first.length,
      };
      return withEntries(registry, [first, second], []);
    }
    case "RV-14": {
      const first = fixtureEntry(1, "private-literal");
      const second = {
        ...fixtureEntry(2, "private-literal"),
        hash: first.hash,
        length: first.length + 1,
      };
      return withEntries(registry, [first, second], []);
    }
    case "RV-15": {
      const entry = fixtureEntry(1, "private-literal");
      return withEntries(registry, [{ ...entry, algorithm: "sha1" }], []);
    }
    case "RV-16": {
      const entry = fixtureEntry(1, "private-literal");
      return withEntries(registry, [{ ...entry, hash: "not-a-digest" }], []);
    }
    case "RV-17": {
      const entry = fixtureEntry(1, "private-literal");
      return withEntries(registry, [{ ...entry, length: "8" as unknown as number }], []);
    }
    case "RV-18": {
      const entry = fixtureEntry(1, "private-literal");
      return withEntries(registry, [{ ...entry, length: 3 }], []);
    }
    case "RV-19": {
      const entry = fixtureEntry(1, "private-literal");
      return withEntries(registry, [{ ...entry, reason: "" }], []);
    }
    case "RV-20": {
      const entry = fixtureEntry(1, "private-literal");
      return withEntries(registry, [{ ...entry, id: "   " }], []);
    }
    case "RV-21":
      registry.allowlist.push({
        id: "ghost-allowlist",
        kind: "file",
        path: "no/such/file.txt",
        rules: ["*"],
        reason: "Synthetic ghost allowlist entry.",
      });
      return registry;
    case "RV-22": {
      const first = registry.allowlist[0] as AllowlistLike;
      registry.allowlist.push({ ...first, id: "duplicate-path-allowlist" });
      return registry;
    }
    case "RV-23": {
      const first = registry.allowlist[0] as AllowlistLike;
      first.reason = "";
      return registry;
    }
    case "RV-24": {
      const first = registry.exclusions[0] as AllowlistLike;
      registry.exclusions.push({ ...first, id: "duplicate-exclusion" });
      return registry;
    }
    case "RV-25": {
      const first = registry.exclusions[0] as AllowlistLike;
      first.reason = "";
      return registry;
    }
    case "RV-26": {
      const first = registry.allowlist[0] as AllowlistLike;
      first.path = "tests/*";
      return registry;
    }
    case "RV-27": {
      const privateEntries = Array.from({ length: 129 }, (_, index) =>
        fixtureEntry(index, "private-literal"),
      );
      const cloudEntries = Array.from({ length: 128 }, (_, index) =>
        fixtureEntry(index + 129, "cloud-term"),
      );
      return withEntries(registry, privateEntries, cloudEntries);
    }
    case "RV-28": {
      const privateEntries = Array.from({ length: 129 }, (_, index) =>
        fixtureEntry(index, "private-literal"),
      );
      return withEntries(registry, privateEntries, []);
    }
    case "RV-29": {
      const privateEntries = Array.from({ length: 17 }, (_, index) =>
        fixtureEntry(index, "private-literal", 4 + index),
      );
      const cloudEntries = Array.from({ length: 16 }, (_, index) =>
        fixtureEntry(index + 17, "cloud-term", 21 + index),
      );
      return withEntries(registry, privateEntries, cloudEntries);
    }
    default:
      throw new Error(`unknown RV mutation: ${rv}`);
  }
};

/** A registry at every accepted NFR-9 boundary. */
export const boundaryRegistry = (base: RegistryLike): RegistryLike => {
  const privateEntries = Array.from({ length: 128 }, (_, index) =>
    fixtureEntry(index, "private-literal", 4 + (index % 16)),
  );
  const cloudEntries = Array.from({ length: 128 }, (_, index) =>
    fixtureEntry(index + 128, "cloud-term", 20 + (index % 16)),
  );
  return withEntries(base, privateEntries, cloudEntries);
};

/** A registry file exactly at the 256 KiB cap. */
export const exactSizeRegistryJson = (base: RegistryLike): string => {
  const target = 262144;
  const registry = structuredClone(base);
  const baseJson = `${JSON.stringify(registry, null, 2)}\n`;
  const padding = target - baseJson.length;
  if (padding < 0) throw new Error("base registry is already over the size cap");
  const current = registry.classes["cloud-term"].emptyReason?.length ?? 0;
  registry.classes["cloud-term"].emptyReason = "x".repeat(current + padding);
  return `${JSON.stringify(registry, null, 2)}\n`;
};

/** A registry file one byte over the 256 KiB cap. */
export const oversizeRegistryJson = (base: RegistryLike): string => {
  const target = 262144;
  const registry = structuredClone(base);
  const baseJson = `${JSON.stringify(registry, null, 2)}\n`;
  const padding = target - baseJson.length + 2;
  const current = registry.classes["cloud-term"].emptyReason?.length ?? 0;
  registry.classes["cloud-term"].emptyReason = "x".repeat(current + padding);
  return `${JSON.stringify(registry, null, 2)}\n`;
};
