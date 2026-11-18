/**
 * TC-CAP-003 — append-only reader guards.
 *
 * A torn tail, a duplicate key, a sequence gap, a post-close line, and CRLF
 * framing are classified refusals with zero bytes written. No repair surface
 * exists on the runtime.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import {
  type CapsuleEvent,
  type CapsuleEventKind,
  CAPSULE_EVENT_KINDS,
  type CapsuleWriter,
} from "../../packages/core/src/contracts/index";
import { parseCapsuleEvents } from "../../packages/core/src/domain/capsule";
import {
  CAPSULE_REF,
  eventsText,
  makeChangeTree,
  makeEvent,
  makeNodeRuntime,
  payloadFor,
  writerFor,
} from "../fixtures/capsule/harness";

const validEvents = (): readonly CapsuleEvent[] => {
  const kinds: readonly CapsuleEventKind[] = [
    "capsule.opened",
    "phase.transition",
    "commit.landed",
    "gate.outcome",
    "review.verdict",
  ];
  return kinds.map((kind, index) =>
    makeEvent(index + 1, kind, writerFor(kind) as CapsuleWriter, payloadFor(kind)),
  );
};

const stat = (file: string): { hash: string; size: number; mtimeMs: number } => {
  const text = readFileSync(file, "utf8");
  return {
    hash: createHash("sha256").update(text).digest("hex"),
    size: statSync(file).size,
    mtimeMs: statSync(file).mtimeMs,
  };
};

const withFixture = (text: string) => {
  const tree = makeChangeTree();
  const file = `${tree.folder}/events.jsonl`;
  writeFileSync(file, text);
  return { tree, file, runtime: makeNodeRuntime(tree) };
};

describe("TC-CAP-003 append-only reader guards", () => {
  test("the valid five-event control parses 1..5", () => {
    const report = parseCapsuleEvents(eventsText(validEvents()));
    expect(report.ok).toBe(true);
    if (report.ok) expect(report.events.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5]);
  });

  test("a dropped final LF is a torn tail and the bytes are unchanged", () => {
    const fixture = withFixture(eventsText(validEvents()).slice(0, -1));
    try {
      const before = stat(fixture.file);
      const report = fixture.runtime.read(CAPSULE_REF);
      expect(report.ok).toBe(false);
      if (!report.ok) expect(report.code).toBe("capsule.torn-tail");
      expect(stat(fixture.file)).toEqual(before);
    } finally {
      fixture.tree.cleanup();
    }
  });

  test("a mid-JSON tear is a torn tail", () => {
    const text = eventsText(validEvents());
    const fixture = withFixture(text.slice(0, text.length - 12));
    try {
      const report = fixture.runtime.read(CAPSULE_REF);
      expect(report.ok).toBe(false);
      if (!report.ok) expect(report.code).toBe("capsule.torn-tail");
    } finally {
      fixture.tree.cleanup();
    }
  });

  test("a duplicate event key is named", () => {
    const events = validEvents();
    const duplicated = [
      ...events,
      makeEvent(6, "review.verdict", "closeout", payloadFor("review.verdict"), {
        eventKey: (events[2] as CapsuleEvent).eventKey,
      }),
    ];
    const report = parseCapsuleEvents(eventsText(duplicated));
    expect(report.ok).toBe(false);
    if (!report.ok) {
      expect(report.code).toBe("capsule.duplicate-key");
      expect(report.line).toBe(6);
    }
  });

  test("a sequence gap and a sequence repeat are invalid", () => {
    const events = validEvents();
    const gap = events.map((event, index) =>
      index >= 2 ? { ...event, sequence: event.sequence + 1 } : event,
    );
    const gapReport = parseCapsuleEvents(eventsText(gap));
    expect(gapReport.ok).toBe(false);
    if (!gapReport.ok) expect(gapReport.code).toBe("capsule.sequence-gap");
    const repeat = [events[0], events[1], events[1], events[2]] as CapsuleEvent[];
    const repeatReport = parseCapsuleEvents(eventsText(repeat));
    expect(repeatReport.ok).toBe(false);
    if (!repeatReport.ok) expect(repeatReport.code).toBe("capsule.sequence-gap");
  });

  test("a line after capsule.closed is refused", () => {
    const events = validEvents();
    const closed = [
      ...events,
      makeEvent(6, "capsule.closed", "closeout", payloadFor("capsule.closed")),
    ];
    const report = parseCapsuleEvents(
      eventsText([...closed, makeEvent(7, "commit.landed", "commit", payloadFor("commit.landed"))]),
    );
    expect(report.ok).toBe(false);
    if (!report.ok) {
      expect(report.code).toBe("capsule.post-close");
      expect(report.line).toBe(7);
    }
  });

  test("CRLF framing is rejected as a framing violation", () => {
    const crlf = eventsText(validEvents()).replace(/\n/g, "\r\n");
    const report = parseCapsuleEvents(crlf);
    expect(report.ok).toBe(false);
    if (!report.ok) expect(report.code).toBe("capsule.malformed-line");
  });

  test("an append to every invalid fixture is refused with zero bytes written", () => {
    const events = validEvents();
    const cases: readonly string[] = [
      eventsText(events).slice(0, -1),
      eventsText([
        ...events.slice(0, 4),
        makeEvent(6, "review.verdict", "closeout", payloadFor("review.verdict")),
      ]),
      eventsText([
        ...events,
        makeEvent(6, "capsule.closed", "closeout", payloadFor("capsule.closed")),
      ]) + eventsText([makeEvent(7, "commit.landed", "commit", payloadFor("commit.landed"))]),
      eventsText(events).replace(/\n/g, "\r\n"),
    ];
    for (const text of cases) {
      const fixture = withFixture(text);
      try {
        const before = stat(fixture.file);
        const attempt = fixture.runtime.append({
          changeRef: CAPSULE_REF,
          workspaceChangesDirectory: fixture.tree.changes,
          writer: "commit",
          kind: "commit.landed",
          eventKey: "new-key",
          payload: { commitSha: "b".repeat(40) },
          runId: "run-0001",
        });
        expect(attempt.ok).toBe(false);
        expect(stat(fixture.file)).toEqual(before);
      } finally {
        fixture.tree.cleanup();
      }
    }
  });

  test("no truncate, repair, rewrite, or compaction surface is exported", () => {
    const tree = makeChangeTree();
    try {
      const runtime = makeNodeRuntime(tree);
      const names = Object.keys(runtime).sort();
      expect(names).toEqual([
        "append",
        "close",
        "ensureCandidates",
        "listReviewArtifacts",
        "read",
        "readCandidateDocuments",
        "readCandidates",
        "resolve",
      ]);
      for (const name of names) {
        expect(/truncate|repair|rewrite|compact|reorder/i.test(name)).toBe(false);
      }
      expect(CAPSULE_EVENT_KINDS.length).toBe(11);
    } finally {
      tree.cleanup();
    }
  });
});
