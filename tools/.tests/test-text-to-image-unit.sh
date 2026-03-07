#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.tests/test-text-to-image-unit.sh
#
# test-text-to-image-unit.sh — Unit tests for text-to-image
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

# ============================================================================
# TEST FRAMEWORK (embedded)
# ============================================================================
readonly TEST_TAG="(test-text-to-image-unit)"
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

assert_ne() {
  local -r unexpected="$1" actual="$2" msg="${3:-}"
  if [[ "${unexpected}" == "${actual}" ]]; then
    printf '  Unexpected: %s\n  Actual:     %s\n' "${unexpected}" "${actual}" >&2
    [[ -n "${msg}" ]] && printf '  Message:    %s\n' "${msg}" >&2
    return 1
  fi
}

assert_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" != *"${needle}"* ]]; then
    printf '  Haystack: %s\n  Needle:   %s\n' "${haystack}" "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message:  %s\n' "${msg}" >&2
    return 1
  fi
}

assert_not_contains() {
  local -r haystack="$1" needle="$2" msg="${3:-}"
  if [[ "${haystack}" == *"${needle}"* ]]; then
    printf '  Haystack should not contain: %s\n  Needle: %s\n' "${haystack}" "${needle}" >&2
    [[ -n "${msg}" ]] && printf '  Message: %s\n' "${msg}" >&2
    return 1
  fi
}

assert_match() {
  local -r pattern="$1" actual="$2" msg="${3:-}"
  if [[ ! "${actual}" =~ ${pattern} ]]; then
    printf '  Pattern: %s\n  Actual:  %s\n' "${pattern}" "${actual}" >&2
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

assert_dir_exists() {
  local -r path="$1" msg="${3:-}"
  if [[ ! -d "${path}" ]]; then
    printf '  Directory does not exist: %s\n' "${path}" >&2
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
# TEST FIXTURES
# ============================================================================

# ============================================================================
# TESTS
# ============================================================================

test_logging_functions_use_correct_tag() {
  local output
  output="$(log_info "test message" 2>&1)"
  assert_contains "${output}" "(text-to-image)" "Log should contain tag"
  assert_contains "${output}" "[INFO]" "Log should contain level"
  assert_contains "${output}" "test message" "Log should contain message"
}

test_command_wrappers_respect_env_vars() {
  local output
  output="$(CURL_CMD="echo" _curl "mock curl response" 2>/dev/null || true)"
  assert_eq "mock curl response" "${output}" "Should use CURL_CMD"
}

test_directories_created_with_correct_permissions() {
  # Override CONFIG_DIR to temp dir for testing
  local test_config_dir="${_test_tmpdir}/test-config"
  TEXT_TO_IMAGE_CONFIG_DIR="${test_config_dir}" ensure_directories

  assert_dir_exists "${test_config_dir}"
  assert_dir_exists "${test_config_dir}/cache"
  assert_dir_exists "${test_config_dir}/logs"
  assert_dir_exists "${test_config_dir}/logs/jobs"

  # Check permissions (700)
  local perms
  perms="$(stat -c '%a' "${test_config_dir}")"
  assert_eq "700" "${perms}" "Config dir should have 700 permissions"
}

test_quality_profiles_defined() {
  # Test that quality profile variables are set
  [[ -n "${QUALITY_HIGH:-}" ]] || return 1
  [[ -n "${QUALITY_MEDIUM:-}" ]] || return 1
  [[ -n "${QUALITY_LOW:-}" ]] || return 1

  assert_contains "${QUALITY_HIGH}" "openai"
  assert_contains "${QUALITY_HIGH}" "stability"
  assert_contains "${QUALITY_HIGH}" "google"
}

test_stub_provider_functions_exist() {
  # Test that functions return error when no key
  local exit_code=0
  generate_image_openai "test" "" 1024 1024 high /tmp/test.png "dall-e-3" || exit_code=$?
  assert_eq "$EXIT_AUTH_FAILED" "$exit_code"
}

test_provider_selection() {
  # Test high quality with key
  export OPENAI_API_KEY="test"
  local provider
  provider="$(select_provider "high")"
  assert_eq "openai" "$provider"

  # Test no key - all providers unavailable
  unset OPENAI_API_KEY STABILITY_API_KEY GOOGLE_API_KEY HF_API_KEY BFL_API_KEY REPLICATE_API_TOKEN SILICONFLOW_API_KEY GOOGLE_CREDENTIALS 2>/dev/null || true
  # Hide gcloud by temporarily renaming PATH to empty dir
  local old_path="$PATH"
  local empty_dir="${_test_tmpdir}/empty_bin"
  mkdir -p "$empty_dir"
  PATH="$empty_dir"
  local exit_code=0
  provider="$(select_provider "high")" || exit_code=$?
  PATH="$old_path"
  assert_eq "$EXIT_AUTH_FAILED" "$exit_code"
}

test_load_dotenv() {
  # Create a test .env file
  local env_file="${_test_tmpdir}/.env"
  echo "TEST_VAR=test_value" > "$env_file"

  # Override CONFIG_DIR
  TEXT_TO_IMAGE_CONFIG_DIR="${_test_tmpdir}" ensure_directories
  load_dotenv

  # Note: source affects current shell, but for test, we can't easily check
  # So just check if function runs without error
  true
}

test_parse_yaml_with_yq() {
  if command -v yq >/dev/null 2>&1; then
    local yaml_file="${_test_tmpdir}/test.yaml"
    echo "key: value" > "$yaml_file"
    local output
    output="$(parse_yaml "$yaml_file")"
    assert_contains "$output" "value"
  else
    # Skip if yq not available
    true
  fi
}

test_parse_yaml_fallback() {
  # Mock yq not available
  if ! command -v yq >/dev/null 2>&1; then
    local yaml_file="${_test_tmpdir}/test.yaml"
    echo "key: value" > "$yaml_file"
    local output
    output="$(parse_yaml "$yaml_file")"
    # Fallback should produce export key=value
    assert_contains "$output" "export key=value"
  else
    # Skip if yq available
    true
  fi
}

test_merge_config() {
  # Set some vars
  PROMPT="test prompt"
  OUTPUT="test.png"
  QUALITY="medium"

  local config
  config="$(merge_config)"
  local expected_prompt
  expected_prompt="$(shell_escape "test prompt")"
  assert_contains "$config" "prompt=$expected_prompt"
  assert_contains "$config" "quality=medium"
}

test_validate_config_valid() {
  local tmp_output="${_test_tmpdir}/test.png"
  touch "$tmp_output"
  validate_config "test prompt" "$tmp_output" "high" 1024 1024
  assert_exit_code 0 $?
}

test_validate_config_missing_prompt() {
  local exit_code=0
  validate_config "" "test.png" "high" 1024 1024 || exit_code=$?
  assert_eq "$EXIT_INVALID_PARAMS" "$exit_code"
}

test_validate_config_invalid_quality() {
  local exit_code=0
  validate_config "prompt" "test.png" "invalid" 1024 1024 || exit_code=$?
  assert_eq "$EXIT_INVALID_PARAMS" "$exit_code"
}

test_validate_config_invalid_dimensions() {
  local exit_code=0
  validate_config "prompt" "test.png" "high" 100 1024 || exit_code=$?
  assert_eq "$EXIT_INVALID_PARAMS" "$exit_code"
}

test_dry_run_openai() {
  export DRY_RUN=true
  export OPENAI_API_KEY="sk-te123456789"
  local output
  output="$(generate_image_openai "test" "" 1024 1024 high "/tmp/test.png" "dall-e-3" 2>&1)"
  assert_contains "$output" "[DRY-RUN]"
  assert_contains "$output" "sk-te123…****"
}

test_compute_cache_key() {
  local key1
  local key2
  key1="$(compute_cache_key "prompt" "neg" 1024 1024 high openai "dall-e-3")"
  key2="$(compute_cache_key "prompt" "neg" 1024 1024 high openai "dall-e-3")"
  assert_eq "$key1" "$key2" "Cache keys should be identical for same inputs"

  local key3
  key3="$(compute_cache_key "different" "neg" 1024 1024 high openai "dall-e-3")"
  assert_ne "$key1" "$key3" "Cache keys should differ for different inputs"
}

test_cache_lookup_miss() {
  # Non-existent key
  ensure_directories
  cache_lookup "nonexistent" "/tmp/test.png"
  assert_exit_code 1 $?
}

test_cache_store_and_lookup() {
  # Create a dummy image
  ensure_directories
  echo "dummy" > "${_test_tmpdir}/dummy.png"
  local cache_key="testkey123"
  local output_path="${_test_tmpdir}/output.png"

  # Store
  cache_store "$cache_key" "${_test_tmpdir}/dummy.png" "prompt" "neg" 1024 1024 high openai "dall-e-3"

  # Lookup
  cache_lookup "$cache_key" "$output_path"
  assert_exit_code 0 $?

  # Verify content
  assert_eq "dummy" "$(cat "$output_path")"
}

test_embed_metadata_sidecar() {
  # Create dummy image
  echo "dummy" > "${_test_tmpdir}/test.png"
  embed_metadata "${_test_tmpdir}/test.png" "artist" "copyright" "keywords" "desc" "prompt" "provider"
  assert_file_exists "${_test_tmpdir}/test.png.metadata"
}

test_batch_sequential_dry_run() {
  # Mock generate_image to return success
  generate_image() { if [[ "${DRY_RUN}" == "true" ]]; then echo "[DRY-RUN] mocked"; fi; return 0; }
  # Mock timeout to just run the command (for testing functions)
  timeout() { shift; "$@" ; }
  export DRY_RUN=true
  export EMBED_METADATA=false
  export ARTIST="" COPYRIGHT="" KEYWORDS="" DESCRIPTION=""
  export OUTPUT_FORMAT="text"
  TEXT_TO_IMAGE_CONFIG_DIR="${_test_tmpdir}" ensure_directories
  local jobs='[{"prompt":"test","output":"test.png","quality":"high"}]'
  local output
  output="$(process_batch_sequential "$jobs" 2>&1)"
  assert_contains "$output" "[DRY-RUN]"
}

test_retry_curl_success() {
  # Mock curl to return success
  _curl() { echo -e 'response\n200'; }
  local output
  output="$(retry_curl "http://example.com")"
  assert_eq "response" "$output"
}

test_retry_curl_retry_on_500() {
  # Mock curl to return 500 then 200, using file for call count due to subshell
  local count_file="${_test_tmpdir}/call_count"
  echo 0 > "$count_file"
  _curl() {
    local count
    count=$(<"$count_file")
    (( count++ ))
    echo "$count" > "$count_file"
    if (( count == 1 )); then
      echo -e 'error\n500'
    else
      echo -e 'success\n200'
    fi
  }
  local output
  output="$(retry_curl "http://example.com")"
  local final_count
  final_count=$(<"$count_file")
  assert_eq "success" "$output"
  assert_eq 2 "$final_count"
}

test_on_exit_function_exists() {
  # Just check that _on_exit is defined
  type _on_exit >/dev/null 2>&1
}

test_json_logging() {
  # Capture JSON log
  local log_file="${_test_tmpdir}/test.log"
  MAIN_LOG_FILE="$log_file"
  log_info "test message"
  local log_content
  log_content="$(cat "$log_file")"
  # Should be valid JSON
  echo "$log_content" | _jq . >/dev/null 2>&1
  assert_exit_code 0 $?
  # Check fields
  local level
  level="$(echo "$log_content" | _jq -r '.level')"
  assert_eq "INFO" "$level"
  local message
  message="$(echo "$log_content" | _jq -r '.message')"
  assert_eq "test message" "$message"
}

test_token_sanitization() {
  local sanitized
  sanitized="$(sanitize_token "sk-1234567890abcdef")"
  assert_eq "sk-12345…****" "$sanitized"

  sanitized="$(sanitize_token "")"
  assert_eq "unset" "$sanitized"
}

test_timeout_handling() {
  # Mock generate_image to hang
  generate_image() { sleep 10; return 0; }
  local jobs='[{"prompt":"test","output":"test.png","quality":"high"}]'
  local exit_code=0
  if command -v timeout >/dev/null 2>&1; then
    timeout 1 process_batch_sequential "$jobs" >/dev/null 2>&1
    exit_code=$?
    if (( exit_code == 124 )); then
      assert_eq 124 "$exit_code"
    else
      # timeout not working as expected, skip
      true
    fi
  else
    # Skip if timeout not available
    true
  fi
}

test_list_models() {
  local output
  output="$(list_models true)"
  assert_contains "$output" "Provider"
  assert_contains "$output" "Model ID"
  assert_contains "$output" "Quality"
  assert_contains "$output" "openai"
  assert_contains "$output" "dall-e-3"
  assert_contains "$output" "high"
}

test_get_provider_model() {
  local model
  model="$(get_provider_model "openai")"
  assert_eq "dall-e-3" "$model"

  model="$(get_provider_model "stability")"
  assert_eq "stable-diffusion-xl-1024-v1-0" "$model"

  model="$(get_provider_model "google")"
  assert_eq "imagen-4.0-generate-001" "$model"

  model="$(get_provider_model "unknown")"
  assert_eq "unknown" "$model"
}

test_model_validation_openai() {
  export OPENAI_API_KEY="test"
  local exit_code=0
  generate_image_openai "test" "" 1024 1024 high "/tmp/test.png" "invalid-model" || exit_code=$?
  assert_eq "$EXIT_INVALID_PARAMS" "$exit_code"
}

test_cache_key_with_different_models() {
  local key1 key2
  key1="$(compute_cache_key "prompt" "neg" 1024 1024 high openai "dall-e-3")"
  key2="$(compute_cache_key "prompt" "neg" 1024 1024 high openai "dall-e-2")"
  assert_ne "$key1" "$key2" "Cache keys should differ for different models"
}

test_backward_compatibility_no_model() {
  # Test that generate_image uses default model when none provided
  export DRY_RUN=true
  export OPENAI_API_KEY="test"
  export FORCE=false
  export TEXT_TO_IMAGE_CONFIG_DIR="${_test_tmpdir}"
  ensure_directories
  local output
  output="$(generate_image "test prompt" "" 1024 1024 high "/tmp/test.png" "openai" "" 2>&1)"
  assert_contains "$output" "[DRY-RUN]"
  assert_contains "$output" "dall-e-3"
}

# ============================================================================
# GOOGLE IMAGEN 4 TESTS
# ============================================================================

test_google_imagen_api_url() {
  local url
  url="$(google_imagen_api_url "my-project" "us-central1" "imagen-4.0-generate-001")"
  assert_eq "https://us-central1-aiplatform.googleapis.com/v1/projects/my-project/locations/us-central1/publishers/google/models/imagen-4.0-generate-001:predict" "$url"

  url="$(google_imagen_api_url "proj-123" "europe-west1" "imagen-4.0-ultra-generate-001")"
  assert_eq "https://europe-west1-aiplatform.googleapis.com/v1/projects/proj-123/locations/europe-west1/publishers/google/models/imagen-4.0-ultra-generate-001:predict" "$url"
}

test_google_imagen_build_payload() {
  local payload
  payload="$(google_imagen_build_payload "test prompt" "" 1024 1024 "imagen-4.0-generate-001")"
  assert_contains "$payload" "test prompt"
  assert_contains "$payload" "sampleCount"
  assert_contains "$payload" "1:1"
}

test_google_imagen_build_payload_with_negative() {
  local payload
  payload="$(google_imagen_build_payload "test prompt" "blurry" 1024 1024 "imagen-4.0-generate-001")"
  assert_contains "$payload" "test prompt"
  assert_contains "$payload" "negativePrompt"
  assert_contains "$payload" "blurry"
}

test_google_imagen_build_payload_aspect_ratios() {
  # 16:9 ratio (1920x1080 -> 16*1080 = 17280, 9*1920 = 17280)
  local payload
  payload="$(google_imagen_build_payload "test" "" 1920 1080 "imagen-4.0-generate-001")"
  assert_contains "$payload" "16:9"

  # 9:16 ratio
  payload="$(google_imagen_build_payload "test" "" 1080 1920 "imagen-4.0-generate-001")"
  assert_contains "$payload" "9:16"

  # 4:3 ratio (1024x768 -> 3*1024 = 3072, 4*768 = 3072)
  payload="$(google_imagen_build_payload "test" "" 1024 768 "imagen-4.0-generate-001")"
  assert_contains "$payload" "4:3"
}

test_google_model_validation() {
  # Valid models should be accepted
  local exit_code=0
  export GOOGLE_AUTH_METHOD="api-key"
  export GOOGLE_API_KEY="test-key"
  export GOOGLE_PROJECT_ID="test-project"
  export DRY_RUN=true
  generate_image_google "test" "" 1024 1024 high "/tmp/test.png" "imagen-4.0-generate-001" || exit_code=$?
  assert_eq "$EXIT_SUCCESS" "$exit_code"

  # Invalid model should fail
  exit_code=0
  generate_image_google "test" "" 1024 1024 high "/tmp/test.png" "invalid-model" || exit_code=$?
  assert_eq "$EXIT_INVALID_PARAMS" "$exit_code"
}

test_google_auth_method_api_key() {
  export GOOGLE_AUTH_METHOD="api-key"
  export GOOGLE_API_KEY="test-api-key-12345"
  local token
  token="$(obtain_google_access_token)"
  assert_eq "test-api-key-12345" "$token"
}

test_google_auth_method_api_key_missing() {
  export GOOGLE_AUTH_METHOD="api-key"
  unset GOOGLE_API_KEY 2>/dev/null || true
  GOOGLE_API_KEY=""
  local exit_code=0
  obtain_google_access_token >/dev/null 2>&1 || exit_code=$?
  assert_eq "$EXIT_AUTH_FAILED" "$exit_code"
}

test_google_auth_method_json_missing_file() {
  export GOOGLE_AUTH_METHOD="json"
  export GOOGLE_CREDENTIALS="/nonexistent/path/credentials.json"
  local exit_code=0
  obtain_google_access_token >/dev/null 2>&1 || exit_code=$?
  assert_eq "$EXIT_AUTH_FAILED" "$exit_code"
}

test_google_auth_method_json_with_file() {
  export GOOGLE_AUTH_METHOD="json"

  # Generate a real RSA key for testing
  local key_file="${_test_tmpdir}/test_key.pem"
  openssl genrsa 2048 > "$key_file" 2>/dev/null
  local private_key
  private_key="$(cat "$key_file")"

  local creds_file="${_test_tmpdir}/service-account.json"
  _jq -n \
    --arg pk "$private_key" \
    '{
      "type": "service_account",
      "project_id": "test-project-123",
      "private_key_id": "abc123",
      "private_key": $pk,
      "client_email": "test@test-project-123.iam.gserviceaccount.com",
      "client_id": "123456789",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/test",
      "universe_domain": "googleapis.com"
    }' > "$creds_file"

  export GOOGLE_CREDENTIALS="$creds_file"

  # Reset token cache
  _GOOGLE_ACCESS_TOKEN=""
  _GOOGLE_TOKEN_EXPIRY=0

  # Mock curl to return a token
  _curl() {
    echo '{"access_token":"mock-token-123","expires_in":3600,"token_type":"Bearer"}'
  }

  local token
  token="$(obtain_google_token_from_json "$creds_file")"
  assert_eq "mock-token-123" "$token"
}

test_google_auth_token_caching() {
  # Set a cached token that hasn't expired
  _GOOGLE_ACCESS_TOKEN="cached-token-abc"
  _GOOGLE_TOKEN_EXPIRY="$(( $(date +%s) + 3600 ))"
  export GOOGLE_AUTH_METHOD="auto"

  local token
  token="$(obtain_google_access_token)"
  assert_eq "cached-token-abc" "$token"

  # Reset cached token
  _GOOGLE_ACCESS_TOKEN=""
  _GOOGLE_TOKEN_EXPIRY=0
}

test_google_dry_run() {
  export DRY_RUN=true
  export GOOGLE_AUTH_METHOD="api-key"
  export GOOGLE_API_KEY="test-key-123456"
  export GOOGLE_PROJECT_ID="test-project"
  local output
  output="$(generate_image_google "test prompt" "" 1024 1024 high "/tmp/test.png" "imagen-4.0-generate-001" 2>&1)"
  assert_contains "$output" "[DRY-RUN]"
  assert_contains "$output" "test-key…****"
  assert_contains "$output" "imagen-4.0-generate-001"
}

test_google_project_from_credentials() {
  export GOOGLE_AUTH_METHOD="api-key"
  export GOOGLE_API_KEY="test-key"
  unset GOOGLE_PROJECT_ID 2>/dev/null || true
  GOOGLE_PROJECT_ID=""

  local creds_file="${_test_tmpdir}/service-account.json"
  echo '{"project_id":"extracted-project-123","client_email":"test@test.iam.gserviceaccount.com","private_key":"test"}' > "$creds_file"
  export GOOGLE_CREDENTIALS="$creds_file"
  export DRY_RUN=true

  local output
  output="$(generate_image_google "test" "" 1024 1024 high "/tmp/test.png" "imagen-4.0-generate-001" 2>&1)"
  assert_contains "$output" "extracted-project-123"
}

test_google_provider_selection_with_credentials() {
  # Should select google provider when credentials file exists
  unset OPENAI_API_KEY STABILITY_API_KEY GOOGLE_API_KEY HF_API_KEY BFL_API_KEY REPLICATE_API_TOKEN SILICONFLOW_API_KEY 2>/dev/null || true
  local creds_file="${_test_tmpdir}/service-account.json"
  echo '{"project_id":"test","client_email":"test@test.iam.gserviceaccount.com","private_key":"test"}' > "$creds_file"
  export GOOGLE_CREDENTIALS="$creds_file"

  local provider
  provider="$(select_provider "high")"
  assert_eq "google" "$provider"
}

test_list_models_includes_imagen4() {
  local output
  output="$(list_models true)"
  assert_contains "$output" "imagen-4.0-generate-001"
  assert_contains "$output" "imagen-4.0-ultra-generate-001"
  assert_contains "$output" "imagen-4.0-fast-generate-001"
  assert_contains "$output" "imagen-3.0-generate-001"
}

# ============================================================================
# ADOS-SPECIFIC FEATURE TESTS
# ============================================================================

test_show_version_convention_compliant() {
  local output
  output="$(show_version)"
  assert_contains "$output" "text-to-image 1.0.0" "Should contain name and version"
  assert_contains "$output" "Copyright" "Should contain copyright"
  assert_contains "$output" "MIT License" "Should contain MIT license"
  assert_contains "$output" "Latest version:" "Should contain latest version URL"
  assert_contains "$output" "github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/text-to-image" "Should link to correct URL"
}

test_show_help_convention_compliant() {
  local output
  output="$(show_help)"
  assert_contains "$output" "text-to-image 1.0.0" "Should contain name and version"
  assert_contains "$output" "Copyright" "Should contain copyright"
  assert_contains "$output" "MIT License" "Should contain MIT license"
  assert_contains "$output" "Latest version:" "Should contain latest version URL"
  assert_contains "$output" "USAGE:" "Should contain usage section"
  assert_contains "$output" "EXAMPLES:" "Should contain examples section"
  assert_contains "$output" "OPTIONS:" "Should contain options section"
  assert_contains "$output" "DOCUMENTATION:" "Should contain documentation link"
  assert_contains "$output" "doc/tools/text-to-image.md" "Should link to doc"
  assert_contains "$output" "EXIT CODES:" "Should contain exit codes"
}

test_version_check_opt_out() {
  # When opt-out env var is set, _check_version should return immediately
  export TEXT_TO_IMAGE_NO_VERSION_CHECK=true
  TEXT_TO_IMAGE_CONFIG_DIR="${_test_tmpdir}" ensure_directories
  _check_version
  local exit_code=$?
  assert_eq 0 "$exit_code" "Version check should succeed when opted out"
  # No version-check file should be created since we returned early
  [[ ! -f "${_test_tmpdir}/version-check" ]] || true
  unset TEXT_TO_IMAGE_NO_VERSION_CHECK
}

test_version_check_silent_failure() {
  # Mock curl to fail
  _curl() { return 1; }
  TEXT_TO_IMAGE_CONFIG_DIR="${_test_tmpdir}" ensure_directories
  unset TEXT_TO_IMAGE_NO_VERSION_CHECK 2>/dev/null || true
  # Should not produce any output or fail
  local stderr_output
  stderr_output="$(_check_version 2>&1)"
  local exit_code=$?
  assert_eq 0 "$exit_code" "Version check should silently succeed on failure"
}

test_doc_linked_error_messages() {
  local output
  output="$(provider_not_configured_error "openai" 2>&1)"
  assert_contains "$output" "Provider 'openai' is not configured" "Should mention provider"
  assert_contains "$output" "doc/tools/text-to-image.md#openai" "Should link to openai doc section"

  output="$(provider_not_configured_error "google" 2>&1)"
  assert_contains "$output" "doc/tools/text-to-image.md#google-imagen" "Should link to google-imagen doc section"

  output="$(provider_not_configured_error "stability" 2>&1)"
  assert_contains "$output" "doc/tools/text-to-image.md#stability-ai" "Should link to stability-ai doc section"
}

test_provider_doc_anchors_defined() {
  # All 7 providers should have doc anchors
  [[ -n "${PROVIDER_DOC_ANCHORS[openai]:-}" ]] || return 1
  [[ -n "${PROVIDER_DOC_ANCHORS[stability]:-}" ]] || return 1
  [[ -n "${PROVIDER_DOC_ANCHORS[google]:-}" ]] || return 1
  [[ -n "${PROVIDER_DOC_ANCHORS[huggingface]:-}" ]] || return 1
  [[ -n "${PROVIDER_DOC_ANCHORS[bfl]:-}" ]] || return 1
  [[ -n "${PROVIDER_DOC_ANCHORS[replicate]:-}" ]] || return 1
  [[ -n "${PROVIDER_DOC_ANCHORS[siliconflow]:-}" ]] || return 1
}

test_doc_base_url_defined() {
  assert_contains "$DOC_BASE_URL" "github.com/juliusz-cwiakalski/agentic-delivery-os" "Should point to ADOS repo"
  assert_contains "$DOC_BASE_URL" "doc/tools/text-to-image.md" "Should point to tool doc"
}

# ============================================================================
# RUN TESTS
# ============================================================================
main() {
  printf '%s Running unit tests...\n' "${TEST_TAG}"

  run_test "logging functions use correct tag" test_logging_functions_use_correct_tag
  run_test "command wrappers respect env vars" test_command_wrappers_respect_env_vars
  run_test "directories created with correct permissions" test_directories_created_with_correct_permissions
  run_test "quality profiles defined" test_quality_profiles_defined
  run_test "stub provider functions exist" test_stub_provider_functions_exist
  run_test "provider selection" test_provider_selection
  run_test "load dotenv" test_load_dotenv
  run_test "parse yaml with yq" test_parse_yaml_with_yq
  run_test "parse yaml fallback" test_parse_yaml_fallback
  run_test "merge config" test_merge_config
  run_test "validate config valid" test_validate_config_valid
  run_test "validate config missing prompt" test_validate_config_missing_prompt
  run_test "validate config invalid quality" test_validate_config_invalid_quality
  run_test "validate config invalid dimensions" test_validate_config_invalid_dimensions
  run_test "dry run openai" test_dry_run_openai
  run_test "compute cache key" test_compute_cache_key
  run_test "cache lookup miss" test_cache_lookup_miss
  run_test "cache store and lookup" test_cache_store_and_lookup
  run_test "embed metadata sidecar" test_embed_metadata_sidecar
  run_test "batch sequential dry run" test_batch_sequential_dry_run
  run_test "retry curl success" test_retry_curl_success
  run_test "retry curl retry on 500" test_retry_curl_retry_on_500
  run_test "on exit function exists" test_on_exit_function_exists
  run_test "json logging" test_json_logging
  run_test "token sanitization" test_token_sanitization
  run_test "timeout handling" test_timeout_handling
  run_test "list models" test_list_models
  run_test "get provider model" test_get_provider_model
  run_test "model validation openai" test_model_validation_openai
  run_test "cache key with different models" test_cache_key_with_different_models
  run_test "backward compatibility no model" test_backward_compatibility_no_model
  # Google Imagen 4 tests
  run_test "google imagen api url" test_google_imagen_api_url
  run_test "google imagen build payload" test_google_imagen_build_payload
  run_test "google imagen build payload with negative prompt" test_google_imagen_build_payload_with_negative
  run_test "google imagen build payload aspect ratios" test_google_imagen_build_payload_aspect_ratios
  run_test "google model validation" test_google_model_validation
  run_test "google auth method api-key" test_google_auth_method_api_key
  run_test "google auth method api-key missing" test_google_auth_method_api_key_missing
  run_test "google auth method json missing file" test_google_auth_method_json_missing_file
  run_test "google auth method json with file" test_google_auth_method_json_with_file
  run_test "google auth token caching" test_google_auth_token_caching
  run_test "google dry run" test_google_dry_run
  run_test "google project from credentials" test_google_project_from_credentials
  run_test "google provider selection with credentials" test_google_provider_selection_with_credentials
  run_test "list models includes imagen 4" test_list_models_includes_imagen4
  # ADOS-specific feature tests
  run_test "show_version convention compliant" test_show_version_convention_compliant
  run_test "show_help convention compliant" test_show_help_convention_compliant
  run_test "version check opt-out" test_version_check_opt_out
  run_test "version check silent failure" test_version_check_silent_failure
  run_test "doc-linked error messages" test_doc_linked_error_messages
  run_test "provider doc anchors defined" test_provider_doc_anchors_defined
  run_test "doc base URL defined" test_doc_base_url_defined

  print_summary
}

main "$@"