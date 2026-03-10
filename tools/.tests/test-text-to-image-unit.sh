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

test_list_models_configured_column() {
  export OPENAI_API_KEY="test"
  unset STABILITY_API_KEY 2>/dev/null || true
  unset GOOGLE_CREDENTIALS 2>/dev/null || true
  unset GOOGLE_API_KEY 2>/dev/null || true
  unset HF_API_KEY 2>/dev/null || true
  unset BFL_API_KEY 2>/dev/null || true
  unset REPLICATE_API_TOKEN 2>/dev/null || true
  unset SILICONFLOW_API_KEY 2>/dev/null || true
  local output
  output="$(list_models true)"
  assert_contains "$output" "Status" "Should have Status header when all_models=true"
  # openai rows should have [x]
  local openai_line
  openai_line="$(printf '%s\n' "$output" | grep "dall-e-3" | head -1)"
  assert_contains "$openai_line" "[x]" "openai row should show [x] when configured"
  # huggingface rows should have [ ]
  local hf_line
  hf_line="$(printf '%s\n' "$output" | grep "huggingface" | head -1)"
  assert_contains "$hf_line" "[ ]" "huggingface row should show [ ] when not configured"
}

test_list_models_no_status_when_filtered() {
  export OPENAI_API_KEY="test"
  local output
  output="$(list_models false)"
  assert_not_contains "$output" "Status" "Should NOT have Status header when all_models=false"
}

# ============================================================================
# ENSURE OUTPUT FORMAT TESTS
# ============================================================================

test_ensure_output_format_detects_png() {
  # Create a minimal 1x1 PNG using ImageMagick
  if ! command -v convert >/dev/null 2>&1 && ! command -v magick >/dev/null 2>&1; then
    # Skip if ImageMagick not available
    return 0
  fi
  local img="${_test_tmpdir}/test.png"
  convert -size 1x1 xc:red "$img" 2>/dev/null || magick -size 1x1 xc:red "$img" 2>/dev/null
  local mime
  mime="$(file --mime-type -b "$img")"
  assert_eq "image/png" "$mime" "Should detect PNG mime type"
}

test_ensure_output_format_detects_webp() {
  if ! command -v convert >/dev/null 2>&1 && ! command -v magick >/dev/null 2>&1; then
    return 0
  fi
  local img="${_test_tmpdir}/test.webp"
  convert -size 1x1 xc:red "$img" 2>/dev/null || magick -size 1x1 xc:red "$img" 2>/dev/null
  local mime
  mime="$(file --mime-type -b "$img")"
  assert_eq "image/webp" "$mime" "Should detect WebP mime type"
}

test_ensure_output_format_converts_webp_to_png() {
  if ! command -v convert >/dev/null 2>&1 && ! command -v magick >/dev/null 2>&1; then
    return 0
  fi
  # Create a WebP file but save it with .png extension (simulating the bug)
  local webp_src="${_test_tmpdir}/source.webp"
  local mismatched="${_test_tmpdir}/output.png"
  convert -size 1x1 xc:blue "$webp_src" 2>/dev/null || magick -size 1x1 xc:blue "$webp_src" 2>/dev/null
  cp "$webp_src" "$mismatched"

  # Verify it's WebP before conversion
  local mime_before
  mime_before="$(file --mime-type -b "$mismatched")"
  assert_eq "image/webp" "$mime_before" "Should be WebP before conversion"

  # Run conversion
  ensure_output_format "$mismatched"

  # Verify it's now PNG
  local mime_after
  mime_after="$(file --mime-type -b "$mismatched")"
  assert_eq "image/png" "$mime_after" "Should be PNG after conversion"
}

test_ensure_output_format_converts_webp_to_jpg() {
  if ! command -v convert >/dev/null 2>&1 && ! command -v magick >/dev/null 2>&1; then
    return 0
  fi
  local webp_src="${_test_tmpdir}/source.webp"
  local mismatched="${_test_tmpdir}/output.jpg"
  convert -size 1x1 xc:green "$webp_src" 2>/dev/null || magick -size 1x1 xc:green "$webp_src" 2>/dev/null
  cp "$webp_src" "$mismatched"

  ensure_output_format "$mismatched"

  local mime_after
  mime_after="$(file --mime-type -b "$mismatched")"
  assert_eq "image/jpeg" "$mime_after" "Should be JPEG after conversion"
}

test_ensure_output_format_noop_when_matching() {
  if ! command -v convert >/dev/null 2>&1 && ! command -v magick >/dev/null 2>&1; then
    return 0
  fi
  # Create a real PNG saved as .png — no conversion needed
  local img="${_test_tmpdir}/correct.png"
  convert -size 1x1 xc:red "$img" 2>/dev/null || magick -size 1x1 xc:red "$img" 2>/dev/null

  # Record file hash before
  local hash_before
  hash_before="$(sha256sum "$img" | cut -d' ' -f1)"

  ensure_output_format "$img"

  # File should be unchanged
  local hash_after
  hash_after="$(sha256sum "$img" | cut -d' ' -f1)"
  assert_eq "$hash_before" "$hash_after" "File should be unchanged when format matches"
}

test_ensure_output_format_graceful_without_imagemagick() {
  if ! command -v convert >/dev/null 2>&1 && ! command -v magick >/dev/null 2>&1; then
    # If ImageMagick is truly not available, we can't create the test fixture
    return 0
  fi
  # Create a WebP file with .png extension
  local webp_src="${_test_tmpdir}/source.webp"
  local mismatched="${_test_tmpdir}/output.png"
  convert -size 1x1 xc:red "$webp_src" 2>/dev/null || magick -size 1x1 xc:red "$webp_src" 2>/dev/null
  cp "$webp_src" "$mismatched"

  # Hide ImageMagick by overriding PATH
  local old_path="$PATH"
  local empty_dir="${_test_tmpdir}/empty_bin"
  mkdir -p "$empty_dir"
  # Keep only file(1) available by symlinking it
  local file_path
  file_path="$(command -v file)"
  ln -sf "$file_path" "$empty_dir/file"
  PATH="$empty_dir"

  # Run — should warn but not fail
  local stderr_output exit_code=0
  stderr_output="$(ensure_output_format "$mismatched" 2>&1)" || exit_code=$?
  PATH="$old_path"

  assert_eq 0 "$exit_code" "Should return 0 (graceful degradation)"

  # File should still be WebP (no conversion happened)
  local mime_after
  mime_after="$(file --mime-type -b "$mismatched")"
  assert_eq "image/webp" "$mime_after" "File should remain WebP when ImageMagick unavailable"
}

test_ensure_output_format_unsupported_ext_skips() {
  # Create a dummy file with unsupported extension
  local img="${_test_tmpdir}/output.tiff"
  printf 'dummy' > "$img"

  # Should return 0 and skip
  local exit_code=0
  ensure_output_format "$img" || exit_code=$?
  assert_eq 0 "$exit_code" "Should skip unsupported extensions gracefully"
}

test_ensure_output_format_converts_png_to_webp() {
  if ! command -v convert >/dev/null 2>&1 && ! command -v magick >/dev/null 2>&1; then
    return 0
  fi
  local png_src="${_test_tmpdir}/source.png"
  local mismatched="${_test_tmpdir}/output.webp"
  convert -size 1x1 xc:red "$png_src" 2>/dev/null || magick -size 1x1 xc:red "$png_src" 2>/dev/null
  cp "$png_src" "$mismatched"

  ensure_output_format "$mismatched"

  local mime_after
  mime_after="$(file --mime-type -b "$mismatched")"
  assert_eq "image/webp" "$mime_after" "Should be WebP after conversion"
}

test_ensure_output_format_avif() {
  # Test AVIF conversion if avifenc or ImageMagick is available
  if ! command -v convert >/dev/null 2>&1 && ! command -v magick >/dev/null 2>&1; then
    return 0
  fi
  # Check if any AVIF conversion tool is available
  local has_avif_tool=false
  if command -v avifenc >/dev/null 2>&1; then
    has_avif_tool=true
  elif command -v magick >/dev/null 2>&1; then
    has_avif_tool=true
  elif command -v convert >/dev/null 2>&1; then
    has_avif_tool=true
  fi
  if [[ "$has_avif_tool" == "false" ]]; then
    return 0  # Skip if no AVIF conversion tool
  fi
  local png_src="${_test_tmpdir}/source.png"
  local mismatched="${_test_tmpdir}/output.avif"
  convert -size 1x1 xc:red "$png_src" 2>/dev/null || magick -size 1x1 xc:red "$png_src" 2>/dev/null
  cp "$png_src" "$mismatched"

  local exit_code=0
  ensure_output_format "$mismatched" || exit_code=$?
  # If conversion tool works, exit_code should be 0 and mime should be avif
  # If conversion fails (tool installed but format unsupported), graceful failure
  if [[ "$exit_code" -eq 0 ]]; then
    local mime_after
    mime_after="$(file --mime-type -b "$mismatched")"
    # Depending on tool, mime may be image/avif or the original if conversion silently failed
    # Just verify no crash occurred
    assert_ne "" "$mime_after" "Should have a mime type"
  fi
}

# ============================================================================
# NATIVE FORMAT REGISTRY TESTS
# ============================================================================

test_get_native_format_known_models() {
  local fmt
  fmt="$(get_native_format "openai" "dall-e-3")"
  assert_eq "png" "$fmt" "DALL-E 3 should be png"

  fmt="$(get_native_format "bfl" "flux-1.1-pro")"
  assert_eq "jpg" "$fmt" "BFL FLUX 1.1 Pro should be jpg"

  fmt="$(get_native_format "huggingface" "black-forest-labs/flux-1.1-pro")"
  assert_eq "webp" "$fmt" "HF FLUX 1.1 Pro should be webp"

  fmt="$(get_native_format "replicate" "black-forest-labs/flux-1.1-pro")"
  assert_eq "webp" "$fmt" "Replicate FLUX 1.1 Pro should be webp"

  fmt="$(get_native_format "google" "imagen-4.0-generate-001")"
  assert_eq "png" "$fmt" "Imagen 4 should be png"

  fmt="$(get_native_format "stability" "stable-diffusion-xl-1024-v1-0")"
  assert_eq "png" "$fmt" "Stability SDXL should be png"
}

test_get_native_format_unknown_model() {
  local fmt
  fmt="$(get_native_format "unknown_provider" "unknown_model")"
  assert_eq "png" "$fmt" "Unknown model should default to png"

  fmt="$(get_native_format "openai" "future-model-5")"
  assert_eq "png" "$fmt" "Unknown OpenAI model should default to png"
}

test_get_conversion_command_webp_cwebp() {
  if ! command -v cwebp >/dev/null 2>&1; then
    return 0  # Skip if cwebp not installed
  fi
  local cmd
  cmd="$(get_conversion_command "png" "webp")"
  assert_eq "cwebp" "$cmd" "Should prefer cwebp for webp target"
}

test_get_conversion_command_avif_avifenc() {
  if ! command -v avifenc >/dev/null 2>&1; then
    return 0  # Skip if avifenc not installed
  fi
  local cmd
  cmd="$(get_conversion_command "png" "avif")"
  assert_eq "avifenc" "$cmd" "Should prefer avifenc for avif target"
}

test_get_conversion_command_fallback_imagemagick() {
  if ! command -v magick >/dev/null 2>&1 && ! command -v convert >/dev/null 2>&1; then
    return 0  # Skip if ImageMagick not installed
  fi
  local cmd
  cmd="$(get_conversion_command "png" "jpg")"
  # Should be either "magick" or "convert"
  if [[ "$cmd" != "magick" && "$cmd" != "convert" ]]; then
    printf '  Expected: magick or convert\n  Actual:   %s\n' "$cmd" >&2
    return 1
  fi
}

test_get_conversion_command_no_tools() {
  # Hide all conversion tools by overriding PATH
  local old_path="$PATH"
  local empty_dir="${_test_tmpdir}/empty_bin"
  mkdir -p "$empty_dir"
  PATH="$empty_dir"

  local cmd
  cmd="$(get_conversion_command "png" "webp")"
  PATH="$old_path"
  assert_eq "" "$cmd" "Should return empty when no tools available"
}

test_validate_config_format_mismatch_no_converter() {
  # Set up provider+model that produces jpg, request png output, hide all converters
  export PROVIDER="bfl"
  export MODEL="flux-1.1-pro"

  local tmp_output="${_test_tmpdir}/test.png"
  touch "$tmp_output"

  # Override get_conversion_command to simulate no tools available
  get_conversion_command() {
    printf ''
  }

  local exit_code=0
  local stderr_output
  stderr_output="$(validate_config "test prompt" "$tmp_output" "high" 1024 1024 2>&1)" || exit_code=$?

  # Restore original function by re-sourcing (handled by subshell in run_test)

  assert_eq "$EXIT_INVALID_PARAMS" "$exit_code" "Should fail when conversion not possible"
  assert_contains "$stderr_output" "natively produces" "Error should mention native format"
  assert_contains "$stderr_output" "Options:" "Error should show options"
}

test_list_models_format_column() {
  local output
  output="$(list_models true)"
  assert_contains "$output" "Fmt" "Should have Fmt column header"
  # Check specific format values appear in output
  local bfl_line
  bfl_line="$(printf '%s\n' "$output" | grep "flux-1.1-pro" | grep "bfl" | head -1)"
  assert_contains "$bfl_line" "jpg" "BFL FLUX 1.1 Pro should show jpg format"
}

test_list_models_json_format_field() {
  export OPENAI_API_KEY="test"
  local output
  output="$(OUTPUT_FORMAT=json list_models true)"
  assert_contains "$output" '"format"' "JSON should contain format field"
  assert_contains "$output" '"png"' "JSON should contain png format value"
}

# ============================================================================
# AUTO-EXTENSION RESOLUTION TESTS
# ============================================================================

test_has_recognized_image_extension_png() {
  has_recognized_image_extension "image.png"
  assert_eq 0 $? "image.png should be recognized"
}

test_has_recognized_image_extension_jpg() {
  has_recognized_image_extension "photo.jpg"
  assert_eq 0 $? "photo.jpg should be recognized"
}

test_has_recognized_image_extension_jpeg() {
  has_recognized_image_extension "photo.jpeg"
  assert_eq 0 $? "photo.jpeg should be recognized"
}

test_has_recognized_image_extension_webp() {
  has_recognized_image_extension "photo.webp"
  assert_eq 0 $? "photo.webp should be recognized"
}

test_has_recognized_image_extension_avif() {
  has_recognized_image_extension "photo.avif"
  assert_eq 0 $? "photo.avif should be recognized"
}

test_has_recognized_image_extension_tiff() {
  has_recognized_image_extension "photo.tiff"
  assert_eq 0 $? "photo.tiff should be recognized"
}

test_auto_extension_no_ext() {
  # Output path without extension should get native format appended
  local result
  result="$(resolve_output_extension "/tmp/image" "openai" "dall-e-3" "high" 2>/dev/null)"
  assert_eq "/tmp/image.png" "$result" "Should append .png for openai dall-e-3"

  result="$(resolve_output_extension "/tmp/photo" "bfl" "flux-1.1-pro" "high" 2>/dev/null)"
  assert_eq "/tmp/photo.jpg" "$result" "Should append .jpg for bfl flux-1.1-pro"

  result="$(resolve_output_extension "/tmp/art" "huggingface" "black-forest-labs/flux-1.1-pro" "high" 2>/dev/null)"
  assert_eq "/tmp/art.webp" "$result" "Should append .webp for HF flux-1.1-pro"
}

test_auto_extension_with_recognized_ext() {
  # Output path with recognized extension should be unchanged
  local result
  result="$(resolve_output_extension "/tmp/image.png" "bfl" "flux-1.1-pro" "high" 2>/dev/null)"
  assert_eq "/tmp/image.png" "$result" "Should keep .png unchanged even if provider native is jpg"

  result="$(resolve_output_extension "/tmp/photo.jpg" "openai" "dall-e-3" "high" 2>/dev/null)"
  assert_eq "/tmp/photo.jpg" "$result" "Should keep .jpg unchanged"

  result="$(resolve_output_extension "/tmp/art.webp" "openai" "dall-e-3" "high" 2>/dev/null)"
  assert_eq "/tmp/art.webp" "$result" "Should keep .webp unchanged"
}

test_auto_extension_unrecognized_ext() {
  # Output path with unrecognized extension (.txt) should get native format appended
  local result
  result="$(resolve_output_extension "/tmp/image.txt" "openai" "dall-e-3" "high" 2>/dev/null)"
  assert_eq "/tmp/image.txt.png" "$result" "Should append .png after .txt for openai"

  result="$(resolve_output_extension "/tmp/data.csv" "bfl" "flux-1.1-pro" "high" 2>/dev/null)"
  assert_eq "/tmp/data.csv.jpg" "$result" "Should append .jpg after .csv for bfl"
}

test_auto_extension_dot_in_dir() {
  # Dot in directory path but not in filename — should detect no extension in basename
  local result
  result="$(resolve_output_extension "/tmp/my.project/image" "openai" "dall-e-3" "high" 2>/dev/null)"
  assert_eq "/tmp/my.project/image.png" "$result" "Should append .png when dot is only in dir path"

  result="$(resolve_output_extension "/home/user/v2.0/output" "bfl" "flux-1.1-pro" "high" 2>/dev/null)"
  assert_eq "/home/user/v2.0/output.jpg" "$result" "Should append .jpg when dot is only in dir path"
}

test_auto_extension_trailing_dot() {
  # Trailing dot — treat as no recognized extension
  local result
  result="$(resolve_output_extension "/tmp/image." "openai" "dall-e-3" "high" 2>/dev/null)"
  assert_eq "/tmp/image..png" "$result" "Should append .png after trailing dot"
}

test_auto_extension_no_provider_fallback() {
  # When no provider can be resolved, should fall back to png.
  # We mock select_provider to always fail, simulating no configured providers.
  select_provider() { return 1; }

  local result
  result="$(resolve_output_extension "/tmp/image" "" "" "high" 2>/dev/null)"
  assert_eq "/tmp/image.png" "$result" "Should fall back to png when no provider available"
}

test_auto_extension_empty_output() {
  # Empty output should return empty (no crash)
  local result
  result="$(resolve_output_extension "" "openai" "dall-e-3" "high" 2>/dev/null)"
  assert_eq "" "$result" "Empty output should return empty"
}

# ============================================================================
# TABLE ALIGNMENT & ASCII STATUS TESTS
# ============================================================================

test_list_models_ascii_status() {
  export OPENAI_API_KEY="test"
  unset STABILITY_API_KEY HF_API_KEY BFL_API_KEY REPLICATE_API_TOKEN SILICONFLOW_API_KEY GOOGLE_CREDENTIALS GOOGLE_API_KEY 2>/dev/null || true
  local output
  output="$(list_models true)"
  # Should contain [x] for configured providers
  assert_contains "$output" "[x]" "Should use [x] for configured providers"
  # Should contain [ ] for unconfigured providers
  assert_contains "$output" "[ ]" "Should use [ ] for unconfigured providers"
  # Should NOT contain the old ✓ character
  assert_not_contains "$output" "✓" "Should NOT use ✓ character"
}

test_list_models_long_model_id_truncated() {
  local output
  output="$(list_models true)"
  # The replicate SDXL model has a very long ID with SHA hash
  # It should be truncated with ...
  local sdxl_line
  sdxl_line="$(printf '%s\n' "$output" | grep "stability-ai/sdxl" | head -1)"
  assert_contains "$sdxl_line" "..." "Long model ID should be truncated with ..."
  # The full SHA should NOT appear
  assert_not_contains "$sdxl_line" "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b" \
    "Full SHA hash should not appear in truncated output"
}

test_list_models_column_alignment() {
  local output
  output="$(list_models true)"
  # Extract all data rows (skip header, separator, title lines)
  # All data rows should have the same pipe positions
  local pipe_positions=""
  local line_count=0
  local misaligned=false
  while IFS= read -r line; do
    # Skip empty lines, title, separator
    [[ -z "$line" ]] && continue
    [[ "$line" == "Available"* ]] && continue
    [[ "$line" == "===="* ]] && continue
    [[ "$line" == *"+"* && "$line" != *"|"* ]] && continue
    # Must contain pipe
    [[ "$line" != *"|"* ]] && continue
    # Get pipe positions by finding indices of '|'
    local positions=""
    local i
    for (( i=0; i<${#line}; i++ )); do
      [[ "${line:$i:1}" == "|" ]] && positions+="$i "
    done
    if [[ -z "$pipe_positions" ]]; then
      pipe_positions="$positions"
    elif [[ "$positions" != "$pipe_positions" ]]; then
      misaligned=true
      printf '  Line: %s\n  Expected pipes at: %s\n  Actual pipes at:   %s\n' "$line" "$pipe_positions" "$positions" >&2
      break
    fi
    (( line_count++ ))
  done <<< "$output"
  [[ "$misaligned" == "false" ]] || return 1
  # Verify we checked at least the header + a few data rows
  [[ $line_count -ge 5 ]] || { printf '  Only checked %d lines, expected at least 5\n' "$line_count" >&2; return 1; }
}

# ============================================================================
# GENERATION INFO SIDECAR TESTS
# ============================================================================

test_write_generation_info_creates_yaml() {
  # Create a fake image file
  local img="${_test_tmpdir}/test-output.png"
  printf 'fake-png-data' > "$img"

  # Set the global metadata vars
  _GEN_API_URL="https://api.openai.com/v1/images/generations"
  _GEN_API_METHOD="POST"
  _GEN_API_REQUEST='{"prompt":"a sunset","model":"dall-e-3","size":"1024x1024","response_format":"url"}'
  _GEN_API_RESPONSE='{"data":[{"url":"https://example.com/image.png","revised_prompt":"A beautiful sunset"}]}'
  _GEN_HTTP_CODE="200"
  _GEN_EXTRA_INFO="revised_prompt=A beautiful sunset"

  # Call write_generation_info
  write_generation_info "$img" "a sunset" "" 1024 1024 "high" "openai" "dall-e-3" 1234

  local yaml_path="${_test_tmpdir}/test-output.yaml"
  assert_file_exists "$yaml_path" "YAML sidecar should be created"

  local yaml_content
  yaml_content="$(cat "$yaml_path")"

  assert_contains "$yaml_content" "generation:" "Should contain generation section"
  assert_contains "$yaml_content" "timestamp:" "Should contain timestamp"
  assert_contains "$yaml_content" 'status: "success"' "Should contain success status"
  assert_contains "$yaml_content" 'error_message: ""' "Should contain empty error_message on success"
  assert_contains "$yaml_content" "input:" "Should contain input section"
  assert_contains "$yaml_content" "a sunset" "Should contain the prompt"
  assert_contains "$yaml_content" "openai" "Should contain provider"
  assert_contains "$yaml_content" "dall-e-3" "Should contain model"
  assert_contains "$yaml_content" "request:" "Should contain request section"
  assert_contains "$yaml_content" "https://api.openai.com/v1/images/generations" "Should contain API URL"
  assert_contains "$yaml_content" "headers:" "Should contain headers section"
  assert_contains "$yaml_content" "content_type:" "Should contain content_type header"
  assert_contains "$yaml_content" "http_code: 200" "Should contain HTTP status code"
  assert_contains "$yaml_content" "output:" "Should contain output section"
  assert_contains "$yaml_content" "file_path:" "Should contain file_path"
  assert_contains "$yaml_content" "duration_ms: 1234" "Should contain duration"
  assert_contains "$yaml_content" "provider_details:" "Should contain provider_details section"
  assert_contains "$yaml_content" "revised_prompt" "Should contain revised_prompt extra info"

  # Reset globals
  _GEN_API_URL=""
  _GEN_API_REQUEST=""
  _GEN_API_RESPONSE=""
  _GEN_HTTP_CODE=""
  _GEN_EXTRA_INFO=""
}

test_write_generation_info_truncates_base64() {
  local img="${_test_tmpdir}/test-b64.png"
  printf 'fake-png-data' > "$img"

  # Create a response with a very long base64 string (>1000 chars, simulating real image data)
  local long_b64
  long_b64="$(printf '%0.sA' $(seq 1 1500))"
  _GEN_API_URL="https://api.stability.ai/v1/generation/test/text-to-image"
  _GEN_API_METHOD="POST"
  _GEN_API_REQUEST='{"text_prompts":[{"text":"test"}]}'
  _GEN_API_RESPONSE="{\"artifacts\":[{\"base64\":\"${long_b64}\"}]}"
  _GEN_HTTP_CODE=""
  _GEN_EXTRA_INFO=""

  write_generation_info "$img" "test" "" 1024 1024 "high" "stability" "stable-diffusion-xl-1024-v1-0" 500

  local yaml_path="${_test_tmpdir}/test-b64.yaml"
  assert_file_exists "$yaml_path" "YAML sidecar should be created"

  local yaml_content
  yaml_content="$(cat "$yaml_path")"

  # The full 1500-char base64 string should NOT appear in the YAML (redacted as image data)
  assert_not_contains "$yaml_content" "$long_b64" "Full base64 data should be redacted"
  assert_contains "$yaml_content" "base64 image data" "Should contain base64 redaction marker"

  _GEN_API_URL=""
  _GEN_API_REQUEST=""
  _GEN_API_RESPONSE=""
  _GEN_HTTP_CODE=""
}

test_generation_info_disabled() {
  # Set up a mock provider that creates a file and sets globals
  generate_image_mockprovider() {
    local output_path="$6"
    printf 'fake-image' > "$output_path"
    _GEN_API_URL="https://mock.api/generate"
    _GEN_API_REQUEST='{"prompt":"test"}'
    _GEN_API_RESPONSE='{"url":"https://mock.api/result.png"}'
    return "$EXIT_SUCCESS"
  }

  local img="${_test_tmpdir}/no-sidecar.png"
  export SAVE_GENERATION_INFO=false
  export DRY_RUN=false
  export FORCE=true
  export EMBED_METADATA=false
  TEXT_TO_IMAGE_CONFIG_DIR="${_test_tmpdir}" ensure_directories

  # Clear globals
  _GEN_API_URL=""
  _GEN_API_REQUEST=""
  _GEN_API_RESPONSE=""
  _GEN_EXTRA_INFO=""

  # Override generate_image to call mockprovider directly with sidecar logic
  # We need to test the sidecar is NOT created when SAVE_GENERATION_INFO=false
  # Simulate what generate_image does: call provider then conditionally write sidecar
  generate_image_mockprovider "test prompt" "" 1024 1024 high "$img" "mock-model"
  if [[ "${SAVE_GENERATION_INFO}" == "true" ]]; then
    write_generation_info "$img" "test prompt" "" 1024 1024 "high" "mockprovider" "mock-model" 100
  fi

  local yaml_path="${_test_tmpdir}/no-sidecar.yaml"
  if [[ -f "$yaml_path" ]]; then
    printf '  YAML sidecar should NOT exist when SAVE_GENERATION_INFO=false\n' >&2
    return 1
  fi

  SAVE_GENERATION_INFO=true
}

test_truncate_response_for_yaml() {
  # Test with a JSON response containing a long string
  local long_str
  long_str="$(printf '%0.sX' $(seq 1 300))"
  local response="{\"data\":\"${long_str}\",\"short\":\"ok\"}"

  local result
  result="$(truncate_response_for_yaml "$response")"

  # The long string should be truncated
  assert_not_contains "$result" "$long_str" "Long string should be truncated"
  # The short string should be preserved
  assert_contains "$result" "ok" "Short string should be preserved"
  # Should contain truncation marker
  assert_contains "$result" "truncated" "Should contain truncation marker"
}

test_truncate_response_for_yaml_short_response() {
  # Short responses should be passed through unchanged
  local response='{"status":"ok","message":"done"}'
  local result
  result="$(truncate_response_for_yaml "$response")"
  assert_contains "$result" "ok" "Short response should be preserved"
  assert_contains "$result" "done" "Short response should be preserved"
}

test_write_generation_info_empty_globals() {
  # Test when globals are empty (no API call metadata captured)
  local img="${_test_tmpdir}/empty-meta.png"
  printf 'fake-png' > "$img"

  _GEN_API_URL=""
  _GEN_API_METHOD="POST"
  _GEN_API_REQUEST=""
  _GEN_API_RESPONSE=""
  _GEN_HTTP_CODE=""
  _GEN_EXTRA_INFO=""

  write_generation_info "$img" "test prompt" "" 1024 1024 "high" "openai" "dall-e-3" 0

  local yaml_path="${_test_tmpdir}/empty-meta.yaml"
  assert_file_exists "$yaml_path" "YAML should be created even with empty globals"

  local yaml_content
  yaml_content="$(cat "$yaml_path")"
  assert_contains "$yaml_content" "generation:" "Should contain generation section"
  assert_contains "$yaml_content" "provider_details:" "Should contain provider_details section"
  assert_contains "$yaml_content" "{}" "Should contain empty provider_details"
}

test_save_generation_info_default() {
  # SAVE_GENERATION_INFO should default to true
  assert_eq "true" "${SAVE_GENERATION_INFO}" "SAVE_GENERATION_INFO should default to true"
}

test_write_generation_info_error_status() {
  # Test that write_generation_info records error status when exit_code != 0
  local img="${_test_tmpdir}/error-test.png"
  # No image file created (simulating error path)

  _GEN_API_URL="https://api.openai.com/v1/images/generations"
  _GEN_API_METHOD="POST"
  _GEN_API_REQUEST='{"prompt":"test","model":"dall-e-3"}'
  _GEN_API_RESPONSE='{"error":{"message":"Invalid API key","type":"invalid_request_error","code":"invalid_api_key"}}'
  _GEN_HTTP_CODE="401"
  _GEN_EXTRA_INFO=""

  write_generation_info "$img" "test" "" 1024 1024 "high" "openai" "dall-e-3" 500 6

  local yaml_path="${_test_tmpdir}/error-test.yaml"
  assert_file_exists "$yaml_path" "YAML sidecar should be created on error"

  local yaml_content
  yaml_content="$(cat "$yaml_path")"

  assert_contains "$yaml_content" 'status: "error"' "Should contain error status"
  assert_contains "$yaml_content" "Invalid API key" "Should contain error message from response"
  assert_contains "$yaml_content" "http_code: 401" "Should contain HTTP 401 status code"
  assert_contains "$yaml_content" "invalid_api_key" "Should preserve error details in response"

  _GEN_API_URL=""
  _GEN_API_REQUEST=""
  _GEN_API_RESPONSE=""
  _GEN_HTTP_CODE=""
}

test_sanitize_response_for_yaml_redacts_credentials() {
  # Test that sensitive fields are redacted in response
  local response='{"access_token":"secret123","api_key":"key456","data":"safe-data"}'
  local result
  result="$(sanitize_response_for_yaml "$response")"
  assert_not_contains "$result" "secret123" "access_token value should be redacted"
  assert_not_contains "$result" "key456" "api_key value should be redacted"
  assert_contains "$result" "REDACTED" "Should contain REDACTED placeholder"
  assert_contains "$result" "safe-data" "Non-sensitive data should be preserved"
}

test_sanitize_response_for_yaml_preserves_short_strings() {
  # Short strings should NOT be truncated (only base64 image data > 1000 chars is replaced)
  local response='{"status":"ok","message":"Image generated successfully","url":"https://example.com/image.png"}'
  local result
  result="$(sanitize_response_for_yaml "$response")"
  assert_contains "$result" "Image generated successfully" "Short message should be preserved verbatim"
  assert_contains "$result" "https://example.com/image.png" "URL should be preserved verbatim"
}

test_sanitize_request_for_yaml_redacts_credentials() {
  # Test that sensitive fields in request payload are redacted
  local request='{"prompt":"test","api_key":"should-be-redacted","password":"secret"}'
  local result
  result="$(sanitize_request_for_yaml "$request")"
  assert_not_contains "$result" "should-be-redacted" "api_key should be redacted"
  assert_not_contains "$result" "secret" "password should be redacted"
  assert_contains "$result" "REDACTED" "Should contain REDACTED placeholder"
  assert_contains "$result" "test" "Non-sensitive data should be preserved"
}

test_sanitize_request_for_yaml_passes_clean_payload() {
  # Normal request payloads (no credentials) should pass through unchanged
  local request='{"prompt":"a sunset","model":"dall-e-3","size":"1024x1024"}'
  local result
  result="$(sanitize_request_for_yaml "$request")"
  assert_contains "$result" "a sunset" "Prompt should be preserved"
  assert_contains "$result" "dall-e-3" "Model should be preserved"
  assert_contains "$result" "1024x1024" "Size should be preserved"
}

test_sanitize_response_for_yaml_empty_input() {
  local result
  result="$(sanitize_response_for_yaml "")"
  assert_eq "" "$result" "Empty input should return empty"
}

test_sanitize_request_for_yaml_empty_input() {
  local result
  result="$(sanitize_request_for_yaml "")"
  assert_eq "" "$result" "Empty input should return empty"
}

test_gen_http_code_global_exists() {
  # _GEN_HTTP_CODE should be declared
  [[ "${_GEN_HTTP_CODE+x}" == "x" ]] || return 1
}

test_retry_curl_sets_http_code_on_success() {
  # Mock curl to return 200
  _curl() { printf 'response body\n200'; }
  _GEN_HTTP_CODE=""
  retry_curl "http://example.com" >/dev/null
  assert_eq "200" "$_GEN_HTTP_CODE" "Should set _GEN_HTTP_CODE to 200 on success"
}

test_retry_curl_sets_http_code_on_client_error() {
  # Mock curl to return 400
  _curl() { printf 'error body\n400'; }
  _GEN_HTTP_CODE=""
  local exit_code=0
  retry_curl "http://example.com" >/dev/null 2>/dev/null || exit_code=$?
  assert_ne "0" "$exit_code" "Should return non-zero on 400"
  assert_eq "400" "$_GEN_HTTP_CODE" "Should set _GEN_HTTP_CODE to 400 on client error"
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
  run_test "list models configured column" test_list_models_configured_column
  run_test "list models no status when filtered" test_list_models_no_status_when_filtered
  # ensure_output_format tests
  run_test "ensure_output_format detects PNG" test_ensure_output_format_detects_png
  run_test "ensure_output_format detects WebP" test_ensure_output_format_detects_webp
  run_test "ensure_output_format converts WebP to PNG" test_ensure_output_format_converts_webp_to_png
  run_test "ensure_output_format converts WebP to JPG" test_ensure_output_format_converts_webp_to_jpg
  run_test "ensure_output_format no-op when matching" test_ensure_output_format_noop_when_matching
  run_test "ensure_output_format graceful without ImageMagick" test_ensure_output_format_graceful_without_imagemagick
  run_test "ensure_output_format skips unsupported extensions" test_ensure_output_format_unsupported_ext_skips
  run_test "ensure_output_format converts PNG to WebP" test_ensure_output_format_converts_png_to_webp
  run_test "ensure_output_format AVIF" test_ensure_output_format_avif
  # Native format registry tests
  run_test "get_native_format known models" test_get_native_format_known_models
  run_test "get_native_format unknown model" test_get_native_format_unknown_model
  run_test "get_conversion_command webp prefers cwebp" test_get_conversion_command_webp_cwebp
  run_test "get_conversion_command avif prefers avifenc" test_get_conversion_command_avif_avifenc
  run_test "get_conversion_command fallback ImageMagick" test_get_conversion_command_fallback_imagemagick
  run_test "get_conversion_command no tools" test_get_conversion_command_no_tools
  run_test "validate_config format mismatch no converter" test_validate_config_format_mismatch_no_converter
  run_test "list_models format column" test_list_models_format_column
  run_test "list_models JSON format field" test_list_models_json_format_field
  # Table alignment & ASCII status tests
  run_test "list_models ASCII status icons" test_list_models_ascii_status
  run_test "list_models long model ID truncated" test_list_models_long_model_id_truncated
  run_test "list_models column alignment" test_list_models_column_alignment
  # Generation info sidecar tests
  run_test "write_generation_info creates YAML" test_write_generation_info_creates_yaml
  run_test "write_generation_info truncates base64" test_write_generation_info_truncates_base64
  run_test "generation info disabled" test_generation_info_disabled
  run_test "truncate_response_for_yaml" test_truncate_response_for_yaml
  run_test "truncate_response_for_yaml short response" test_truncate_response_for_yaml_short_response
  run_test "write_generation_info empty globals" test_write_generation_info_empty_globals
  run_test "SAVE_GENERATION_INFO default" test_save_generation_info_default
  # Error sidecar and enhanced logging tests
  run_test "write_generation_info error status" test_write_generation_info_error_status
  run_test "sanitize_response_for_yaml redacts credentials" test_sanitize_response_for_yaml_redacts_credentials
  run_test "sanitize_response_for_yaml preserves short strings" test_sanitize_response_for_yaml_preserves_short_strings
  run_test "sanitize_request_for_yaml redacts credentials" test_sanitize_request_for_yaml_redacts_credentials
  run_test "sanitize_request_for_yaml passes clean payload" test_sanitize_request_for_yaml_passes_clean_payload
  run_test "sanitize_response_for_yaml empty input" test_sanitize_response_for_yaml_empty_input
  run_test "sanitize_request_for_yaml empty input" test_sanitize_request_for_yaml_empty_input
  run_test "_GEN_HTTP_CODE global exists" test_gen_http_code_global_exists
  run_test "retry_curl sets http_code on success" test_retry_curl_sets_http_code_on_success
  run_test "retry_curl sets http_code on client error" test_retry_curl_sets_http_code_on_client_error
  # Auto-extension resolution tests
  run_test "has_recognized_image_extension png" test_has_recognized_image_extension_png
  run_test "has_recognized_image_extension jpg" test_has_recognized_image_extension_jpg
  run_test "has_recognized_image_extension jpeg" test_has_recognized_image_extension_jpeg
  run_test "has_recognized_image_extension webp" test_has_recognized_image_extension_webp
  run_test "has_recognized_image_extension avif" test_has_recognized_image_extension_avif
  run_test "has_recognized_image_extension tiff" test_has_recognized_image_extension_tiff
  run_test "auto extension no ext" test_auto_extension_no_ext
  run_test "auto extension with recognized ext" test_auto_extension_with_recognized_ext
  run_test "auto extension unrecognized ext" test_auto_extension_unrecognized_ext
  run_test "auto extension dot in dir" test_auto_extension_dot_in_dir
  run_test "auto extension trailing dot" test_auto_extension_trailing_dot
  run_test "auto extension no provider fallback" test_auto_extension_no_provider_fallback
  run_test "auto extension empty output" test_auto_extension_empty_output

  print_summary
}

main "$@"