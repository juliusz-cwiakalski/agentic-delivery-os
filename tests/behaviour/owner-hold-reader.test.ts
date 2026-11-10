/**
 * TC-HOLDFACT-002/005/006/008/009/010/011 (GH-280) — the bounded marker reader
 * over a real temp HOME's production store directory and injected filesystem
 * facts: fixed path, first-line reason, zero-byte marker, directory/stat/read
 * fail-closed matrix, one existence check and one 4 096-byte read, no extra
 * bytes, no second read, and no marker when no store directory resolves.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  nodeOwnerHoldMarkerFileSystem,
  type OwnerHoldMarkerFileSystem,
  ownerHoldMarkerPath,
  readOwnerHoldMarker,
} from "../../packages/adapters/src/file/index";
import {
  OWNER_HOLD_MAX_MARKER_BYTES,
  type OwnerHoldMarkerOutcome,
} from "../../packages/core/src/contracts/index";
import {
  resolveOwnerHoldFact,
  sanitizeOwnerHoldReason,
} from "../../packages/core/src/domain/index";

const STATE_DIR_NAME = ".acme-state";
const roots: string[] = [];

const tempHome = (): string => {
  const root = mkdtempSync(join(tmpdir(), "owner-hold-reader-"));
  roots.push(root);
  return root;
};

const storeDirectory = (home: string): string => {
  const store = join(home, STATE_DIR_NAME);
  mkdirSync(store, { recursive: true });
  return store;
};

const factFrom = (
  store: string | undefined,
  marker: OwnerHoldMarkerOutcome,
): ReturnType<typeof resolveOwnerHoldFact> =>
  resolveOwnerHoldFact({
    environment: {},
    environmentPrefix: "ACME",
    storeDirectory: store,
    marker,
  });

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("TC-HOLDFACT-002 marker source at the fixed production store path", () => {
  test("the reader reads exactly <store>/owner-hold and yields the first-line reason", () => {
    const home = tempHome();
    const store = storeDirectory(home);
    const markerPath = join(store, "owner-hold");
    expect(ownerHoldMarkerPath(store)).toBe(markerPath);
    writeFileSync(markerPath, "peak-hour cost pause\nlater text\n");
    const marker = readOwnerHoldMarker({ storeDirectory: store }, nodeOwnerHoldMarkerFileSystem());
    expect(marker).toEqual({ state: "present", content: "peak-hour cost pause\nlater text\n" });
    expect(factFrom(store, marker)).toEqual({
      active: true,
      source: "marker",
      reason: "peak-hour cost pause",
    });
  });

  test("a marker at a non-default path never activates the hold", () => {
    const home = tempHome();
    const store = storeDirectory(home);
    const elsewhere = join(home, "other");
    mkdirSync(elsewhere, { recursive: true });
    writeFileSync(join(elsewhere, "owner-hold"), "elsewhere reason");
    const marker = readOwnerHoldMarker({ storeDirectory: store }, nodeOwnerHoldMarkerFileSystem());
    expect(marker).toEqual({ state: "absent" });
    expect(factFrom(store, marker)).toEqual({ active: false });
  });
});

describe("TC-HOLDFACT-005 empty marker is active without a reason", () => {
  test("a zero-byte regular file is active with no reason", () => {
    const home = tempHome();
    const store = storeDirectory(home);
    writeFileSync(join(store, "owner-hold"), "");
    const marker = readOwnerHoldMarker({ storeDirectory: store }, nodeOwnerHoldMarkerFileSystem());
    expect(marker).toEqual({ state: "present", content: "" });
    const fact = factFrom(store, marker);
    expect(fact).toEqual({ active: true, source: "marker" });
    expect(Object.hasOwn(fact, "reason")).toBe(false);
  });
});

describe("TC-HOLDFACT-006 unreadable, non-regular, and stat-failing markers fail closed", () => {
  test("a directory at the marker path is unreadable, never absent", () => {
    const home = tempHome();
    const store = storeDirectory(home);
    mkdirSync(join(store, "owner-hold"));
    const marker = readOwnerHoldMarker({ storeDirectory: store }, nodeOwnerHoldMarkerFileSystem());
    expect(marker).toEqual({ state: "unreadable" });
    expect(factFrom(store, marker)).toEqual({ active: true, source: "marker" });
  });

  test("an injected EACCES read and an injected stat failure both fail closed", () => {
    const path = ownerHoldMarkerPath("/srv/operator/.ados-state");
    expect(path).toBe("/srv/operator/.ados-state/owner-hold");
    const unreadableFs = (
      overrides: Partial<OwnerHoldMarkerFileSystem>,
    ): OwnerHoldMarkerFileSystem => ({
      exists: () => true,
      isFile: () => true,
      readText: () => {
        throw Object.assign(new Error("denied"), { code: "EACCES" });
      },
      ...overrides,
    });
    expect(
      readOwnerHoldMarker({ storeDirectory: "/srv/operator/.ados-state" }, unreadableFs({})),
    ).toEqual({ state: "unreadable" });
    expect(
      readOwnerHoldMarker(
        { storeDirectory: "/srv/operator/.ados-state" },
        unreadableFs({
          isFile: () => {
            throw Object.assign(new Error("io"), { code: "EIO" });
          },
        }),
      ),
    ).toEqual({ state: "unreadable" });
  });

  test("an existence-check stat failure is unreadable, while ENOENT stays absent", () => {
    const path = ownerHoldMarkerPath("/srv/operator/.ados-state");
    expect(path).toBe("/srv/operator/.ados-state/owner-hold");
    const statFailureFs: OwnerHoldMarkerFileSystem = {
      exists: () => {
        throw Object.assign(new Error("parent directory denied"), { code: "EACCES" });
      },
      isFile: () => true,
      readText: () => "never",
    };
    expect(
      readOwnerHoldMarker({ storeDirectory: "/srv/operator/.ados-state" }, statFailureFs),
    ).toEqual({ state: "unreadable" });
    const enoentFs: OwnerHoldMarkerFileSystem = {
      exists: () => false,
      isFile: () => true,
      readText: () => "never",
    };
    expect(readOwnerHoldMarker({ storeDirectory: "/srv/operator/.ados-state" }, enoentFs)).toEqual({
      state: "absent",
    });
  });

  test.skipIf(typeof process.getuid === "function" && process.getuid() === 0)(
    "an unreadable parent store directory fails closed (skipped as root by name)",
    () => {
      const home = tempHome();
      const store = storeDirectory(home);
      writeFileSync(join(store, "owner-hold"), "unreadable parent");
      chmodSync(store, 0o000);
      try {
        const marker = readOwnerHoldMarker(
          { storeDirectory: store },
          nodeOwnerHoldMarkerFileSystem(),
        );
        expect(marker).toEqual({ state: "unreadable" });
        expect(factFrom(store, marker)).toEqual({ active: true, source: "marker" });
      } finally {
        chmodSync(store, 0o700);
      }
    },
  );

  test.skipIf(typeof process.getuid === "function" && process.getuid() === 0)(
    "a chmod-000 file resolves active with no reason (skipped as root by name)",
    () => {
      const home = tempHome();
      const store = storeDirectory(home);
      const markerPath = join(store, "owner-hold");
      writeFileSync(markerPath, "unreadable reason");
      chmodSync(markerPath, 0o000);
      const marker = readOwnerHoldMarker(
        { storeDirectory: store },
        nodeOwnerHoldMarkerFileSystem(),
      );
      expect(marker).toEqual({ state: "unreadable" });
      expect(factFrom(store, marker)).toEqual({ active: true, source: "marker" });
    },
  );
});

describe("TC-HOLDFACT-008 one existence check and one 4 096-byte read", () => {
  test("a recording filesystem sees exactly one exists call and one bounded read", () => {
    const calls: string[] = [];
    const limits: number[] = [];
    const paths: string[] = [];
    const fs: OwnerHoldMarkerFileSystem = {
      exists: (path) => {
        calls.push("exists");
        paths.push(path);
        return true;
      },
      isFile: (path) => {
        calls.push("isFile");
        paths.push(path);
        return true;
      },
      readText: (path, maxBytes) => {
        calls.push("read");
        paths.push(path);
        limits.push(maxBytes);
        return "recording reason";
      },
    };
    const marker = readOwnerHoldMarker({ storeDirectory: "/srv/operator/.ados-state" }, fs);
    expect(marker).toEqual({ state: "present", content: "recording reason" });
    expect(calls).toEqual(["exists", "isFile", "read"]);
    expect(limits).toEqual([OWNER_HOLD_MAX_MARKER_BYTES]);
    expect(paths).toEqual([
      "/srv/operator/.ados-state/owner-hold",
      "/srv/operator/.ados-state/owner-hold",
      "/srv/operator/.ados-state/owner-hold",
    ]);
  });

  test("a real 10 KB file yields a bounded reason and surfaces no extra bytes", () => {
    const home = tempHome();
    const store = storeDirectory(home);
    const visible = "a".repeat(160);
    const tail = "TAIL-MARKER-THAT-MUST-NOT-SURFACE";
    writeFileSync(join(store, "owner-hold"), `${visible}${tail}${"z".repeat(10_000)}\n`);
    const marker = readOwnerHoldMarker({ storeDirectory: store }, nodeOwnerHoldMarkerFileSystem());
    if (marker.state !== "present") throw new Error("expected a present marker");
    expect(marker.content.length).toBeLessThanOrEqual(OWNER_HOLD_MAX_MARKER_BYTES);
    const fact = factFrom(store, marker);
    if (!fact.active) throw new Error("expected an active hold");
    expect(fact.reason).toHaveLength(160);
    expect(fact.reason).toBe(visible);
    expect(JSON.stringify(fact)).not.toContain(tail);
    expect(sanitizeOwnerHoldReason(marker.content)).toBe(visible);
  });
});

describe("TC-HOLDFACT-010 no store directory means no marker read", () => {
  test("an undefined store directory is absent with zero filesystem calls", () => {
    let calls = 0;
    const fs: OwnerHoldMarkerFileSystem = {
      exists: () => {
        calls += 1;
        return true;
      },
      isFile: () => {
        calls += 1;
        return true;
      },
      readText: () => {
        calls += 1;
        return "never";
      },
    };
    expect(readOwnerHoldMarker({ storeDirectory: undefined }, fs)).toEqual({ state: "absent" });
    expect(calls).toBe(0);
    expect(ownerHoldMarkerPath(undefined)).toBeUndefined();
  });
});
