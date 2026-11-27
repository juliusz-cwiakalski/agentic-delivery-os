/**
 * GH-416 — the push answer's human bounds and declared key order (TC-LOUT-002).
 *
 * The renderer is a pure projection: at most eight lines, well inside 2 KiB,
 * single-line values, and `cause`/`recordedAt` only when present.
 */
import { describe, expect, test } from "bun:test";
import { renderPushText } from "../../packages/cli/src/output/push-text";

const HEAD = "0123456789abcdef0123456789abcdef01234567";

const accepted = {
  ref: "GH-416",
  repository: "github.com/owner/repo",
  lanePush: {
    verdict: "pushed",
    branch: "feat/GH-416/lane-pushes-own-evidence-commit",
    head: HEAD,
    recorded: true,
    recordedAt: "2026-11-27T00:00:00.000Z",
  },
};

describe("GH-416 TC-LOUT-002 the push answer bounds", () => {
  test("the accepted block is the declared seven lines in order", () => {
    const text = renderPushText(accepted);
    expect(text).toBeDefined();
    const lines = (text ?? "").trimEnd().split("\n");
    expect(lines).toEqual([
      "ref=GH-416",
      "repository=github.com/owner/repo",
      "lanePush=pushed",
      "branch=feat/GH-416/lane-pushes-own-evidence-commit",
      `head=${HEAD}`,
      "recorded=true",
      "recordedAt=2026-11-27T00:00:00.000Z",
    ]);
    expect(lines.length).toBeLessThanOrEqual(16);
    expect(new TextEncoder().encode(text ?? "").length).toBeLessThanOrEqual(2048);
  });

  test("a refusal adds `cause` and omits `recordedAt` when unrecorded", () => {
    const text = renderPushText({
      ref: "GH-416",
      repository: "github.com/owner/repo",
      lanePush: {
        verdict: "failed",
        branch: "feat/GH-416/lane-pushes-own-evidence-commit",
        head: HEAD,
        cause: "non-fast-forward",
        recorded: false,
      },
    });
    const lines = (text ?? "").trimEnd().split("\n");
    expect(lines).toContain("cause=non-fast-forward");
    expect(lines).toContain("recorded=false");
    expect(lines.some((line) => line.startsWith("recordedAt="))).toBe(false);
    expect(lines.length).toBeLessThanOrEqual(16);
  });

  test("every value is single-line and an oversized value is bounded", () => {
    const text = renderPushText({
      ref: "GH-416",
      repository: `repo/${"x".repeat(500)}`,
      lanePush: {
        verdict: "failed",
        branch: "feat/GH-416/a\nb",
        head: HEAD,
        cause: "unclassified",
        recorded: true,
        recordedAt: "2026-11-27T00:00:00.000Z",
      },
    });
    const lines = (text ?? "").trimEnd().split("\n");
    expect(lines.length).toBeLessThanOrEqual(16);
    expect(new TextEncoder().encode(text ?? "").length).toBeLessThanOrEqual(2048);
    for (const line of lines) {
      expect(line.includes("\n")).toBe(false);
    }
    expect(lines.some((line) => line.includes("…"))).toBe(true);
    expect(text).not.toContain("\nb=");
  });

  test("malformed data renders nothing (the generic fallback answers)", () => {
    expect(renderPushText({ ref: "GH-416" })).toBeUndefined();
    expect(renderPushText(null)).toBeUndefined();
    expect(renderPushText({ ref: "GH-416", repository: "r", lanePush: { verdict: "pushed" } })).toBeUndefined();
  });
});
