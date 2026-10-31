/**
 * TC-PRIVACY-001..009, 020 — generic rules, suppression, hashed entries,
 * normalization, windows, vacuous class activation, live-tree green, and the
 * mutation controls that keep every assertion non-vacuous.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  normalizeLiteral,
  PRIVACY_CAPS,
  PRIVACY_FINGERPRINT_DOMAIN,
  PRIVACY_HASH_DOMAIN,
  PRIVACY_RULE_IDS,
  privacyDigestInput,
  privacyFingerprint,
} from "../../packages/adapters/src/io/privacy-rules.js";
import {
  CLOUD_TERM,
  CLOUD_TERM_ENTRY,
  type FixtureEntry,
  hashLiteral,
  PRIVATE_LITERAL,
  PRIVATE_LITERAL_ENTRY,
} from "../fixtures/privacy-literals/activation";
import {
  EXPECTED_ALLOWLIST,
  LIVE_REGISTRY_PATH,
  type RegistryLike,
} from "../fixtures/privacy-literals/registry";
import {
  FALSE_POSITIVE_CORPUS,
  MIXED_SUPPRESSION_LINE,
  MIXED_SUPPRESSION_POSITIVE,
  RULE_NEAR_MISSES,
  RULE_POSITIVES,
  SUPPRESSION_FIXTURES,
} from "../fixtures/privacy-literals/rules";
import {
  CHECK_PATH,
  createPrivacyRepo,
  makeMutantCheck,
  ROOT,
  readLiveRegistry,
  scan,
  snapshotTree,
} from "./privacy-support";

const buildRegistry = (
  entries: readonly FixtureEntry[],
  base: RegistryLike = readLiveRegistry(),
): RegistryLike => {
  const registry = structuredClone(base);
  for (const classId of ["private-literal", "cloud-term"] as const) {
    const classEntries = entries.filter((entry) => entry.class === classId);
    registry.classes[classId] = {
      emptyReason:
        classEntries.length === 0
          ? (base.classes[classId].emptyReason ?? `${classId} intentionally empty.`)
          : null,
      entries: classEntries.map((entry) => ({ ...entry })),
    };
  }
  return registry;
};

const withPositiveFile = (value: string, registry?: RegistryLike) =>
  createPrivacyRepo({ "scanned/planted.txt": `${value}\n` }, registry ? { registry } : {});

const fingerprintOf = (id: string): string => privacyFingerprint(id);

describe("TC-PRIVACY-001 seven generic rules fire on planted positives", () => {
  test("each rule fires exactly once on its own positive", () => {
    for (const positive of RULE_POSITIVES) {
      const repo = withPositiveFile(positive.value);
      try {
        const outcome = scan(repo.root);
        expect(outcome.failures, positive.id).toEqual([]);
        const matches = outcome.violations.filter(
          (violation) => violation.ruleOrEntryId === positive.id,
        );
        expect(matches.length, positive.id).toBe(1);
        const match = matches[0];
        expect(match?.file).toBe("scanned/planted.txt");
        expect(match?.line).toBe(1);
        expect(match?.fingerprint).toBe(fingerprintOf(positive.id));
        expect(
          outcome.violations.filter((violation) => violation.ruleOrEntryId !== positive.id),
        ).toEqual([]);
      } finally {
        repo.cleanup();
      }
    }
  });

  test("the multi-plant tree reports seven sorted unique violations", () => {
    const repo = withPositiveFile(RULE_POSITIVES.map((positive) => positive.value).join("\n"));
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toEqual([]);
      expect(outcome.violations.length).toBe(7);
      expect(new Set(outcome.violations.map((violation) => violation.ruleOrEntryId))).toEqual(
        new Set(PRIVACY_RULE_IDS),
      );
      const ordered = [...outcome.violations].sort(
        (left, right) =>
          left.file.localeCompare(right.file) ||
          left.line - right.line ||
          left.ruleOrEntryId.localeCompare(right.ruleOrEntryId),
      );
      expect(outcome.violations).toEqual(ordered);
    } finally {
      repo.cleanup();
    }
  });

  test("a detection-disabled mutant reports zero while the fixture still holds the value", async () => {
    const value = RULE_POSITIVES[4]?.value as string;
    const repo = withPositiveFile(value);
    const mutant = makeMutantCheck({
      moduleMutations: [{ name: "matchGenericRules", body: "return [];" }],
    });
    try {
      expect(scan(repo.root).violations.length).toBeGreaterThan(0);
      expect(readFileSync(join(repo.root, "scanned/planted.txt"), "utf8")).toContain(value);
      const mutantCheck = await mutant.importCheck();
      expect(mutantCheck.runPrivacyScan(repo.root).violations).toEqual([]);
    } finally {
      mutant.cleanup();
      repo.cleanup();
    }
  });
});

describe("TC-PRIVACY-002 near-miss negatives and the false-positive corpus", () => {
  test("every rule has a near-miss sharing its discriminating shape and none fires", () => {
    for (const nearMiss of RULE_NEAR_MISSES) {
      expect(nearMiss.value.length).toBeGreaterThan(0);
      expect(nearMiss.value).toContain(nearMiss.shares);
      const repo = withPositiveFile(nearMiss.value);
      try {
        const outcome = scan(repo.root);
        expect(
          outcome.violations.filter((violation) => violation.ruleOrEntryId === nearMiss.id),
          nearMiss.id,
        ).toEqual([]);
      } finally {
        repo.cleanup();
      }
    }
  });

  test("the committed false-positive corpus is silent", () => {
    const files: Record<string, string> = {};
    for (const entry of FALSE_POSITIVE_CORPUS)
      files[`scanned/corpus/${entry.path}`] = entry.content;
    const repo = createPrivacyRepo(files);
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toEqual([]);
      expect(outcome.violations).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  test("extending a near-miss past the threshold fires the rule", () => {
    const extended = `ghp_${"ZQ7XK9M2P4R6T8V0W1Y3A5B7"}`;
    const repo = withPositiveFile(extended);
    try {
      expect(
        scan(repo.root).violations.some(
          (violation) => violation.ruleOrEntryId === "secret.provider-token-prefix",
        ),
      ).toBe(true);
    } finally {
      repo.cleanup();
    }
  });

  test("an over-broad threshold-removal mutant accepts the near-miss", async () => {
    const nearMiss = RULE_NEAR_MISSES[0]?.value as string;
    const repo = withPositiveFile(nearMiss);
    const mutant = makeMutantCheck({
      moduleReplacements: [
        {
          search: "[A-Za-z0-9_-]{16,}",
          replacement: "[A-Za-z0-9_-]{1,}",
        },
        {
          search: "if (matchedText.length < rule.minimumMatchLength) continue;",
          replacement: "",
        },
      ],
      moduleMutations: [],
    });
    try {
      expect(
        scan(repo.root).violations.some(
          (violation) => violation.ruleOrEntryId === "secret.provider-token-prefix",
        ),
      ).toBe(false);
      const mutantCheck = await mutant.importCheck();
      expect(
        mutantCheck
          .runPrivacyScan(repo.root)
          .violations.some(
            (violation) => violation.ruleOrEntryId === "secret.provider-token-prefix",
          ),
      ).toBe(true);
    } finally {
      mutant.cleanup();
      repo.cleanup();
    }
  });
});

describe("TC-PRIVACY-003 placeholder suppression is narrow and non-vacuous", () => {
  test("every suppression class has a silent fixture", () => {
    for (const [id, value] of Object.entries(SUPPRESSION_FIXTURES)) {
      const repo = withPositiveFile(value);
      try {
        const outcome = scan(repo.root);
        expect(outcome.violations, id).toEqual([]);
      } finally {
        repo.cleanup();
      }
    }
  });

  test("a placeholder and an adjacent positive on the same line suppress only the placeholder", () => {
    const repo = withPositiveFile(MIXED_SUPPRESSION_LINE);
    try {
      const outcome = scan(repo.root);
      expect(MIXED_SUPPRESSION_POSITIVE.length).toBeGreaterThan(0);
      expect(outcome.violations.length).toBe(1);
      expect(outcome.violations[0]?.ruleOrEntryId).toBe("secret.credential-assignment");
      expect(outcome.violations[0]?.line).toBe(1);
    } finally {
      repo.cleanup();
    }
  });

  test("a suppression-disabled mutant fires on the placeholder", async () => {
    const repo = withPositiveFile(SUPPRESSION_FIXTURES.placeholder);
    const mutant = makeMutantCheck({
      moduleMutations: [{ name: "suppressionClassFor", body: "return null;" }],
    });
    try {
      expect(scan(repo.root).violations).toEqual([]);
      const mutantCheck = await mutant.importCheck();
      expect(mutantCheck.runPrivacyScan(repo.root).violations.length).toBeGreaterThan(0);
    } finally {
      mutant.cleanup();
      repo.cleanup();
    }
  });
});

describe("TC-PRIVACY-004 hashed private-literal entry detects and clears", () => {
  test("the synthetic entry detects its literal and clears when the literal is removed", () => {
    const registry = buildRegistry([PRIVATE_LITERAL_ENTRY]);
    const repo = withPositiveFile(PRIVATE_LITERAL, registry);
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toEqual([]);
      const violations = outcome.violations.filter(
        (violation) => violation.ruleOrEntryId === PRIVATE_LITERAL_ENTRY.id,
      );
      expect(violations.length).toBe(1);
      expect(violations[0]?.fingerprint).toBe(fingerprintOf(PRIVATE_LITERAL_ENTRY.id));
      expect(violations[0]?.fingerprint).not.toBe(PRIVATE_LITERAL_ENTRY.hash);
      expect(violations[0]?.fingerprint).not.toContain(privacyDigestInput(PRIVATE_LITERAL));
      repo.write("scanned/planted.txt", "clean content\n");
      expect(scan(repo.root).violations).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  test("removing the entry clears the same literal; re-adding under a new id reports the new id", () => {
    const repo = withPositiveFile(PRIVATE_LITERAL, buildRegistry([PRIVATE_LITERAL_ENTRY]));
    try {
      repo.writeRegistry(readLiveRegistry());
      expect(scan(repo.root).violations).toEqual([]);
      const renamed: FixtureEntry = { ...PRIVATE_LITERAL_ENTRY, id: "renamed-private-entry" };
      repo.writeRegistry(buildRegistry([renamed]));
      expect(scan(repo.root).violations.map((violation) => violation.ruleOrEntryId)).toEqual([
        "renamed-private-entry",
      ]);
    } finally {
      repo.cleanup();
    }
  });

  test("a hashed-detection-disabled mutant reports zero on the planted tree", async () => {
    const repo = withPositiveFile(PRIVATE_LITERAL, buildRegistry([PRIVATE_LITERAL_ENTRY]));
    const mutant = makeMutantCheck({
      moduleMutations: [{ name: "findWindowMatches", body: "return [];" }],
    });
    try {
      expect(scan(repo.root).violations.length).toBe(1);
      const mutantCheck = await mutant.importCheck();
      expect(mutantCheck.runPrivacyScan(repo.root).violations).toEqual([]);
    } finally {
      mutant.cleanup();
      repo.cleanup();
    }
  });
});

describe("TC-PRIVACY-005 authoring-produced entry is data-only", () => {
  test("an authored entry detects its literal with no code change", () => {
    const literal = "authoreddataonlyzq7x9m2p4r6t8v0";
    const checkDigest = createHash("sha256")
      .update(readFileSync(join(ROOT, CHECK_PATH)))
      .digest("hex");
    const moduleDigest = createHash("sha256")
      .update(readFileSync(join(ROOT, "packages/adapters/src/io/privacy-rules.ts")))
      .digest("hex");
    const authored = spawnSync("bun", ["run", join(ROOT, CHECK_PATH), "--author"], {
      cwd: ROOT,
      encoding: "utf8",
      input: `${literal}\n`,
      env: { ...process.env, CI: "", GITHUB_ACTIONS: "" },
    });
    expect(authored.status).toBe(0);
    const record = JSON.parse(authored.stdout) as FixtureEntry;
    expect(record.hash).toBe(hashLiteral(literal));
    expect(record.length).toBe(normalizeLiteral(literal).length);
    const repo = withPositiveFile(literal, buildRegistry([record]));
    try {
      expect(scan(repo.root).violations.map((violation) => violation.ruleOrEntryId)).toEqual([
        record.id,
      ]);
    } finally {
      repo.cleanup();
    }
    expect(
      createHash("sha256")
        .update(readFileSync(join(ROOT, CHECK_PATH)))
        .digest("hex"),
    ).toBe(checkDigest);
    expect(
      createHash("sha256")
        .update(readFileSync(join(ROOT, "packages/adapters/src/io/privacy-rules.ts")))
        .digest("hex"),
    ).toBe(moduleDigest);
    const specifiers = [
      ...readFileSync(join(ROOT, CHECK_PATH), "utf8").matchAll(/from\s+"([^"]+)"/g),
    ].map((match) => match[1]);
    expect(specifiers.some((specifier) => specifier?.includes("dist/"))).toBe(false);
    expect(specifiers.some((specifier) => specifier?.startsWith("@delivery-os/"))).toBe(false);
    expect(
      specifiers.some((specifier) => specifier?.includes("privacy-literals.registry.json")),
    ).toBe(false);
  });

  test("the guard runs from a temp clone of HEAD and detects the same literal", () => {
    const literal = "cloneauthoringzq7x9m2p4r6t8v0";
    const entry = {
      ...PRIVATE_LITERAL_ENTRY,
      id: "clone-entry",
      hash: hashLiteral(literal),
      length: normalizeLiteral(literal).length,
    };
    const repo = withPositiveFile(literal, buildRegistry([entry]));
    const cloneRoot = mkdtempSync(join(tmpdir(), "privacy-clone-"));
    try {
      execFileSync("git", ["clone", "--no-hardlinks", "--quiet", ROOT, join(cloneRoot, "repo")]);
      const result = spawnSync("bun", ["run", join(cloneRoot, "repo", CHECK_PATH)], {
        cwd: repo.root,
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("clone-entry");
    } finally {
      rmSync(cloneRoot, { recursive: true, force: true });
      repo.cleanup();
    }
  });

  test("re-authoring yields the same digest and a new id still detects", () => {
    const literal = "reauthoringzq7x9m2p4r6t8v0";
    const first = hashLiteral(literal);
    const second = hashLiteral(literal);
    expect(first).toBe(second);
    const repo = withPositiveFile(
      literal,
      buildRegistry([
        {
          ...PRIVATE_LITERAL_ENTRY,
          id: "reason-only-change",
          hash: first,
          length: normalizeLiteral(literal).length,
          reason: "different reason",
        },
      ]),
    );
    try {
      expect(scan(repo.root).violations.map((violation) => violation.ruleOrEntryId)).toEqual([
        "reason-only-change",
      ]);
    } finally {
      repo.cleanup();
    }
  });
});

describe("TC-PRIVACY-006 normalization and case/whitespace variants", () => {
  const registry = buildRegistry([PRIVATE_LITERAL_ENTRY]);
  const variants: Array<[string, string]> = [
    ["exact", PRIVATE_LITERAL],
    ["uppercase", PRIVATE_LITERAL.toUpperCase()],
    ["spaces", `  ${PRIVATE_LITERAL}  `],
    ["tab", `\t${PRIVATE_LITERAL}\t`],
    ["newlines", `\n${PRIVATE_LITERAL}\n`],
  ];

  test("matching variants are detected with the same fingerprint", () => {
    for (const [label, value] of variants) {
      const repo = withPositiveFile(value, registry);
      try {
        const outcome = scan(repo.root);
        const violations = outcome.violations.filter(
          (violation) => violation.ruleOrEntryId === PRIVATE_LITERAL_ENTRY.id,
        );
        expect(violations.length, label).toBe(1);
        expect(violations[0]?.fingerprint, label).toBe(fingerprintOf(PRIVATE_LITERAL_ENTRY.id));
      } finally {
        repo.cleanup();
      }
    }
  });

  test("non-matching variants stay silent", () => {
    const nonMatching = [
      `${PRIVATE_LITERAL.slice(0, 10)} ${PRIVATE_LITERAL.slice(10)}`,
      `${PRIVATE_LITERAL.slice(0, 10)}\n${PRIVATE_LITERAL.slice(10)}`,
      `${PRIVATE_LITERAL.slice(0, 10)}x${PRIVATE_LITERAL.slice(11)}`,
      PRIVATE_LITERAL.slice(0, -1),
    ];
    for (const value of nonMatching) {
      expect(value.length).toBeGreaterThan(0);
      const repo = withPositiveFile(value, registry);
      try {
        expect(
          scan(repo.root).violations.filter(
            (violation) => violation.ruleOrEntryId === PRIVATE_LITERAL_ENTRY.id,
          ),
        ).toEqual([]);
      } finally {
        repo.cleanup();
      }
    }
  });

  test("two runs produce the identical violation set and bytes", () => {
    const repo = withPositiveFile(PRIVATE_LITERAL.toUpperCase(), registry);
    try {
      const first = scan(repo.root);
      const second = scan(repo.root);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    } finally {
      repo.cleanup();
    }
  });

  test("normalization is single-sourced", () => {
    expect(privacyDigestInput(PRIVATE_LITERAL)).toBe(
      `${PRIVACY_HASH_DOMAIN}:${normalizeLiteral(PRIVATE_LITERAL)}`,
    );
    expect(PRIVATE_LITERAL_ENTRY.length).toBe(normalizeLiteral(PRIVATE_LITERAL).length);
    expect(PRIVACY_FINGERPRINT_DOMAIN).not.toBe(PRIVACY_HASH_DOMAIN);
  });

  test("a case-fold-disabled mutant misses the uppercase variant", async () => {
    const repo = withPositiveFile(PRIVATE_LITERAL.toUpperCase(), registry);
    const mutant = makeMutantCheck({
      moduleMutations: [{ name: "normalizeLiteral", body: "return literal.trim();" }],
    });
    try {
      expect(scan(repo.root).violations.length).toBe(1);
      const mutantCheck = await mutant.importCheck();
      expect(
        mutantCheck
          .runPrivacyScan(repo.root)
          .violations.filter((violation) => violation.ruleOrEntryId === PRIVATE_LITERAL_ENTRY.id),
      ).toEqual([]);
    } finally {
      mutant.cleanup();
      repo.cleanup();
    }
  });
});

describe("TC-PRIVACY-007 window boundaries and the distinct-length matrix", () => {
  const valueFor = (length: number): string => {
    const unit = "zq7x9m2p4r6t8v0";
    return unit.repeat(Math.ceil(length / unit.length)).slice(0, length);
  };

  test("each placement detects at the correct line exactly once", () => {
    for (const length of [4, 5, 7, 16, 64, 512]) {
      const value = valueFor(length);
      const entry: FixtureEntry = {
        ...PRIVATE_LITERAL_ENTRY,
        id: `length-${length}`,
        hash: hashLiteral(value),
        length,
      };
      const registry = buildRegistry([entry]);
      const placements: Array<[string, string, number]> = [
        ["start", value, 1],
        ["end", `prefix ${value}`, 1],
        ["after-newline", `first\n${value}`, 2],
        ["punctuation", `(${value})`, 1],
        ["longer-run", `AAAA${value}BBBB`, 1],
      ];
      for (const [label, content, line] of placements) {
        const repo = createPrivacyRepo({ "scanned/placed.txt": content }, { registry });
        try {
          const violations = scan(repo.root).violations.filter(
            (violation) => violation.ruleOrEntryId === entry.id,
          );
          expect(violations.length, `${length}/${label}`).toBe(1);
          expect(violations[0]?.line, `${length}/${label}`).toBe(line);
        } finally {
          repo.cleanup();
        }
      }
    }
  });

  test("overlapping lengths report the matching entries", () => {
    const short = valueFor(4);
    const long = valueFor(7);
    const registry = buildRegistry([
      { ...PRIVATE_LITERAL_ENTRY, id: "entry-4", hash: hashLiteral(short), length: 4 },
      { ...PRIVATE_LITERAL_ENTRY, id: "entry-7", hash: hashLiteral(long), length: 7 },
    ]);
    const repo = createPrivacyRepo({ "scanned/overlap.txt": long }, { registry });
    try {
      const ids = new Set(scan(repo.root).violations.map((violation) => violation.ruleOrEntryId));
      expect(ids.has("entry-4")).toBe(true);
      expect(ids.has("entry-7")).toBe(true);
    } finally {
      repo.cleanup();
    }
  });

  test("a short file and a wrong-length occurrence stay silent", () => {
    const registry = buildRegistry([
      { ...PRIVATE_LITERAL_ENTRY, id: "entry-16", hash: hashLiteral(valueFor(16)), length: 16 },
    ]);
    const repo = createPrivacyRepo(
      { "scanned/short.txt": "abc\n", "scanned/three.txt": valueFor(4).slice(0, 3) },
      { registry },
    );
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toEqual([]);
      expect(outcome.violations).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  test("the distinct-length set is exactly derived and bounded", () => {
    const lengths = [4, 5, 7, 16, 64, 512];
    const entries = lengths.map((length) => ({
      ...PRIVATE_LITERAL_ENTRY,
      id: `derived-${length}`,
      hash: hashLiteral(valueFor(length)),
      length,
    }));
    const registry = buildRegistry(entries);
    const repo = createPrivacyRepo({ "scanned/clean.txt": "clean\n" }, { registry });
    try {
      const outcome = scan(repo.root);
      expect(outcome.summary?.distinctLengths).toBe(lengths.length);
      expect(outcome.summary?.distinctLengths).toBeLessThanOrEqual(PRIVACY_CAPS.maxDistinctLengths);
    } finally {
      repo.cleanup();
    }
  });

  test("a changed interior character does not match", () => {
    const value = valueFor(16);
    const changed = `${value.slice(0, 8)}X${value.slice(9)}`;
    const registry = buildRegistry([
      { ...PRIVATE_LITERAL_ENTRY, id: "entry-interior", hash: hashLiteral(value), length: 16 },
    ]);
    const repo = createPrivacyRepo({ "scanned/changed.txt": changed }, { registry });
    try {
      expect(scan(repo.root).violations).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });
});

describe("TC-PRIVACY-008 production cloud-term class is explicitly vacuous", () => {
  test("the delivered class is empty with a reason and the live scan reports it", () => {
    const live = readLiveRegistry();
    expect(live.classes["cloud-term"].entries).toEqual([]);
    expect((live.classes["cloud-term"].emptyReason ?? "").length).toBeGreaterThan(0);
    const outcome = scan(ROOT);
    expect(outcome.failures).toEqual([]);
    expect(outcome.summary?.entriesByClass["cloud-term"]).toBe(0);
    const vacuous = outcome.summary?.vacuousClasses.find((entry) => entry.class === "cloud-term");
    expect(vacuous?.reason).toBe(live.classes["cloud-term"].emptyReason as string);
  });

  test("an empty class without a reason fails validation", () => {
    const registry = structuredClone(readLiveRegistry());
    registry.classes["cloud-term"].emptyReason = " ";
    const repo = createPrivacyRepo({}, { registry });
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toEqual([
        "class cloud-term: empty class requires a non-empty emptyReason (RV-09)",
      ]);
      expect(outcome.summary).toBeNull();
    } finally {
      repo.cleanup();
    }
  });
});

describe("TC-PRIVACY-009 synthetic cloud-term activation and removal", () => {
  test("activation and removal flip the class summary with data only", () => {
    const activated = buildRegistry([CLOUD_TERM_ENTRY]);
    const repo = withPositiveFile(CLOUD_TERM, activated);
    try {
      const outcome = scan(repo.root);
      expect(outcome.violations.map((violation) => violation.ruleOrEntryId)).toEqual([
        CLOUD_TERM_ENTRY.id,
      ]);
      expect(outcome.summary?.entriesByClass["cloud-term"]).toBe(1);
      expect(outcome.summary?.vacuousClasses.some((entry) => entry.class === "cloud-term")).toBe(
        false,
      );
      repo.writeRegistry(buildRegistry([]));
      const removed = scan(repo.root);
      expect(removed.violations).toEqual([]);
      expect(removed.summary?.entriesByClass["cloud-term"]).toBe(0);
      expect(removed.summary?.vacuousClasses.some((entry) => entry.class === "cloud-term")).toBe(
        true,
      );
    } finally {
      repo.cleanup();
    }
  });

  test("the synthetic term exists only inside the allowlisted fixture root", () => {
    const files = execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { cwd: ROOT, encoding: "utf8" },
    )
      .split("\0")
      .filter((file) => file.length > 0);
    const occurrences = files.filter((file) =>
      readFileSync(join(ROOT, file), "utf8").includes(CLOUD_TERM),
    );
    expect(occurrences.length).toBeGreaterThan(0);
    for (const occurrence of occurrences) {
      expect(occurrence.startsWith("tests/fixtures/privacy-literals/")).toBe(true);
    }
  });

  test("a hashed-detection-disabled mutant reports zero on the activated tree", async () => {
    const repo = withPositiveFile(CLOUD_TERM, buildRegistry([CLOUD_TERM_ENTRY]));
    const mutant = makeMutantCheck({
      moduleMutations: [{ name: "findWindowMatches", body: "return [];" }],
    });
    try {
      expect(scan(repo.root).violations.length).toBe(1);
      const mutantCheck = await mutant.importCheck();
      expect(mutantCheck.runPrivacyScan(repo.root).violations).toEqual([]);
    } finally {
      mutant.cleanup();
      repo.cleanup();
    }
  });
});

describe("TC-PRIVACY-020 live-tree green and non-vacuous scope reporting", () => {
  test("the live tree is green with a non-vacuous summary", () => {
    const live = readLiveRegistry();
    const before = snapshotTree(ROOT);
    const statusBefore = execFileSync("git", ["status", "--porcelain"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const outcome = scan(ROOT);
    expect(outcome.failures).toEqual([]);
    expect(outcome.violations).toEqual([]);
    expect(outcome.summary?.scannedFiles).toBeGreaterThan(0);
    expect(outcome.summary?.enabledRules).toBe(7);
    expect(outcome.summary?.entriesByClass).toEqual({
      "private-literal": live.classes["private-literal"].entries.length,
      "cloud-term": live.classes["cloud-term"].entries.length,
    });
    const distinct = new Set(
      Object.values(live.classes).flatMap((classEntry) =>
        classEntry.entries.map((entry) => entry.length),
      ),
    );
    expect(outcome.summary?.distinctLengths).toBe(distinct.size);
    const statusAfter = execFileSync("git", ["status", "--porcelain"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(statusAfter).toBe(statusBefore);
    expect(snapshotTree(ROOT)).toEqual(before);
  });

  test("the guard surfaces are allowlisted and docs are not", () => {
    const live = readLiveRegistry();
    const paths = live.allowlist.map((entry) => entry.path);
    for (const expected of EXPECTED_ALLOWLIST) expect(paths).toContain(expected.path);
    expect(paths.some((path) => path.startsWith("doc/spec/"))).toBe(false);
    expect(paths.some((path) => path.startsWith("doc/guides/"))).toBe(false);
    expect(
      paths.some(
        (path) =>
          path.startsWith("doc/changes/2026-10/2026-10-31--GH-184--privacy-and-no-cloud-guards/") &&
          !path.includes("/readiness-review/"),
      ),
    ).toBe(false);
    expect(paths).toContain("tests/fixtures/privacy-literals");
    expect(live.allowlist.filter((entry) => entry.kind === "directory")).toHaveLength(1);
  });

  test("a planted copy makes the same scan fire", () => {
    const value = RULE_POSITIVES[4]?.value as string;
    const repo = withPositiveFile(value);
    try {
      expect(scan(repo.root).violations.length).toBeGreaterThan(0);
    } finally {
      repo.cleanup();
    }
  });

  test("the live result is not vacuous because the registry path is read at runtime", () => {
    const source = readFileSync(join(ROOT, CHECK_PATH), "utf8");
    expect(source).toContain(LIVE_REGISTRY_PATH);
    expect(source).not.toContain(`import ${JSON.stringify(LIVE_REGISTRY_PATH)}`);
    expect(pathToFileURL(join(ROOT, CHECK_PATH)).href).toContain("privacy-literals.ts");
  });
});
