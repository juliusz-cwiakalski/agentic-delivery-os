/**
 * TC-CEREMONY-030 (a project declaration runs through the same runner with zero
 * tooling change), TC-CEREMONY-031 (an unparseable document refuses
 * `config.file.malformed` before any run), and TC-CEREMONY-032 (an empty
 * document behaves identically to an absent one), plus the collision and defect
 * refusals of F-6.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CEREMONY_DECLARATIONS_SCHEMA,
  builtinCeremonyDeclaration,
} from "../../packages/core/src/contracts/index";
import { buildCeremonyRegistry, runCeremony } from "../../packages/core/src/domain/index";
import { readCeremonyDeclarationDocument } from "../../packages/adapters/src/file/index";
import { makeEngineHarness } from "../fixtures/ceremony/engine";
import { readCeremonyRuns } from "../../packages/core/src/state/index";

const FIXTURES = join(process.cwd(), "tests/fixtures/ceremony/declarations");
const CONFIG_DIR = ".synthetic";

const makeDocumentRoot = (fixture: string | undefined): string => {
  const root = mkdtempSync(join(tmpdir(), "ceremony-doc-"));
  mkdirSync(join(root, CONFIG_DIR), { recursive: true });
  if (fixture !== undefined) {
    writeFileSync(
      join(root, CONFIG_DIR, "ceremonies.yaml"),
      readFileSync(join(FIXTURES, fixture), "utf8"),
      "utf8",
    );
  }
  return root;
};

const readDocument = (root: string) =>
  readCeremonyDeclarationDocument({ gitRoot: root, configurationDirectoryName: CONFIG_DIR });

describe("TC-CEREMONY-030 a project declaration runs through the same runner", () => {
  test("the document alone registers the ceremony with origin project and it executes", () => {
    const root = makeDocumentRoot("project-document.yaml");
    try {
      const document = readDocument(root);
      expect(document.state).toBe("document");
      const built = buildCeremonyRegistry({ document });
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      const entry = built.registry.projects[0];
      expect(entry?.origin).toBe("project");
      expect(entry?.declaration.id).toBe("project-daily-audit");
      expect(built.registry.builtins).toHaveLength(6);
      const harness = makeEngineHarness({ origin: "project" });
      try {
        const run = runCeremony({
          declaration: entry?.declaration as never,
          env: harness.env,
          noteSupplied: false,
          apply: false,
        });
        expect(run.ok).toBe(true);
        if (!run.ok) return;
        expect(run.data.verdict).toBe("verified");
        expect(run.data.origin).toBe("project");
        expect(run.data.steps.map((step) => step.index)).toEqual([1, 2]);
        const runs = readCeremonyRuns(harness.store);
        expect(runs.ok).toBe(true);
        if (runs.ok) expect(runs.value.records[0]?.ceremonyId).toBe("project-daily-audit");
      } finally {
        harness.dispose();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the recorded origin follows the injected registry origin", () => {
    const root = makeDocumentRoot("project-document.yaml");
    try {
      const document = readDocument(root);
      const built = buildCeremonyRegistry({ document });
      if (!built.ok) return;
      const entry = built.registry.projects[0];
      const harness = makeEngineHarness({ origin: "project" });
      try {
        const run = runCeremony({
          declaration: entry?.declaration as never,
          env: harness.env,
          noteSupplied: false,
          apply: false,
        });
        expect(run.ok).toBe(true);
        if (run.ok) expect(run.data.origin).toBe("project");
      } finally {
        harness.dispose();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("TC-CEREMONY-031 an unparseable document refuses config.file.malformed", () => {
  test("the adapter classifies malformed and the registry refuses before any run", () => {
    const root = makeDocumentRoot("unparseable-document.yaml");
    try {
      const document = readDocument(root);
      expect(document.state).toBe("malformed");
      const built = buildCeremonyRegistry({ document });
      expect(built.ok).toBe(false);
      if (!built.ok) expect(built.error.code).toBe("config.file.malformed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an unreadable path is the same refusal, never a silent drop", () => {
    const path = "/synthetic/.synthetic/ceremonies.yaml";
    const built = buildCeremonyRegistry({
      document: { state: "unreadable", path },
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error.code).toBe("config.file.malformed");
      expect(built.error.summary).toContain("cannot be read");
    }
  });
});

describe("TC-CEREMONY-032 an empty document is identical to an absent document", () => {
  test("both registries carry only the six built-ins", () => {
    const root = makeDocumentRoot("empty-document.yaml");
    const absentRoot = makeDocumentRoot(undefined);
    try {
      const empty = buildCeremonyRegistry({ document: readDocument(root) });
      const absent = buildCeremonyRegistry({ document: readDocument(absentRoot) });
      expect(empty.ok && absent.ok).toBe(true);
      if (!empty.ok || !absent.ok) return;
      expect(empty.registry.entries.map((entry) => entry.declaration.id)).toEqual(
        absent.registry.entries.map((entry) => entry.declaration.id),
      );
      expect(empty.registry.projects).toEqual([]);
      expect(empty.registry.source).toBe("absent");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(absentRoot, { recursive: true, force: true });
    }
  });
});

describe("F-6 a collision or a defect registers nothing and leaves the built-in effective", () => {
  test("a project id colliding with a built-in is refused naming the id", () => {
    const root = makeDocumentRoot("collision-document.yaml");
    try {
      const built = buildCeremonyRegistry({ document: readDocument(root) });
      expect(built.ok).toBe(false);
      if (!built.ok) {
        expect(built.error.code).toBe("ceremony.declaration.invalid");
        expect(built.error.field).toBe("id");
      }
      expect(builtinCeremonyDeclaration("morning-brief")).toBeDefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a defective entry is refused naming the field with zero partial registration", () => {
    const root = makeDocumentRoot("defective-document.yaml");
    try {
      const built = buildCeremonyRegistry({ document: readDocument(root) });
      expect(built.ok).toBe(false);
      if (!built.ok) {
        expect(built.error.code).toBe("ceremony.declaration.invalid");
        expect(built.error.field).toBe("agenda[0].steps[0].kind");
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an absent document is the built-ins-only control", () => {
    const built = buildCeremonyRegistry({ document: { state: "absent" } });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.registry.entries).toHaveLength(6);
      expect(built.registry.projects).toEqual([]);
    }
    expect(CEREMONY_DECLARATIONS_SCHEMA).toBe("delivery.ceremony.declarations.v1");
  });
});
