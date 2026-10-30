/**
 * GH-172 CI parity — boundary-build ordering mutations.
 *
 * The check passes on the live workflow and fails on mutated copies: build step
 * removed (the pre-fix state), build step ordered after the cruise, or the
 * boundary gate removed entirely.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BUILD_COMMAND,
  BOUNDARY_COMMAND,
  JOB_ID,
  validate,
} from "../../scripts/checks/boundary-ci-parity";

const ROOT = process.cwd();
const CI_RELATIVE = ".github/workflows/ci.yml";

// Anchored on the build→cruise pair, which only occurs in the ts-boundaries
// job; tolerant of comment lines between the install and build steps.
const BUILD_THEN_CRUISE = `      - run: ${BUILD_COMMAND}\n      - run: ${BOUNDARY_COMMAND}\n`;

const makeWorkflowTree = (mutate: (text: string) => string): string => {
  const directory = mkdtempSync(join(tmpdir(), "boundary-ci-parity-"));
  mkdirSync(join(directory, ".github/workflows"), { recursive: true });
  const text = readFileSync(join(ROOT, CI_RELATIVE), "utf8");
  writeFileSync(join(directory, CI_RELATIVE), mutate(text));
  return directory;
};

describe("boundary CI parity", () => {
  test("the live ts-boundaries job builds before cruising", () => {
    expect(validate(ROOT)).toEqual([]);
  });

  test("removing the build step (the pre-fix job shape) fails by name", () => {
    const directory = makeWorkflowTree((text) =>
      text.replace(BUILD_THEN_CRUISE, `      - run: ${BOUNDARY_COMMAND}\n`),
    );
    try {
      const failures = validate(directory);
      expect(failures.some((message) => message.includes(JOB_ID))).toBe(true);
      expect(failures.some((message) => message.includes(BUILD_COMMAND))).toBe(true);
      expect(failures.some((message) => message.includes("no build step"))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("cruising before building fails the ordering", () => {
    const directory = makeWorkflowTree((text) =>
      text.replace(
        BUILD_THEN_CRUISE,
        `      - run: ${BOUNDARY_COMMAND}\n      - run: ${BUILD_COMMAND}\n`,
      ),
    );
    try {
      const failures = validate(directory);
      expect(failures.some((message) => message.includes("before"))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("removing the boundary gate fails by name", () => {
    const directory = makeWorkflowTree((text) =>
      text.replace(`      - run: ${BOUNDARY_COMMAND}\n`, ""),
    );
    try {
      const failures = validate(directory);
      expect(failures.some((message) => message.includes(BOUNDARY_COMMAND))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
