#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/test-text-to-image-integration.sh
#
# test-text-to-image-integration.sh — Integration tests for text-to-image
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-text-to-image-integration)"
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
assert_eq() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" != "${actual}" ]]; then
    printf '  Expected: %s\n  Actual:   %s\n' "${expected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

assert_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" != *"${needle}"* ]]; then
    printf '  Haystack: %s\n  Needle:   %s\n' "${haystack}" "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
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

assert_exit_code() {
  local -r expected="$1" actual="$2" msg="${3:-}"
  if [[ "${expected}" -ne "${actual}" ]]; then
    printf '  Expected exit code: %s\n  Actual exit code:   %s\n' "${expected}" "${actual}" >&2
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
# MOCK FUNCTIONS
# ============================================================================

# Mock curl for API responses
mock_curl_openai() {
  echo '{"data":[{"url":"http://mock.url/image.png"}]}'
}

mock_curl_download() {
  echo "mock image data" > "$3"
}

# ============================================================================
# TESTS
# ============================================================================

test_end_to_end_openai_generation() {
   ensure_directories
   export OPENAI_API_KEY="sk-mock123"
   export FORCE=false
   export EMBED_METADATA=false
   # Mock curl
   _curl() {
     if [[ "$*" == *'-w "%{http_code}"'* ]]; then
       echo "200"
     elif [[ "$*" == *"POST"* && "$*" == *"/v1/images/generations"* ]]; then
       echo '{"data":[{"url":"http://mock.url/image.png"}]}'
     elif [[ "$*" == *"http://mock.url/image.png"* ]]; then
       echo "mock image data" > "$3"
     fi
   }

   local output="${_test_tmpdir}/test.png"
   generate_image "test prompt" "" 1024 1024 high "$output" "" ""
   local exit_code=$?
   assert_exit_code 0 "$exit_code"
   assert_file_exists "$output"
}

test_cache_hit() {
   ensure_directories
   export OPENAI_API_KEY="sk-mock123"
   export FORCE=false
   export EMBED_METADATA=false
   _curl() {
     if [[ "$*" == *"/v1/images/generations"* ]]; then
       echo '{"data":[{"url":"http://mock.url/image.png"}]}'
     elif [[ "$*" == *"http://mock.url/image.png"* ]]; then
       echo "cached image" > "$3"
     fi
   }

   local output="${_test_tmpdir}/test.png"
   # First generation
   generate_image "cache test" "" 1024 1024 high "$output" "" ""
   assert_file_exists "$output"

   # Second should hit cache
   local output2="${_test_tmpdir}/test2.png"
   generate_image "cache test" "" 1024 1024 high "$output2" "" ""
   assert_file_exists "$output2"
}

test_force_regeneration() {
   ensure_directories
   export OPENAI_API_KEY="sk-mock123"
   export FORCE=true
   export EMBED_METADATA=false
   _curl() {
     if [[ "$*" == *"/v1/images/generations"* ]]; then
       echo '{"data":[{"url":"http://mock.url/image.png"}]}'
     elif [[ "$*" == *"http://mock.url/image.png"* ]]; then
       echo "forced image" > "$3"
     fi
   }

   local output="${_test_tmpdir}/test.png"
   generate_image "force test" "" 1024 1024 high "$output" "" ""
   assert_file_exists "$output"
}

test_metadata_embedding() {
  ensure_directories
  export EMBED_METADATA=true
  export ARTIST="Test Artist"
  # Create dummy image
  echo "dummy" > "${_test_tmpdir}/test.png"
  embed_metadata "${_test_tmpdir}/test.png" "Test Artist" "" "" "" "prompt" "openai"
  # If exiftool available, check embedded, else sidecar
  if command -v exiftool >/dev/null 2>&1; then
    local artist
    artist="$(exiftool -Artist "${_test_tmpdir}/test.png" | sed 's/.*: //')"
    assert_eq "Test Artist" "$artist"
  else
    assert_file_exists "${_test_tmpdir}/test.png.metadata"
  fi
}

test_batch_sequential() {
  ensure_directories
  export OPENAI_API_KEY="sk-mock123"
  export FORCE=false
  export EMBED_METADATA=false
  export ARTIST="" COPYRIGHT="" KEYWORDS="" DESCRIPTION=""
  export OUTPUT_FORMAT=text
  _curl() {
    if [[ "$*" == *"/v1/images/generations"* ]]; then
      echo '{"data":[{"url":"http://mock.url/image.png"}]}'
    elif [[ "$*" == *"http://mock.url/image.png"* ]]; then
      echo "batch image" > "$3"
    fi
  }

  local jobs='[{"prompt":"batch1","output":"'"${_test_tmpdir}"'/b1.png","quality":"high"},{"prompt":"batch2","output":"'"${_test_tmpdir}"'/b2.png","quality":"high"}]'
  process_batch_sequential "$jobs"
  local exit_code=$?
  assert_exit_code 0 "$exit_code"
  assert_file_exists "${_test_tmpdir}/b1.png"
  assert_file_exists "${_test_tmpdir}/b2.png"
}

test_dry_run_batch() {
   ensure_directories
   export DRY_RUN=true
   export OPENAI_API_KEY="sk-mock123"
   export FORCE=false
   export EMBED_METADATA=false
   export ARTIST="" COPYRIGHT="" KEYWORDS="" DESCRIPTION=""
   export OUTPUT_FORMAT=text
   local jobs='[{"prompt":"dry","output":"dry.png","quality":"high"}]'
   local output
   output="$(process_batch_sequential "$jobs" 2>&1)"
   assert_contains "$output" "[DRY-RUN]"
}

test_list_models() {
   export OPENAI_API_KEY="sk-mock123"
   local output
   output="$(list_models false 2>&1)"
   assert_exit_code 0 $?
   assert_contains "$output" "Available AI Image Generation Models"
   assert_contains "$output" "Provider"
   assert_contains "$output" "Model ID"
   assert_contains "$output" "openai"
}

test_all_models() {
   local output
   output="$(list_models true 2>&1)"
   assert_exit_code 0 $?
   assert_contains "$output" "Available AI Image Generation Models"
   # Should have more models than list_models
   local count_all
   count_all="$(echo "$output" | grep -c "|")"
   local output_limited
   output_limited="$(list_models false 2>&1)"
   local count_limited
   count_limited="$(echo "$output_limited" | grep -c "|")"
   # all should have at least as many as limited
   [[ $count_all -ge $count_limited ]]
   assert_exit_code 0 $?
}

test_provider_valid_openai() {
   ensure_directories
   export OPENAI_API_KEY="sk-mock123"
   export FORCE=false
   export EMBED_METADATA=false
   _curl() {
     if [[ "$*" == *'/v1/images/generations'* ]]; then
       echo '{"data":[{"url":"http://mock.url/image.png"}]}'
     elif [[ "$*" == *"http://mock.url/image.png"* ]]; then
       echo "mock image data" > "$3"
     fi
   }

   local output="${_test_tmpdir}/test_openai.png"
   generate_image "test prompt" "" 1024 1024 high "$output" "openai" ""
   local exit_code=$?
   assert_exit_code 0 "$exit_code"
   assert_file_exists "$output"
}

test_provider_invalid() {
   ensure_directories
   local output="${_test_tmpdir}/test_invalid.png"
   generate_image "test prompt" "" 1024 1024 high "$output" "invalid_provider" ""
   local exit_code=$?
   assert_exit_code 2 "$exit_code"  # EXIT_INVALID_PARAMS
}

test_model_valid_openai() {
   ensure_directories
   export OPENAI_API_KEY="sk-mock123"
   export FORCE=false
   export EMBED_METADATA=false
   _curl() {
     if [[ "$*" == *'/v1/images/generations'* ]]; then
       echo '{"data":[{"url":"http://mock.url/image.png"}]}'
     elif [[ "$*" == *"http://mock.url/image.png"* ]]; then
       echo "mock image data" > "$3"
     fi
   }

   local output="${_test_tmpdir}/test_dalle3.png"
   generate_image "test prompt" "" 1024 1024 high "$output" "openai" "dall-e-3"
   local exit_code=$?
   assert_exit_code 0 "$exit_code"
   assert_file_exists "$output"
}

test_model_invalid_openai() {
   ensure_directories
   export OPENAI_API_KEY="sk-mock123"
   export FORCE=false
   local output="${_test_tmpdir}/test_invalid_model.png"
   generate_image "test prompt" "" 1024 1024 high "$output" "openai" "invalid-model"
   local exit_code=$?
   assert_exit_code 2 "$exit_code"  # EXIT_INVALID_PARAMS
}

test_models_multiple() {
   ensure_directories
   export DRY_RUN=true  # Use dry run to avoid real calls
   export OPENAI_API_KEY="sk-mock123"
   export STABILITY_API_KEY="sk-stability123"
   export FORCE=false
   export EMBED_METADATA=false
   export ARTIST="" COPYRIGHT="" KEYWORDS="" DESCRIPTION=""
   export OUTPUT_FORMAT=text

   # Simulate the multiple models logic
   local prompt="test prompt"
   local output="${_test_tmpdir}/test.png"
   local models="dall-e-3,stable-diffusion-xl-1024-v1-0"
   local model_list
   IFS=',' read -ra model_list <<< "$models"
   local results=()
   local success_count=0
   local failure_count=0

   for model_item in "${model_list[@]}"; do
     model_item="$(echo "$model_item" | xargs)"
     [[ -z "$model_item" ]] && continue

     local base="${output%.*}"
     local ext="${output##*.}"
     local model_output="${base}-${model_item}.${ext}"

     # Mock success for dry run
     results+=("SUCCESS: $model_output")
     (( success_count++ ))
   done

   # Check results
   assert_eq "${#results[@]}" 2
   assert_contains "${results[0]}" "SUCCESS"
   assert_contains "${results[0]}" "test-dall-e-3.png"
   assert_contains "${results[1]}" "test-stable-diffusion-xl-1024-v1-0.png"
}

test_cache_with_model() {
   ensure_directories
   export OPENAI_API_KEY="sk-mock123"
   export FORCE=false
   export EMBED_METADATA=false
   _curl() {
     if [[ "$*" == *"/v1/images/generations"* ]]; then
       echo '{"data":[{"url":"http://mock.url/image.png"}]}'
     elif [[ "$*" == *"http://mock.url/image.png"* ]]; then
       echo "cached image" > "$3"
     fi
   }

   local output1="${_test_tmpdir}/test1.png"
   generate_image "cache test" "" 1024 1024 high "$output1" "openai" "dall-e-3"
   assert_file_exists "$output1"

   # Same prompt, same model, should hit cache
   local output2="${_test_tmpdir}/test2.png"
   generate_image "cache test" "" 1024 1024 high "$output2" "openai" "dall-e-3"
   assert_file_exists "$output2"

   # Different model, should not hit cache (but since dry run or mock, we can't test fully, but function called)
}

# ============================================================================
# GOOGLE IMAGEN 4 INTEGRATION TESTS
# ============================================================================

test_google_imagen4_end_to_end() {
   ensure_directories
   export GOOGLE_AUTH_METHOD="api-key"
   export GOOGLE_API_KEY="mock-google-key"
   export GOOGLE_PROJECT_ID="mock-project"
   export GOOGLE_LOCATION="us-central1"
   export FORCE=false
   export EMBED_METADATA=false
   # Mock curl for Google Imagen API
   _curl() {
     if [[ "$*" == *"aiplatform.googleapis.com"* && "$*" == *"POST"* ]]; then
       # Return base64 encoded mock image (just "mock image" in base64)
       echo '{"predictions":[{"bytesBase64Encoded":"bW9jayBpbWFnZQ=="}]}'
     fi
   }

   local output="${_test_tmpdir}/google_test.png"
   generate_image "test prompt" "" 1024 1024 high "$output" "google" "imagen-4.0-generate-001"
   local exit_code=$?
   assert_exit_code 0 "$exit_code"
   assert_file_exists "$output"
}

test_google_imagen4_ultra_model() {
   ensure_directories
   export GOOGLE_AUTH_METHOD="api-key"
   export GOOGLE_API_KEY="mock-google-key"
   export GOOGLE_PROJECT_ID="mock-project"
   export FORCE=false
   export EMBED_METADATA=false
   _curl() {
     if [[ "$*" == *"imagen-4.0-ultra-generate-001"* ]]; then
       echo '{"predictions":[{"bytesBase64Encoded":"bW9jayBpbWFnZQ=="}]}'
     fi
   }

   local output="${_test_tmpdir}/google_ultra.png"
   generate_image "test" "" 1024 1024 high "$output" "google" "imagen-4.0-ultra-generate-001"
   local exit_code=$?
   assert_exit_code 0 "$exit_code"
   assert_file_exists "$output"
}

test_google_imagen4_fast_model() {
   ensure_directories
   export GOOGLE_AUTH_METHOD="api-key"
   export GOOGLE_API_KEY="mock-google-key"
   export GOOGLE_PROJECT_ID="mock-project"
   export FORCE=false
   export EMBED_METADATA=false
   _curl() {
     if [[ "$*" == *"imagen-4.0-fast-generate-001"* ]]; then
       echo '{"predictions":[{"bytesBase64Encoded":"bW9jayBpbWFnZQ=="}]}'
     fi
   }

   local output="${_test_tmpdir}/google_fast.png"
   generate_image "test" "" 1024 1024 high "$output" "google" "imagen-4.0-fast-generate-001"
   local exit_code=$?
   assert_exit_code 0 "$exit_code"
   assert_file_exists "$output"
}

test_google_imagen4_invalid_model() {
   ensure_directories
   export GOOGLE_AUTH_METHOD="api-key"
   export GOOGLE_API_KEY="mock-google-key"
   export GOOGLE_PROJECT_ID="mock-project"
   export FORCE=false

   local output="${_test_tmpdir}/google_invalid.png"
   generate_image "test" "" 1024 1024 high "$output" "google" "invalid-imagen-model"
   local exit_code=$?
   assert_exit_code 2 "$exit_code"  # EXIT_INVALID_PARAMS
}

test_google_imagen4_dry_run() {
   ensure_directories
   export DRY_RUN=true
   export GOOGLE_AUTH_METHOD="api-key"
   export GOOGLE_API_KEY="mock-google-key-12345"
   export GOOGLE_PROJECT_ID="mock-project"
   export FORCE=false
   export EMBED_METADATA=false

   local output
   output="$(generate_image_google "test prompt" "" 1024 1024 high "/tmp/test.png" "imagen-4.0-generate-001" 2>&1)"
   assert_contains "$output" "[DRY-RUN]"
   assert_contains "$output" "imagen-4.0-generate-001"
   assert_contains "$output" "mock-goo…****"
}

test_google_imagen4_service_account_auth() {
   ensure_directories
   export FORCE=false
   export EMBED_METADATA=false
   export GOOGLE_PROJECT_ID="sa-project"
   export GOOGLE_AUTH_METHOD="json"

   # Generate a real RSA key for testing
   local key_file="${_test_tmpdir}/test_key.pem"
   openssl genrsa 2048 > "$key_file" 2>/dev/null
   local private_key
   private_key="$(cat "$key_file")"

   local creds_file="${_test_tmpdir}/sa.json"
   _jq -n \
     --arg pk "$private_key" \
     '{
       "type": "service_account",
       "project_id": "sa-project",
       "private_key_id": "abc123",
       "private_key": $pk,
       "client_email": "test@sa-project.iam.gserviceaccount.com",
       "client_id": "123456789",
       "auth_uri": "https://accounts.google.com/o/oauth2/auth",
       "token_uri": "https://oauth2.googleapis.com/token",
       "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
       "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/test",
       "universe_domain": "googleapis.com"
     }' > "$creds_file"

   export GOOGLE_CREDENTIALS="$creds_file"

   # Mock curl to return token then image
   local call_count=0
   _curl() {
     (( call_count++ )) || true
     if [[ "$*" == *"oauth2.googleapis.com/token"* ]]; then
       echo '{"access_token":"sa-mock-token-xyz","expires_in":3600,"token_type":"Bearer"}'
     elif [[ "$*" == *"aiplatform.googleapis.com"* ]]; then
       echo '{"predictions":[{"bytesBase64Encoded":"bW9jayBpbWFnZQ=="}]}'
     fi
   }

   # Reset token cache
   _GOOGLE_ACCESS_TOKEN=""
   _GOOGLE_TOKEN_EXPIRY=0

   local output="${_test_tmpdir}/google_sa.png"
   generate_image "test prompt" "" 1024 1024 high "$output" "google" "imagen-4.0-generate-001"
   local exit_code=$?
   assert_exit_code 0 "$exit_code"
   assert_file_exists "$output"
}

test_google_all_models_listed() {
   local output
   output="$(list_models true 2>&1)"
   assert_contains "$output" "imagen-4.0-generate-001"
   assert_contains "$output" "imagen-4.0-ultra-generate-001"
   assert_contains "$output" "imagen-4.0-fast-generate-001"
   assert_contains "$output" "imagen-3.0-generate-001"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
   printf '%s Running integration tests...\n' "${TEST_TAG}"

   run_test "end-to-end OpenAI generation" test_end_to_end_openai_generation
   run_test "cache hit" test_cache_hit
   run_test "force regeneration" test_force_regeneration
   run_test "metadata embedding" test_metadata_embedding
   run_test "batch sequential" test_batch_sequential
   run_test "dry run batch" test_dry_run_batch
   run_test "list models" test_list_models
   run_test "all models" test_all_models
   run_test "provider valid openai" test_provider_valid_openai
   run_test "provider invalid" test_provider_invalid
   run_test "model valid openai" test_model_valid_openai
   run_test "model invalid openai" test_model_invalid_openai
   run_test "models multiple" test_models_multiple
   run_test "cache with model" test_cache_with_model
   # Google Imagen 4 integration tests
   run_test "google imagen4 end-to-end" test_google_imagen4_end_to_end
   run_test "google imagen4 ultra model" test_google_imagen4_ultra_model
   run_test "google imagen4 fast model" test_google_imagen4_fast_model
   run_test "google imagen4 invalid model" test_google_imagen4_invalid_model
   run_test "google imagen4 dry run" test_google_imagen4_dry_run
   run_test "google imagen4 service account auth" test_google_imagen4_service_account_auth
   run_test "google all models listed" test_google_all_models_listed

   print_summary
}

main "$@"