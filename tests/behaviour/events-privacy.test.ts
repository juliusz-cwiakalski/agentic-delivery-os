/**
 * TC-EVT-084 (behaviour half) — no payload, page, or error carries a credential,
 * token, prompt, transcript, diff, repository content, or `repositoryRoot`.
 */
import { describe, expect, test } from "bun:test";
import { type ControlFrame, DELIVERY_RESULT_TOKENS } from "../../packages/core/src/contracts/index";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import {
  attemptRecord,
  createEventHarness,
  dataOf,
  questionRecord,
} from "../fixtures/events/event-harness";
import { createSurfaceHarness } from "../fixtures/events/surface-harness";

const CANARIES = [
  "/canary/repository-root",
  "canary-prompt-text",
  "canary-transcript",
  "canary-diff-hunk",
  "Bearer canary-token",
  "sk-canary-credential",
];

const payloadKey = (field: string): string => field.replace(/[?]$/u, "").replace(/\[\]$/u, "");

const eventFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

describe("TC-EVT-084 privacy and content safety", () => {
  test("no canary and no repositoryRoot reaches any frame, page, or error", async () => {
    const harness = await createEventHarness({ label: "privacy" });
    try {
      const client = await harness.connect();
      for (const topic of [
        "queue.graph",
        "dispatch.attempt",
        "phase.state",
        "blockers.state",
      ] as const) {
        client.subscribe(topic);
      }
      await Promise.resolve();
      await harness.step();
      // The durable entry record carries the canary root; the projection must not.
      harness.appendEntry({
        schema: "delivery.queue.entry.v1" as never,
        ref: "GH-700",
        repository: "github.com/example/repo",
        repositoryRoot: CANARIES[0] as string,
        priority: 5,
        recordedAt: "2026-11-12T10:00:01.000Z",
      } as never);
      harness.appendAttempt(attemptRecord("GH-700", "completed"));
      harness.appendQuestion({
        ...questionRecord("Q-1", "GH-290"),
        question: "Which gate applies?",
      });
      await harness.step();
      const collected = eventFrames(client.drain());
      expect(collected.length).toBeGreaterThan(0);

      const surfaces = await Promise.all([
        createSurfaceHarness().run(["events", "list"]),
        createSurfaceHarness().run(["events", "list", "--json"]),
        createSurfaceHarness().run(["events", "describe", "queue.graph"]),
        createSurfaceHarness().run(["events", "describe", "queue.graph", "--json"]),
        createSurfaceHarness().run(["events", "describe", "status", "--json"]),
      ]);
      const serialized = `${JSON.stringify(collected)}${surfaces.map((run) => run.stdout).join("")}`;
      for (const canary of CANARIES) expect(serialized).not.toContain(canary);
      expect(serialized).not.toContain("repositoryRoot");

      for (const data of collected) {
        const topic = data.topic as string;
        const kind = data.kind as string;
        const declared = TAXONOMY.topics
          .find((candidate) => candidate.name === topic)
          ?.kinds.find((candidate) => candidate.name === kind);
        const declaredFields = new Set((declared?.payloadFields ?? []).map(payloadKey));
        for (const key of Object.keys(data.payload as Record<string, unknown>)) {
          expect(declaredFields.has(key), `${topic}/${kind}:${key}`).toBe(true);
        }
      }

      // Error envelopes carry identity fields and the requested topic only.
      const refusal = surfaces[4]?.envelope?.error as Record<string, unknown>;
      expect(Object.keys(refusal).sort()).toEqual(
        ["category", "code", "consequence", "remediationHint", "retryable", "summary"].sort(),
      );
      for (const canary of CANARIES) expect(JSON.stringify(refusal)).not.toContain(canary);
    } finally {
      await harness.stop();
      harness.close();
    }
  });

  test("a queue entry's repositoryRoot is excluded from the entry payload by rule", async () => {
    const entry = TAXONOMY.topics
      .find((topic) => topic.name === "queue.graph")
      ?.kinds.find((kind) => kind.name === "entry");
    expect(entry?.payloadFields).toEqual(["ref", "repository?", "priority", "recordedAt"]);
    expect(entry?.payloadFields).not.toContain("repositoryRoot");
  });

  test("the attempt's delivery result token is published; a nested comparison token is not", async () => {
    const harness = await createEventHarness({
      label: "privacy-token",
      processBlockerAnswers: false,
    });
    try {
      const client = await harness.connect();
      client.subscribe("dispatch.attempt");
      await Promise.resolve();
      await harness.step();

      // The attempt record's own token is the declared, non-secret delivery
      // result token; the nested comparison record carries a credential-shaped
      // value that must never reach a frame.
      const credentialCanary = "canary-credential-value";
      const comparisonField = "token";
      harness.appendAttempt({
        ...attemptRecord("GH-701", "completed"),
        token: "merged",
        comparison: {
          class: "verify-change",
          [comparisonField]: credentialCanary,
          outcome: "match",
        },
      });
      harness.appendAttempt({
        ...attemptRecord("GH-702", "refused"),
        token: "failed",
        comparison: { class: "not-applicable", [comparisonField]: null, outcome: "not-applicable" },
      });
      await harness.step();

      const frames = eventFrames(client.drain());
      const completed = frames.find((data) => data.kind === "completed");
      const refused = frames.find((data) => data.kind === "refused");
      expect(completed?.payload).toMatchObject({ token: "merged" });
      expect(refused?.payload).toMatchObject({ token: "failed" });

      // The one published token is a member of the closed vocabulary, never an
      // opaque credential string.
      for (const frame of [completed, refused]) {
        const token = (frame?.payload as { token?: unknown } | undefined)?.token;
        expect(typeof token).toBe("string");
        expect(DELIVERY_RESULT_TOKENS).toContain(token as never);
      }

      // The nested comparison token is not projected at all: it is neither a
      // field named `token` inside a nested object nor a value anywhere.
      expect(JSON.stringify(frames)).not.toContain(credentialCanary);
      for (const frame of frames) {
        const payload = frame.payload as Record<string, unknown>;
        // A flat payload: lists are the only non-scalar value, so no nested
        // record (and therefore no nested `token`) can be published.
        expect(payload).not.toHaveProperty("comparison");
        for (const value of Object.values(payload)) {
          if (Array.isArray(value)) continue;
          expect(typeof value === "object" && value !== null).toBe(false);
        }
      }
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
