/**
 * TC-LANE-001 — the lane environment stays model-only for shipped settings:
 * an inventory-style checked proof over the real builders, with the declared
 * credential-entry capacity demonstrably intact.
 */
import { describe, expect, test } from "bun:test";
import type {
  HarnessExecutionEnvironmentDescriptor,
  ProviderProfileSeat,
} from "../../packages/core/src/contracts/index";
import { buildHarnessSpawnEnvironment } from "../../packages/core/src/domain/harness-spawn-env";
import {
  buildProfileEnvRecord,
  type EnvRecord,
} from "../../packages/core/src/provider/profile-env-record";
import { CANARY, fixtureBrand } from "../fixtures/credentials/cases";

const SEATS: Readonly<Record<string, ProviderProfileSeat>> = {
  reviewer: {
    model: "model-reviewer-1",
    capability: "text-only",
    pacingClass: "judgment",
  } as ProviderProfileSeat,
  coder: {
    model: "model-coder-1",
    capability: "text-only",
    pacingClass: "judgment",
  } as ProviderProfileSeat,
};

const SEAT_MODELS: Readonly<Record<string, string>> = {
  reviewer: "model-reviewer-1",
  coder: "model-coder-1",
};

describe("TC-LANE-001 the shipped lane environment is model-only", () => {
  test("the profile env record built from shipped settings carries exactly the model-name set", () => {
    const built = buildProfileEnvRecord({
      seatModels: SEAT_MODELS,
      seats: SEATS,
      namePrefix: "fixture",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const record: EnvRecord = built.record;
    // Set equality against the declared model names — not a count that can
    // drift. No credential entry is present under shipped settings.
    const entryNames = record.entries.map((entry) => entry.name).sort();
    const expectedNames = Object.keys(SEATS)
      .map((seat) => entryNameFor(seat))
      .sort();
    expect(entryNames).toEqual(expectedNames);
    const entryValues = record.entries.map((entry) => entry.value).sort();
    expect(entryValues).toEqual([...Object.values(SEAT_MODELS)].sort());
  });

  test("the descriptor built from shipped settings declares no credential entry", () => {
    const descriptor: HarnessExecutionEnvironmentDescriptor = {
      environment: [
        { kind: "variable", name: "FIXTURE_MODEL", optional: false },
        { kind: "variable", name: "FIXTURE_OPTIONAL", optional: true },
      ],
    };
    const credentialEntries = descriptor.environment.filter((entry) => entry.kind === "credential");
    expect(credentialEntries).toEqual([]);
  });

  test("control: an operator-declared credential entry keeps the delivered spawn-time behaviour", () => {
    const descriptor: HarnessExecutionEnvironmentDescriptor = {
      environment: [
        ...SHIPPED_VARIABLES,
        {
          kind: "credential",
          name: "HARNESS_AUTH",
          reference: {
            referenceName: "lane-credential",
            sourceKey: { style: "literal", name: "FIXTURE_CREDENTIAL" },
          },
        },
      ],
    };
    // Spawn-time resolution through the port: present value enters the child
    // environment; absent value is the classified failure naming the item —
    // the delivered contract, unchanged.
    const resolved = buildHarnessSpawnEnvironment({
      descriptor,
      parentEnvironment: { FIXTURE_SHIPPED: "shipped-value" },
      credentials: environmentPort({ FIXTURE_CREDENTIAL: CANARY }),
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.value.HARNESS_AUTH).toBe(CANARY);

    const refused = buildHarnessSpawnEnvironment({
      descriptor,
      parentEnvironment: { FIXTURE_SHIPPED: "shipped-value" },
      credentials: environmentPort({}),
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error.code).toBe("config.credential.missing");
      expect(refused.error.reference).toBe("lane-credential");
      expect(refused.error.summary).toContain("reason variable-absent");
    }
  });
});

const SHIPPED_VARIABLES = [{ kind: "variable" as const, name: "FIXTURE_SHIPPED", optional: false }];

const entryNameFor = (seat: string): string =>
  `OC_FIXTURE_AGENT_${seat
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}_MODEL`;

const environmentPort = (environment: Record<string, string | undefined>) => {
  const { createEnvironmentCredentialPort } =
    require("../../packages/adapters/src/credentials/index") as {
      createEnvironmentCredentialPort: (options: {
        environment: Record<string, string | undefined>;
        brand: typeof fixtureBrand;
      }) => {
        resolve: (reference: {
          referenceName: string;
          sourceKey: { style: "literal"; name: string };
        }) => unknown;
      };
    };
  return createEnvironmentCredentialPort({ environment, brand: fixtureBrand });
};
