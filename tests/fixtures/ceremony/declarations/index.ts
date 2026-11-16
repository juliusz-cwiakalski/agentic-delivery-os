/**
 * The committed ceremony declaration fixtures and the path patch helper
 * (GH-296 §4.1.6): one valid declaration per legal scope-key derivation, one
 * note-less scheduled and one note-less event-only declaration, plus the
 * committed defect corpus D-01..D-18.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const FIXTURE_DIR = "tests/fixtures/ceremony/declarations";

export type UnknownRecord = Record<string, unknown>;

export const readFixture = (name: string): UnknownRecord =>
  JSON.parse(readFileSync(join(process.cwd(), FIXTURE_DIR, name), "utf8")) as UnknownRecord;

export type DefectFixture = {
  readonly id: string;
  readonly field: string;
  readonly set?: { readonly path: string; readonly value: unknown };
  readonly unset?: string;
};

export const readDefects = (): readonly DefectFixture[] =>
  JSON.parse(
    readFileSync(join(process.cwd(), FIXTURE_DIR, "defects.json"), "utf8"),
  ) as readonly DefectFixture[];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const applySet = (container: unknown, parts: readonly string[], value: unknown): void => {
  const [head, ...rest] = parts;
  if (head === undefined) return;
  if (Array.isArray(container)) {
    const index = Number(head);
    if (rest.length === 0) container[index] = value;
    else applySet(container[index], rest, value);
    return;
  }
  const record = container as Record<string, unknown>;
  if (rest.length === 0) record[head] = value;
  else applySet(record[head], rest, value);
};

const applyUnset = (container: unknown, parts: readonly string[]): void => {
  const [head, ...rest] = parts;
  if (head === undefined) return;
  if (Array.isArray(container)) {
    const index = Number(head);
    if (rest.length === 0) container.splice(index, 1);
    else applyUnset(container[index], rest);
    return;
  }
  const record = container as Record<string, unknown>;
  if (rest.length === 0) delete record[head];
  else applyUnset(record[head], rest);
};

/** Set one dotted/indexed path on a declaration copy (arrays use numeric parts). */
export const withPath = (base: UnknownRecord, path: string, value: unknown): UnknownRecord => {
  const copy = clone(base);
  applySet(copy, path.split("."), value);
  return copy;
};

/** Remove one dotted/indexed path from a declaration copy. */
export const withoutPath = (base: UnknownRecord, path: string): UnknownRecord => {
  const copy = clone(base);
  applyUnset(copy, path.split("."));
  return copy;
};

/** Apply one defect fixture to the valid base declaration. */
export const defectiveDeclaration = (defect: DefectFixture): UnknownRecord => {
  const base = readFixture("valid-repository.json");
  if (defect.unset !== undefined) return withoutPath(base, defect.unset);
  if (defect.set !== undefined) return withPath(base, defect.set.path, defect.set.value);
  return base;
};
