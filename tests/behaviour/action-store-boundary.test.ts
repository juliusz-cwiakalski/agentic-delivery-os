/**
 * TC-ACTION-034 — the action registry is a first-class validated boundary:
 * exactly the two owned kinds, payload validation on read and write, classified
 * damage (torn, wrong-kind, permission, malformed), and the doctor store
 * verdict. The delivered retro-registry exactly-three declaration is a control.
 * (NFR-5, DM-1, DM-3; DEC-7, §10, §21.)
 */
import { describe, expect, test } from "bun:test";
import { readActionRegistryState } from "../../packages/cli/src/edge";
import {
  RETRO_ACTION_CLOSURE_RECORD_KIND,
  RETRO_ACTION_RECORD_KEY_PREFIX,
  RETRO_ACTION_RECORD_KIND,
  RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION,
  RETRO_REGISTRY_BOUNDARY_DECLARATION,
} from "../../packages/core/src/contracts/index";
import { readActionRegistry } from "../../packages/core/src/state/action-registry";
import { createArtifactBoundary } from "../../packages/core/src/state/artifact-boundary";
import { conformingDraft } from "../fixtures/action/builders";
import { FILING_MS, NOW_MS } from "../fixtures/action/clock";
import { actionSnapshot, fileAction } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";
import { withinFence } from "../fixtures/state/harness";

const storeFailure = (code: string) => ({
  ok: false as const,
  error: {
    kind: "state" as const,
    code,
    consequence: "not_landed" as const,
    location: { path: "planted-state-path" },
  },
});

describe("TC-ACTION-034 the boundary declares exactly its two kinds", () => {
  test("two kinds under the shared retro.action scope; the delivered three are untouched", () => {
    expect(RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION.kinds.map((kind) => kind.kind)).toEqual([
      RETRO_ACTION_RECORD_KIND,
      RETRO_ACTION_CLOSURE_RECORD_KIND,
    ]);
    expect(RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION.recordKeyPrefix).toBe("retro.action");
    expect(RETRO_REGISTRY_BOUNDARY_DECLARATION.kinds).toHaveLength(3);
  });

  test("the boundary refuses an undeclared kind and an incomplete payload", () => {
    const fixture = makeActionStore("boundary-write");
    try {
      const boundary = createArtifactBoundary(
        fixture.store,
        RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION,
      );
      let refusal: string | undefined;
      withinFence(fixture.store, "boundary-fence", (handle) => {
        const undeclared = boundary.append(handle, {
          kind: "retro.level",
          recordKey: "retro.actions:wrong",
          payload: { schemaId: "delivery.retro.level.v1", name: "change" },
        });
        expect(undeclared.ok).toBe(false);
        if (!undeclared.ok) refusal = undeclared.error.code;
        const incomplete = boundary.append(handle, {
          kind: RETRO_ACTION_RECORD_KIND,
          recordKey: `${RETRO_ACTION_RECORD_KEY_PREFIX}:incomplete`,
          payload: { schemaId: "delivery.retro.action.v1", actionId: "incomplete" },
        });
        expect(incomplete.ok).toBe(false);
      });
      expect(refusal).toBe("state.store.unknown");
      expect(actionSnapshot(fixture.store).actions).toHaveLength(0);
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-034 payload validation and damage classification", () => {
  test("a malformed record is never served and classifies through the boundary guard", () => {
    const fixture = makeActionStore("boundary-malformed");
    try {
      expect(fileAction(fixture.store, conformingDraft(), { actionId: "action-valid" }).ok).toBe(
        true,
      );
      withinFence(fixture.store, "malformed-fence", (handle) => {
        const appended = fixture.store.append(handle, {
          kind: RETRO_ACTION_RECORD_KIND,
          recordKey: `${RETRO_ACTION_RECORD_KEY_PREFIX}:malformed`,
          payload: { schemaId: "delivery.retro.action.v1", actionId: "malformed" },
        });
        expect(appended.ok).toBe(true);
      });
      const read = readActionRegistry(fixture.store);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.actions.map((action) => action.actionId)).toEqual(["action-valid"]);
        expect(read.value.malformed).toHaveLength(1);
      }
      const boundary = createArtifactBoundary(
        fixture.store,
        RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION,
      );
      const boundaryRead = boundary.read();
      expect(boundaryRead.ok).toBe(false);
      if (!boundaryRead.ok) expect(boundaryRead.error.code).toBe("state.store.unknown");
      expect(readActionRegistryState(fixture.store)).toMatchObject({
        ok: false,
        reason: "store-unknown",
        failureCode: "state.store.unknown",
      });
    } finally {
      fixture.cleanup();
    }
  });

  test("a wrong-kind record under the owned scope classifies", () => {
    const fixture = makeActionStore("boundary-wrong-kind");
    try {
      withinFence(fixture.store, "wrong-kind-fence", (handle) => {
        expect(
          fixture.store.append(handle, {
            kind: "retro.level",
            recordKey: `${RETRO_ACTION_RECORD_KEY_PREFIX}:wrong-kind`,
            payload: { schemaId: "delivery.retro.level.v1", name: "change" },
          }).ok,
        ).toBe(true);
      });
      const read = readActionRegistry(fixture.store);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.actions).toHaveLength(0);
        expect(read.value.malformed).toHaveLength(1);
      }
    } finally {
      fixture.cleanup();
    }
  });

  test("torn and permission-denied stores classify with the delivered state identities", () => {
    const torn = {
      readRecords: () => storeFailure("state.store.torn"),
    } as never;
    const tornRead = readActionRegistry(torn);
    expect(tornRead.ok).toBe(false);
    if (!tornRead.ok) expect(tornRead.error.code).toBe("state.store.torn");
    expect(readActionRegistryState(torn)).toMatchObject({
      ok: false,
      reason: "store-torn",
      failureCode: "state.store.torn",
    });

    const denied = {
      readRecords: () => storeFailure("state.permission.denied"),
    } as never;
    expect(readActionRegistryState(denied)).toMatchObject({
      ok: false,
      reason: "store-unreadable",
      failureCode: "state.permission.denied",
    });
  });

  test("an empty store is a verified-empty read and a verified-empty doctor fact", () => {
    const fixture = makeActionStore("boundary-empty");
    try {
      const read = readActionRegistry(fixture.store);
      expect(read.ok && read.value.verdict).toBe("verified-empty");
      expect(readActionRegistryState(fixture.store)).toEqual({
        ok: true,
        verifiedEmpty: true,
        recordCount: 0,
        stores: [{ name: "action-registry", verdict: "verified-empty" }],
      });
    } finally {
      fixture.cleanup();
    }
  });

  test("a verified store reports the action-registry verdict with its record count", () => {
    const fixture = makeActionStore("boundary-verified");
    try {
      expect(fileAction(fixture.store, conformingDraft(), { actionId: "action-1" }).ok).toBe(true);
      const state = readActionRegistryState(fixture.store);
      expect(state).toEqual({
        ok: true,
        verifiedEmpty: false,
        recordCount: 1,
        stores: [{ name: "action-registry", verdict: "valid" }],
      });
      expect(readActionRegistry(fixture.store).ok && FILING_MS < NOW_MS).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });
});
