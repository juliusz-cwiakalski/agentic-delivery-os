import type {
  ConfigFailure,
  ConfigFileLayer,
  ConfigOrigin,
  ConfigSourceFacts,
  ConfigValue,
} from "@delivery-os/core/contracts";
import {
  isAlias,
  isMap,
  isNode,
  isScalar,
  isSeq,
  LineCounter,
  type Node,
  parseAllDocuments,
} from "yaml";

export type ParsedConfig =
  | { readonly ok: true; readonly facts: ConfigSourceFacts }
  | { readonly ok: false; readonly error: ConfigFailure };

const MAX_SOURCE_BYTES = 1_048_576;
const MAX_NODES = 2_048;
const MAX_DEPTH = 64;
const MAX_ALIASES = 100;
const CORE_TAG_PREFIX = "tag:yaml.org,2002:";
const ALLOWED_TAGS = new Set([
  `${CORE_TAG_PREFIX}str`,
  `${CORE_TAG_PREFIX}int`,
  `${CORE_TAG_PREFIX}float`,
  `${CORE_TAG_PREFIX}bool`,
  `${CORE_TAG_PREFIX}null`,
  `${CORE_TAG_PREFIX}seq`,
  `${CORE_TAG_PREFIX}map`,
]);

const malformed = (layer: ConfigFileLayer, file: string, line?: number): ParsedConfig => ({
  ok: false,
  error: {
    kind: "config",
    code: "config.file.malformed",
    layer,
    file,
    ...(line !== undefined && line > 0 ? { line } : {}),
  },
});

/** The Node-selected yaml entry reads these switches independently of log level. */
export const parserHostSwitchBlocked = (): boolean =>
  Boolean(process.env.LOG_TOKENS || process.env.LOG_STREAM);

const isJsonScalar = (value: unknown): value is string | number | boolean | null =>
  value === null ||
  typeof value === "string" ||
  typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value));

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/**
 * Parse one YAML 1.2 document into plain facts. Parser exceptions, messages and
 * snippets stay inside this function; callers receive constructed codes only.
 */
export const parseConfigYaml = (
  text: string,
  layer: ConfigFileLayer,
  file: string,
): ParsedConfig => {
  // Guard the actual host switches before constructing a parser. Never mutate
  // the host environment or intercept a global stream.
  if (parserHostSwitchBlocked()) {
    return {
      ok: false,
      error: { kind: "config", code: "config.value.invalid", layer, file },
    };
  }
  if (text.length > MAX_SOURCE_BYTES) return malformed(layer, file);

  try {
    const lines = new LineCounter();
    const documents = parseAllDocuments(text, {
      version: "1.2",
      schema: "core",
      uniqueKeys: true,
      merge: false,
      logLevel: "silent",
      prettyErrors: false,
      keepSourceTokens: true,
      lineCounter: lines,
    });
    if (documents.length !== 1) return malformed(layer, file);
    const document = documents[0];
    if (!document) return malformed(layer, file);
    const first = document.errors[0] ?? document.warnings[0];
    if (document.errors.length > 0 || document.warnings.length > 0) {
      const line = first ? lines.linePos(first.pos[0]).line : undefined;
      return malformed(layer, file, line);
    }
    const contents = document.contents;
    if (!isMap(contents)) return malformed(layer, file);

    const origins: Record<string, ConfigOrigin> = {};
    const ancestors = new Set<Node>();
    let visited = 0;
    let aliases = 0;

    const walk = (node: Node, path: string, depth: number): ConfigValue => {
      visited += 1;
      if (visited > MAX_NODES || depth > MAX_DEPTH) throw new Error("node limit");
      if (ancestors.has(node)) throw new Error("cyclic node");
      if (isAlias(node)) {
        aliases += 1;
        if (aliases > MAX_ALIASES) throw new Error("alias limit");
        const target = node.resolve(document);
        if (!target) throw new Error("unresolved alias");
        return walk(target, path, depth + 1);
      }
      if (node.tag !== undefined && !ALLOWED_TAGS.has(node.tag)) {
        throw new Error("unsupported tag");
      }
      if (node.range === undefined || node.range === null) throw new Error("missing position");
      origins[path] = { layer, file, line: lines.linePos(node.range[0]).line };
      ancestors.add(node);
      try {
        if (isScalar(node)) {
          if (!isJsonScalar(node.value)) throw new Error("non-JSON scalar");
          return node.value;
        }
        if (isSeq(node)) {
          return node.items.map((item, index) => {
            if (!isNode(item)) throw new Error("invalid sequence item");
            return walk(item, `${path}[${index}]`, depth + 1);
          });
        }
        if (isMap(node)) {
          const result: Record<string, ConfigValue> = {};
          const keys = new Set<string>();
          for (const pair of node.items) {
            const keyNode = pair.key;
            const valueNode = pair.value;
            if (!isScalar(keyNode) || !isNonEmptyString(keyNode.value)) {
              throw new Error("non-string key");
            }
            if (keyNode.tag !== undefined && keyNode.tag !== `${CORE_TAG_PREFIX}str`) {
              throw new Error("non-string key tag");
            }
            const key = keyNode.value;
            if (
              keys.has(key) ||
              key === "<<" ||
              key === "__proto__" ||
              key === "prototype" ||
              key === "constructor" ||
              !isNode(valueNode)
            ) {
              throw new Error("invalid mapping key");
            }
            keys.add(key);
            result[key] = walk(valueNode, path ? `${path}.${key}` : key, depth + 1);
          }
          return result;
        }
        throw new Error("unsupported node");
      } finally {
        ancestors.delete(node);
      }
    };

    const root = walk(contents, "", 0);
    if (!root || Array.isArray(root) || typeof root !== "object") {
      return malformed(layer, file);
    }
    delete origins[""];
    return { ok: true, facts: { layer, values: root, origins, loadedFile: { layer, file } } };
  } catch {
    // Never forward an upstream exception message, stack, document or snippet.
    return malformed(layer, file);
  }
};
