/**
 * TC-HARNESS-026 — one totals basis: the per-session totals read and the
 * extractor's session baseline agree, so seat attribution is an added dimension
 * rather than a second sum (RSK-7, T-13).
 */
import { describe, expect, test } from "bun:test";
import {
  createBunSqliteStoreOpener,
  createOpencodeSessionTotalsReader,
} from "../../packages/adapters/src/harness/index";
import { ROOT_BINDING, extractOpencode } from "../fixtures/harness/telemetry-attempts";
import {
  CHILD_SESSION,
  ROOT_SESSION,
  buildOpencodeStore,
} from "../fixtures/harness/opencode-store/build";

const readerFor = (path: string) =>
  createOpencodeSessionTotalsReader({ opener: createBunSqliteStoreOpener(), storePath: path });

describe("TC-HARNESS-026 one totals basis", () => {
  test("the totals read equals the extractor's session baseline once", () => {
    const store = buildOpencodeStore();
    const totals = readerFor(store.path)(ROOT_SESSION);
    const captured = extractOpencode({
      store,
      heldSessionIds: [ROOT_SESSION],
      bindings: { [ROOT_SESSION]: ROOT_BINDING },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(totals).toBeDefined();
    expect(totals?.tokens).toEqual(root?.tokens);
    expect(totals?.cost).toBe(root?.cost);
    expect(totals?.calls).toBe(2);
    // The child is its own baseline, never added into the root's figure.
    expect(root?.calls).toBe(2);
  });

  test("the child session's baseline is its own and the set is not summed", () => {
    const store = buildOpencodeStore();
    const totals = readerFor(store.path)(CHILD_SESSION);
    expect(totals?.tokens.input).toBe(6);
    expect(totals?.calls).toBe(1);
  });

  test("a reported zero cost is reported, not absence (control)", () => {
    const store = buildOpencodeStore({ variant: "reported-zero-cost" });
    const totals = readerFor(store.path)(ROOT_SESSION);
    expect(totals?.cost).toBe(0);
    expect(totals?.tokens.input).toBe(15);
  });

  test("an absent session yields undefined rather than a fabricated zero", () => {
    const store = buildOpencodeStore();
    expect(readerFor(store.path)("ses_not_here")).toBeUndefined();
  });
});
