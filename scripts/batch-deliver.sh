#!/usr/bin/env bash
# batch-deliver.sh — Sequential batch delivery with pre-flight skip
#
# Runs deliver-ticket.sh for each ticket sequentially. Skips tickets that are
# already closed, blocked (human-input-needed), or have merged PRs. Logs a
# human-readable summary with timestamps and durations. Safe to re-run
# (idempotent — skips already-done tickets).
#
# Dependencies: bash>=4, gh, jq
# Usage: batch-deliver.sh [options] <ticket[:branch]>...
#
# Exit codes:
#   0 - All tickets succeeded (merged, blocked, or pr-open)
#   1 - One or more tickets failed
#   2 - Usage error

set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# SETTINGS
# ============================================================================
readonly APP_NAME="batch-deliver"
readonly APP_VERSION="1.1.0"
readonly LOG_TAG="(${APP_NAME})"

readonly EXIT_USAGE=2

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
readonly SCRIPT_DIR
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd -P)"
readonly ROOT_DIR

DELIVER_SCRIPT="${SCRIPT_DIR}/deliver-ticket.sh"
CLEAN_TOOL="${ROOT_DIR}/tools/clean-merged-branches"
readonly SUMMARY_LOG="${ROOT_DIR}/tmp/batch-deliver-summary.log"

DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"

# Platform configuration
ADOS_PLATFORM="${ADOS_PLATFORM:-}"  # github | gitlab (empty = auto-detect)
readonly ADOS_BLOCKED_LABEL="${ADOS_BLOCKED_LABEL:-human-input-needed}"
readonly ADOS_MERGE_STRATEGY="${ADOS_MERGE_STRATEGY:-squash}"  # squash | merge | rebase

# Parsed ticket arrays
PARSED_TICKETS=()
PARSED_BRANCHES=()

# ============================================================================
# TRAPS
# ============================================================================
_on_err() {
  local -r line="$1" cmd="$2" code="$3"
  log_err "line ${line}: '${cmd}' exited with ${code}"
}

trap '_on_err $LINENO "$BASH_COMMAND" $?' ERR
trap 'log_warn "Interrupted"; exit 130' INT TERM

# ============================================================================
# LOGGING
# ============================================================================
_ts() { date '+%H:%M:%S'; }

log_info()   { printf '[%s] ℹ %s %s\n' "$(_ts)" "${LOG_TAG}" "$*" >&2; }
log_warn()   { printf '[%s] ⚠ %s %s\n' "$(_ts)" "${LOG_TAG}" "$*" >&2; }
log_err()    { printf '[%s] ✗ %s %s\n' "$(_ts)" "${LOG_TAG}" "$*" >&2; }
log_debug()  { [[ "${VERBOSE}" == "true" ]] && printf '[%s] ℹ DEBUG %s %s\n' "$(_ts)" "${LOG_TAG}" "$*" >&2 || true; }

die() { log_err "$@"; exit "${EXIT_USAGE}"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

# ============================================================================
# MOCKABLE WRAPPERS
# ============================================================================
_gh()  { command gh "$@"; }
_glab(){ command glab "$@"; }
_git() { command git "$@"; }
_jq()  { command jq "$@"; }

# Platform detection (F-1): Auto-detect gitlab vs github
# Resolution order: ADOS_PLATFORM env var > git remote > glab auth > default github
detect_platform() {
  # 1. Environment override takes precedence
  if [[ -n "${ADOS_PLATFORM}" ]]; then
    if [[ "${ADOS_PLATFORM}" == "github" || "${ADOS_PLATFORM}" == "gitlab" ]]; then
      printf '%s' "${ADOS_PLATFORM}"
      return 0
    fi
    log_warn "Invalid ADOS_PLATFORM value: '${ADOS_PLATFORM}' (must be 'github' or 'gitlab')"
  fi

  # 2. Detect from git remote URL
  local remote_url
  remote_url="$(_git remote get-url origin 2>/dev/null || true)"
  if [[ "${remote_url}" == *"gitlab.com"* ]]; then
    printf '%s' "gitlab"
    return 0
  elif [[ "${remote_url}" == *"github.com"* ]]; then
    printf '%s' "github"
    return 0
  fi

  # 3. Fallback: check if glab is authenticated
  if command -v glab >/dev/null 2>&1; then
    if glab auth status >/dev/null 2>&1; then
      printf '%s' "gitlab"
      return 0
    fi
  fi

  # 4. Default to github (NFR-5)
  printf '%s' "github"
  return 0
}

# F-3: Tracker/MR dispatch seam — routes to correct CLI based on PLATFORM
_tracker() {
  if [[ "${PLATFORM}" == "gitlab" ]]; then
    _glab "$@"
  else
    _gh "$@"
  fi
}

_mr() {
  if [[ "${PLATFORM}" == "gitlab" ]]; then
    _glab "$@"
  else
    _gh "$@"
  fi
}

# F-4: JSON normalization shim — presents common schema from divergent CLI outputs
# Normalized schema (DM-1): {state: open|closed, labels: [name,...]} for issues
#                          [{number, url, head_branch, merged_at}] for MR/PR lists

# Normalize issue JSON from either GitHub or GitLab
tracker_issue_view() {
  local -r ticket_ref="$1"
  local raw_json normalized

  # Default to github if PLATFORM not set
  local platform="${PLATFORM:-github}"

  if [[ "${platform}" == "gitlab" ]]; then
    # GitLab: state is "opened"/"closed", labels are in .labels[].name
    if ! raw_json="$(_tracker issue view "${ticket_ref}" --output json 2>/dev/null)"; then
      return 1
    fi
    # Normalize state and extract labels
    normalized="$(echo "${raw_json}" | _jq '{
      state: (if .state == "opened" then "open" else .state end),
      labels: [.labels[].name]
    }')"
  else
    # GitHub: state is "OPEN"/"CLOSED", labels are in .labels[].name
    if ! raw_json="$(_tracker issue view "${ticket_ref}" --json state,labels 2>/dev/null)"; then
      return 1
    fi
    # Normalize state and extract labels
    normalized="$(echo "${raw_json}" | _jq '{
      state: (if .state == "OPEN" then "open" else .state end),
      labels: [.labels[].name]
    }')"
  fi

  printf '%s' "${normalized}"
}

# Normalize open MR/PR list for a branch
mr_list_for_branch() {
  local -r head_branch="$1"
  local raw_json normalized

  # Default to github if PLATFORM not set
  local platform="${PLATFORM:-github}"

  if [[ "${platform}" == "gitlab" ]]; then
    # GitLab: .iid, .web_url, .source_branch, .merged_at
    if ! raw_json="$(_mr mr list --source-branch "${head_branch}" --output json 2>/dev/null)"; then
      return 1
    fi
    normalized="$(echo "${raw_json}" | _jq '[.[] | {
      number: .iid,
      url: .web_url,
      head_branch: .source_branch,
      merged_at: .merged_at
    } | select(.merged_at == null)]')"
  else
    # GitHub: .number, .url, .headRefName, .mergedAt
    if ! raw_json="$(_mr pr list --head "${head_branch}" --json number,url,headRefName,mergedAt 2>/dev/null)"; then
      return 1
    fi
    normalized="$(echo "${raw_json}" | _jq '[.[] | {
      number: .number,
      url: .url,
      head_branch: .headRefName,
      merged_at: .mergedAt
    } | select(.merged_at == null)]')"
  fi

  printf '%s' "${normalized}"
}

# Normalize closed+merged MR/PR list for a branch
mr_list_closed_merged() {
  local -r head_branch="$1"
  local raw_json normalized

  # Default to github if PLATFORM not set
  local platform="${PLATFORM:-github}"

  if [[ "${platform}" == "gitlab" ]]; then
    # GitLab: .iid, .web_url, .source_branch, .merged_at
    if ! raw_json="$(_mr mr list --source-branch "${head_branch}" --output json 2>/dev/null)"; then
      return 1
    fi
    normalized="$(echo "${raw_json}" | _jq '[.[] | {
      merged_at: .merged_at
    } | select(.merged_at != null)]')"
  else
    # GitHub: .number, .url, .headRefName, .mergedAt
    if ! raw_json="$(_mr pr list --head "${head_branch}" --json number,url,headRefName,mergedAt 2>/dev/null)"; then
      return 1
    fi
    normalized="$(echo "${raw_json}" | _jq '[.[] | {
      merged_at: .mergedAt
    } | select(.mergedAt != null)]')"
  fi

  printf '%s' "${normalized}"
}

# Normalize open MR/PR search by title
mr_list_search() {
  local -r search_term="$1"
  local raw_json normalized

  # Default to github if PLATFORM not set
  local platform="${PLATFORM:-github}"

  if [[ "${platform}" == "gitlab" ]]; then
    # GitLab: .iid
    if ! raw_json="$(_mr mr list --search "${search_term}" --output json 2>/dev/null)"; then
      return 1
    fi
    normalized="$(echo "${raw_json}" | _jq '[.[] | {
      number: .iid
    } | select(.state == "opened")]' 2>/dev/null || echo '[]')"
  else
    # GitHub: .number
    if ! raw_json="$(_mr pr list --search "${search_term}" --json number,state 2>/dev/null)"; then
      return 1
    fi
    normalized="$(echo "${raw_json}" | _jq '[.[] | {
      number: .number
    } | select(.state == "OPEN")]' 2>/dev/null || echo '[]')"
  fi

  printf '%s' "${normalized}"
}

# ============================================================================
# INPUT PARSING (pure functions)
# ============================================================================

# PURE: Extract ticket ref from a spec string
extract_ticket_ref() {
  local -r input="$1"
  printf '%s' "${input%%:*}"
}

# PURE: Extract branch from a spec string (empty if not present)
extract_branch() {
  local -r input="$1"
  if [[ "${input}" == *":"* ]]; then
    printf '%s' "${input#*:}"
  else
    printf ''
  fi
}

# PURE: Convert workItemRef (GH-37) to bare issue number (37) for gh CLI
to_issue_number() {
  local -r ticket_ref="$1"
  printf '%s' "${ticket_ref#*-}"
}

# Add a ticket spec to the parsed arrays
add_ticket() {
  local -r spec="$1"
  PARSED_TICKETS+=("$(extract_ticket_ref "${spec}")")
  PARSED_BRANCHES+=("$(extract_branch "${spec}")")
}

# Load tickets from a file (one per line, skipping blanks and comments)
load_tickets_file() {
  local -r file="$1"
  [[ -f "${file}" ]] || die "Tickets file not found: ${file}"
  local line
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"  # trim leading whitespace
    line="${line%"${line##*[![:space:]]}"}"   # trim trailing whitespace
    [[ -z "${line}" || "${line}" == \#* ]] && continue
    add_ticket "${line}"
  done <"${file}"
}

# ============================================================================
# PRE-FLIGHT CHECK
# ============================================================================

# Check if a ticket should be skipped.
# Prints skip reason (closed|blocked|merged) and returns 0 if should skip.
# Prints nothing and returns 1 if should proceed.
# F-5/F-8: Use tracker_issue_view() for normalized state + ADOS_BLOCKED_LABEL
# F-5: Use mr_list_closed_merged() for merged-PR check
should_skip_ticket() {
  local -r ticket_ref="$1"

  local issue_json
  issue_json="$(tracker_issue_view "$(to_issue_number "${ticket_ref}")" 2>/dev/null)" || {
    return 1  # Can't determine state → don't skip
  }

  local state
  state="$(printf '%s' "${issue_json}" | _jq -r '.state // empty' 2>/dev/null)" || state=""

  # Closed → skip (normalized "closed" token from DM-1)
  if [[ "${state}" == "closed" ]]; then
    printf 'closed'
    return 0
  fi

  # Blocked label (F-8: configurable ADOS_BLOCKED_LABEL)
  local blocked_label="${ADOS_BLOCKED_LABEL:-human-input-needed}"
  if printf '%s' "${issue_json}" | _jq -r '.labels[]' 2>/dev/null | grep -q "${blocked_label}"; then
    printf 'blocked'
    return 0
  fi

  # Merged PR → skip (branch-scoped via mr_list_closed_merged)
  local merged_json
  merged_json="$(mr_list_closed_merged "$(to_issue_number "${ticket_ref}")" 2>/dev/null)" || merged_json='[]'
  if printf '%s' "${merged_json}" | _jq -e '.[0].merged_at' >/dev/null 2>&1; then
    printf 'merged'
    return 0
  fi

  return 1  # Don't skip
}

# ============================================================================
# APPROVED-PR FLOW (Mode B: rebase-before-merge + green-gate wait)
# ============================================================================

# Check if a ticket has the `approved` label (human-approved for merge).
# Returns 0 if approved, 1 otherwise.
# F-5: Use _tracker dispatch for platform-aware label lookup
is_pr_approved() {
  local -r ticket_ref="$1"
  local issue_json
  issue_json="$(tracker_issue_view "$(to_issue_number "${ticket_ref}")" 2>/dev/null)" || return 1
  printf '%s' "${issue_json}" | _jq -r '.labels[]' 2>/dev/null | grep -qx 'approved'
}

# Find the open PR number for a ticket. Prints the number, or empty.
# F-5: Use mr_list_search for platform-aware PR lookup
get_pr_number() {
  local -r ticket_ref="$1"
  local pr_json
  pr_json="$(mr_list_search "${ticket_ref}" 2>/dev/null)" || pr_json='[]'
  printf '%s' "${pr_json}" | _jq -r '.[0].number // empty' 2>/dev/null
}

# Get PR title and body via platform-aware dispatch. Prints "title\nbody".
# F-5: Use _mr dispatch for platform-aware PR view
get_pr_title_and_body() {
  local -r pr_number="$1"
  local pr_json title body
  if [[ "${PLATFORM}" == "gitlab" ]]; then
    # GitLab: glab mr view
    pr_json="$(_mr mr view "${pr_number}" --output json 2>/dev/null)" || pr_json='{}'
    title="$(printf '%s' "${pr_json}" | _jq -r '.title // empty' 2>/dev/null)" || title=""
    body="$(printf '%s' "${pr_json}" | _jq -r '.description // empty' 2>/dev/null)" || body=""
  else
    # GitHub: gh pr view
    pr_json="$(_mr pr view "${pr_number}" --json title,body 2>/dev/null)" || pr_json='{}'
    title="$(printf '%s' "${pr_json}" | _jq -r '.title // empty' 2>/dev/null)" || title=""
    body="$(printf '%s' "${pr_json}" | _jq -r '.body // empty' 2>/dev/null)" || body=""
  fi
  printf '%s\n%s' "${title}" "${body}"
}

# Check if branch is already on latest origin/main (no rebase needed).
# Returns 0 if up to date, 1 otherwise.
is_pr_on_latest_main() {
  local -r branch="$1"
  _git fetch origin main 2>/dev/null || return 1
  local merge_base main_head
  merge_base="$(_git merge-base "origin/main" "${branch}" 2>/dev/null)" || return 1
  main_head="$(_git rev-parse origin/main 2>/dev/null)" || return 1
  [[ "${merge_base}" == "${main_head}" ]]
}

# Resolve rebase conflicts via AI (opencode). Returns 0 on success, 1 on failure.
resolve_rebase_conflicts() {
  local conflict_files
  conflict_files="$(_git diff --name-only --diff-filter=U 2>/dev/null)" || conflict_files=""
  [[ -n "${conflict_files}" ]] || return 1
  log_warn "Rebase conflicts in: ${conflict_files}"
  if command -v opencode >/dev/null 2>&1; then
    opencode run "Resolve git rebase conflicts in these files: ${conflict_files}. Remove all conflict markers (<<<<<<, =======, >>>>>>). Keep both sides where compatible; prefer origin/main for shared infrastructure; prefer our branch for feature-specific code." 2>/dev/null || return 1
    # Verify no conflict markers remain
    _git diff --name-only --diff-filter=U 2>/dev/null | grep -q . && return 1
    return 0
  fi
  return 1
}

# Rebase branch on latest main; push --force-with-lease. Returns 0 on success.
rebase_before_merge() {
  local -r branch="$1"
  _git checkout "${branch}" 2>/dev/null || return 1

  if is_pr_on_latest_main "${branch}"; then
    log_info "PR head already on latest main; skipping rebase"
    return 0
  fi

  log_info "Rebasing ${branch} on origin/main"
  if ! _git rebase origin/main 2>/dev/null; then
    log_warn "Rebase conflict on ${branch}; attempting AI resolution"
    if resolve_rebase_conflicts; then
      _git rebase --continue 2>/dev/null || { _git rebase --abort 2>/dev/null || true; return 1; }
    else
      _git rebase --abort 2>/dev/null || true
      return 1
    fi
  fi

  log_info "Pushing rebased ${branch} (--force-with-lease)"
  _git push --force-with-lease origin "${branch}" 2>/dev/null || return 1
  return 0
}

# Positively confirm a PR has NO status checks configured (legitimately green),
# Check if PR has no CI checks configured (positive confirmation).
# GitHub: uses gh pr view --json statusCheckRollup.
# GitLab (OQ-1): queries pipelines via API; empty = no CI (legit green).
# Returns 0 if positively confirmed no-checks, 1 otherwise (checks exist OR the
# query itself errored — caller must NOT treat that as green).
_pr_has_no_checks_configured() {
  if [[ "${PLATFORM}" == "gitlab" ]]; then
    local -r pr_number="$1"
    local pipelines rc=0

    # GitLab: query pipelines for this MR. Empty result = no CI.
    # glab mr view gives us project_id and iid; we use the API for pipelines.
    pipelines="$(_glab api /projects/:id/merge_requests/"${pr_number}"/pipelines --output json 2>/dev/null)" || rc=$?
    (( rc == 0 )) || return 1  # glab error → cannot positively confirm no-checks

    local count
    count="$(printf '%s' "${pipelines}" | _jq 'length' 2>/dev/null)" || count=""
    [[ "${count}" == "0" ]]
  else
    local -r pr_number="$1"
    local rollup rc=0
    rollup="$(_gh pr view "${pr_number}" --json statusCheckRollup 2>/dev/null)" || rc=$?
    (( rc == 0 )) || return 1  # gh error → cannot positively confirm no-checks
    local count
    count="$(printf '%s' "${rollup}" | _jq -r '.statusCheckRollup | length' 2>/dev/null)" || count=""
    [[ "${count}" == "0" ]]
  fi
}

# F-9: Resolve merge flags based on strategy and platform
# Args: strategy (squash|merge|rebase)
# Prints: platform-specific merge flags
merge_flags_for() {
  local -r strategy="$1"
  if [[ "${PLATFORM}" == "gitlab" ]]; then
    # GitLab: glab mr merge
    case "${strategy}" in
      squash) printf '%s' "--squash --remove-source-branch" ;;
      merge)  printf '%s' "--merge --remove-source-branch" ;;
      rebase) printf '%s' "--rebase --remove-source-branch" ;;
      *)      log_warn "Unknown merge strategy '${strategy}', defaulting to squash"; printf '%s' "--squash --remove-source-branch" ;;
    esac
  else
    # GitHub: gh pr merge
    case "${strategy}" in
      squash) printf '%s' "--squash --delete-branch" ;;
      merge)  printf '%s' "--merge --delete-branch" ;;
      rebase) printf '%s' "--rebase --delete-branch" ;;
      *)      log_warn "Unknown merge strategy '${strategy}', defaulting to squash"; printf '%s' "--squash --delete-branch" ;;
    esac
  fi
}

# F-10: GitLab merge-status polling with stale-conflict no-op-push recovery
# Polls detailed_merge_status until mergeable or timeout. Returns 0 on mergeable, 1 on timeout/error.
gitlab_await_mergeable() {
  local -r pr_number="$1"
  local max_wait=60 poll_interval=5 waited=0

  log_info "Waiting for MR !${pr_number} to become mergeable..."

  while (( waited < max_wait )); do
    local merge_status detailed_status
    merge_status="$(_mr mr view "${pr_number}" --json mergeStatus --output json 2>/dev/null | _jq -r '.mergeStatus // empty' 2>/dev/null)" || merge_status=""
    detailed_status="$(_mr mr view "${pr_number}" --json detailed_merge_status --output json 2>/dev/null | _jq -r '.detailed_merge_status // empty' 2>/dev/null)" || detailed_status=""

    if [[ "${detailed_status}" == "mergeable" ]]; then
      log_info "MR !${pr_number} is mergeable"
      return 0
    fi

    # F-10: Detect stale-conflict (detailed=conflict while merge_status=can_be_merged/has_conflicts=false)
    if [[ "${detailed_status}" == "conflict" ]] && [[ "${merge_status}" == "can_be_merged" || "${merge_status}" == "has_conflicts" ]]; then
      # No-op push to force recompute
      log_info "MR !${pr_number} has stale conflict status; performing no-op push to recompute"
      if ! _git commit --allow-empty -m "chore: force merge-status recompute" 2>/dev/null; then
        log_warn "No-op push failed for MR !${pr_number}"
        return 1
      fi
      if ! _git push 2>/dev/null; then
        log_warn "Failed to push no-op commit for MR !${pr_number}"
        return 1
      fi
      log_info "No-op push complete for MR !${pr_number}; re-polling merge status"
      # Continue polling after recompute
    fi

    sleep "${poll_interval}"
    waited=$((waited + poll_interval))
  done

  log_warn "MR !${pr_number} did not become mergeable within ${max_wait}s (status: ${detailed_status})"
  return 1
}

# Wait for PR checks to be green. Returns:
#   0 — green (all checks passed, or positively confirmed no checks configured)
#   1 — red (a check failed)
#   2 — timeout
#   3 — unknown (CLI error: auth/rate-limit/network/PR-not-found) → caller parks
# F-2: a non-zero CLI check is NOT treated as green. "No checks configured"
# (legit green) is positively confirmed via _pr_has_no_checks_configured; any
# other error returns 3 (unknown) so the caller PARKS instead of merging a
# red/unknown PR.
# F-7/OQ-1: GitLab CI-gate uses pipeline API (empty = no CI → legit green).
wait_for_pr_green() {
  local -r pr_number="$1"
  local max_wait="${BATCH_GREEN_GATE_TIMEOUT:-300}"
  local poll_interval="${BATCH_GREEN_POLL_INTERVAL:-10}"
  local waited=0

  if [[ "${PLATFORM}" == "gitlab" ]]; then
    # GitLab pipeline-based CI-gate (OQ-1)
    log_debug "GitLab CI-gate: polling pipelines for MR !${pr_number}"
      while (( waited < max_wait )); do
        local pipelines rc=0
        # Query pipelines for this MR. glab API returns array.
        pipelines="$(_glab api /projects/:id/merge_requests/"${pr_number}"/pipelines --output json 2>/dev/null)" || rc=$?

      if (( rc == 0 )); then
        local count status
        count="$(printf '%s' "${pipelines}" | _jq 'length' 2>/dev/null)" || count=""
        status="$(printf '%s' "${pipelines}" | _jq -r '.[0].status // empty' 2>/dev/null)" || status=""

        if [[ "${count}" == "0" ]]; then
          # No pipelines = positively confirmed no CI configured → green (OQ-1)
          log_debug "GitLab CI-gate: no pipelines → no CI configured → green"
          return 0
        fi

        # Check the latest pipeline status
        case "${status}" in
          success)
            log_debug "GitLab CI-gate: pipeline succeeded → green"
            return 0
            ;;
          failed)
            log_warn "GitLab CI-gate: pipeline failed → red"
            return 1
            ;;
          pending|running|created|scheduled|manual)
            # Still running → keep polling
            log_debug "GitLab CI-gate: pipeline ${status} → still waiting"
            ;;
          *)
            # Unknown status → unknown, park
            log_warn "GitLab CI-gate: unknown pipeline status '${status}' → parking"
            return 3
            ;;
        esac
      else
        # glab error → unknown, park
        log_warn "GitLab CI-gate: glab API error (rc=${rc}) → parking (not merging)"
        return 3
      fi

      sleep "${poll_interval}"
      waited=$((waited + poll_interval))
    done
    return 2  # Timeout
  else
    # GitHub: use gh pr checks
    while (( waited < max_wait )); do
      local checks_output checks_rc=0
      checks_output="$(_gh pr checks "${pr_number}" 2>/dev/null)" || checks_rc=$?

      if (( checks_rc == 0 )); then
        # gh succeeded → the output is the checks table. Parse it.
        if printf '%s' "${checks_output}" | grep -qi 'fail'; then
          return 1  # Red
        fi
        if ! printf '%s' "${checks_output}" | grep -qiE 'pending|in_progress|queued'; then
          return 0  # All complete, none failed → green
        fi
        # else: still pending → keep polling
      else
        # gh exited non-zero: could be "no checks configured" OR a gh error
        # (auth/rate-limit/network/PR-not-found). F-2: never assume green here.
        if _pr_has_no_checks_configured "${pr_number}"; then
          return 0  # Positively confirmed: legitimately no checks → green
        fi
        log_warn "gh pr checks errored for PR #${pr_number} (rc=${checks_rc}); cannot confirm green — parking (not merging)"
        return 3  # Unknown — caller must park
      fi

      sleep "${poll_interval}"
      waited=$((waited + poll_interval))
    done

    return 2  # Timeout
  fi
}

# Approved PR flow: rebase, wait green, merge with configurable strategy.
# Returns 0 if merged, 1 if couldn't merge (parked).
# F-5/F-9: Uses platform-aware dispatch + ADOS_MERGE_STRATEGY.
# F-10: On GitLab, polls merge status before merge with stale-conflict recovery.
approved_pr_flow() {
  local -r ticket_ref="$1" branch="$2"
  local merge_strategy="${ADOS_MERGE_STRATEGY:-squash}"

  local pr_number
  pr_number="$(get_pr_number "${ticket_ref}")" || pr_number=""
  [[ -n "${pr_number}" ]] || { log_warn "No open PR/MR found for ${ticket_ref}"; return 1; }

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "[DRY-RUN] Would rebase+merge PR #${pr_number} (${merge_strategy}) for ${ticket_ref}"
    return 0
  fi

  # Rebase before merge
  if ! rebase_before_merge "${branch}"; then
    log_warn "Rebase failed for ${ticket_ref}; marking human-input-needed"
    return 1
  fi

  # Wait for green
  local green_rc=0
  wait_for_pr_green "${pr_number}" || green_rc=$?

  if (( green_rc == 1 )); then
    log_warn "PR checks red for ${ticket_ref}; routing back to delivery"
    return 1
  elif (( green_rc == 2 )); then
    log_warn "PR checks timed out for ${ticket_ref}; parking"
    return 1
  elif (( green_rc == 3 )); then
    # CLI error (auth/rate-limit/network/PR-not-found) → unknown, do NOT merge.
    log_warn "PR checks unknown for ${ticket_ref} (CLI error); parking (not merging)"
    return 1
  fi

  # F-10: GitLab merge-status polling (stale-conflict recovery)
  if [[ "${PLATFORM}" == "gitlab" ]]; then
    if ! gitlab_await_mergeable "${pr_number}"; then
      log_warn "MR !${pr_number} not mergeable for ${ticket_ref}; parking"
      return 1
    fi
  fi

  # Merge with PR title + body as commit message
  local pr_info title body
  pr_info="$(get_pr_title_and_body "${pr_number}")" || pr_info=""
  title="$(printf '%s' "${pr_info}" | head -1)"
  body="$(printf '%s' "${pr_info}" | tail -n +2)"

  local merge_flags
  merge_flags="$(merge_flags_for "${merge_strategy}")"

  log_info "Merging PR #${pr_number} (${ticket_ref}) with strategy '${merge_strategy}'"
  if [[ "${PLATFORM}" == "gitlab" ]]; then
    # GitLab: glab mr merge
    _mr mr merge "${pr_number}" "${merge_flags}" --title "${title}" --message "${body}" 2>/dev/null || {
      log_warn "Merge failed for MR !${pr_number}"
      return 1
    }
  else
    # GitHub: gh pr merge
    _mr pr merge "${pr_number}" "${merge_flags}" --subject "${title}" --body "${body}" 2>/dev/null || {
      log_warn "Merge failed for PR #${pr_number}"
      return 1
    }
  fi

  log_info "Merged PR #${pr_number} (${ticket_ref})"
  return 0
}

# ============================================================================
# DURATION FORMATTING (pure function)
# ============================================================================

# PURE: Format seconds into human-readable duration.
# Examples: 45 → "45s", 123 → "2m 3s", 2723 → "45m 23s", 3723 → "1h 2m"
format_duration() {
  local -r total_seconds="$1"
  local hours mins secs

  hours=$((total_seconds / 3600))
  mins=$(((total_seconds % 3600) / 60))
  secs=$((total_seconds % 60))

  if (( hours > 0 )); then
    printf '%dh %dm' "${hours}" "${mins}"
  elif (( mins > 0 )); then
    printf '%dm %ds' "${mins}" "${secs}"
  else
    printf '%ds' "${secs}"
  fi
}

# ============================================================================
# SUMMARY LOGGING
# ============================================================================

log_batch_start() {
  local -r index="$1" total="$2" ticket="$3"
  printf '[%s] [%s/%s] ▶ START %s\n' "$(_ts)" "${index}" "${total}" "${ticket}" >&2
}

log_batch_skip() {
  local -r index="$1" total="$2" ticket="$3" reason="$4"
  printf '[%s] [%s/%s] ⊘ SKIP %s — %s\n' "$(_ts)" "${index}" "${total}" "${ticket}" "${reason}" >&2
}

log_batch_done() {
  local -r index="$1" total="$2" ticket="$3" detail="$4" duration="$5"
  printf '[%s] [%s/%s] ✓ DONE %s — %s (%s)\n' "$(_ts)" "${index}" "${total}" "${ticket}" "${detail}" "${duration}" >&2
}

log_batch_blocked() {
  local -r index="$1" total="$2" ticket="$3" detail="$4" duration="$5"
  printf '[%s] [%s/%s] ⏸ BLOCKED %s — %s (%s)\n' "$(_ts)" "${index}" "${total}" "${ticket}" "${detail}" "${duration}" >&2
}

log_batch_failed() {
  local -r index="$1" total="$2" ticket="$3" detail="$4" duration="$5"
  printf '[%s] [%s/%s] ✗ FAILED %s — %s (%s)\n' "$(_ts)" "${index}" "${total}" "${ticket}" "${detail}" "${duration}" >&2
}

# PURE: Format the final batch summary line block
print_batch_summary() {
  local -r total="$1" merged="$2" skipped="$3" failed="$4" duration="$5"
  local -r parked="${6:-0}"
  printf '\n═══ Batch complete: %d tickets in %s ═══\n' "${total}" "${duration}"
  printf '  Merged/Done: %d\n' "${merged}"
  printf '  Parked:      %d\n' "${parked}"
  printf '  Skipped:     %d\n' "${skipped}"
  printf '  Failed:      %d\n' "${failed}"
}

# ============================================================================
# SEQUENTIAL EXECUTION
# ============================================================================

run_batch() {
  local total=${#PARSED_TICKETS[@]}
  [[ ${total} -gt 0 ]] || { log_info "No tickets to process"; return 0; }

  local batch_start_epoch
  batch_start_epoch="$(date +%s)"

  local results_merged=0 results_skipped=0 results_failed=0 results_parked=0

  local i
  for ((i = 0; i < total; i++)); do
    local ticket="${PARSED_TICKETS[$i]}"
    local branch="${PARSED_BRANCHES[$i]}"
    local index=$((i + 1))

    log_batch_start "${index}" "${total}" "${ticket}"

    # Pre-flight check
    local skip_reason=""
    skip_reason="$(should_skip_ticket "${ticket}" 2>/dev/null)" || skip_reason=""
    if [[ -n "${skip_reason}" ]]; then
      log_batch_skip "${index}" "${total}" "${ticket}" "${skip_reason}"
      results_skipped=$((results_skipped + 1))
      continue
    fi

    # Build input for deliver-ticket.sh
    local input="${ticket}"
    [[ -n "${branch}" ]] && input="${ticket}:${branch}"

    # Run deliver-ticket.sh
    local ticket_start_epoch exit_code=0
    ticket_start_epoch="$(date +%s)"

    if [[ "${DRY_RUN}" == "true" ]]; then
      log_info "[DRY-RUN] Would run: deliver-ticket.sh ${input}"
      exit_code=0
    else
      "${DELIVER_SCRIPT}" "${input}" || exit_code=$?
    fi

    local ticket_end_epoch duration
    ticket_end_epoch="$(date +%s)"
    duration="$(format_duration $((ticket_end_epoch - ticket_start_epoch)))"

    # Classify result
    if [[ ${exit_code} -ne 0 ]]; then
      log_batch_failed "${index}" "${total}" "${ticket}" "exit=${exit_code}" "${duration}"
      results_failed=$((results_failed + 1))
    elif is_pr_approved "${ticket}" 2>/dev/null; then
      # Approved PR flow: rebase, wait green, squash-merge
      local resolve_branch="${branch}"
      # If no explicit branch, try to detect from the PR
      if [[ -z "${resolve_branch}" ]]; then
        local pr_num
        pr_num="$(get_pr_number "${ticket}")" || pr_num=""
        if [[ -n "${pr_num}" ]]; then
          # F-5: Use _mr dispatch + normalized head_branch (DM-1)
          if [[ "${PLATFORM}" == "gitlab" ]]; then
            # GitLab: glab mr view → .source_branch
            resolve_branch="$(_mr mr view "${pr_num}" --output json 2>/dev/null | _jq -r '.source_branch // empty' 2>/dev/null)" || resolve_branch=""
          else
            # GitHub: gh pr view → .headRefName
            resolve_branch="$(_mr pr view "${pr_num}" --json headRefName 2>/dev/null | _jq -r '.headRefName // empty' 2>/dev/null)" || resolve_branch=""
          fi
        fi
      fi
      if [[ -n "${resolve_branch}" ]] && approved_pr_flow "${ticket}" "${resolve_branch}"; then
        log_batch_done "${index}" "${total}" "${ticket}" "merged" "${duration}"
        results_merged=$((results_merged + 1))
      else
        log_batch_blocked "${index}" "${total}" "${ticket}" "approved but merge failed" "${duration}"
        results_parked=$((results_parked + 1))
      fi
    else
      # PR open but not approved → pending review, park and continue
      log_batch_blocked "${index}" "${total}" "${ticket}" "pending review" "${duration}"
      results_parked=$((results_parked + 1))
    fi

    # Clean merged branches between tickets
    if [[ -x "${CLEAN_TOOL}" ]]; then
      log_debug "Running clean-merged-branches between tickets"
      "${CLEAN_TOOL}" --allow-dirty 2>/dev/null || true
    fi
  done

  # Final summary
  local batch_end_epoch total_duration
  batch_end_epoch="$(date +%s)"
  total_duration="$(format_duration $((batch_end_epoch - batch_start_epoch)))"

  print_batch_summary "${total}" "${results_merged}" "${results_skipped}" "${results_failed}" "${total_duration}" "${results_parked}"

  # Write summary log
  mkdir -p "$(dirname "${SUMMARY_LOG}")"
  {
    printf 'Batch delivery — %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'Total: %d, Merged: %d, Parked: %d, Skipped: %d, Failed: %d, Duration: %s\n' \
      "${total}" "${results_merged}" "${results_parked}" "${results_skipped}" "${results_failed}" "${total_duration}"
  } >>"${SUMMARY_LOG}"

  [[ ${results_failed} -eq 0 ]]
}

# ============================================================================
# CLI
# ============================================================================
usage() {
  cat <<EOF
${APP_NAME} ${APP_VERSION} — sequential batch delivery with pre-flight skip

Usage: ${APP_NAME} [options] <ticket[:branch]>...

Runs deliver-ticket.sh for each ticket sequentially. Skips tickets that are
already closed, blocked, or merged. Idempotent — safe to re-run.

Input formats:
  ${APP_NAME} GH-108 GH-110 GH-37                    Positional tickets
  ${APP_NAME} GH-108:fix/branch GH-110:feat/branch   Ticket:branch pairs
  ${APP_NAME} GH-108:fix/branch GH-110 GH-37         Mixed
  ${APP_NAME} --tickets-file tickets.txt              From file (one per line)

Options:
  -h, --help                  Show this help message
  -V, --version               Show version
  -n, --dry-run               Show what would be done
  -v, --verbose               Enable debug output
  --tickets-file <path>       Read tickets from file (one per line)

 Environment:
   DRY_RUN                     Dry-run mode
   VERBOSE                     Debug output
   ADOS_PLATFORM               Platform override: github | gitlab (default: auto-detect)
   ADOS_BLOCKED_LABEL          Label for blocked state (default: human-input-needed)
   ADOS_MERGE_STRATEGY         Merge strategy: squash | merge | rebase (default: squash)

 Exit codes:
   0 - All tickets succeeded
   1 - One or more tickets failed
   2 - Usage error
EOF
}

parse_args() {
  local tickets_file=""
  local positional=()

  while (($#)); do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      -V|--version) printf '%s %s\n' "${APP_NAME}" "${APP_VERSION}"; exit 0 ;;
      -n|--dry-run) DRY_RUN=true ;;
      -v|--verbose) VERBOSE=true ;;
      --tickets-file)
        [[ $# -ge 2 ]] || die "--tickets-file requires a value"
        tickets_file="$2"; shift ;;
      --) shift; positional+=("$@"); break ;;
      -*) die "Unknown option: $1" ;;
      *) positional+=("$1") ;;
    esac
    shift
  done

  # Process positional args
  local arg
  for arg in "${positional[@]}"; do
    add_ticket "${arg}"
  done

  # Process tickets file
  if [[ -n "${tickets_file}" ]]; then
    load_tickets_file "${tickets_file}"
  fi
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  parse_args "$@"

  # F-1: Platform detection (must run before require_cmd)
  PLATFORM=""
  PLATFORM="$(detect_platform)"
  log_info "Detected platform: ${PLATFORM}"

  # F-2: Conditional CLI dependency
  if [[ "${PLATFORM}" == "gitlab" ]]; then
    require_cmd glab
  else
    require_cmd gh
  fi
  require_cmd jq

  local total=${#PARSED_TICKETS[@]}
  [[ ${total} -gt 0 ]] || die "No tickets provided. See --help."

  log_info "Starting batch delivery of ${total} ticket(s)"
  local _i
  for ((_i = 0; _i < total; _i++)); do
    local _t="${PARSED_TICKETS[$_i]}" _b="${PARSED_BRANCHES[$_i]}"
    if [[ -n "${_b}" ]]; then
      log_info "  $((_i + 1))/${total}: ${_t}:${_b}"
    else
      log_info "  $((_i + 1))/${total}: ${_t}"
    fi
  done

  run_batch
}

# Testable main guard
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
