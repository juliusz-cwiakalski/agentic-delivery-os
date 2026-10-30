import type {
  ConfigLayer,
  ConfigNodeOrigins,
  ConfigOrigin,
  ConfigSourceFacts,
  ConfigValue,
} from "../../../packages/core/src/contracts/config";

/** Injected facts model what the production file port returns; Phase 3 tests parse actual YAML. */
export const fileFacts = (
  layer: Exclude<ConfigLayer, "defaults" | "environment" | "cli">,
  values: Record<string, ConfigValue>,
  line: number,
  reset?: readonly string[],
): ConfigSourceFacts => {
  const file = `fixtures/${layer}.yaml`;
  const origins: Record<string, ConfigOrigin> = {};
  const mark = (node: ConfigValue, path: string): void => {
    origins[path] = { layer, file, line };
    if (Array.isArray(node))
      node.forEach((child, index) => {
        mark(child, `${path}[${index}]`);
      });
    else if (node !== null && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) mark(child, `${path}.${key}`);
    }
  };
  for (const [key, node] of Object.entries(values)) {
    if (key !== "$schema" && key !== "reset") mark(node, key);
  }
  return {
    layer,
    values,
    origins: origins as ConfigNodeOrigins,
    loadedFile: { layer, file },
    ...(reset ? { reset } : {}),
  };
};
