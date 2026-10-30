import type { ConfigCatalog } from "../../../packages/core/src/config/catalog";

/** Only test data: no ordinary production consumer fields. */
export const FIXTURE_CATALOG = {
  "x-test": {
    type: "object",
    fields: {
      nested: {
        type: "object",
        fields: {
          first: {
            type: "string",
            env: true,
            flag: "--first",
            default: "default-first",
            defaultOrigin: {
              layer: "defaults",
              file: "tests/fixtures/config/catalog.ts",
              line: 15,
            },
          },
          second: { type: "number", env: true, flag: "--second", nullable: true },
        },
      },
      list: { type: "array", items: { type: "string" }, env: true, flag: "--list" },
      requiredValue: { type: "string", required: true, env: true },
      oldValue: { type: "string", deprecated: true },
      credential: { type: "string", source: "environment-only", env: true, required: true },
      localPath: { type: "string", source: "machine-path" },
    },
  },
} as const satisfies ConfigCatalog;
