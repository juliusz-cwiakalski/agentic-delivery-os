/**
 * TC-STEER-007 (structure halves), TC-STEER-008 (data half), TC-STEER-021
 * (class map), TC-STEER-082 (constants) — the shared message record, the four
 * closed vocabularies declared once, the declared S5 filing subset, the ttl
 * grammar, and every declared bound.
 *
 * Contract data only: these assertions read the exported module and the source
 * tree; no runtime seam is required before the validator exists.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOARD_MAX_ASKS,
  STEER_DEFAULT_TTL,
  STEER_DEFAULT_TTL_MS,
  STEER_ERROR_CODES,
  STEER_EXPIRY_REASON,
  STEER_FILING_FROM,
  STEER_FILING_KINDS,
  STEER_FILING_SCOPE,
  STEER_FILING_SUBSET,
  STEER_FILING_TO,
  STEER_KINDS,
  STEER_LIFECYCLES,
  STEER_MAX_ASKS,
  STEER_MAX_HUMAN_BYTES,
  STEER_MAX_HUMAN_LINES,
  STEER_MAX_LIST_ROWS_PER_GROUP,
  STEER_MAX_MACHINE_BYTES,
  STEER_MAX_READ_PAYLOAD_NOTES,
  STEER_MAX_REF_CHARS,
  STEER_MAX_TEXT_CHARS,
  STEER_MAX_TTL_MS,
  STEER_MAX_TTL_SECONDS,
  STEER_MESSAGE_ID_PREFIX,
  STEER_MESSAGE_RECORD_KIND,
  STEER_PHASE_IN_PROGRESS_REASON,
  STEER_PHASE_UNKNOWN_REASONS,
  STEER_PRIORITIES,
  STEER_PRIORITY_CLASS_BY_PRIORITY,
  STEER_RANK_KEY,
  STEER_RECORD_FIELDS,
  STEER_RECORD_KINDS,
  STEER_SCHEMA_VERSION,
  STEER_SCOPES,
  STEER_TTL_UNIT_MS,
  STEER_TTL_UNITS,
  type SteerMessageRecord,
} from "../../packages/core/src/contracts/index";
import {
  deriveSteerBoundary,
  deriveSteerLifecycle,
  evaluateSteerGuard,
  formatSteerMessageId,
  parseSteerTtl,
  rankSteerMessages,
  steerAgeMs,
  steerExpiresAt,
  steerTtlElapsed,
  validateSteerCompletion,
  validateSteerMessage,
  validateSteerSend,
} from "../../packages/core/src/domain/index";

const ROOT = process.cwd();

const OWNER_SPECIFIC_FIELD_NAMES = [
  "ownerNote",
  "ownerNoteId",
  "steeredBy",
  "steeringText",
  "sessionId",
  "steeringPriority",
  "ownerId",
] as const;

const sorted = (values: readonly string[]): readonly string[] => [...values].sort();

const messageKeys: readonly (keyof SteerMessageRecord)[] = [
  "id",
  "from",
  "to",
  "scope",
  "kind",
  "subject",
  "ref",
  "origin",
  "priority",
  "created",
  "ttl",
];

/** Every TypeScript source under `packages/` (contracts and consumers). */
const packageSources = (directory: string): readonly string[] => {
  const results: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const next = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...packageSources(next));
    else if (entry.name.endsWith(".ts")) results.push(next);
  }
  return results;
};

describe("TC-STEER-007 the shared message schema", () => {
  test("exactly the eleven declared fields with declared types and no owner-specific shape", () => {
    expect(STEER_RECORD_FIELDS).toHaveLength(11);
    expect(STEER_RECORD_FIELDS.map((field) => field.name)).toEqual(messageKeys);
    expect([...STEER_RECORD_FIELDS.map((field) => field.name)].sort()).toEqual(
      [...messageKeys].sort(),
    );
    for (const field of STEER_RECORD_FIELDS) {
      expect(field.type.length).toBeGreaterThan(0);
      expect((OWNER_SPECIFIC_FIELD_NAMES as readonly string[]).includes(field.name)).toBe(false);
    }
    expect(STEER_RECORD_FIELDS.find((field) => field.name === "ref")?.type).toBe("string-or-null");
    expect(STEER_RECORD_FIELDS.find((field) => field.name === "origin")?.type).toBe("object");
    expect(STEER_RECORD_FIELDS.find((field) => field.name === "ttl")?.type).toBe("number");
  });

  test("the four shared closed vocabularies equal the declared sets in both directions", () => {
    expect(sorted(STEER_SCOPES)).toEqual(sorted(["session", "change", "repo", "fleet"]));
    expect(sorted(STEER_KINDS)).toEqual(
      sorted(["ask", "answer", "notify", "request", "escalate", "report", "heartbeat"]),
    );
    expect(sorted(STEER_PRIORITIES)).toEqual(sorted(["low", "normal", "high", "urgent"]));
    expect(sorted(STEER_LIFECYCLES)).toEqual(sorted(["queued", "landed", "expired", "completed"]));
    expect(STEER_EXPIRY_REASON).toBe("ttl-elapsed");
    expect(STEER_PHASE_IN_PROGRESS_REASON).toBe("phase-in-progress");
    expect([...STEER_PHASE_UNKNOWN_REASONS]).toEqual(["phase-unrecorded"]);
  });

  test("each closed vocabulary is declared once across the package tree", () => {
    const sources = packageSources(join(ROOT, "packages"));
    const kindDeclaration = /\[\s*"ask",\s*"answer",\s*"notify"/u;
    const scopeDeclaration = /\[\s*"session",\s*"change",\s*"repo",\s*"fleet"\s*\]/u;
    const priorityDeclaration = /\[\s*"low",\s*"normal",\s*"high",\s*"urgent"\s*\]/u;
    const count = (pattern: RegExp): number =>
      sources.filter((path) => pattern.test(readFileSync(path, "utf8"))).length;
    expect(count(kindDeclaration)).toBe(1);
    expect(count(scopeDeclaration)).toBe(1);
    expect(count(priorityDeclaration)).toBe(1);
  });
});

describe("TC-STEER-008 the declared filing subset", () => {
  test("the subset is exactly the declared restriction over the shared sets", () => {
    expect(sorted(STEER_FILING_KINDS)).toEqual(sorted(["request", "escalate"]));
    expect(STEER_FILING_SCOPE).toBe("repo");
    expect(STEER_FILING_FROM).toBe("owner");
    expect(STEER_FILING_TO).toBe("delivery");
    expect(STEER_FILING_SUBSET).toEqual({
      kinds: ["request", "escalate"],
      scope: "repo",
      from: "owner",
      to: "delivery",
    });
  });

  test("every filing-subset member is present in its parent vocabulary", () => {
    for (const kind of STEER_FILING_SUBSET.kinds) {
      expect(STEER_KINDS).toContain(kind);
    }
    expect(STEER_SCOPES).toContain(STEER_FILING_SUBSET.scope);
    expect(STEER_FILING_SUBSET.kinds.length).toBeLessThan(STEER_KINDS.length);
  });
});

describe("TC-STEER-082 the declared bounds and the ttl grammar", () => {
  test("every bound equals the spec's declared value", () => {
    expect(STEER_MAX_TEXT_CHARS).toBe(160);
    expect(STEER_MAX_REF_CHARS).toBe(160);
    expect(STEER_MAX_LIST_ROWS_PER_GROUP).toBe(8);
    expect(STEER_MAX_READ_PAYLOAD_NOTES).toBe(20);
    expect(STEER_MAX_MACHINE_BYTES).toBe(65_536);
    expect(STEER_MAX_HUMAN_LINES).toBe(32);
    expect(STEER_MAX_HUMAN_BYTES).toBe(6_144);
    expect(STEER_MAX_ASKS).toBe(BOARD_MAX_ASKS);
    expect(STEER_MAX_ASKS).toBe(8);
  });

  test("the ttl grammar declares its units, maximum, and drawn default once", () => {
    expect([...STEER_TTL_UNITS]).toEqual(["s", "m", "h", "d"]);
    expect(STEER_TTL_UNIT_MS).toEqual({ s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 });
    expect(STEER_MAX_TTL_SECONDS).toBe(2_592_000);
    expect(STEER_MAX_TTL_MS).toBe(2_592_000_000);
    expect(STEER_DEFAULT_TTL).toBe("24h");
    expect(STEER_DEFAULT_TTL_MS).toBe(86_400_000);
    expect(STEER_MAX_TTL_MS).toBe(30 * STEER_TTL_UNIT_MS.d);
  });

  test("the record identity, payload identity, and record kinds are declared once", () => {
    expect(STEER_SCHEMA_VERSION).toBe("delivery.steer.v1");
    expect(STEER_MESSAGE_ID_PREFIX).toBe("msg-");
    expect([...STEER_RECORD_KINDS]).toEqual([
      "steering.message",
      "steering.outcome",
      "steering.completion",
    ]);
    expect([...STEER_ERROR_CODES]).toEqual([
      "steer.unknown-id",
      "steer.credential-value-rejected",
      "steer.queue-unavailable",
    ]);
  });
});

describe("TC-STEER-021 the shared priority class map", () => {
  test("the class map is exactly urgent=1, high=2, normal=3, low=4 in both directions", () => {
    expect(STEER_PRIORITY_CLASS_BY_PRIORITY).toEqual({
      urgent: 1,
      high: 2,
      normal: 3,
      low: 4,
    });
    expect(Object.keys(STEER_PRIORITY_CLASS_BY_PRIORITY).sort()).toEqual([
      "high",
      "low",
      "normal",
      "urgent",
    ]);
    expect(STEER_RANK_KEY).toBe("priority-class,created,id");
  });
});

const messageOf = (overrides: Partial<SteerMessageRecord> = {}): SteerMessageRecord => ({
  id: "msg-fixture-1",
  from: "owner",
  to: "delivery",
  scope: "repo",
  kind: "request",
  subject: "prefer smaller diffs",
  ref: null,
  origin: { change: "GH-298", repo: "example/product", agent: "owner" },
  priority: "normal",
  created: "2026-11-16T12:00:00.000Z",
  ttl: 86_400_000,
  ...overrides,
});

describe("TC-STEER-007 the shared validator has no owner branch", () => {
  test("a non-owner-issued record validates against the same schema and key set", () => {
    const nonOwner = messageOf({
      from: "coordinator",
      to: "delivery",
      scope: "change",
      kind: "ask",
      origin: { change: null, repo: "example/product", agent: "coordinator" },
    });
    const validated = validateSteerMessage(nonOwner);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(Object.keys(validated.value).sort()).toEqual(Object.keys(messageOf()).sort());
    expect(validated.value.kind).toBe("ask");
    expect(validated.value.origin.agent).toBe("coordinator");
  });

  test("malformed variants are rejected naming the field", () => {
    const variants: readonly { readonly field: string; readonly record: unknown }[] = [
      {
        field: "ttl",
        record: (() => {
          const { ttl, ...rest } = messageOf();
          void ttl;
          return rest;
        })(),
      },
      { field: "ttl", record: messageOf({ ttl: 0 }) },
      { field: "ttl", record: messageOf({ ttl: 2_592_000_001 }) },
      { field: "priority", record: { ...messageOf(), priority: "critical" } },
      { field: "scope", record: { ...messageOf(), scope: "galaxy" } },
      { field: "kind", record: { ...messageOf(), kind: "steer" } },
      { field: "subject", record: messageOf({ subject: "x".repeat(161) }) },
      { field: "ref", record: messageOf({ ref: "x".repeat(161) }) },
      { field: "ownerNoteId", record: { ...messageOf(), ownerNoteId: "n-1" } },
    ];
    for (const variant of variants) {
      const validated = validateSteerMessage(variant.record);
      expect(validated.ok, variant.field).toBe(false);
      if (!validated.ok) {
        expect(validated.code).toBe("input.value.rejected");
        expect(validated.field).toBe(variant.field);
      }
    }
  });
});

describe("TC-STEER-003 the one pure ttl parser", () => {
  test("every declared unit parses to its millisecond duration", () => {
    expect(parseSteerTtl("90s")).toEqual({ ok: true, ms: 90_000, unit: "s" });
    expect(parseSteerTtl("90m")).toEqual({ ok: true, ms: 5_400_000, unit: "m" });
    expect(parseSteerTtl("24h")).toEqual({ ok: true, ms: 86_400_000, unit: "h" });
    expect(parseSteerTtl("14d")).toEqual({ ok: true, ms: 1_209_600_000, unit: "d" });
    expect(parseSteerTtl("30d")).toEqual({ ok: true, ms: 2_592_000_000, unit: "d" });
    expect(parseSteerTtl("2592000s")).toEqual({ ok: true, ms: 2_592_000_000, unit: "s" });
    expect(parseSteerTtl("720h")).toEqual({ ok: true, ms: 2_592_000_000, unit: "h" });
    expect(parseSteerTtl("43200m")).toEqual({ ok: true, ms: 2_592_000_000, unit: "m" });
  });

  test("zero, negative, oversized, and malformed values are refused with no coercion", () => {
    for (const cell of ["0s", "0m", "0h", "0d", "-1h", "-30m"]) {
      expect(parseSteerTtl(cell).ok, cell).toBe(false);
    }
    for (const cell of ["31d", "8761h", "2592001s"]) {
      const parsed = parseSteerTtl(cell);
      expect(parsed.ok, cell).toBe(false);
      if (!parsed.ok) expect(parsed.reason).toBe("too-large");
    }
    for (const cell of ["24", "h", "1.5h", "24 h", "24H", "24y", "+1h", "", " 24h"]) {
      const parsed = parseSteerTtl(cell);
      expect(parsed.ok, cell).toBe(false);
      if (!parsed.ok) expect(parsed.reason).toBe("malformed");
    }
  });

  test("the family declares exactly one duration parser", () => {
    const text = readFileSync(join(ROOT, "packages/core/src/domain/steer.ts"), "utf8");
    expect(text.match(/\(\[smhd\]\)/gu)?.length ?? 0).toBe(1);
    expect(text).not.toContain("parseDuration");
  });
});

describe("TC-STEER-017 the inclusive ttl predicate and derived expiry", () => {
  const created = "2026-11-16T12:00:00.000Z";
  const ttl = 86_400_000;
  const boundary = Date.parse(created) + ttl;

  test("the predicate is exactly now >= created + ttl", () => {
    expect(steerTtlElapsed(boundary - 1, created, ttl)).toBe(false);
    expect(steerTtlElapsed(boundary, created, ttl)).toBe(true);
    expect(steerTtlElapsed(boundary + 1, created, ttl)).toBe(true);
  });

  test("expiresAt is a pure function of the stored created and ttl", () => {
    expect(steerExpiresAt(created, ttl)).toBe("2026-11-17T12:00:00.000Z");
    expect(steerExpiresAt(created, ttl)).toBe(steerExpiresAt(created, ttl));
  });

  test("aged notes are classified, never refused at filing", () => {
    const stale = messageOf({ created: "2020-01-01T00:00:00.000Z" });
    expect(steerTtlElapsed(boundary, stale.created, stale.ttl)).toBe(true);
    expect(validateSteerMessage(stale).ok).toBe(true);
  });
});

describe("TC-STEER-020/006 measured aging, rank and id shape", () => {
  test("age is measured from the injected clock and never negative", () => {
    const created = "2026-11-16T12:00:00.000Z";
    expect(steerAgeMs(Date.parse(created), created)).toBe(0);
    expect(steerAgeMs(Date.parse(created) + 90_000, created)).toBe(90_000);
    expect(steerAgeMs(Date.parse(created) - 1, created)).toBe(0);
    expect(Number.isInteger(steerAgeMs(Date.parse(created) + 1.7, created))).toBe(true);
  });

  test("the rank key is class, then oldest, then id, with contiguous 1..N", () => {
    const messages: readonly SteerMessageRecord[] = [
      messageOf({ id: "msg-c", priority: "low", created: "2026-11-16T10:00:00.000Z" }),
      messageOf({ id: "msg-b", priority: "urgent", created: "2026-11-16T11:00:00.000Z" }),
      messageOf({ id: "msg-a", priority: "normal", created: "2026-11-16T09:00:00.000Z" }),
      messageOf({ id: "msg-b2", priority: "urgent", created: "2026-11-16T11:00:00.000Z" }),
    ];
    const ranked = rankSteerMessages(messages);
    expect(ranked.map((entry) => entry.record.id)).toEqual(["msg-b", "msg-b2", "msg-a", "msg-c"]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3, 4]);
    expect(rankSteerMessages([...messages].reverse()).map((entry) => entry.record.id)).toEqual(
      ranked.map((entry) => entry.record.id),
    );
  });

  test("the id shape is msg- plus an opaque suffix", () => {
    const id = formatSteerMessageId("01JAB");
    expect(id).toBe("msg-01JAB");
    expect(id.startsWith(STEER_MESSAGE_ID_PREFIX)).toBe(true);
    expect(validateSteerMessage(messageOf({ id })).ok).toBe(true);
  });
});

describe("TC-STEER-008/053 the filing restriction and the registered-value guard", () => {
  test("every shared vocabulary member validates, while filing admits only the subset", () => {
    for (const kind of ["ask", "answer", "notify", "report", "heartbeat"] as const) {
      expect(validateSteerMessage(messageOf({ kind })).ok, kind).toBe(true);
      const filing = validateSteerSend({ text: "a note", kind });
      expect(filing.ok, kind).toBe(false);
      if (!filing.ok) expect(filing.field).toBe("kind");
    }
    for (const kind of ["request", "escalate"] as const) {
      expect(validateSteerSend({ text: "a note", kind }).ok, kind).toBe(true);
    }
  });

  test("the guard is the registered-value match only, with no pattern layer", () => {
    const secrets = ["S3CR3T-REGISTERED-VALUE"] as const;
    const blocked = evaluateSteerGuard({
      subject: "contains S3CR3T-REGISTERED-VALUE",
      secrets,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe("steer.credential-value-rejected");
      expect(blocked.field).toBe("subject");
      expect(blocked.summary).not.toContain(secrets[0]);
    }
    const tokenShaped = [
      ["ghp", "_", "0".repeat(36)].join(""),
      ["AKIA", "IOSFODNN7EXAMPLE"].join(""),
      ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "signature"].join("."),
      ["sk", "-", "0".repeat(24)].join(""),
    ];
    for (const value of tokenShaped) {
      expect(evaluateSteerGuard({ subject: value, secrets }).ok, value).toBe(true);
    }
    const text = readFileSync(join(ROOT, "packages/core/src/domain/steer.ts"), "utf8");
    expect(text).toContain("containsRegisteredSecret");
    expect(text).not.toContain("TOKEN_PATTERN");
    expect(text).not.toContain("entropy");
  });
});

describe("TC-STEER-010/013 boundary derivation and derived lifecycle", () => {
  test("no phase record is open with the phase-unrecorded reason", () => {
    expect(deriveSteerBoundary({ present: false, entries: [] })).toEqual({
      open: true,
      phase: null,
      phaseUnknownReason: "phase-unrecorded",
    });
  });

  test("every completed entry is open at the latest completion; an in-progress entry closes", () => {
    const open = deriveSteerBoundary({
      present: true,
      entries: [
        { phaseId: "delivery", started: "2026-11-16T10:00:00Z", completed: "2026-11-16T11:00:00Z" },
        {
          phaseId: "review_fix",
          started: "2026-11-16T11:30:00Z",
          completed: "2026-11-16T12:00:00Z",
        },
        {
          phaseId: "quality_gates",
          started: "2026-11-16T09:00:00Z",
          completed: "2026-11-16T09:30:00Z",
        },
      ],
    });
    expect(open).toEqual({ open: true, phase: "review_fix" });
    expect(
      deriveSteerBoundary({
        present: true,
        entries: [
          {
            phaseId: "delivery",
            started: "2026-11-16T10:00:00Z",
            completed: "2026-11-16T11:00:00Z",
          },
          { phaseId: "review_fix", started: "2026-11-16T11:00:00Z", completed: null },
        ],
      }),
    ).toEqual({ open: false, phase: "review_fix" });
  });

  test("lifecycle derives from appended records, never a stored flag", () => {
    const applied = {
      schemaId: "delivery.steering.outcome.v1" as const,
      id: "msg-1",
      outcome: "applied" as const,
      recordedAt: "2026-11-16T12:30:00Z",
      receipt: {
        origin: { change: null, repo: "r", agent: "owner" },
        readReceipt: { at: "2026-11-16T12:30:00Z", boundary: "delivery" },
        ttl: 86_400_000,
        expiresAt: "2026-11-17T12:00:00Z",
      },
    };
    const completion = {
      schemaId: "delivery.steering.completion.v1" as const,
      id: "msg-1",
      completedAt: "2026-11-16T13:00:00Z",
      artifact: "doc/changes/x/chg-GH-298-plan.yaml",
    };
    expect(deriveSteerLifecycle("msg-1", [], [])).toBe("queued");
    expect(deriveSteerLifecycle("msg-1", [applied], [])).toBe("landed");
    expect(deriveSteerLifecycle("msg-1", [applied], [completion])).toBe("completed");
    expect(
      deriveSteerLifecycle(
        "msg-1",
        [
          {
            schemaId: "delivery.steering.outcome.v1",
            id: "msg-1",
            outcome: "expired",
            recordedAt: "2026-11-16T12:30:00Z",
            reason: "ttl-elapsed",
          },
        ],
        [completion],
      ),
    ).toBe("expired");
  });
});

describe("TC-STEER-042 completion validation is receipt-first and artifact-required", () => {
  test("queued, expired and completed notes are refused; a missing or oversized ref is refused", () => {
    expect(validateSteerCompletion({ id: "msg-1", ref: "a" }, "queued").ok).toBe(false);
    expect(validateSteerCompletion({ id: "msg-1", ref: "a" }, "expired").ok).toBe(false);
    expect(validateSteerCompletion({ id: "msg-1", ref: "a" }, "completed").ok).toBe(false);
    expect(validateSteerCompletion({ id: "msg-1" }, "landed").ok).toBe(false);
    expect(validateSteerCompletion({ id: "msg-1", ref: "" }, "landed").ok).toBe(false);
    expect(validateSteerCompletion({ id: "msg-1", ref: "x".repeat(161) }, "landed").ok).toBe(false);
    expect(validateSteerCompletion({ id: "msg-1", ref: "x".repeat(160) }, "landed").ok).toBe(true);
  });
});

const steerStateKinds = (): readonly string[] => [
  "steering.message",
  "steering.outcome",
  "steering.completion",
];

describe("TC-STEER-084 the three additive state record kinds are declared", () => {
  test("the steering kinds and key prefixes are declared once", async () => {
    const state = await import("../../packages/core/src/state/index");
    expect(steerStateKinds()).toEqual([
      "steering.message",
      "steering.outcome",
      "steering.completion",
    ]);
    expect(state.STEERING_ARTIFACT_BOUNDARY.kinds.map((kind) => kind.kind)).toEqual(
      steerStateKinds(),
    );
    expect(STEER_MESSAGE_RECORD_KIND).toBe("steering.message");
    expect(state.steeringMessageRecordKey("msg-1")).toBe("steering.messages:msg-1");
    expect(state.steeringOutcomeRecordKey("msg-1")).toBe("steering.outcomes:msg-1");
    expect(state.steeringCompletionRecordKey("msg-1")).toBe("steering.completions:msg-1");
  });
});
