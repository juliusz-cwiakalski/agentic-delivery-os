/**
 * TC-EVT-006 and the union half of TC-EVT-016 — one authored declaration drives
 * both the surface record and the emitted frame, and no second kind list exists
 * in the production tree.
 *
 * The scan is AST-based, not a flat-array regex: it collects every string literal
 * a module assigns to a `kind` property, every array literal that groups two or
 * more declared kind names, and every object literal keyed by two or more
 * declared kind names. The projection's `kind` literals are then pinned
 * bidirectionally against the declaration's emitted set, so an added, renamed, or
 * dropped kind in either the declaration or the projection fails here; every
 * other module must carry no kind group at all.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { TAXONOMY, type TaxonomyDeclaration } from "../../packages/core/src/contracts/taxonomy";
import {
  compareFrames,
  compareSurface,
  scriptedFrames,
  scriptedRecords,
} from "../fixtures/events/drift-mutants";
import { createSurfaceHarness } from "../fixtures/events/surface-harness";

const ROOT = process.cwd();
const DECLARATION_MODULE = "packages/core/src/contracts/taxonomy.ts";
const PROJECTION_MODULE = "packages/core/src/domain/event-projection.ts";

/**
 * Kind-name groups that are NOT a second taxonomy copy, each with its reason.
 * The comparison against these is exact: a new group in a listed file, or a
 * stale allowance with no matching group, fails the same way an unlisted file
 * does.
 */
type KindGroupAllowance = {
  readonly reason: string;
  readonly kindValues?: readonly string[];
  readonly arrays?: readonly (readonly string[])[];
  readonly objects?: readonly (readonly string[])[];
};

const NON_TAXONOMY_GROUPS: Readonly<Record<string, KindGroupAllowance>> = {
  // `HARNESS_OUTCOMES` and its token map: harness classification vocabulary, not
  // event kinds.
  "packages/core/src/contracts/harness.ts": {
    reason: "harness outcome vocabulary",
    arrays: [["completed", "refused"]],
    objects: [["completed", "refused"]],
  },
  // The phase-ledger fold's `{started, completed}` entry: pm-notes phase
  // timestamps, not event kinds.
  "packages/core/src/state/registry.ts": {
    reason: "phase-ledger entry shape",
    objects: [["completed", "started"]],
  },
  "packages/core/src/domain/verify-change.ts": {
    reason: "phase-ledger entry shape",
    objects: [["completed", "started"]],
  },
  "packages/core/src/domain/pm-notes-lint.ts": {
    reason: "pm-notes field vocabulary",
    arrays: [["completed", "started"]],
  },
  "packages/adapters/src/file/pm-notes-parser.ts": {
    reason: "pm-notes field vocabulary",
    objects: [["completed", "started"]],
  },
  // A merge-transaction result discriminant, not an event kind.
  "packages/core/src/domain/merge-transaction.ts": {
    reason: "merge-transaction result discriminant",
    kindValues: ["refused"],
  },
};

const declaredKindNames = (): ReadonlySet<string> =>
  new Set(TAXONOMY.topics.flatMap((topic) => topic.kinds.map((kind) => kind.name as string)));

const declaredEmittedNames = (): ReadonlySet<string> =>
  new Set(
    TAXONOMY.topics.flatMap((topic) =>
      topic.kinds.filter((kind) => kind.emitted).map((kind) => kind.name as string),
    ),
  );

const productionFiles = (): readonly string[] => {
  const files: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(ROOT, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) {
        files.push(next);
      }
    }
  };
  for (const packageName of ["core", "adapters", "cli", "mcp", "opencode"]) {
    walk(`packages/${packageName}/src`);
  }
  return files;
};

const propertyNameOf = (name: ts.PropertyName | undefined): string | undefined => {
  if (name === undefined) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return undefined;
};

/** Every declared kind name used as a string literal inside one expression. */
const declaredLiteralsIn = (node: ts.Node, declared: ReadonlySet<string>): readonly string[] => {
  const found: string[] = [];
  const walk = (current: ts.Node): void => {
    if (ts.isStringLiteralLike(current) && declared.has(current.text)) found.push(current.text);
    ts.forEachChild(current, walk);
  };
  walk(node);
  return [...new Set(found)];
};

type KindEvidence = {
  /** Declared kind names used as a `kind` property's string value. */
  readonly kindValues: ReadonlySet<string>;
  /** Array literals grouping two or more declared kind names (sorted, comma-joined). */
  readonly arrays: readonly string[];
  /** Object literals keyed by two or more declared kind names (sorted, comma-joined). */
  readonly objects: readonly string[];
};

const evidenceOf = (file: string, declared: ReadonlySet<string>): KindEvidence => {
  const source = ts.createSourceFile(
    file,
    readFileSync(join(ROOT, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const kindValues = new Set<string>();
  const arrays = new Set<string>();
  const objects = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && propertyNameOf(node.name) === "kind") {
      // The initializer may be a conditional (`refused ? "refused" : "completed"`)
      // or a call, so every declared-name literal inside it counts: a kind the
      // projection names is a kind it emits.
      for (const literal of declaredLiteralsIn(node.initializer, declared)) {
        kindValues.add(literal);
      }
    }
    if (ts.isArrayLiteralExpression(node)) {
      const names = node.elements
        .filter(ts.isStringLiteralLike)
        .map((element) => element.text)
        .filter((text) => declared.has(text));
      if (names.length >= 2) arrays.add([...new Set(names)].sort().join(","));
    }
    if (ts.isObjectLiteralExpression(node)) {
      const names = node.properties
        .map((property) =>
          ts.isPropertyAssignment(property) ||
          ts.isShorthandPropertyAssignment(property) ||
          ts.isMethodDeclaration(property)
            ? propertyNameOf(property.name)
            : undefined,
        )
        .filter((name): name is string => name !== undefined && declared.has(name));
      if (names.length >= 2) objects.add([...new Set(names)].sort().join(","));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { kindValues, arrays: [...arrays], objects: [...objects] };
};

describe("TC-EVT-006 one declaration, two consumers", () => {
  test("an additive payload field moves the surface without a second edit", async () => {
    const copy = JSON.parse(JSON.stringify(TAXONOMY)) as {
      topics: {
        name: string;
        kinds: { name: string; payloadFields: string[] }[];
        payloadFields: string[];
      }[];
    };
    const graph = copy.topics.find((topic) => topic.name === "queue.graph");
    const entry = graph?.kinds.find((kind) => kind.name === "entry");
    entry?.payloadFields.push("futureField");
    const position = graph?.payloadFields.indexOf("recordedAt") ?? -1;
    graph?.payloadFields.splice(position + 1, 0, "futureField");

    const surface = await createSurfaceHarness({
      taxonomy: copy as unknown as TaxonomyDeclaration,
    }).run(["events", "describe", "queue.graph", "--json"]);
    const described = surface.data?.topics[0]?.kinds.find((kind) => kind.name === "entry");
    expect(described?.payloadFields).toContain("futureField");
    expect(surface.data?.topics[0]?.payloadFields).toContain("futureField");

    const shipped = await createSurfaceHarness().run([
      "events",
      "describe",
      "queue.graph",
      "--json",
    ]);
    expect(
      shipped.data?.topics[0]?.kinds.find((kind) => kind.name === "entry")?.payloadFields,
    ).not.toContain("futureField");
  });

  test("the live surface kinds are element-wise and order-wise the declaration's kinds", async () => {
    const run = await createSurfaceHarness().run(["events", "list", "--json"]);
    for (const topic of TAXONOMY.topics) {
      const record = run.data?.topics.find((candidate) => candidate.name === topic.name);
      expect(record?.kinds).toEqual(
        topic.kinds.map((kind) => ({
          name: kind.name,
          emitted: kind.emitted,
          payloadFields: [...kind.payloadFields],
        })),
      );
    }
    expect(compareSurface(TAXONOMY, scriptedRecords(TAXONOMY))).toEqual([]);
  });

  test("a version mutation moves the surface and every frame together", async () => {
    const copy = JSON.parse(JSON.stringify(TAXONOMY)) as {
      version: string;
      topics: { version: string }[];
    };
    copy.version = "v1-experiment";
    for (const topic of copy.topics) topic.version = "v1-experiment";
    const frames = scriptedFrames(copy as unknown as TaxonomyDeclaration);
    expect(frames.every((frame) => frame.data.taxonomyVersion === "v1-experiment")).toBe(true);
    const violations = compareSurface(
      TAXONOMY,
      scriptedRecords(copy as unknown as TaxonomyDeclaration),
    );
    expect(violations.some((violation) => violation.field === "version")).toBe(true);
    expect(compareFrames(TAXONOMY, frames).some((violation) => violation.field === "version")).toBe(
      true,
    );
  });

  test("the projection's kind literals are exactly the declared emitted kind set", () => {
    const declared = declaredKindNames();
    const emitted = declaredEmittedNames();
    // `completed` is declared on two topics, so the distinct emitted NAME set is 11.
    expect(emitted.size).toBe(11);
    const projection = evidenceOf(PROJECTION_MODULE, declared);
    // Bidirectional: a kind the projection emits but the declaration does not
    // own fails, and a declared emitted kind the projection has no literal for
    // fails — the exact-key suite is what proves the payloads, this proves the
    // name set cannot drift.
    expect([...projection.kindValues].sort()).toEqual([...emitted].sort());
    expect(projection.arrays).toEqual([]);
    expect(projection.objects).toEqual([]);
  });

  test("no other production module carries a kind list, array, or object map", () => {
    const declared = declaredKindNames();
    const offenders: string[] = [];
    for (const file of productionFiles()) {
      if (file === DECLARATION_MODULE || file === PROJECTION_MODULE) continue;
      const evidence = evidenceOf(file, declared);
      const allowance = NON_TAXONOMY_GROUPS[file];
      const allowedArrays = (allowance?.arrays ?? []).map((group) => [...group].sort().join(","));
      const allowedObjects = (allowance?.objects ?? []).map((group) => [...group].sort().join(","));
      const allowedKindValues = [...(allowance?.kindValues ?? [])].sort();
      const arrays = evidence.arrays;
      const objects = evidence.objects;
      const kindValues = [...evidence.kindValues].sort();
      if (arrays.join("|") !== allowedArrays.join("|")) {
        offenders.push(
          `${file}: arrays [${arrays.join(" ; ")}] (allowed [${allowedArrays.join(" ; ")}])`,
        );
      }
      if (objects.join("|") !== allowedObjects.join("|")) {
        offenders.push(
          `${file}: objects {${objects.join(" ; ")}} (allowed {${allowedObjects.join(" ; ")}})`,
        );
      }
      if (kindValues.join("|") !== allowedKindValues.join("|")) {
        offenders.push(
          `${file}: kind: ${kindValues.join(",")} (allowed ${allowedKindValues.join(",")})`,
        );
      }
    }
    expect(offenders).toEqual([]);
    // Every allowance stays live: a listed file that no longer shows its group
    // is stale and fails above, and a listed file that vanished fails here.
    const production = new Set(productionFiles());
    for (const file of Object.keys(NON_TAXONOMY_GROUPS)) {
      expect(production.has(file), `${file} is not a production module`).toBe(true);
    }
  });
});
