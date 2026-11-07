/**
 * Promotion runtime fixtures: a temp memory tree with the real confined writer.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CapsuleFileRuntime,
  CloseoutPromotionRuntime,
} from "../../../packages/core/src/contracts/index";
import {
  applyPromotionWrite,
  checkPromotionConfinement,
  readMemoryFacts,
} from "../../../packages/adapters/src/file/memory-promotion";

export type TempMemory = {
  readonly root: string;
  readonly cleanup: () => void;
  write(relative: string, content: string): void;
  read(relative: string): string;
  exists(relative: string): boolean;
};

export const makeTempMemory = (
  options: {
    readonly readmeLines?: number;
    readonly records?: Readonly<Record<string, string>>;
  } = {},
): TempMemory => {
  const root = mkdtempSync(join(tmpdir(), "gh240-memory-"));
  mkdirSync(join(root, "lessons"), { recursive: true });
  mkdirSync(join(root, "tacit"), { recursive: true });
  const readme = ["# Memory", "", "## Index", "", "| Path | Read when |", "|---|---|"];
  while (readme.length < (options.readmeLines ?? 6)) readme.push("| filler | never |");
  writeFileSync(join(root, "README.md"), `${readme.join("\n")}\n`);
  for (const [relative, content] of Object.entries(options.records ?? {})) {
    const target = join(root, relative);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, content);
  }
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
    write: (relative, content) => {
      const target = join(root, relative);
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, content);
    },
    read: (relative) => readFileSync(join(root, relative), "utf8"),
    exists: (relative) => existsSync(join(root, relative)),
  };
};

/** The real promotion runtime over a temp memory root and capsule runtime. */
export const makePromotionRuntime = (
  memory: TempMemory,
  capsule: CapsuleFileRuntime,
  workItemRef: string,
): CloseoutPromotionRuntime => {
  const documents = capsule.readCandidateDocuments(workItemRef);
  return {
    candidates: documents.ok ? documents.documents : [],
    memory: readMemoryFacts(memory.root),
    write: (write) => {
      const result = applyPromotionWrite(memory.root, write);
      return result.ok
        ? result
        : {
            ok: false,
            code: result.code === "escape" ? "escape" : "conflict",
            detail: result.detail,
          };
    },
    preflight: (writes) => {
      for (const write of writes) {
        const checked = checkPromotionConfinement(memory.root, write);
        if (!checked.ok) return { ok: false, code: "escape", detail: checked.detail };
      }
      return { ok: true };
    },
  };
};

/** Build a candidate YAML document from a partial mapping. */
export const candidateYaml = (overrides: Readonly<Record<string, unknown>> = {}): string => {
  const base = {
    id: "review-catch-fixture",
    class: "lesson",
    scope: "repo",
    statement: "Run the scoped gate first when the full gate is slow.",
    evidence: "review-verdict:review-iter-1",
    basis: "review-catch",
    source: "review_verdict",
    trust: "T3",
    status: "candidate",
    created_by: "coder",
    created: "2026-11-07",
  };
  const merged = { ...base, ...overrides };
  return `${Object.entries(merged)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      Array.isArray(value)
        ? `${key}:\n${value.map((entry) => `  - "${String(entry)}"`).join("\n")}`
        : `${key}: ${typeof value === "string" ? `"${value.replace(/"/g, '\\"')}"` : String(value)}`,
    )
    .join("\n")}\n`;
};

export type PromotionCloseoutRun = {
  readonly exitCode: number;
  readonly data?: Record<string, unknown>;
  readonly error?: Record<string, unknown>;
  readonly memory: TempMemory;
  readonly tree: ReturnType<typeof makeChangeTree>;
  readonly capsule: CapsuleFileRuntime;
  readonly cleanup: () => void;
};

/** Run one closeout (plan or apply) over seeded candidates and a temp memory tree. */
export const runPromotionCloseout = async (options: {
  readonly candidates?: Readonly<Record<string, string>>;
  readonly memory?: Parameters<typeof makeTempMemory>[0];
  readonly apply?: boolean;
  /** Keep the caller's file names instead of naming each file <id>.yaml. */
  readonly preserveNames?: boolean;
  readonly promotionWrite?: (
    base: CloseoutPromotionRuntime["write"],
  ) => CloseoutPromotionRuntime["write"];
}): Promise<PromotionCloseoutRun> => {
  const [{ makeChangeTree }, { runCloseoutCli }, { WORK_ITEM_REF }, { makeCapsuleRuntime }] =
    await Promise.all([
      import("./harness"),
      import("../closeout/cli"),
      import("../closeout/harness"),
      import("./producer"),
    ]);
  const files: Record<string, string> = {};
  for (const [name, text] of Object.entries(options.candidates ?? {})) {
    const id = /^id:\s*"([^"]+)"/m.exec(text)?.[1];
    const file = options.preserveNames === true || id === undefined ? name : `${id}.yaml`;
    files[`candidates/${file}`] = text;
  }
  const tree = makeChangeTree({
    ref: WORK_ITEM_REF,
    month: "2026-11",
    name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    files,
  });
  const memory = makeTempMemory(options.memory ?? {});
  const capsule = makeCapsuleRuntime(tree.changes);
  const basePromotion = makePromotionRuntime(memory, capsule, WORK_ITEM_REF);
  const promotion =
    options.promotionWrite === undefined
      ? basePromotion
      : { ...basePromotion, write: options.promotionWrite(basePromotion.write) };
  const run = await runCloseoutCli(
    ["--json", "closeout", WORK_ITEM_REF, ...(options.apply === false ? [] : ["--apply"])],
    { capsule, promotion },
  );
  const cleanup = () => {
    tree.cleanup();
    memory.cleanup();
  };
  return {
    exitCode: run.exitCode,
    ...(run.envelope.data === undefined
      ? {}
      : { data: run.envelope.data as Record<string, unknown> }),
    ...(run.envelope.error === undefined
      ? {}
      : { error: run.envelope.error as Record<string, unknown> }),
    memory,
    tree,
    capsule,
    cleanup,
  };
};
