/**
 * Deterministic, ANSI-free loop human text (GH-348 API-4, API-7, NFR-2).
 *
 * Every renderer is bounded: the status block is at most thirty-two lines and
 * carries the declared keys only. No clock, environment, config, or model call
 * participates; the projection arrives already folded.
 */

import type { LoopStartReceipt } from "@delivery-os/core";
import { renderStatusBlock } from "@delivery-os/core";
import { LOOP_MAX_HUMAN_LINES, type LoopStatusProjection } from "@delivery-os/core/contracts";

/** Clip one block to the declared human line bound, keeping the declared order. */
const bounded = (lines: readonly string[]): string[] =>
  lines.length <= LOOP_MAX_HUMAN_LINES
    ? [...lines]
    : [
        ...lines.slice(0, LOOP_MAX_HUMAN_LINES - 1),
        `truncated=${String(lines.length - LOOP_MAX_HUMAN_LINES + 1)}`,
      ];

/** The declared `key=value` status block, in the declared order. */
export const renderLoopStatusHuman = (projection: LoopStatusProjection): string =>
  `${bounded(renderStatusBlock(projection)).join("\n")}\n`;

/**
 * The `start` receipt: the same status block plus the release fact, so an
 * operator sees the terminal `state=stopped` shape the shell prints.
 */
export const renderLoopStartHuman = (receipt: LoopStartReceipt): string =>
  `${bounded([...renderStatusBlock(receipt), `released=${receipt.released ? "yes" : "no"}`]).join("\n")}\n`;

/**
 * The at-bound exhaustion summary (AC-F3-3): the loop's OWN remediation and its
 * derivable history reference, never the delivered coordinator row's text.
 */
export const renderLoopExhaustion = (summary: string): string => `loop exhausted  ${summary}\n`;
