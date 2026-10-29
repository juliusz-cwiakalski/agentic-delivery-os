/**
 * TC-SCAFFOLD-018 / 024 / 037 / 038 — CI check mutations.
 *
 * Each check passes on the live tree and fails on a mutated temp copy, naming
 * the diverging location (pins), the injected construct (bindingness), the
 * floating ref (supply chain), or the advisory (vulnerability gate).
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  scanText as scanBindingness,
  validate as validateBindingness,
} from "../../scripts/checks/ci-bindingness";
import {
  scanText as scanSupplyChain,
  validate as validateSupplyChain,
} from "../../scripts/checks/ci-supply-chain";
import { validate as validateTopology } from "../../scripts/checks/ci-topology";
import { validate as validatePins } from "../../scripts/checks/pin-equality";
import {
  validate as validateVulnerabilities,
  validateFixture,
} from "../../scripts/checks/vulnerability-gate";

const ROOT = process.cwd();
const PIN_FILES = [
  ".bun-version",
  "package.json",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
];

const makePinTree = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "pins-"));
  for (const relative of PIN_FILES) {
    const target = join(directory, relative);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(ROOT, relative), target);
  }
  return directory;
};

describe("pin equality", () => {
  test("live tree passes", () => {
    expect(validatePins(ROOT)).toEqual([]);
  });

  test("each of the four copies diverges by name", () => {
    const mutations: Array<[string, (directory: string) => void, string]> = [
      [
        ".bun-version",
        (directory) => writeFileSync(join(directory, ".bun-version"), "9.9.9\n"),
        "engines.bun",
      ],
      [
        "package.json engines.bun",
        (directory) => {
          const path = join(directory, "package.json");
          const manifest = JSON.parse(readFileSync(path, "utf8")) as {
            engines: { bun: string };
          };
          manifest.engines.bun = "9.9.9";
          writeFileSync(path, JSON.stringify(manifest, null, 2));
        },
        "engines.bun",
      ],
      [
        "ci.yml env.BUN_VERSION",
        (directory) => {
          const path = join(directory, ".github/workflows/ci.yml");
          writeFileSync(
            path,
            readFileSync(path, "utf8").replace('BUN_VERSION: "1.4.4"', 'BUN_VERSION: "9.9.9"'),
          );
        },
        "ci.yml env.BUN_VERSION",
      ],
      [
        "release.yml bun-version",
        (directory) => {
          const path = join(directory, ".github/workflows/release.yml");
          writeFileSync(
            path,
            readFileSync(path, "utf8").replaceAll('bun-version: "1.4.4"', 'bun-version: "9.9.9"'),
          );
        },
        "release.yml bun-version",
      ],
    ];
    for (const [label, mutate, expected] of mutations) {
      const directory = makePinTree();
      try {
        mutate(directory);
        const failures = validatePins(directory);
        expect(
          failures.some((message) => message.includes(expected)),
          label,
        ).toBe(true);
        expect(
          failures.some((message) => message.includes("9.9.9")),
          label,
        ).toBe(true);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  test("range and latest shapes are rejected", () => {
    const shape = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/pins/shape.json"), "utf8"),
    ) as { rejected: string[] };
    for (const value of shape.rejected) {
      const directory = makePinTree();
      try {
        writeFileSync(join(directory, ".bun-version"), `${value}\n`);
        expect(
          validatePins(directory).some((message) => message.includes("must be an exact")),
          value,
        ).toBe(true);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });
});

describe("CI bindingness", () => {
  test("live workflow is binding", () => {
    expect(validateBindingness(ROOT)).toEqual([]);
  });

  test("an injected continue-on-error is caught by job name", () => {
    const text = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8").replace(
      "  ts-boundaries:\n",
      "  ts-boundaries:\n    continue-on-error: true\n",
    );
    const failures = scanBindingness(text);
    expect(failures.some((message) => message.includes("ts-boundaries"))).toBe(true);
    expect(failures.some((message) => message.includes("continue-on-error"))).toBe(true);
  });
});

describe("CI supply chain", () => {
  test("live workflow is SHA-pinned with least privilege", () => {
    expect(validateSupplyChain(ROOT)).toEqual([]);
  });

  test("a floating tag is caught by name", () => {
    const text = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8").replace(
      "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
      "actions/checkout@v4",
    );
    const failures = scanSupplyChain(text);
    expect(failures.some((message) => message.includes("actions/checkout@v4"))).toBe(true);
  });
});

describe("vulnerability gate", () => {
  test("the committed lockfile has no high/critical advisories", () => {
    expect(validateVulnerabilities(ROOT)).toEqual([]);
  }, 240_000);

  test("a fixture advisory makes the gate fail", () => {
    const failures = validateFixture(ROOT);
    expect(failures.some((message) => message.includes("high"))).toBe(true);
  });
});

describe("CI topology", () => {
  test("bash jobs intact, TS jobs complete, triggers and wiring correct", () => {
    expect(validateTopology(ROOT)).toEqual([]);
  });
});
