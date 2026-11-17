/**
 * The `metrics.burn-rate` declaration-node read (GH-299 F-6, DM-6, DEC-4).
 *
 * One bounded project-committed document read (the GH-300 `verify.suite-map`
 * precedent): at most one existence probe and one content read, no system,
 * user-global, project-local, environment, or CLI source, and the merged layer
 * tree is never consulted. The document's content is classified, never
 * interpreted: semantic validation belongs to the pure resolver.
 */
import type { MetricsConfigNodeRead } from "@delivery-os/core/contracts";
import { METRICS_BURN_RATE_CONFIG_KEY } from "@delivery-os/core/contracts";
import { type FileAcquisitionInput, readCommittedConfigDocument } from "./config-source.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Extract `metrics["burn-rate"]` from one parsed document; interpret nothing else. */
export const extractMetricsBurnRateNode = (document: unknown): MetricsConfigNodeRead => {
  if (!isRecord(document)) return { ok: true, state: "absent" };
  const branch = document.metrics;
  if (!isRecord(branch)) return { ok: true, state: "absent" };
  const [head, tail] = METRICS_BURN_RATE_CONFIG_KEY.split(".");
  if (head !== "metrics" || tail === undefined) return { ok: true, state: "absent" };
  if (!Object.hasOwn(branch, tail)) return { ok: true, state: "absent" };
  return { ok: true, state: "present", node: branch[tail] };
};

/** Read the declaration node from the project-committed configuration document. */
export const readMetricsBurnRateNode = (input: FileAcquisitionInput): MetricsConfigNodeRead => {
  const read = readCommittedConfigDocument(input);
  if (!read.ok) return { ok: false, state: read.state };
  if (read.state === "absent") return { ok: true, state: "absent" };
  return extractMetricsBurnRateNode(read.document);
};
