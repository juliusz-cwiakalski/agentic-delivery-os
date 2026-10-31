/**
 * TC-STATUS-019 — parked work from the git-ignored PM context: observed,
 * observed-empty, absent, malformed/wrong-shape, item-level unknown, optional
 * age, no notes projection, caps/ordering, and read-only access.
 *
 * The lanes/providers cases of this file land in Phase 5.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nodeFileSystemFacts, readLocalPmContext } from "../../packages/adapters/src/file/index";
import { aggregateStatus } from "../../packages/core/src/domain/index";
import { baseFacts, sectionById } from "../fixtures/status/harness";

const fs = nodeFileSystemFacts();

const withContext = (text: string): { readonly root: string; readonly path: string } => {
  const root = mkdtempSync(join(tmpdir(), "status-pm-context-"));
  const path = join(root, "pm-context.yaml");
  writeFileSync(path, text);
  return { root, path };
};

const readContext = (text: string) => {
  const temp = withContext(text);
  return {
    ...temp,
    read: readLocalPmContext({ path: temp.path, fs }),
    cleanup: () => rmSync(temp.root, { recursive: true, force: true }),
  };
};

const digestFor = (text: string) => {
  const context = readContext(text);
  const digest = aggregateStatus(baseFacts({ localContext: context.read }));
  return { digest, context, section: sectionById(digest.sections, "parked-work") };
};

const BASE =
  "active_change:\n  workItemRef: GH-175\n  branch: feat/GH-175/status-v1\n  change_folder: doc/changes/x\n";

describe("TC-STATUS-019 parked work from the local PM context", () => {
  test("an absent file is unavailable with local-context-missing", () => {
    const parsed = readLocalPmContext({ path: "/nonexistent/pm-context.yaml", fs });
    expect(parsed).toEqual({ ok: false, reason: "missing", path: "/nonexistent/pm-context.yaml" });
    const digest = aggregateStatus(baseFacts({ localContext: parsed }));
    const section = sectionById(digest.sections, "parked-work");
    expect(section.state).toBe("unavailable");
    expect(section.evidence.reasons).toContain("local-context-missing");
    expect(section.items).toEqual([]);
  });

  test("an explicit empty array is observed-empty with the git-ignored marker", () => {
    const { section, context } = digestFor(`${BASE}\nparked_changes: []\n`);
    try {
      expect(section.state).toBe("observed");
      expect(section.evidence.reasons).toContain("observed-empty");
      expect(section.source).toEqual({
        kind: "local-pm-context",
        path: context.path,
        tracked: false,
        gitIgnored: true,
      });
      expect(section.items).toEqual([]);
    } finally {
      context.cleanup();
    }
  });

  test("observed entries project only the declared fields and derive age", () => {
    const { section, context } = digestFor(
      `${BASE}\nparked_changes:\n  - workItemRef: GH-200\n    branch: feat/GH-200/parked\n    change_folder: doc/changes/2026-10/GH-200\n    reason: waiting-on-owner\n    parkedAt: 2026-10-21T00:00:00Z\n    notes: planted-status-notes-canary\n`,
    );
    try {
      expect(section.state).toBe("observed");
      expect(section.items).toHaveLength(1);
      const item = section.items?.[0];
      expect(item).toMatchObject({
        workItemRef: "GH-200",
        branch: "feat/GH-200/parked",
        changeFolder: "doc/changes/2026-10/GH-200",
        reason: "waiting-on-owner",
        itemState: "observed",
      });
      expect(item?.ageDays).toBe(10);
      expect(JSON.stringify(section)).not.toContain("planted-status-notes-canary");
    } finally {
      context.cleanup();
    }
  });

  test("an entry without workItemRef is item-level unknown", () => {
    const { section, context } = digestFor(
      `${BASE}\nparked_changes:\n  - branch: feat/GH-201/parked\n    reason: waiting\n`,
    );
    try {
      expect(section.state).toBe("observed");
      expect(section.items?.[0]?.itemState).toBe("unknown");
      expect(section.counts.unknown).toBe(1);
      expect(section.evidence.reasons).toContain("item-signal-absent");
    } finally {
      context.cleanup();
    }
  });

  test("malformed YAML and a non-array parked_changes are unknown", () => {
    const malformed = digestFor("active_change: [unclosed\n");
    try {
      expect(malformed.section.state).toBe("unknown");
      expect(malformed.section.evidence.reasons).toContain("local-context-malformed");
    } finally {
      malformed.context.cleanup();
    }
    const wrongShape = digestFor(`${BASE}\nparked_changes:\n  workItemRef: GH-1\n`);
    try {
      expect(wrongShape.section.state).toBe("unknown");
      expect(wrongShape.section.evidence.reasons).toContain("local-context-malformed");
    } finally {
      wrongShape.context.cleanup();
    }
  });

  test("an invalid parkedAt yields no age and never fabricates one", () => {
    const { section, context } = digestFor(
      `${BASE}\nparked_changes:\n  - workItemRef: GH-202\n    parkedAt: not-a-date\n`,
    );
    try {
      expect(section.items?.[0]?.parkedAt).toBe("not-a-date");
      expect(section.items?.[0]?.ageDays).toBeUndefined();
    } finally {
      context.cleanup();
    }
  });

  test("caps at eight and orders oldest parkedAt first", () => {
    const entries = Array.from({ length: 9 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return `  - workItemRef: GH-${300 + index}\n    parkedAt: 2026-09-${day}T00:00:00Z\n`;
    }).join("");
    const { section, context } = digestFor(`${BASE}\nparked_changes:\n${entries}`);
    try {
      expect(section.items).toHaveLength(8);
      expect(section.counts.omitted).toBe(1);
      expect(section.truncated).toBe(true);
      expect(section.items?.[0]?.workItemRef).toBe("GH-300");
      expect(section.items?.[7]?.workItemRef).toBe("GH-307");
    } finally {
      context.cleanup();
    }
  });

  test("reading and aggregating never writes the PM context", () => {
    const context = readContext(`${BASE}\nparked_changes: []\n`);
    try {
      const beforeBytes = readFileSync(context.path, "utf8");
      const beforeMtime = statSync(context.path).mtimeMs;
      const read = readLocalPmContext({ path: context.path, fs });
      aggregateStatus(baseFacts({ localContext: read }));
      expect(readFileSync(context.path, "utf8")).toBe(beforeBytes);
      expect(statSync(context.path).mtimeMs).toBe(beforeMtime);
    } finally {
      context.cleanup();
    }
  });
});
