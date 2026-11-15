/**
 * TC-SMAP-008 — the real committed-document adapter classifies every document and
 * selection state fail-closed, and fail-open mutants fail the same expectations.
 *
 * The adapter executes for real; the only substitution is `FileSystemFacts`
 * (`exists`, `readText`). The per-case root reaches it the way production
 * supplies it: through `explicitProjectRoot`, never by moving the process cwd.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type FileSystemFacts,
  readCommittedConfigDocument,
} from "../../packages/adapters/src/file/index";
import type {
  VerifyCommittedConfigDocumentRead,
  VerifySuiteMapRead,
} from "../../packages/core/src/contracts/index";
import { suiteMapReadOfDocument } from "../../packages/core/src/domain/index";
import { REFERENCE_JOB, REFERENCE_SUITES } from "../fixtures/verify-gates/suite-map/cases";

const CONFIG_DIR = ".delivery-os";
const TMP = join(process.cwd(), "tmp/tmpdir");

const configYaml = (node: string): string => `verify:\n  suite-map:\n${node}`;
const suites = REFERENCE_SUITES.map((id) => `          - ${id}`).join("\n");
const VALID = `    schemaVersion: "delivery.verify.suite-map.v1"
    jobs:
      - job: "${REFERENCE_JOB}"
        suites:
${suites}
    local:
${REFERENCE_SUITES.map((id) => `      - ${id}`).join("\n")}
`;

type World = {
  readonly root: string;
  readonly log: { exists: string[]; readText: string[] };
  readonly fs: FileSystemFacts;
  path(): string;
  cleanup(): void;
};

const world = (
  label: string,
  options: {
    readonly body?: string;
    readonly readFailure?: "EACCES" | "ENOENT";
  } = {},
): World => {
  const root = mkdtempSync(join(TMP, `gh300-adapter-${label}-`));
  const log = { exists: [] as string[], readText: [] as string[] };
  const path = () => join(root, CONFIG_DIR, "config.yaml");
  if (options.body !== undefined) {
    mkdirSync(join(root, CONFIG_DIR), { recursive: true });
    writeFileSync(path(), options.body);
  }
  const fs: FileSystemFacts = {
    exists: (candidate) => {
      log.exists.push(candidate);
      if (candidate.startsWith(root)) return existsSync(candidate);
      return false;
    },
    readText: (candidate) => {
      log.readText.push(candidate);
      if (options.readFailure === "EACCES") throw new Error("EACCES");
      if (options.readFailure === "ENOENT") throw new Error("ENOENT");
      return readFileSync(candidate, "utf8");
    },
  };
  return { root, log, fs, path, cleanup: () => rmSync(root, { recursive: true, force: true }) };
};

const read = (
  target: World | undefined,
  overrides: { readonly selectedConfig?: string } = {},
): VerifyCommittedConfigDocumentRead =>
  readCommittedConfigDocument({
    platform: "linux",
    homeDirectory: join(TMP, "home"),
    environment: {},
    ...(target === undefined ? {} : { explicitProjectRoot: target.root }),
    ...(overrides.selectedConfig === undefined ? {} : { selectedConfig: overrides.selectedConfig }),
    enableSystemConfig: false,
    enableUserConfig: false,
    enableProjectLocalConfig: false,
    configurationDirectoryName: CONFIG_DIR,
    fs: target?.fs ?? {
      exists: () => false,
      readText: () => {
        throw new Error("no read expected");
      },
    },
  });

const mapped = (
  target: World | undefined,
  overrides: { readonly selectedConfig?: string } = {},
): VerifySuiteMapRead => suiteMapReadOfDocument(read(target, overrides));

describe("TC-SMAP-008 absent and selection states", () => {
  test("no repository root is undeclared with zero reads", () => {
    expect(read(undefined)).toEqual({ ok: true, state: "absent" });
  });

  test("a root without the file is undeclared after exactly one probe", () => {
    const target = world("absent");
    try {
      expect(read(target)).toEqual({ ok: true, state: "absent" });
      expect(target.log.exists).toEqual([target.path()]);
      expect(target.log.readText).toEqual([]);
    } finally {
      target.cleanup();
    }
  });

  test("a selection naming a missing path is never undeclared", () => {
    const target = world("selected-missing");
    try {
      const missing = join(target.root, "missing.yaml");
      const document = read(target, { selectedConfig: missing });
      expect(document).toEqual({ ok: false, state: "selected-unusable" });
      const outcome = suiteMapReadOfDocument(document);
      expect(outcome.ok).toBe(false);
      expect(target.log.exists).toEqual([missing]);
      expect(target.log.readText).toEqual([]);
    } finally {
      target.cleanup();
    }
  });

  test("a selection naming an unreadable path is never undeclared", () => {
    const target = world("selected-unreadable", { body: configYaml(VALID), readFailure: "EACCES" });
    try {
      const selected = target.path();
      expect(read(target, { selectedConfig: selected })).toEqual({
        ok: false,
        state: "selected-unusable",
      });
      expect(mapped(target, { selectedConfig: selected }).ok).toBe(false);
    } finally {
      target.cleanup();
    }
  });
});

describe("TC-SMAP-008 present but unreadable", () => {
  for (const failure of ["EACCES", "ENOENT"] as const) {
    test(`a ${failure} read is unreadable with one probe and one read attempt`, () => {
      const target = world(`unreadable-${failure}`, {
        body: configYaml(VALID),
        readFailure: failure,
      });
      try {
        expect(read(target)).toEqual({ ok: false, state: "unreadable" });
        expect(target.log.exists).toEqual([target.path()]);
        expect(target.log.readText).toEqual([target.path()]);
        expect(mapped(target)).toEqual({
          ok: false,
          code: "config.value.invalid",
          detail: "document.unreadable",
        });
      } finally {
        target.cleanup();
      }
    });
  }
});

describe("TC-SMAP-008 unparseable as a whole", () => {
  const overCap = `verify:\n  suite-map:\n${Array.from({ length: 2100 }, (_, index) => `    k${index}: 1`).join("\n")}\n`;
  const classes: readonly (readonly [string, string])[] = [
    ["malformed-body", configYaml("    schemaVersion: [\n")],
    [
      "duplicate-key",
      `verify:\n  suite-map:\n    schemaVersion: "delivery.verify.suite-map.v1"\n    schemaVersion: "delivery.verify.suite-map.v1"\n`,
    ],
    ["unsupported-tag", `verify:\n  suite-map:\n    schemaVersion: !!binary "AAAA"\n`],
    ["non-mapping-root", "- one\n- two\n"],
    ["over-cap-source", overCap],
  ];
  for (const [label, body] of classes) {
    test(`${label} is unparseable and never undeclared`, () => {
      const target = world(label, { body });
      try {
        expect(read(target)).toEqual({ ok: false, state: "unparseable" });
        expect(mapped(target).ok).toBe(false);
      } finally {
        target.cleanup();
      }
    });
  }
});

describe("TC-SMAP-008 a defective map node is refused by the map's own resolver", () => {
  const defects: readonly (readonly [string, string])[] = [
    ["schema-version-missing", `    jobs: []\n    local: []\n`],
    [
      "schema-version-unsupported",
      VALID.replace("delivery.verify.suite-map.v1", "delivery.verify.suite-map.v2"),
    ],
    ["undeclared-key", `${VALID}    extra: true\n`],
    ["jobs-not-list", VALID.replace(/ {4}jobs:[\s\S]*? {4}local:/, "    jobs: nope\n    local:")],
    ["empty-job", VALID.replace(`job: "${REFERENCE_JOB}"`, 'job: ""')],
    ["leading-space", VALID.replace(`job: "${REFERENCE_JOB}"`, 'job: " TS aggregate check"')],
    ["trailing-space", VALID.replace(`job: "${REFERENCE_JOB}"`, 'job: "TS aggregate check "')],
    ["line-break", VALID.replace(`job: "${REFERENCE_JOB}"`, 'job: "TS\\naggregate check"')],
    ["tab", VALID.replace(`job: "${REFERENCE_JOB}"`, 'job: "TS\\taggregate check"')],
    ["bad-id", VALID.replace("      - tests", "      - Tests")],
    ["duplicate-local", VALID.replace("      - tests", "      - tests\n      - tests")],
  ];
  for (const [label, body] of defects) {
    test(`${label} is parsed and refused config.value.invalid`, () => {
      const target = world(`defective-${label}`, { body: configYaml(body) });
      try {
        const document = read(target);
        expect(document.ok).toBe(true);
        const outcome = mapped(target);
        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(outcome.code).toBe("config.value.invalid");
      } finally {
        target.cleanup();
      }
    });
  }
});

describe("TC-SMAP-008 a valid map beside an outside-node defect is honoured", () => {
  test("an unknown key and a forbidden value elsewhere neither refuse nor remove the map", () => {
    const outside = `provider:\n  unknownKey: true\nmerge: "defective"\nverify:\n  suite-map:\n${VALID}`;
    const target = world("outside-defect", { body: outside });
    try {
      const outcome = mapped(target);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok || !outcome.declared) throw new Error("expected the declaration honoured");
      expect(outcome.value.jobs[0]?.job).toBe(REFERENCE_JOB);
      expect(outcome.value.local).toEqual([...REFERENCE_SUITES]);
    } finally {
      target.cleanup();
    }
  });
});

describe("TC-SMAP-008 the fail-open mutants fail the same cases", () => {
  const failOpenMapping = (document: VerifyCommittedConfigDocumentRead): VerifySuiteMapRead =>
    document.ok ? suiteMapReadOfDocument(document) : { ok: true, declared: false };
  const defectiveAsAbsent = (document: VerifyCommittedConfigDocumentRead): VerifySuiteMapRead => {
    const outcome = suiteMapReadOfDocument(document);
    return outcome.ok ? outcome : { ok: true, declared: false };
  };

  test("a read failure mapped to undeclared is discriminated", () => {
    const target = world("mutant-read", { body: configYaml(VALID), readFailure: "EACCES" });
    try {
      const delivered = suiteMapReadOfDocument(read(target));
      expect(delivered.ok).toBe(false);
      const mutant = failOpenMapping(read(target));
      expect(mutant).toEqual({ ok: true, declared: false });
      expect(mutant).not.toEqual(delivered);
    } finally {
      target.cleanup();
    }
  });

  test("a parse failure mapped to undeclared is discriminated", () => {
    const target = world("mutant-parse", { body: "- not a mapping\n" });
    try {
      expect(suiteMapReadOfDocument(read(target)).ok).toBe(false);
      expect(failOpenMapping(read(target))).toEqual({ ok: true, declared: false });
    } finally {
      target.cleanup();
    }
  });

  test("a defective node treated as absent is discriminated", () => {
    const target = world("mutant-node", { body: configYaml(`    jobs: []\n    local: []\n`) });
    try {
      expect(suiteMapReadOfDocument(read(target)).ok).toBe(false);
      expect(defectiveAsAbsent(read(target))).toEqual({ ok: true, declared: false });
    } finally {
      target.cleanup();
    }
  });
});

describe("TC-SMAP-008 read accounting and determinism", () => {
  test("every state performs one resolution attempt and repeats identically", () => {
    const states: readonly (() => VerifyCommittedConfigDocumentRead)[] = [
      () => read(undefined),
      () => {
        const target = world("repeat-absent");
        try {
          return read(target);
        } finally {
          target.cleanup();
        }
      },
      () => {
        const target = world("repeat-present", { body: configYaml(VALID) });
        try {
          return read(target);
        } finally {
          target.cleanup();
        }
      },
    ];
    for (const runState of states) {
      expect(runState()).toEqual(runState());
    }
  });

  test("a present document is read exactly once and no other layer is consulted", () => {
    const target = world("accounting", { body: configYaml(VALID) });
    try {
      read(target);
      expect(target.log.exists).toHaveLength(1);
      expect(target.log.readText).toHaveLength(1);
      expect(target.log.readText[0]).toBe(target.path());
    } finally {
      target.cleanup();
    }
  });
});
