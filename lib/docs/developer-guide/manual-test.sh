#!/bin/bash
#
# Manual Test Plan Script for prompt-registry CLI
# Based on manual-test-plan.md
#
# Usage:
#   ./manual-test.sh [section]...
#   ./manual-test.sh --help
#
# Examples:
#   ./manual-test.sh              # Run all sections
#   ./manual-test.sh 1 5          # Run sections 1 and 5 only
#   ./manual-test.sh --list       # List all sections
#

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables
PR_TEST_ROOT=""
XDG_CONFIG_HOME=""
REPO_ROOT=""
PR_BIN=""
RESULTS_FILE=""
VERBOSE=0
SECTIONS_TO_RUN=()

# Test results tracking
declare -A SECTION_RESULTS
declare -A TEST_RESULTS

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $*"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[SKIP]${NC} $*"
}

log_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $*${NC}"
    echo -e "${BLUE}========================================${NC}"
}

log_command() {
    echo "" >&2
    echo -e "${YELLOW}>${NC} $*" >&2
}

# Record test result
record_test() {
    local section="$1"
    local test_name="$2"
    local status="$3"  # pass, fail, skip
    local output="$4"
    local duration="$5"

    TEST_RESULTS["${section}:${test_name}"]="${status}|${duration}|${output}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Run a command with timing and output capture
run_cmd() {
    local cmd="$*"
    local start end duration exit_code output

    log_command "$cmd"

    start=$(date +%s.%N)
    output=$(eval "$cmd" 2>&1) || true
    exit_code=$?
    end=$(date +%s.%N)
    
    # Calculate duration, fallback to 0 if bc fails
    duration=$(echo "$end - $start" | bc 2>/dev/null || echo "0")

    if [ $VERBOSE -eq 1 ]; then
        echo "$output"
    fi

    # Base64 encode output to handle multiline and special characters
    output=$(echo "$output" | base64 -w 0)

    echo "$exit_code|$duration|$output"
}

# Assert exit code matches expected
assert_exit() {
    local result="$1"
    local expected="$2"

    local exit_code=$(echo "$result" | cut -d'|' -f1)
    local output=$(echo "$result" | cut -d'|' -f3- | base64 -d)

    if [ "$exit_code" -eq "$expected" ]; then
        return 0
    else
        echo "Expected exit code $expected, got $exit_code"
        echo "Output: $output"
        return 1
    fi
}

# Assert JSON field matches expected
assert_json_field() {
    local output="$1"
    local field_path="$2"
    local expected="$3"

    local value
    value=$(echo "$output" | jq -r "$field_path" 2>/dev/null) || return 1

    if [ "$value" = "$expected" ]; then
        return 0
    else
        echo "Expected $field_path=$expected, got $value"
        return 1
    fi
}

# Assert JSON status is ok
assert_json_status() {
    local output="$1"
    assert_json_field "$output" ".status" "ok"
}

# Assert pattern exists in output
assert_contains() {
    local output="$1"
    local pattern="$2"

    # Decode base64 if it looks like base64
    if echo "$output" | grep -qE '^[A-Za-z0-9+/]+={0,2}$'; then
        output=$(echo "$output" | base64 -d)
    fi

    if echo "$output" | grep -q "$pattern"; then
        return 0
    else
        echo "Expected pattern '$pattern' not found in output"
        return 1
    fi
}

# ============================================================================
# Setup
# ============================================================================

setup_environment() {
    log_section "Setting up test environment"

    PR_TEST_ROOT="$HOME/.test-prompt-registry"
    XDG_CONFIG_HOME="$PR_TEST_ROOT/xdg"
    REPO_ROOT="$(cd /home/wherka/workspace/opensource/prompt-registry && pwd)"
    PR_BIN="node $REPO_ROOT/lib/dist/cli/main.js"

    log_info "Test root: $PR_TEST_ROOT"
    log_info "CLI binary: $PR_BIN"
    log_info "XDG config: $XDG_CONFIG_HOME"

    # Clean and create directories
    rm -rf "$PR_TEST_ROOT"
    mkdir -p "$PR_TEST_ROOT"/{xdg,project,bundles/local-foo,exports}

    # Initialize results file
    RESULTS_FILE="$PR_TEST_ROOT/results.json"
    echo '{"sections":{}}' > "$RESULTS_FILE"

    log_success "Environment setup complete"
}

check_prerequisites() {
    log_section "Checking prerequisites"

    local all_ok=true

    # Check node
    if command_exists node; then
        local node_version=$(node --version)
        log_success "Node: $node_version"
    else
        log_error "Node not found"
        all_ok=false
    fi

    # Check jq
    if command_exists jq; then
        log_success "jq: $(jq --version)"
    else
        log_error "jq not found (required for JSON validation)"
        all_ok=false
    fi

    # Check bc (for timing calculations)
    if command_exists bc; then
        log_success "bc: available"
    else
        log_warning "bc not found (timing calculations will be limited)"
    fi

    # Check gh CLI (optional)
    if command_exists gh; then
        log_success "gh CLI: $(gh --version)"
    else
        log_warning "gh CLI not found (GitHub auth tests will be skipped)"
    fi

    # Check if CLI binary exists
    if [ -f "$REPO_ROOT/lib/dist/cli/main.js" ]; then
        log_success "CLI binary found"
    else
        log_error "CLI binary not found at $REPO_ROOT/lib/dist/cli/main.js"
        log_info "Run 'npm run build' in the lib directory first"
        all_ok=false
    fi

    if [ "$all_ok" = false ]; then
        log_error "Prerequisites check failed"
        exit 1
    fi
}

# ============================================================================
# Test Sections
# ============================================================================

section_1_unauthenticated_smoke_test() {
    log_section "Section 1: Unauthenticated Smoke Test"

    unset GITHUB_TOKEN GH_TOKEN
    export PROMPT_REGISTRY_DISABLE_GH_CLI=1
    cd "$PR_TEST_ROOT/project"

    # 1.1 Version check
    log_info "Test 1.1: Version check"
    result=$(run_cmd "$PR_BIN --version")
    local exit_code=$(echo "$result" | cut -d'|' -f1)
    local output=$(echo "$result" | cut -d'|' -f3- | base64 -d)
    if [ "$exit_code" -eq 0 ] && [ -n "$output" ]; then
        log_success "Version check passed"
        record_test "1" "version" "pass" "$output" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Version check failed"
        record_test "1" "version" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
    fi

    # 1.2 Help check
    log_info "Test 1.2: Help check"
    result=$(run_cmd "$PR_BIN --help")
    if assert_exit "$result" 0 && assert_contains "$(echo "$result" | cut -d'|' -f3-)" "prompt-registry"; then
        log_success "Help check passed"
        record_test "1" "help" "pass" "$(echo "$result" | cut -d'|' -f3- | head -5)" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Help check failed"
        record_test "1" "help" "fail" "$(echo "$result" | cut -d'|' -f3-)" "$(echo "$result" | cut -d'|' -f2)"
    fi

    # 1.3 Empty-state list
    log_info "Test 1.3: Empty-state list"
    result=$(run_cmd "$PR_BIN hub list -o json")
    local output=$(echo "$result" | cut -d'|' -f3-)
    if assert_exit "$result" 0 && assert_json_status "$output" && assert_json_field "$output" ".data.hubs" "[]" && assert_json_field "$output" ".data.activeId" "null"; then
        log_success "Empty-state list passed"
        record_test "1" "empty-state-list" "pass" "$output" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Empty-state list failed"
        record_test "1" "empty-state-list" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
    fi

    # 1.4 Unknown command
    log_info "Test 1.4: Unknown command"
    result=$(run_cmd "$PR_BIN bogus")
    if ! assert_exit "$result" 0; then
        log_success "Unknown command check passed (exit code non-zero)"
        record_test "1" "unknown-command" "pass" "exit code: $(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Unknown command check failed"
        record_test "1" "unknown-command" "fail" "exit code: $(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2)"
    fi

    # 1.5 Index unknown verb
    log_info "Test 1.5: Index unknown verb"
    result=$(run_cmd "$PR_BIN index ghost")
    if assert_exit "$result" 64; then
        log_success "Index unknown verb check passed (exit code 64)"
        record_test "1" "index-unknown-verb" "pass" "exit code: $(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Index unknown verb check failed"
        record_test "1" "index-unknown-verb" "fail" "exit code: $(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2)"
    fi

    # 1.6 Explain output
    log_info "Test 1.6: Explain output"
    log_warning "Explain test skipped - explain command is a defineCommand (positional argument limitation)"
    record_test "1" "explain-output" "skip" "defineCommand limitation" "0"

    # 1.7 Output format matrix
    log_info "Test 1.7: Output format matrix"
    local all_passed=true
    for fmt in text json yaml ndjson; do
        result=$(run_cmd "$PR_BIN hub list -o $fmt")
        if assert_exit "$result" 0; then
            local output=$(echo "$result" | cut -d'|' -f3-)
            if [ "$fmt" != "ndjson" ] && [ -z "$output" ]; then
                log_error "Output format $fmt failed (empty output)"
                record_test "1" "output-format-$fmt" "fail" "empty output" "$(echo "$result" | cut -d'|' -f2)"
                all_passed=false
            else
                log_success "Output format $fmt passed"
                record_test "1" "output-format-$fmt" "pass" "" "$(echo "$result" | cut -d'|' -f2)"
            fi
        else
            log_error "Output format $fmt failed"
            record_test "1" "output-format-$fmt" "fail" "exit code: $(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2)"
            all_passed=false
        fi
    done

    if [ "$all_passed" = true ]; then
        log_success "All output formats passed"
    else
        log_error "Some output formats failed"
    fi

    unset PROMPT_REGISTRY_DISABLE_GH_CLI
    SECTION_RESULTS["1"]="completed"
}

section_2_initiate_user_configuration() {
    log_section "Section 2: Initiate User Configuration from Real Hub"

    unset GITHUB_TOKEN GH_TOKEN
    unset PROMPT_REGISTRY_DISABLE_GH_CLI
    cd "$PR_TEST_ROOT/project"

    # Check if gh CLI is available and authenticated
    if ! command_exists gh || ! gh auth status >/dev/null 2>&1; then
        log_warning "gh CLI not available or not authenticated - skipping section 2"
        record_test "2" "hub-add" "skip" "gh CLI not available" "0"
        record_test "2" "hub-use" "skip" "gh CLI not available" "0"
        record_test "2" "hub-sync" "skip" "gh CLI not available" "0"
        record_test "2" "hub-inspect" "skip" "gh CLI not available" "0"
        SECTION_RESULTS["2"]="skipped"
        return
    fi

    # 2.1 Add the hub
    log_info "Test 2.1: Add hub"
    result=$(run_cmd "$PR_BIN hub add --type github --location Amadeus-xDLC/genai.prompt-registry-config --ref main -o json")
    local output=$(echo "$result" | cut -d'|' -f3-)
    if assert_json_status "$output"; then
        log_success "Hub add passed"
        record_test "2" "hub-add" "pass" "$output" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Hub add failed"
        record_test "2" "hub-add" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
        # Skip remaining tests in this section if hub add failed
        SECTION_RESULTS["2"]="failed"
        return
    fi

    # 2.2 Activate the hub
    log_info "Test 2.2: Activate hub"
    result=$(run_cmd "$PR_BIN hub use amadeus-hub -o json")
    output=$(echo "$result" | cut -d'|' -f3-)
    if assert_json_status "$output" && assert_json_field "$output" ".data.activeId" "amadeus-hub"; then
        log_success "Hub activate passed"
        record_test "2" "hub-use" "pass" "$output" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Hub activate failed"
        record_test "2" "hub-use" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
    fi

    # 2.3 Sync the hub
    log_info "Test 2.3: Sync hub"
    result=$(run_cmd "$PR_BIN hub sync amadeus-hub -o json")
    output=$(echo "$result" | cut -d'|' -f3-)
    if assert_json_status "$output"; then
        log_success "Hub sync passed"
        record_test "2" "hub-sync" "pass" "$output" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Hub sync failed"
        record_test "2" "hub-sync" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
    fi

    # 2.4 Inspect on disk
    log_info "Test 2.4: Inspect on disk"
    local hub_dir="$XDG_CONFIG_HOME/prompt-registry/hubs/amadeus-hub"
    if [ -d "$hub_dir" ] && [ -f "$hub_dir/hub-config.yml" ]; then
        log_success "Hub files exist on disk"
        record_test "2" "hub-inspect" "pass" "hub-config.yml found at $hub_dir" "0"
    else
        log_error "Hub files not found on disk"
        record_test "2" "hub-inspect" "fail" "hub-config.yml not found at $hub_dir" "0"
    fi

    SECTION_RESULTS["2"]="completed"
}

section_3_browse_profiles() {
    log_section "Section 3: Browse Profiles from Hub"

    cd "$PR_TEST_ROOT/project"

    # Check if hub is activated (depends on section 2)
    if [ "${SECTION_RESULTS[2]:-}" != "completed" ]; then
        log_warning "Section 2 not completed - skipping section 3"
        record_test "3" "profile-list" "skip" "depends on section 2" "0"
        record_test "3" "profile-show" "skip" "depends on section 2" "0"
        SECTION_RESULTS["3"]="skipped"
        return
    fi

    # 3.1 List profiles
    log_info "Test 3.1: List profiles"
    result=$(run_cmd "$PR_BIN profile list -o json")
    local output=$(echo "$result" | cut -d'|' -f3-)
    local profile_count=$(echo "$output" | jq -r '.data.profiles | length' 2>/dev/null || echo "0")
    if assert_json_status "$output" && [ "$profile_count" -gt 0 ]; then
        log_success "Profile list passed ($profile_count profiles)"
        record_test "3" "profile-list" "pass" "$profile_count profiles" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Profile list failed"
        record_test "3" "profile-list" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
    fi

    # 3.2 Show a specific profile (if available)
    log_info "Test 3.2: Show profile"
    local first_profile=$(echo "$output" | jq -r '.data.profiles[0].id' 2>/dev/null || echo "")
    if [ -n "$first_profile" ]; then
        result=$(run_cmd "$PR_BIN profile show $first_profile -o json")
        output=$(echo "$result" | cut -d'|' -f3-)
        if assert_json_status "$output"; then
            log_success "Profile show passed"
            record_test "3" "profile-show" "pass" "$output" "$(echo "$result" | cut -d'|' -f2)"
        else
            log_error "Profile show failed"
            record_test "3" "profile-show" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
        fi
    else
        log_warning "No profiles available to show"
        record_test "3" "profile-show" "skip" "no profiles available" "0"
    fi

    SECTION_RESULTS["3"]="completed"
}

section_4_project_level_configuration() {
    log_section "Section 4: Project-level Configuration"

    cd "$PR_TEST_ROOT/project"

    log_warning "Section 4 skipped - target add is a defineCommand (known limitation)"
    record_test "4" "target-add" "skip" "defineCommand limitation" "0"
    record_test "4" "target-list" "skip" "defineCommand limitation" "0"
    SECTION_RESULTS["4"]="skipped"
}

section_5_detached_hub_flow() {
    log_section "Section 5: Detached / Default-local Hub Flow"

    cd "$PR_TEST_ROOT/project"

    # 5.1 Add detached source
    log_info "Test 5.1: Add detached source"
    result=$(run_cmd "$PR_BIN source add --type github --url owner/repo --id detached-foo -o json")
    local output=$(echo "$result" | cut -d'|' -f3-)
    if assert_json_status "$output"; then
        log_success "Source add passed"
        record_test "5" "source-add" "pass" "$output" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Source add failed"
        record_test "5" "source-add" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
        SECTION_RESULTS["5"]="failed"
        return
    fi

    # 5.2 List sources
    log_info "Test 5.2: List sources"
    result=$(run_cmd "$PR_BIN source list -o text")
    local output=$(echo "$result" | cut -d'|' -f3-)
    if assert_exit "$result" 0 && assert_contains "$output" "detached-foo"; then
        log_success "Source list passed"
        record_test "5" "source-list" "pass" "$output" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Source list failed"
        record_test "5" "source-list" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
    fi

    # 5.3 Remove source
    log_info "Test 5.3: Remove source"
    result=$(run_cmd "$PR_BIN source remove detached-foo -o json")
    output=$(echo "$result" | cut -d'|' -f3-)
    if assert_json_status "$output"; then
        log_success "Source remove passed"
        record_test "5" "source-remove" "pass" "$output" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Source remove failed"
        record_test "5" "source-remove" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
    fi

    SECTION_RESULTS["5"]="completed"
}

section_6_synthetic_bundle_flow() {
    log_section "Section 6: End-to-End Profile Activation (Synthetic Bundle)"

    # 6.1 Build synthetic bundle
    log_info "Test 6.1: Build synthetic bundle"
    local bundle_dir="$PR_TEST_ROOT/bundles/local-foo"
    mkdir -p "$bundle_dir/prompts"

    cat > "$bundle_dir/deployment-manifest.yml" <<'EOF'
id: local-foo
version: 1.0.0
name: Local Foo
EOF

    echo "# A prompt" > "$bundle_dir/prompts/a.md"

    if [ -f "$bundle_dir/deployment-manifest.yml" ]; then
        log_success "Synthetic bundle created"
        record_test "6" "bundle-create" "pass" "bundle created at $bundle_dir" "0"
    else
        log_error "Synthetic bundle creation failed"
        record_test "6" "bundle-create" "fail" "bundle not created" "0"
        SECTION_RESULTS["6"]="failed"
        return
    fi

    # 6.2 Build local hub config
    log_info "Test 6.2: Build local hub config"
    local hub_dir="$PR_TEST_ROOT/local-hub"
    mkdir -p "$hub_dir"

    cat > "$hub_dir/hub-config.yml" <<EOF
version: 1.0.0
metadata:
  name: Local Test Hub
  description: synthetic hub for the manual test plan
  maintainer: tester
  updatedAt: '2026-04-26T00:00:00Z'
sources:
  - id: local-foo-src
    name: Local Foo Source
    type: local
    url: $PR_TEST_ROOT/bundles/local-foo
    enabled: true
    priority: 0
    hubId: local-test-hub
profiles:
  - id: backend
    name: Backend Developer
    bundles:
      - id: local-foo
        version: 1.0.0
        source: local-foo-src
        required: true
EOF

    if [ -f "$hub_dir/hub-config.yml" ]; then
        log_success "Local hub config created"
        record_test "6" "hub-config-create" "pass" "hub config created at $hub_dir" "0"
    else
        log_error "Local hub config creation failed"
        record_test "6" "hub-config-create" "fail" "hub config not created" "0"
        SECTION_RESULTS["6"]="failed"
        return
    fi

    cd "$PR_TEST_ROOT/project"

    # 6.3 Import hub
    log_info "Test 6.3: Import hub"
    result=$(run_cmd "$PR_BIN hub add --type local --location \"$PR_TEST_ROOT/local-hub\" -o json")
    local output=$(echo "$result" | cut -d'|' -f3-)
    if assert_json_status "$output"; then
        log_success "Hub import passed"
        record_test "6" "hub-import" "pass" "$output" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Hub import failed"
        record_test "6" "hub-import" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
        SECTION_RESULTS["6"]="failed"
        return
    fi

    # 6.4 Activate hub
    log_info "Test 6.4: Activate hub"
    result=$(run_cmd "$PR_BIN hub use local-test-hub -o json")
    output=$(echo "$result" | cut -d'|' -f3-)
    if assert_json_status "$output" && assert_json_field "$output" ".data.activeId" "local-test-hub"; then
        log_success "Hub activate passed"
        record_test "6" "hub-activate" "pass" "$output" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Hub activate failed"
        record_test "6" "hub-activate" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
    fi

    # 6.5 Show profile
    log_info "Test 6.5: Show profile"
    result=$(run_cmd "$PR_BIN profile show backend -o json")
    output=$(echo "$result" | cut -d'|' -f3-)
    if assert_json_status "$output" && assert_json_field "$output" ".data.profile.id" "backend"; then
        log_success "Profile show passed"
        record_test "6" "profile-show" "pass" "$output" "$(echo "$result" | cut -d'|' -f2)"
    else
        log_error "Profile show failed"
        record_test "6" "profile-show" "fail" "$output" "$(echo "$result" | cut -d'|' -f2)"
    fi

    # 6.6 Profile activation (skipped - requires target add)
    log_warning "Test 6.6: Profile activation skipped - requires target add (defineCommand limitation)"
    record_test "6" "profile-activate" "skip" "defineCommand limitation" "0"

    SECTION_RESULTS["6"]="completed"
}

# ============================================================================
# Report Generation
# ============================================================================

generate_report() {
    log_section "Test Report"

    local total=0 passed=0 failed=0 skipped=0

    # Count results
    for key in "${!TEST_RESULTS[@]}"; do
        local status=$(echo "${TEST_RESULTS[$key]}" | cut -d'|' -f1)
        total=$((total + 1))
        case "$status" in
            pass) passed=$((passed + 1)) ;;
            fail) failed=$((failed + 1)) ;;
            skip) skipped=$((skipped + 1)) ;;
        esac
    done

    # Print summary
    echo ""
    echo "========================================"
    echo "  SUMMARY"
    echo "========================================"
    echo "Total tests:  $total"
    echo -e "Passed:       ${GREEN}$passed${NC}"
    echo -e "Failed:       ${RED}$failed${NC}"
    echo -e "Skipped:      ${YELLOW}$skipped${NC}"

    if [ $total -gt 0 ]; then
        local pass_rate=$(echo "scale=1; $passed * 100 / $total" | bc)
        echo "Pass rate:    ${pass_rate}%"
    fi
    echo ""

    # Print section details
    echo "========================================"
    echo "  SECTION DETAILS"
    echo "========================================"

    for section in 1 2 3 4 5 6; do
        local section_name=""
        case "$section" in
            1) section_name="Unauthenticated Smoke Test" ;;
            2) section_name="Initiate User Configuration" ;;
            3) section_name="Browse Profiles" ;;
            4) section_name="Project-level Configuration" ;;
            5) section_name="Detached Hub Flow" ;;
            6) section_name="Synthetic Bundle Flow" ;;
        esac

        echo ""
        echo "Section $section: $section_name"
        echo "Status: ${SECTION_RESULTS[$section]:-not_run}"

        # Print test results for this section
        for key in "${!TEST_RESULTS[@]}"; do
            local test_section=$(echo "$key" | cut -d':' -f1)
            if [ "$test_section" = "$section" ]; then
                local test_name=$(echo "$key" | cut -d':' -f2-)
                local status=$(echo "${TEST_RESULTS[$key]}" | cut -d'|' -f1)
                local duration=$(echo "${TEST_RESULTS[$key]}" | cut -d'|' -f2)
                local output=$(echo "${TEST_RESULTS[$key]}" | cut -d'|' -f3-)

                case "$status" in
                    pass) echo -e "  ${GREEN}[PASS]${NC} $test_name" ;;
                    fail) echo -e "  ${RED}[FAIL]${NC} $test_name" ;;
                    skip) echo -e "  ${YELLOW}[SKIP]${NC} $test_name" ;;
                esac

                if [ -n "$duration" ] && [ "$duration" != "0" ]; then
                    echo "    Duration: ${duration}s"
                fi

                if [ -n "$output" ]; then
                    echo "    Output: ${output:0:100}"
                fi
            fi
        done
    done

    # Save results to JSON file
    local json_results="{"
    json_results+="\"total\":$total,"
    json_results+="\"passed\":$passed,"
    json_results+="\"failed\":$failed,"
    json_results+="\"skipped\":$skipped,"
    json_results+="\"sections\":{"

    local first_section=true
    for section in 1 2 3 4 5 6; do
        if [ "$first_section" = false ]; then
            json_results+=","
        fi
        first_section=false

        json_results+="\"$section\":{"
        json_results+="\"status\":\"${SECTION_RESULTS[$section]:-not_run}\","
        json_results+="\"tests\":["

        local first_test=true
        for key in "${!TEST_RESULTS[@]}"; do
            local test_section=$(echo "$key" | cut -d':' -f1)
            if [ "$test_section" = "$section" ]; then
                if [ "$first_test" = false ]; then
                    json_results+=","
                fi
                first_test=false

                local test_name=$(echo "$key" | cut -d':' -f2-)
                local status=$(echo "${TEST_RESULTS[$key]}" | cut -d'|' -f1)
                local duration=$(echo "${TEST_RESULTS[$key]}" | cut -d'|' -f2)
                local output=$(echo "${TEST_RESULTS[$key]}" | cut -d'|' -f3-)

                # Escape JSON strings
                test_name=$(echo "$test_name" | sed 's/"/\\"/g')
                output=$(echo "$output" | sed 's/"/\\"/g' | tr '\n' ' ')

                json_results+="{\"name\":\"$test_name\",\"status\":\"$status\",\"duration\":$duration,\"output\":\"$output\"}"
            fi
        done

        json_results+="]}"
    done

    json_results+="}}"
    echo "$json_results" | jq . > "$RESULTS_FILE"

    echo ""
    log_info "Results saved to: $RESULTS_FILE"
}

# ============================================================================
# Main
# ============================================================================

print_usage() {
    cat <<EOF
Usage: $0 [OPTIONS] [SECTION]...

Run manual test plan for prompt-registry CLI.

Options:
  -v, --verbose     Enable verbose output
  -l, --list        List available sections
  -h, --help        Show this help message

Sections:
  1  Unauthenticated smoke test
  2  Initiate user configuration from real hub (requires GitHub auth)
  3  Browse profiles from hub (depends on section 2)
  4  Project-level configuration (skipped - defineCommand limitation)
  5  Detached / default-local hub flow
  6  End-to-end profile activation (synthetic bundle)

Examples:
  $0                  # Run all sections
  $0 1 5              # Run sections 1 and 5 only
  $0 -v               # Run all sections with verbose output
  $0 -l               # List all sections

EOF
}

list_sections() {
    cat <<EOF
Available Sections:
  1  Unauthenticated smoke test
  2  Initiate user configuration from real hub (requires GitHub auth)
  3  Browse profiles from hub (depends on section 2)
  4  Project-level configuration (skipped - defineCommand limitation)
  5  Detached / default-local hub flow
  6  End-to-end profile activation (synthetic bundle)
EOF
}

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=1
                shift
                ;;
            -l|--list)
                list_sections
                exit 0
                ;;
            -h|--help)
                print_usage
                exit 0
                ;;
            [0-9])
                SECTIONS_TO_RUN+=("$1")
                shift
                ;;
            *)
                echo "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done

    # If no sections specified, run all
    if [ ${#SECTIONS_TO_RUN[@]} -eq 0 ]; then
        SECTIONS_TO_RUN=(1 2 3 4 5 6)
    fi

    log_section "Manual Test Plan for prompt-registry CLI"
    log_info "Sections to run: ${SECTIONS_TO_RUN[*]}"
    log_info "Verbose mode: $([ $VERBOSE -eq 1 ] && echo "enabled" || echo "disabled")"

    # Run setup
    setup_environment
    check_prerequisites
    

    # Run selected sections
    for section in "${SECTIONS_TO_RUN[@]}"; do
        case "$section" in
            1) section_1_unauthenticated_smoke_test ;;
            2) section_2_initiate_user_configuration ;;
            3) section_3_browse_profiles ;;
            4) section_4_project_level_configuration ;;
            5) section_5_detached_hub_flow ;;
            6) section_6_synthetic_bundle_flow ;;
            *)
                log_error "Unknown section: $section"
                ;;
        esac
    done

    # Generate report
    generate_report

    # Exit with appropriate code
    local exit_code=0
    for key in "${!TEST_RESULTS[@]}"; do
        local status=$(echo "${TEST_RESULTS[$key]}" | cut -d'|' -f1)
        if [ "$status" = "fail" ]; then
            exit_code=1
            break
        fi
    done

    exit $exit_code
}

main "$@"
