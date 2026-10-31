/**
 * Malformed and unavailable IO outcomes. These are the classified seam errors a
 * production `OpencodeSessionIo` would surface; the fake never parses SQL.
 */
import { sessionError } from "./harness";

export const malformedQueryError = sessionError("db.query.failed");

export const unavailableError = sessionError("db.opencode.unavailable");

export const deleteFailedError = sessionError("db.delete.failed");

export const nonArrayBodyError = sessionError("db.query.failed");

export const nonZeroExitError = sessionError("db.query.failed");
