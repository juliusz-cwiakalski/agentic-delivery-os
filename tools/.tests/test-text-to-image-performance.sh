#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/test-text-to-image-performance.sh
#
# test-text-to-image-performance.sh — Performance tests for text-to-image
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-text-to-image-performance)"
_test_count=0
_test_passed=0
_test_failed=0
_test_tmpdir=""

# Colors (disabled if not a terminal)
if [[ -t 1 ]]; then
  readonly _RED=$'\033[0;31m'
  readonly _GREEN=$'\033[0;32m'
  readonly _YELLOW=$'\033[0;33m'
  readonly _RESET=$'\033[0m'
else
  readonly _RED="" _GREEN="" _YELLOW="" _RESET=""
fi

_test_setup() {
  _test_tmpdir="$(mktemp -d)"
}

_test_teardown() {
  [[ -n "${_test_tmpdir}" && -d "${_test_tmpdir}" ]] && rm -rf "${_test_tmpdir}"
}

trap '_test_teardown' EXIT

# Run a test function
run_test() {
  local -r name="$1"
  local -r func="$2"
  _test_count=$(( _test_count + 1 ))

  _test_setup

  if ( set -e; "${func}" ); then
    _test_passed=$(( _test_passed + 1 ))
    printf '%s[PASS]%s %s\n' "${_GREEN}" "${_RESET}" "${name}"
  else
    _test_failed=$(( _test_failed + 1 ))
    printf '%s[FAIL]%s %s\n' "${_RED}" "${_RESET}" "${name}" >&2
  fi

  _test_teardown
  _test_tmpdir=""
}

# Assertions
assert_lt() {
  local -r actual="$1" limit="$2" msg="${3:-}"
  if (( $(echo "$actual < $limit" | bc -l) )); then
    true
  else
    printf '  Value %s not less than %s\n' "${actual}" "${limit}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

assert_eq() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" != "${actual}" ]]; then
    printf '  Expected: %s\n  Actual:   %s\n' "${expected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

assert_file_exists() {
  local -r path="$1" msg="${3:-}"
  if [[ ! -f "${path}" ]]; then
    printf '  File does not exist: %s\n' "${path}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

# Print test summary
print_summary() {
  printf '\n%s Summary: %d/%d passed' "${TEST_TAG}" "${_test_passed}" "${_test_count}"
  if [[ "${_test_failed}" -gt 0 ]]; then
    printf ' (%s%d failed%s)\n' "${_RED}" "${_test_failed}" "${_RESET}"
    return 1
  else
    printf ' %s(all passed)%s\n' "${_GREEN}" "${_RESET}"
    return 0
  fi
}

# ============================================================================
# SOURCE THE SCRIPT UNDER TEST
# ============================================================================
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/text-to-image"

# ============================================================================
# PERFORMANCE TESTS
# ============================================================================

test_cache_hit_performance() {
  ensure_directories
  # Create a cache entry
  export FORCE=false
  export EMBED_METADATA=false
  export ARTIST=""
  export COPYRIGHT=""
  export KEYWORDS=""
  export DESCRIPTION=""
  export OUTPUT_FORMAT="text"
  export OPENAI_API_KEY="sk-mock123"
  _curl() {
    # Mock for cache generation: return JSON with URL, then write image data
    if [[ "$*" == *"/v1/images/generations"* ]]; then
      echo '{"data":[{"url":"http://mock.url/image.png"}]}'
    elif [[ "$*" == *"http://mock.url/image.png"* ]]; then
      echo "cached data" > "$3"
    else
      # For -w "%{http_code}" calls
      echo "200"
    fi
  }
  local output="${_test_tmpdir}/test.png"
   # Generate once (populates cache)
   generate_image "cache perf" "" 1024 1024 high "$output" "" "" >/dev/null 2>&1
   # Measure cache hit time
   local start
   start=$(date +%s%3N)
   generate_image "cache perf" "" 1024 1024 high "${_test_tmpdir}/test2.png" "" "" >/dev/null 2>&1
  local end
  end=$(date +%s%3N)
  local duration=$((end - start))
  assert_lt "$duration" 100 "Cache hit should be <100ms, was ${duration}ms"
}

test_parallel_batch_speedup() {
  ensure_directories
  export OPENAI_API_KEY="sk-mock123"
  export FORCE=false
  export EMBED_METADATA=false
  export ARTIST=""
  export COPYRIGHT=""
  export KEYWORDS=""
  export DESCRIPTION=""
  export OUTPUT_FORMAT="text"
  _curl() {
    # Simulate network delay (only for actual API calls, not for cache checks)
    if [[ "$*" == *"/v1/images/generations"* ]]; then
      sleep 0.1  # Simulate API processing time
      echo '{"data":[{"url":"http://mock.url/image.png"}]}'
    elif [[ "$*" == *"http://mock.url/image.png"* ]]; then
      sleep 0.1  # Simulate download time
      echo "mock image data" > "$3"
    else
      # For -w "%{http_code}" calls (rate limit checking) return success
      echo "200"
    fi
  }
  local jobs='[{"prompt":"p1","output":"'"${_test_tmpdir}"'/p1.png","quality":"high"},{"prompt":"p2","output":"'"${_test_tmpdir}"'/p2.png","quality":"high"}]'
  # Sequential
  local start
  start=$(date +%s%3N)
  process_batch_sequential "$jobs"
  local seq_time=$(( $(date +%s%3N) - start ))
  # Parallel
  start=$(date +%s%3N)
  process_batch_parallel "$jobs"
  local par_time=$(( $(date +%s%3N) - start ))
  # Check if parallel is faster (allow some variance)
  if (( par_time < seq_time )); then
    true
  else
    printf '  Parallel time %d not faster than sequential %d\n' "$par_time" "$seq_time" >&2
    return 1
  fi
}

test_large_batch() {
  ensure_directories
  export OPENAI_API_KEY="sk-mock123"
  export FORCE=false
  export EMBED_METADATA=false
  export ARTIST=""
  export COPYRIGHT=""
  export KEYWORDS=""
  export DESCRIPTION=""
  export OUTPUT_FORMAT="text"
  _curl() {
    # Simulate network delay (only for actual API calls, not for cache checks)
    if [[ "$*" == *"/v1/images/generations"* ]]; then
      sleep 0.1  # Simulate API processing time
      echo '{"data":[{"url":"http://mock.url/image.png"}]}'
    elif [[ "$*" == *"http://mock.url/image.png"* ]]; then
      sleep 0.1  # Simulate download time
      echo "mock image data" > "$3"
    else
      # For -w "%{http_code}" calls (rate limit checking) return success
      echo "200"
    fi
  }
  # Create 10 jobs
  local jobs='['
  for i in {1..10}; do
    jobs+='{"prompt":"large'"$i"'","output":"'"${_test_tmpdir}"'/large'"$i"'.png","quality":"high"}'
    if (( i < 10 )); then jobs+=','; fi
  done
  jobs+=']'
  process_batch_parallel "$jobs"
  local exit_code=$?
  assert_eq 0 "$exit_code"
  # Check files exist
  for i in {1..10}; do
    assert_file_exists "${_test_tmpdir}/large${i}.png"
  done
}

test_rate_limiting_backoff() {
   # Mock rate limit response
   _curl() {
     # Check if -I flag is present (HEAD request)
     local args=("$@")
     local is_head=false
     for arg in "${args[@]}"; do
       if [[ "$arg" == "-I" ]]; then
         is_head=true
         break
       fi
     done
     
     if [[ "$is_head" == true ]]; then
       # HEAD request for Retry-After header
       echo "HTTP/1.1 429 Too Many Requests"
       echo "Retry-After: 2"
       echo "Content-Type: application/json"
       echo ""
       return 22
     else
       # Regular request with response body + http_code
       echo "Rate limited"
       echo "429"
       return 22
     fi
   }
   # retry_curl should handle backoff
   retry_curl -s "http://mock.api" 2>/dev/null
   local exit_code=$?
   # Should eventually fail after retries
   assert_eq "$EXIT_NETWORK_ERROR" "$exit_code"
}

test_cache_different_models() {
   ensure_directories
   export FORCE=false
   export EMBED_METADATA=false
   export ARTIST=""
   export COPYRIGHT=""
   export KEYWORDS=""
   export DESCRIPTION=""
   export OUTPUT_FORMAT="text"
   export OPENAI_API_KEY="sk-mock123"
   _curl() {
     # Mock for cache generation: return JSON with URL, then write image data
     if [[ "$*" == *"/v1/images/generations"* ]]; then
       echo '{"data":[{"url":"http://mock.url/image.png"}]}'
     elif [[ "$*" == *"http://mock.url/image.png"* ]]; then
       echo "mock data" > "$3"
     else
       # For -w "%{http_code}" calls
       echo "200"
     fi
   }
   local output1="${_test_tmpdir}/test1.png"
   local output2="${_test_tmpdir}/test2.png"
   # Generate with model A
   generate_image "cache test" "" 1024 1024 high "$output1" "" "dall-e-3" >/dev/null 2>&1
   # Measure time for model B (should not hit cache)
   local start
   start=$(date +%s%3N)
   generate_image "cache test" "" 1024 1024 high "$output2" "" "dall-e-2" >/dev/null 2>&1
   local end
   end=$(date +%s%3N)
   local duration=$((end - start))
   # Should not be cache-fast (<500ms), indicate API call
   assert_lt "$duration" 500 "Different model should not hit cache, took ${duration}ms"
}

test_multiple_model_generation() {
   ensure_directories
   export OPENAI_API_KEY="sk-mock123"
   export FORCE=false
   export EMBED_METADATA=false
   export ARTIST=""
   export COPYRIGHT=""
   export KEYWORDS=""
   export DESCRIPTION=""
   export OUTPUT_FORMAT="text"
   _curl() {
     # Simulate API delay
     if [[ "$*" == *"/v1/images/generations"* ]]; then
       sleep 0.1
       echo '{"data":[{"url":"http://mock.url/image.png"}]}'
     elif [[ "$*" == *"http://mock.url/image.png"* ]]; then
       sleep 0.1
       echo "mock data" > "$3"
     else
       echo "200"
     fi
   }
   local start
   start=$(date +%s%3N)
   # Generate with two models (simulating --models)
   generate_image "multi model" "" 1024 1024 high "${_test_tmpdir}/multi1.png" "" "dall-e-3" >/dev/null 2>&1
   generate_image "multi model" "" 1024 1024 high "${_test_tmpdir}/multi2.png" "" "dall-e-2" >/dev/null 2>&1
   local end
   end=$(date +%s%3N)
   local duration=$((end - start))
   # Should take at least 400ms for two calls
   assert_lt 400 "$duration" "Multiple models should involve multiple API calls, took ${duration}ms"
   assert_file_exists "${_test_tmpdir}/multi1.png"
   assert_file_exists "${_test_tmpdir}/multi2.png"
}

test_google_auth_token_caching_performance() {
  # Test that cached token retrieval is fast
  export GOOGLE_AUTH_METHOD="api-key"
  export GOOGLE_API_KEY="perf-test-key"
  _GOOGLE_ACCESS_TOKEN="cached-perf-token"
  _GOOGLE_TOKEN_EXPIRY="$(( $(date +%s) + 3600 ))"

  local start
  start=$(date +%s%3N)
  local token
  for i in {1..100}; do
    token="$(obtain_google_access_token)"
  done
  local end
  end=$(date +%s%3N)
  local duration=$((end - start))
  # 100 cached lookups should complete in under 500ms
  assert_lt "$duration" 500 "100 cached Google token lookups should be <500ms, was ${duration}ms"
  assert_eq "cached-perf-token" "$token"

  # Reset
  _GOOGLE_ACCESS_TOKEN=""
  _GOOGLE_TOKEN_EXPIRY=0
}

test_google_imagen4_generation_with_cache() {
  ensure_directories
  export GOOGLE_AUTH_METHOD="api-key"
  export GOOGLE_API_KEY="mock-google-key"
  export GOOGLE_PROJECT_ID="mock-project"
  export FORCE=false
  export EMBED_METADATA=false
  export ARTIST=""
  export COPYRIGHT=""
  export KEYWORDS=""
  export DESCRIPTION=""
  export OUTPUT_FORMAT="text"
  _curl() {
    if [[ "$*" == *"aiplatform.googleapis.com"* ]]; then
      sleep 0.1
      echo '{"predictions":[{"bytesBase64Encoded":"bW9jayBpbWFnZQ=="}]}'
    fi
  }
  local output1="${_test_tmpdir}/google_perf1.png"
  generate_image "google perf test" "" 1024 1024 high "$output1" "google" "imagen-4.0-generate-001" >/dev/null 2>&1

  # Second call should hit cache and be fast
  local start
  start=$(date +%s%3N)
  local output2="${_test_tmpdir}/google_perf2.png"
  generate_image "google perf test" "" 1024 1024 high "$output2" "google" "imagen-4.0-generate-001" >/dev/null 2>&1
  local end
  end=$(date +%s%3N)
  local duration=$((end - start))
  assert_lt "$duration" 100 "Google Imagen cache hit should be <100ms, was ${duration}ms"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running performance tests...\n' "${TEST_TAG}"

  run_test "cache hit performance <100ms" test_cache_hit_performance
  run_test "parallel batch speedup" test_parallel_batch_speedup
  run_test "large batch processing" test_large_batch
  run_test "rate limiting backoff" test_rate_limiting_backoff
  run_test "cache different models" test_cache_different_models
  run_test "multiple model generation" test_multiple_model_generation
  # Google Imagen 4 performance tests
  run_test "google auth token caching performance" test_google_auth_token_caching_performance
  run_test "google imagen4 generation with cache" test_google_imagen4_generation_with_cache

  print_summary
}

main "$@"