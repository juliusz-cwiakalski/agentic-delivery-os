/**
 * TC-PRIVACY-015..017 — determinism/read-only/no-network, content-free
 * reporting in both modes with an echo mutant, and the identifier-only
 * fingerprint.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRIVACY_RULE_IDS,
  privacyDigestInput,
  privacyFingerprint,
} from "../../packages/adapters/src/io/privacy-rules.js";
import {
  CLOUD_TERM,
  CLOUD_TERM_ENTRY,
  PRIVATE_LITERAL,
  PRIVATE_LITERAL_ENTRY,
} from "../fixtures/privacy-literals/activation";
import type { RegistryLike } from "../fixtures/privacy-literals/registry";
import { RULE_POSITIVES } from "../fixtures/privacy-literals/rules";
import {
  candidateWindows,
  collectStrings,
  createPrivacyRepo,
  gitStatus,
  makeMutantCheck,
  ROOT,
  readLiveRegistry,
  runCheck,
  scan,
  snapshotTree,
} from "./privacy-support";

const genericValue = RULE_POSITIVES[4]?.value as string;

const withThreeViolations = (): { repo: ReturnType<typeof createPrivacyRepo>; body: string } => {
  const base = readLiveRegistry();
  const registry: RegistryLike = structuredClone(base);
  registry.classes["private-literal"] = {
    emptyReason: null,
    entries: [{ ...PRIVATE_LITERAL_ENTRY }],
  };
  registry.classes["cloud-term"] = { emptyReason: null, entries: [{ ...CLOUD_TERM_ENTRY }] };
  const body = `${genericValue}\n${PRIVATE_LITERAL}\n${CLOUD_TERM}\n`;
  const repo = createPrivacyRepo({ "scanned/planted.txt": body }, { registry });
  return { repo, body };
};

describe("TC-PRIVACY-015 determinism, read-only, and no-network", () => {
  test("two runs in each mode are byte-identical and write nothing", () => {
    const { repo } = withThreeViolations();
    try {
      const before = snapshotTree(repo.root);
      const statusBefore = gitStatus(repo.root);
      for (const args of [[], ["--json"]]) {
        const first = runCheck(repo.root, args);
        const second = runCheck(repo.root, args);
        expect(first.status).toBe(1);
        expect(first.stdout).toBe(second.stdout);
        expect(first.stderr).toBe(second.stderr);
        expect(first.status).toBe(second.status);
      }
      expect(snapshotTree(repo.root)).toEqual(before);
      expect(gitStatus(repo.root)).toBe(statusBefore);
    } finally {
      repo.cleanup();
    }
  });

  test("the import graph has no network module and only the licensed child process", () => {
    const source = readFileSync(join(ROOT, "scripts/checks/privacy-literals.ts"), "utf8");
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1] ?? "");
    for (const forbidden of [
      "node:http",
      "node:https",
      "node:net",
      "node:tls",
      "node:dns",
      "node:dgram",
    ]) {
      expect(specifiers).not.toContain(forbidden);
    }
    expect(source).not.toContain("fetch(");
    expect(source.match(/spawnSync\(/g)?.length ?? 0).toBe(1);
    expect(source).toContain('spawnSync(\n    "git"');
  });

  test("a throwing fetch stub does not affect the scan", () => {
    const { repo } = withThreeViolations();
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (() => {
        throw new Error("network access is not licensed");
      }) as typeof fetch;
      expect(scan(repo.root).violations.length).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
      repo.cleanup();
    }
  });

  test("a writing mutant is caught by the snapshot assertion", async () => {
    const { repo } = withThreeViolations();
    const mutant = makeMutantCheck({
      replacements: [
        {
          search: 'import { existsSync, readFileSync, statSync } from "node:fs";',
          replacement:
            'import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";',
        },
        {
          search: "export const runPrivacyScan = (root: string): ScanOutcome => {",
          replacement:
            'export const runPrivacyScan = (root: string): ScanOutcome => {\n  writeFileSync(join(root, ".privacy-cache"), "x");',
        },
      ],
    });
    try {
      const before = snapshotTree(repo.root);
      expect(before.has(".privacy-cache")).toBe(false);
      const mutantCheck = await mutant.importCheck();
      mutantCheck.runPrivacyScan(repo.root);
      const after = snapshotTree(repo.root);
      expect(after.has(".privacy-cache")).toBe(true);
      expect(after).not.toEqual(before);
    } finally {
      mutant.cleanup();
      repo.cleanup();
    }
  });
});

describe("TC-PRIVACY-016 no-echo reporting in both modes", () => {
  test("both modes name id, file, line, and fingerprint and never echo content", () => {
    const { repo, body } = withThreeViolations();
    try {
      const human = runCheck(repo.root);
      const machine = runCheck(repo.root, ["--json"]);
      const parsed = JSON.parse(machine.stdout) as unknown;
      const machineStrings = collectStrings(parsed);
      const humanText = `${human.stdout}${human.stderr}`;
      const windows = candidateWindows(body, [PRIVATE_LITERAL.length, CLOUD_TERM.length]);
      for (const planted of [genericValue, PRIVATE_LITERAL, CLOUD_TERM]) {
        expect(planted.length).toBeGreaterThan(0);
        expect(humanText).not.toContain(planted);
        expect(machineStrings.some((value) => value.includes(planted))).toBe(false);
      }
      for (const window of windows) {
        if (window.trim().length < 4) continue;
        expect(humanText).not.toContain(window);
        expect(machineStrings.some((value) => value.includes(window))).toBe(false);
      }
      expect(humanText).not.toContain(body);
      for (const id of [
        genericValue && "secret.credential-assignment",
        PRIVATE_LITERAL_ENTRY.id,
        CLOUD_TERM_ENTRY.id,
      ]) {
        if (id !== false) expect(`${humanText}${machine.stdout}`).toContain(id);
      }
    } finally {
      repo.cleanup();
    }
  });

  test("the digest input is absent and every long hex string is a fingerprint", () => {
    const { repo } = withThreeViolations();
    try {
      const machine = runCheck(repo.root, ["--json"]);
      const parsed = JSON.parse(machine.stdout) as unknown;
      const strings = collectStrings(parsed);
      for (const literal of [PRIVATE_LITERAL, CLOUD_TERM]) {
        expect(strings.some((value) => value.includes(privacyDigestInput(literal)))).toBe(false);
      }
      const hex = new Set(`${machine.stdout}${machine.stderr}`.match(/[0-9a-f]{16,}/g) ?? []);
      const allowed = new Set(
        [PRIVATE_LITERAL_ENTRY.id, CLOUD_TERM_ENTRY.id, "secret.credential-assignment"].map(
          privacyFingerprint,
        ),
      );
      for (const value of hex) expect(allowed.has(value)).toBe(true);
    } finally {
      repo.cleanup();
    }
  });

  test("a line-1 violation prints no file body excerpt", () => {
    const { repo, body } = withThreeViolations();
    try {
      const human = runCheck(repo.root);
      expect(human.stdout).not.toContain(body.split("\n")[0] as string);
      expect(human.stderr).not.toContain(body);
    } finally {
      repo.cleanup();
    }
  });

  test("an echo-enabled mutant is detected by the same absence assertion", async () => {
    const { repo, body } = withThreeViolations();
    const mutant = makeMutantCheck({
      replacements: [
        {
          search: "ruleOrEntryId: match.id,",
          replacement: "ruleOrEntryId: match.id,\n      echo: match.matchedText,",
        },
      ],
    });
    try {
      const clean = runCheck(repo.root, ["--json"]);
      expect(JSON.stringify(collectStrings(JSON.parse(clean.stdout) as unknown))).not.toContain(
        body.split("\n")[0] as string,
      );
      const mutantCheck = await mutant.importCheck();
      const echoed = mutantCheck.renderJson(mutantCheck.runPrivacyScan(repo.root));
      const echoedStrings = collectStrings(JSON.parse(echoed) as unknown);
      expect(echoedStrings.some((value) => value.includes(genericValue))).toBe(true);
    } finally {
      mutant.cleanup();
      repo.cleanup();
    }
  });
});

describe("TC-PRIVACY-017 fingerprint is identifier-only, short, and stable", () => {
  test("the fingerprint is short, charset-bounded, id-stable, and content-independent", () => {
    const ids = [...PRIVACY_RULE_IDS, PRIVATE_LITERAL_ENTRY.id, CLOUD_TERM_ENTRY.id];
    const fingerprints = ids.map(privacyFingerprint);
    for (const fingerprint of fingerprints) {
      expect(fingerprint.length).toBeLessThanOrEqual(16);
      expect(fingerprint).toMatch(/^[0-9a-f]+$/);
    }
    expect(new Set(fingerprints).size).toBe(ids.length);
    expect(privacyFingerprint("secret.credential-assignment")).toBe(
      privacyFingerprint("secret.credential-assignment"),
    );
    expect(privacyFingerprint("different-id")).not.toBe(
      privacyFingerprint("secret.credential-assignment"),
    );
  });

  test("two files with different content but the same rule id share the fingerprint", () => {
    const repo = createPrivacyRepo({
      "scanned/one.txt": `${genericValue}\n`,
      "scanned/two.txt": `${genericValue.toUpperCase()}\n`,
    });
    try {
      const outcome = scan(repo.root);
      expect(outcome.violations.length).toBe(2);
      expect(outcome.violations[0]?.fingerprint).toBe(outcome.violations[1]?.fingerprint);
    } finally {
      repo.cleanup();
    }
  });
});
