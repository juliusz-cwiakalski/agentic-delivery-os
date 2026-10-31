/**
 * TC-DB-010, the privacy scaffold of TC-DB-036, and the metadata-only half of
 * TC-DB-029. The store port is read-only, the admin port owns mutation, the
 * seam is adapter-local and destructively inert, and the item shape is closed.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { createSessionAdmin, createSessionStore } from "../../packages/adapters/src/session/index";
import {
  CANARY,
  ENV_CANARY,
  FORBIDDEN_FIELDS,
  forbiddenRow,
} from "../fixtures/session-admin/canary";
import {
  createFakeIo,
  NOW_MS,
  runDbWithIo,
  SYNTHETIC_DB_PATH,
} from "../fixtures/session-admin/harness";
import { makeSession, sessionRow } from "../fixtures/session-admin/store";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/session.ts";
const ADAPTER = "packages/adapters/src/session/index.ts";

const parse = (path: string, text: string): ts.SourceFile =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const interfaceMethods = (text: string, name: string): string[] => {
  const source = parse(CONTRACT, text);
  for (const statement of source.statements) {
    if (!ts.isInterfaceDeclaration(statement) || statement.name.text !== name) continue;
    return statement.members
      .filter(ts.isMethodSignature)
      .map((member) => member.name.getText(source));
  }
  return [];
};

const interfaceExtends = (text: string, name: string): string[] => {
  const source = parse(CONTRACT, text);
  for (const statement of source.statements) {
    if (!ts.isInterfaceDeclaration(statement) || statement.name.text !== name) continue;
    return (statement.heritageClauses ?? []).flatMap((clause) =>
      clause.types.map((type) => type.expression.getText(source)),
    );
  }
  return [];
};

const seamMembers = (text: string): string[] => {
  const source = parse(ADAPTER, text);
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== "OpencodeSessionIo") {
      continue;
    }
    if (!ts.isTypeLiteralNode(statement.type)) return [];
    return statement.type.members
      .filter((member) => ts.isPropertySignature(member) || ts.isMethodSignature(member))
      .map((member) => member.name.getText(source))
      .sort();
  }
  return [];
};

describe("TC-DB-010 port surfaces and fake conformance", () => {
  test("the read port surface is exactly size/list at runtime", () => {
    const store = createSessionStore(createFakeIo());
    expect(Object.keys(store).sort()).toEqual(["list", "size"]);
    expect(Object.hasOwn(store, "prune")).toBe(false);
    expect(Object.hasOwn(store, "reboot")).toBe(false);
  });

  test("the admin port extends the read surface with prune and reboot", () => {
    const admin = createSessionAdmin(createFakeIo());
    expect(Object.keys(admin).sort()).toEqual(["list", "prune", "reboot", "size"]);
    expect(
      interfaceMethods(readFileSync(join(ROOT, CONTRACT), "utf8"), "SessionStorePort"),
    ).toEqual(["size", "list"]);
    expect(
      interfaceMethods(readFileSync(join(ROOT, CONTRACT), "utf8"), "SessionAdminPort"),
    ).toEqual(["prune", "reboot"]);
    expect(
      interfaceExtends(readFileSync(join(ROOT, CONTRACT), "utf8"), "SessionAdminPort"),
    ).toEqual(["SessionStorePort"]);
  });

  test("the seam is adapter-local, exact, and destructively inert", () => {
    expect(seamMembers(readFileSync(join(ROOT, ADAPTER), "utf8"))).toEqual([
      "checkpoint",
      "command",
      "databasePath",
      "deleteSession",
      "environment",
      "now",
      "query",
      "stat",
    ]);
    const contract = readFileSync(join(ROOT, CONTRACT), "utf8");
    const contractsIndex = readFileSync(join(ROOT, "packages/core/src/contracts/index.ts"), "utf8");
    expect(contract.includes("OpencodeSessionIo")).toBe(false);
    expect(contractsIndex.includes("OpencodeSessionIo")).toBe(false);
    expect(readFileSync(join(ROOT, ADAPTER), "utf8")).toContain("export type OpencodeSessionIo");
  });

  test("the same fake drives both ports without a divergent read path", async () => {
    const rows = [sessionRow(makeSession({ id: "ses_one", timeUpdated: NOW_MS - 1 }))];
    const storeIo = createFakeIo();
    storeIo.queueQuery([{ total: 1 }]);
    storeIo.queueQuery(rows);
    const adminIo = createFakeIo();
    adminIo.queueQuery([{ total: 1 }]);
    adminIo.queueQuery(rows);
    const storeRead = await createSessionStore(storeIo).list({ limit: 20, nowMs: NOW_MS });
    const adminRead = await createSessionAdmin(adminIo).list({ limit: 20, nowMs: NOW_MS });
    expect(storeRead).toEqual(adminRead);
  });

  test("the item shape is closed and no forbidden field survives projection", async () => {
    const io = createFakeIo();
    io.queueQuery([{ total: 1 }]);
    io.queueQuery([
      { ...forbiddenRow("ses_canary"), ...sessionRow(makeSession({ id: "ses_canary" })) },
    ]);
    const read = await createSessionStore(io).list({ limit: 20, nowMs: NOW_MS });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const item = read.value.items[0];
    expect(item).toBeDefined();
    if (item === undefined) return;
    expect(Object.keys(item).sort()).toEqual([
      "archived",
      "createdAt",
      "dataBytes",
      "id",
      "live",
      "messageCount",
      "partCount",
      "updatedAt",
    ]);
    for (const field of FORBIDDEN_FIELDS) {
      expect(Object.hasOwn(item, field)).toBe(false);
      expect(JSON.stringify(item)).not.toContain(CANARY);
    }
  });

  test("the seam names no destructive or process member", () => {
    const members = seamMembers(readFileSync(join(ROOT, ADAPTER), "utf8"));
    for (const banned of ["unlink", "rm", "truncate", "rename", "kill", "spawn", "exec"]) {
      expect(members.includes(banned)).toBe(false);
    }
  });
});

describe("TC-DB-036 hermeticity scaffold", () => {
  test("the size/list and privacy suites import no process or network API", () => {
    const suites = [
      "tests/behaviour/session-admin-size-list.test.ts",
      "tests/behaviour/session-admin-privacy.test.ts",
    ];
    for (const file of suites) {
      const text = readFileSync(join(ROOT, file), "utf8");
      const source = parse(file, text);
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
          continue;
        }
        const specifier = statement.moduleSpecifier.text;
        expect(specifier.startsWith("node:" + "child_process"), file).toBe(false);
        expect(specifier.startsWith("node:" + "http"), file).toBe(false);
        expect(specifier.startsWith("node:" + "https"), file).toBe(false);
      }
      for (const banned of [
        "Bun." + "spawn",
        "os." + "homedir",
        "process." + "env",
        "$" + "HOME",
      ]) {
        expect(text.includes(banned), file).toBe(false);
      }
    }
  });

  test("the synthetic database path is not a real home path", () => {
    expect(SYNTHETIC_DB_PATH.startsWith("/synthetic/")).toBe(true);
    expect(SYNTHETIC_DB_PATH).not.toMatch(/^\/home\/|\/Users\//);
  });

  test("the canary is a fabricated marker, not a credential", () => {
    expect(CANARY.length).toBeGreaterThan(0);
    expect(CANARY).toContain("CANARY");
    expect(forbiddenRow("ses_probe").title).toBe(CANARY);
  });
});

describe("TC-DB-029 metadata-only whitelist, canary, and mutation sensitivity", () => {
  const listRow = (): Record<string, unknown> => ({
    ...forbiddenRow("ses_canary"),
    ...sessionRow(makeSession({ id: "ses_canary", timeUpdated: NOW_MS - 1_000 })),
  });

  test("the canary is present in the raw response before it is absent from output", async () => {
    const raw = listRow();
    expect(raw.title).toBe(CANARY);
    expect(raw.prompt).toBe(CANARY);
    expect(JSON.stringify(raw)).toContain(CANARY);
    const io = createFakeIo();
    io.queueQuery([{ total: 1 }]);
    io.queueQuery([raw]);
    const machine = await runDbWithIo(["db", "list", "--json"], io);
    expect(machine.exitCode).toBe(0);
    expect(machine.stdout).not.toContain(CANARY);
    expect(machine.stderr).not.toContain(CANARY);
    const envelope = JSON.parse(machine.stdout) as Record<string, unknown>;
    expect(JSON.stringify(envelope)).not.toContain(CANARY);
    expect(envelope.data).toMatchObject({
      schemaVersion: "delivery.session-admin.v1",
      command: "list",
    });

    const humanIo = createFakeIo();
    humanIo.queueQuery([{ total: 1 }]);
    humanIo.queueQuery([listRow()]);
    const human = await runDbWithIo(["db", "list"], humanIo);
    expect(human.exitCode).toBe(0);
    expect(human.stdout).not.toContain(CANARY);
  });

  test("an invalid id carrying the canary is rejected without echoing it", async () => {
    const io = createFakeIo();
    io.queueQuery([{ total: 1 }]);
    io.queueQuery([{ ...listRow(), id: `${CANARY} '` }]);
    const run = await runDbWithIo(["db", "list", "--json"], io);
    expect(run.exitCode).toBe(2);
    expect(run.stdout).not.toContain(CANARY);
    expect(run.stderr).not.toContain(CANARY);
    expect(JSON.parse(run.stdout)).toMatchObject({ error: { code: "db.query.failed" } });
  });

  test("the exact key sets stay closed and no extra field survives", async () => {
    const io = createFakeIo();
    io.queueQuery([{ total: 1 }]);
    io.queueQuery([listRow()]);
    const run = await runDbWithIo(["db", "list", "--json"], io);
    const envelope = JSON.parse(run.stdout) as { data: { items: Record<string, unknown>[] } };
    expect(Object.keys(envelope.data).sort()).toEqual([
      "command",
      "items",
      "limit",
      "omitted",
      "schemaVersion",
      "total",
      "truncated",
    ]);
    const item = envelope.data.items[0] ?? {};
    expect(Object.keys(item).sort()).toEqual([
      "archived",
      "createdAt",
      "dataBytes",
      "id",
      "live",
      "messageCount",
      "partCount",
      "updatedAt",
    ]);
    const wide = { ...item, title: CANARY };
    expect(JSON.stringify(wide)).toContain(CANARY);
    expect(Object.hasOwn(item, "title")).toBe(false);
  });

  test("the injected environment value never appears in output", async () => {
    const io = createFakeIo();
    (io as { environment: Readonly<Record<string, string | undefined>> }).environment = {
      PATH: "/synthetic/bin",
      SECRET: ENV_CANARY,
    };
    io.statFacts.set(SYNTHETIC_DB_PATH, { bytes: 4096, present: true });
    io.statFacts.set(`${SYNTHETIC_DB_PATH}-wal`, { bytes: 0, present: false });
    io.statFacts.set(`${SYNTHETIC_DB_PATH}-shm`, { bytes: 0, present: false });
    io.queueQuery([{ sessions: 0, oldest: null, newest: null }]);
    io.queueQuery([{ messages: 0 }]);
    io.queueQuery([{ parts: 0 }]);
    const run = await runDbWithIo(["db", "size", "--json"], io);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).not.toContain(ENV_CANARY);
    expect(run.stderr).not.toContain(ENV_CANARY);
  });

  test("committed fixtures outside the canary source carry no forbidden field", () => {
    const root = join(ROOT, "tests/fixtures/session-admin");
    const files: string[] = [];
    const walk = (path: string): void => {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        const next = join(path, entry.name);
        if (entry.isDirectory()) walk(next);
        else if (entry.name.endsWith(".ts")) files.push(next);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      if (file.endsWith("canary.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const field of FORBIDDEN_FIELDS) {
        expect(text.includes(`"${field}"`), `${file} carries ${field}`).toBe(false);
      }
      expect(text).not.toContain(CANARY);
    }
  });
});
