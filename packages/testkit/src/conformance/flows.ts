/**
 * The three-flow, thirteen-step conformance registry (GH-189 F-1, DEC-9).
 *
 * Data only. Flow ids, step ids, operations, and assertion families are stable
 * across providers; capability gating is applied by the runner.
 */
import type { ConformanceFlow } from "./types.js";

/** The v1 registry: exactly three flows covering all eight operations. */
export const CONFORMANCE_FLOWS: readonly ConformanceFlow[] = [
  {
    flowId: "change-lifecycle",
    name: "Change lifecycle",
    steps: [
      {
        stepId: "change-lifecycle.read-work-item",
        operation: "read-work-item",
        assertionFamily: "work-item",
      },
      {
        stepId: "change-lifecycle.read-delivery-request",
        operation: "read-delivery-request",
        assertionFamily: "delivery-request",
      },
      {
        stepId: "change-lifecycle.read-pipeline-run",
        operation: "read-pipeline-run",
        assertionFamily: "pipeline-run",
      },
      {
        stepId: "change-lifecycle.open-change",
        operation: "write-work-item",
        assertionFamily: "work-item",
      },
      {
        stepId: "change-lifecycle.transition",
        operation: "transition-work-item",
        assertionFamily: "work-item",
      },
      {
        stepId: "change-lifecycle.create-delivery-request",
        operation: "write-delivery-request",
        assertionFamily: "delivery-request",
      },
      {
        stepId: "change-lifecycle.comment",
        operation: "write-comment",
        assertionFamily: "comment-provenance",
      },
      {
        stepId: "change-lifecycle.resolve-delivery-thread",
        operation: "resolve-delivery-thread",
        assertionFamily: "delivery-thread",
      },
    ],
  },
  {
    flowId: "comment-provenance",
    name: "Comment provenance",
    steps: [
      {
        stepId: "comment-provenance.read-comments",
        operation: "read-work-item",
        assertionFamily: "comment-provenance",
      },
      {
        stepId: "comment-provenance.carrier-roundtrip",
        operation: "write-comment",
        assertionFamily: "comment-provenance",
        requiresCarrier: true,
      },
    ],
  },
  {
    flowId: "label-semantics",
    name: "Label semantics",
    steps: [
      {
        stepId: "label-semantics.read-labels",
        operation: "read-work-item",
        assertionFamily: "label-semantics",
      },
      {
        stepId: "label-semantics.replace",
        operation: "write-work-item",
        assertionFamily: "label-semantics",
      },
      {
        stepId: "label-semantics.sweep",
        operation: "write-work-item",
        assertionFamily: "label-semantics",
      },
    ],
  },
];

/** Look up one flow by its stable id. */
export const findFlow = (flowId: string): ConformanceFlow | undefined =>
  CONFORMANCE_FLOWS.find((flow) => flow.flowId === flowId);
