/**
 * TC-DB-010, the privacy scaffold of TC-DB-036, and the metadata-only half of
 * TC-DB-029. The store port is read-only, the admin port owns mutation, the
 * seam is adapter-local and destructively inert, and the item shape is closed.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { createSessionAdmin, createSessionStore } from "../../packages/adapters/src/session/index";
import { CANARY, FORBIDDEN_FIELDS, forbiddenRow } from "../fixtures/session-admin/canary";
import { createFakeIo, NOW_MS, SYNTHETIC_DB_PATH } from "../fixtures/session-admin/harness";
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
        expect(specifier.startsWith("node:child_process"), file).toBe(false);
        expect(specifier.startsWith("node:http"), file).toBe(false);
        expect(specifier.startsWith("node:https"), file).toBe(false);
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
