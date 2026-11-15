/**
 * TC-SMAP-007 — the project-committed layer slot is the map's only source.
 *
 * The real committed-document read is driven over a temporary checkout whose
 * user-global, system, and project-local overlays each declare a narrowed map.
 * Only the committed slot is ever read; an overlay has no effect and is not a
 * refusal.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type FileSystemFacts,
  readCommittedConfigDocument,
} from "../../packages/adapters/src/file/index";
import {
  resolveVerifySuiteBreadth,
  suiteMapReadOfDocument,
} from "../../packages/core/src/domain/index";
import { REFERENCE_JOB, REFERENCE_SUITES } from "../fixtures/verify-gates/suite-map/cases";

const CONFIG_DIR = ".delivery-os";
const TMP_ROOT = join(process.cwd(), "tmp/tmpdir");

const NARROWED_OVERLAY = `verify:
  suite-map:
    schemaVersion: "delivery.verify.suite-map.v1"
    jobs:
      - job: "${REFERENCE_JOB}"
        suites:
${REFERENCE_SUITES.map((id) => `          - ${id}`).join("\n")}
    local:
      - tests
`;

const EQUALITY_COMMITTED = `verify:
  suite-map:
    schemaVersion: "delivery.verify.suite-map.v1"
    jobs:
      - job: "${REFERENCE_JOB}"
        suites:
${REFERENCE_SUITES.map((id) => `          - ${id}`).join("\n")}
    local:
${REFERENCE_SUITES.map((id) => `      - ${id}`).join("\n")}
`;

type Layered = {
  readonly root: string;
  readonly home: string;
  readonly system: string;
  readonly reads: string[];
  readonly fs: FileSystemFacts;
  write(relative: string, text: string): string;
  cleanup(): void;
};

const layered = (label: string): Layered => {
  mkdirSync(TMP_ROOT, { recursive: true });
  const root = mkdtempSync(join(TMP_ROOT, `gh300-layer-${label}-`));
  const home = join(root, "home");
  const system = join(root, "system");
  const reads: string[] = [];
  const write = (relative: string, text: string): string => {
    const path = join(root, relative);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text);
    return path;
  };
  mkdirSync(home, { recursive: true });
  mkdirSync(system, { recursive: true });
  const fs: FileSystemFacts = {
    exists: (path) => path.startsWith(root) && existsSync(path),
    readText: (path) => {
      reads.push(path);
      return readFileSync(path, "utf8");
    },
  };
  return {
    root,
    home,
    system,
    reads,
    fs,
    write,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

const readWith = (world: Layered, selectedConfig?: string) =>
  readCommittedConfigDocument({
    platform: "linux",
    homeDirectory: world.home,
    environment: {
      XDG_CONFIG_HOME: join(world.home, ".config"),
      XDG_CONFIG_DIRS: world.system,
      ...(selectedConfig === undefined ? {} : { [`${"EXAMPLE_PRODUCT_"}CONFIG`]: selectedConfig }),
    },
    gitRoot: world.root,
    ...(selectedConfig === undefined ? {} : { selectedConfig }),
    enableSystemConfig: true,
    enableUserConfig: true,
    enableProjectLocalConfig: true,
    configurationDirectoryName: CONFIG_DIR,
    fs: world.fs,
  });

const breadthFrom = (read: ReturnType<typeof suiteMapReadOfDocument>) => {
  if (!read.ok || !read.declared) return { kind: "undeclared" as const };
  return resolveVerifySuiteBreadth({
    map: read.value,
    workflow: { outcome: "read", names: [REFERENCE_JOB] },
  });
};

const breadthOf = (world: Layered) => breadthFrom(suiteMapReadOfDocument(readWith(world)));

describe("TC-SMAP-007 an overlay declaration has no effect", () => {
  test("a user-global overlay with the committed document absent leaves the map undeclared", () => {
    const world = layered("user-global-absent");
    try {
      world.write(`${CONFIG_DIR}-overlay`, NARROWED_OVERLAY);
      world.write(`home/.config/${CONFIG_DIR}/config.yaml`, NARROWED_OVERLAY);
      const read = readWith(world);
      expect(read).toEqual({ ok: true, state: "absent" });
      expect(breadthOf(world).kind).toBe("undeclared");
      expect(world.reads).toEqual([]);
    } finally {
      world.cleanup();
    }
  });

  test("a project-local overlay with the committed document absent leaves the map undeclared", () => {
    const world = layered("project-local-absent");
    try {
      world.write(`${CONFIG_DIR}/config.local.yaml`, NARROWED_OVERLAY);
      expect(readWith(world)).toEqual({ ok: true, state: "absent" });
      expect(breadthOf(world).kind).toBe("undeclared");
      expect(world.reads).toEqual([]);
    } finally {
      world.cleanup();
    }
  });

  test("a system-layer file is never read for the map", () => {
    const world = layered("system-absent");
    try {
      world.write(`system/${CONFIG_DIR}/config.yaml`, NARROWED_OVERLAY);
      expect(readWith(world)).toEqual({ ok: true, state: "absent" });
      expect(world.reads.some((path) => path.startsWith(world.system))).toBe(false);
    } finally {
      world.cleanup();
    }
  });
});

describe("TC-SMAP-007 a valid selected file supplies the map", () => {
  test("an equality selection is honoured and no committed or overlay path is read", () => {
    const world = layered("selected-equality");
    try {
      const selected = world.write("selected-equality.yaml", EQUALITY_COMMITTED);
      world.write(`${CONFIG_DIR}/config.yaml`, NARROWED_OVERLAY);
      world.write(`home/.config/${CONFIG_DIR}/config.yaml`, NARROWED_OVERLAY);
      const read = readWith(world, selected);
      expect(read.ok).toBe(true);
      const breadth = breadthFrom(suiteMapReadOfDocument(read));
      expect(breadth.kind).toBe("equal");
      expect(world.reads).toEqual([selected]);
    } finally {
      world.cleanup();
    }
  });

  test("a narrowed selection is honoured and the committed slot is never consulted", () => {
    const world = layered("selected-narrowed");
    try {
      const selected = world.write("selected-narrowed.yaml", NARROWED_OVERLAY);
      world.write(`${CONFIG_DIR}/config.yaml`, EQUALITY_COMMITTED);
      world.write(`${CONFIG_DIR}/config.local.yaml`, EQUALITY_COMMITTED);
      const read = readWith(world, selected);
      expect(read.ok).toBe(true);
      const breadth = breadthFrom(suiteMapReadOfDocument(read));
      expect(breadth.kind).toBe("narrower");
      expect(world.reads).toEqual([selected]);
    } finally {
      world.cleanup();
    }
  });
});

describe("TC-SMAP-007 the committed declaration is honoured despite overlays", () => {
  test("a narrowed user-global overlay cannot replace or complete the committed map", () => {
    const world = layered("committed-honoured");
    try {
      const committed = world.write(`${CONFIG_DIR}/config.yaml`, EQUALITY_COMMITTED);
      world.write(`home/.config/${CONFIG_DIR}/config.yaml`, NARROWED_OVERLAY);
      world.write(`${CONFIG_DIR}/config.local.yaml`, NARROWED_OVERLAY);
      const read = readWith(world);
      expect(read.ok).toBe(true);
      if (!read.ok || read.state !== "parsed") throw new Error("expected the committed document");
      const breadth = breadthFrom(suiteMapReadOfDocument(read));
      expect(breadth.kind).toBe("equal");
      expect(world.reads).toEqual([committed]);
    } finally {
      world.cleanup();
    }
  });

  test("exactly one existence probe and one bounded content read per invocation", () => {
    const world = layered("read-budget");
    try {
      const committed = world.write(`${CONFIG_DIR}/config.yaml`, EQUALITY_COMMITTED);
      let probes = 0;
      const counted: FileSystemFacts = {
        exists: (path) => {
          probes += 1;
          return path === committed;
        },
        readText: world.fs.readText,
      };
      const outcome = readCommittedConfigDocument({
        platform: "linux",
        homeDirectory: world.home,
        environment: {},
        gitRoot: world.root,
        enableSystemConfig: true,
        enableUserConfig: true,
        enableProjectLocalConfig: true,
        configurationDirectoryName: CONFIG_DIR,
        fs: counted,
      });
      expect(outcome.ok).toBe(true);
      expect(probes).toBe(1);
      expect(world.reads).toEqual([committed]);
    } finally {
      world.cleanup();
    }
  });

  test("an overlay declaration is not a refusal", () => {
    const world = layered("no-refusal");
    try {
      world.write(`home/.config/${CONFIG_DIR}/config.yaml`, NARROWED_OVERLAY);
      const read = suiteMapReadOfDocument(readWith(world));
      expect(read.ok).toBe(true);
    } finally {
      world.cleanup();
    }
  });

  test("the same committed declaration resolves identically with and without overlays", () => {
    const withOverlays = layered("ambient-present");
    const without = layered("ambient-absent");
    try {
      for (const world of [withOverlays, without]) {
        world.write(`${CONFIG_DIR}/config.yaml`, EQUALITY_COMMITTED);
      }
      withOverlays.write(`home/.config/${CONFIG_DIR}/config.yaml`, NARROWED_OVERLAY);
      expect(breadthOf(withOverlays)).toEqual(breadthOf(without));
      expect(breadthOf(withOverlays).kind).toBe("equal");
    } finally {
      withOverlays.cleanup();
      without.cleanup();
    }
  });
});
