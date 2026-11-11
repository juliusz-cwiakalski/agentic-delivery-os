#!/bin/sh
# Self-evidencing execution-failure shim. Every invocation appends its own path
# to $SHIM_MARKER so the suite can prove the gate actually executed it, prints a
# distinct token, and exits with an execution failure (no parseable problems).
printf '%s\n' "$0" >>"${SHIM_MARKER:?SHIM_MARKER must be set}"
printf '%s\n' "SHIM-EXEC-FAILURE" >&2
exit 3
