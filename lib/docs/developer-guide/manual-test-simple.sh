#!/bin/bash
#
# Simple Manual Test Plan Script
# Runs commands directly without complex output parsing
#

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $*"; }
log_error() { echo -e "${RED}[FAIL]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[SKIP]${NC} $*"; }
log_section() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}  $*${NC}"; echo -e "${BLUE}========================================${NC}"; }

# Environment setup
PR_TEST_ROOT="$HOME/.test-prompt-registry"
XDG_CONFIG_HOME="$PR_TEST_ROOT/xdg"
REPO_ROOT="$(cd /home/wherka/workspace/opensource/prompt-registry && pwd)"
PR_BIN="node $REPO_ROOT/lib/dist/cli/main.js"

log_section "Setting up test environment"
rm -rf "$PR_TEST_ROOT"
mkdir -p "$PR_TEST_ROOT"/{xdg,project,bundles/local-foo,exports}
log_info "Test root: $PR_TEST_ROOT"
log_info "CLI binary: $PR_BIN"

# Section 1
log_section "Section 1: Unauthenticated Smoke Test"

unset GITHUB_TOKEN GH_TOKEN
export PROMPT_REGISTRY_DISABLE_GH_CLI=1
cd "$PR_TEST_ROOT/project"

log_info "Test 1.1: Version"
if $PR_BIN --version; then
    log_success "Version check passed"
else
    log_error "Version check failed"
fi

log_info "Test 1.2: Help"
if $PR_BIN --help | head -5; then
    log_success "Help check passed"
else
    log_error "Help check failed"
fi

log_info "Test 1.3: Empty-state list"
output=$($PR_BIN hub list -o json 2>&1)
echo "$output" | jq -e '.status=="ok" and .data.hubs==[] and .data.activeId==null' && log_success "Empty-state list passed" || log_error "Empty-state list failed"

log_info "Test 1.4: Unknown command"
if $PR_BIN bogus 2>&1; then
    log_error "Unknown command should fail"
else
    log_success "Unknown command correctly failed"
fi

log_info "Test 1.5: Index unknown verb"
exit_code=0
($PR_BIN index ghost 2>&1 >/dev/null) || exit_code=$?
if [ "$exit_code" -eq 64 ]; then
    log_success "Index unknown verb correctly exited 64"
else
    log_error "Index unknown verb exit code was $exit_code, expected 64"
fi

log_info "Test 1.6: Explain with positional argument"
output=$($PR_BIN explain BUNDLE.NOT_FOUND 2>&1)
if echo "$output" | grep -q "No bundle (collection or plugin) matched the requested identifier"; then
    log_success "Explain command passed"
else
    log_error "Explain command failed"
    echo "$output"
fi

log_info "Test 1.7: Output format matrix"
for fmt in text json yaml ndjson; do
    if $PR_BIN hub list -o "$fmt" >/dev/null 2>&1; then
        log_success "Output format $fmt passed"
    else
        log_error "Output format $fmt failed"
    fi
done

unset PROMPT_REGISTRY_DISABLE_GH_CLI

log_section "Section 1 Complete"

# Section 2
log_section "Section 2: Initiate User Configuration from Real Hub"

# Export GitHub token for hub operations
export GITHUB_TOKEN=$(gh auth token)
unset PROMPT_REGISTRY_DISABLE_GH_CLI
cd "$PR_TEST_ROOT/project"

log_info "Test 2.1: Add hub (requires GitHub auth)"
output=$($PR_BIN hub add --type github --location Amadeus-xDLC/genai.prompt-registry-config --ref main -o json 2>&1)
if echo "$output" | jq -e '.status=="ok"' >/dev/null; then
    log_success "Hub add passed"
    echo "$output" | jq .
else
    log_error "Hub add failed"
    echo "$output"
fi

log_section "Section 2 Complete"

# Section 3
log_section "Section 3: Browse Profiles from Hub"

log_info "Test 3.1: List profiles"
output=$($PR_BIN profile list -o text 2>&1)
if [ -n "$output" ] && echo "$output" | grep -q "Developer\|Contributor\|Workflow"; then
    log_success "Profile list passed"
    echo "$output" | head -10
else
    log_error "Profile list failed"
    echo "$output"
fi

log_info "Test 3.2: Show profile"
output=$($PR_BIN profile show development-workflow -o json 2>&1)
if echo "$output" | jq -e '.status=="ok" and .data.profile.id=="development-workflow"' >/dev/null; then
    log_success "Profile show passed"
else
    log_error "Profile show failed"
    echo "$output"
fi

log_section "Section 3 Complete"

# Section 4
log_section "Section 4: Project-level Configuration"

log_info "Test 4.1: Target add"
output=$($PR_BIN target add my-target --type copilot-cli -o json 2>&1)
if echo "$output" | jq -e '.status=="ok"' >/dev/null; then
    log_success "Target add passed"
    echo "$output" | jq .
else
    log_error "Target add failed"
    echo "$output"
fi

log_info "Test 4.2: Target list"
output=$($PR_BIN target list -o json 2>&1)
if echo "$output" | jq -e '.status=="ok"' >/dev/null; then
    log_success "Target list passed"
else
    log_error "Target list failed"
    echo "$output"
fi

log_section "Section 4 Complete"

# Section 5
log_section "Section 5: Detached Hub Flow"

log_info "Test 5.1: Add detached source"
output=$($PR_BIN source add --type github --url owner/repo --id detached-foo -o json 2>&1)
if echo "$output" | jq -e '.status=="ok"' >/dev/null; then
    log_success "Source add passed"
else
    log_error "Source add failed"
    echo "$output"
fi

log_info "Test 5.2: List sources"
output=$($PR_BIN source list -o text 2>&1)
if echo "$output" | grep -q "detached-foo"; then
    log_success "Source list passed"
else
    log_error "Source list failed"
    echo "$output"
fi

log_info "Test 5.3: Remove source"
output=$($PR_BIN source remove detached-foo -o json 2>&1)
if echo "$output" | jq -e '.status=="ok"' >/dev/null; then
    log_success "Source remove passed"
else
    log_error "Source remove failed"
    echo "$output"
fi

log_section "Section 5 Complete"

# Section 6
log_section "Section 6: Synthetic Bundle Flow"

log_info "Test 6.1: Create synthetic bundle"
bundle_dir="$PR_TEST_ROOT/bundles/local-foo"
mkdir -p "$bundle_dir/prompts"

cat > "$bundle_dir/deployment-manifest.yml" <<'EOF'
id: local-foo
version: 1.0.0
name: Local Foo
EOF

echo "# A prompt" > "$bundle_dir/prompts/a.md"
log_success "Synthetic bundle created"

log_info "Test 6.2: Create local hub config"
hub_dir="$PR_TEST_ROOT/local-hub"
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
log_success "Local hub config created"

cd "$PR_TEST_ROOT/project"

log_info "Test 6.3: Import hub"
output=$($PR_BIN hub add --type local --location "$PR_TEST_ROOT/local-hub" -o json 2>&1)
if echo "$output" | jq -e '.status=="ok"' >/dev/null; then
    log_success "Hub import passed"
else
    log_error "Hub import failed"
    echo "$output"
fi

log_info "Test 6.4: Activate hub"
output=$($PR_BIN hub use local-test-hub -o json 2>&1)
if echo "$output" | jq -e '.status=="ok" and .data.activeId=="local-test-hub"' >/dev/null; then
    log_success "Hub activate passed"
else
    log_error "Hub activate failed"
    echo "$output"
fi

log_info "Test 6.5: Show profile"
output=$($PR_BIN profile show backend -o json 2>&1)
if echo "$output" | jq -e '.status=="ok" and .data.profile.id=="backend"' >/dev/null; then
    log_success "Profile show passed"
else
    log_error "Profile show failed"
    echo "$output"
fi

log_info "Test 6.6: Profile activation"
# Use the local hub's profile (backend) since local hub is activated in 6.4
output=$($PR_BIN profile activate backend --target my-target -o json 2>&1)
if echo "$output" | jq -e '.status=="ok"' >/dev/null; then
    log_success "Profile activation passed"
else
    log_error "Profile activation failed"
    echo "$output"
fi

log_section "Section 6 Complete"

# Section 7
log_section "Section 7: Primitive Index Commands"

log_info "Test 7.1: Index build from local bundles"
output=$($PR_BIN index build --root "$PR_TEST_ROOT/bundles/local-foo" -o json 2>&1)
if echo "$output" | jq -e '.status=="ok"' >/dev/null; then
    log_success "Index build passed"
else
    log_error "Index build failed"
    echo "$output"
fi

log_info "Test 7.2: Index search with --query"
output=$($PR_BIN index search --query "prompt" -o json 2>&1)
if echo "$output" | jq -e '.status=="ok"' >/dev/null; then
    log_success "Index search with --query passed"
else
    log_error "Index search with --query failed"
    echo "$output"
fi

log_info "Test 7.3: Index search with --kinds"
output=$($PR_BIN index search --query "prompt" --kinds prompt -o json 2>&1)
if echo "$output" | jq -e '.status=="ok"' >/dev/null; then
    log_success "Index search with --kinds passed"
else
    log_error "Index search with --kinds failed"
    echo "$output"
fi

log_info "Test 7.4: Index search with --limit"
output=$($PR_BIN index search --query "prompt" --limit 1 -o json 2>&1)
if echo "$output" | jq -e '.status=="ok"' >/dev/null; then
    log_success "Index search with --limit passed"
else
    log_error "Index search with --limit failed"
    echo "$output"
fi

log_info "Test 7.5: Index search with --output format variations"
for fmt in text json yaml ndjson; do
    if $PR_BIN index search --query "prompt" -o "$fmt" >/dev/null 2>&1; then
        log_success "Index search output format $fmt passed"
    else
        log_error "Index search output format $fmt failed"
    fi
done

log_info "Test 7.6: Index stats"
output=$($PR_BIN index stats -o json 2>&1)
if echo "$output" | jq -e '.status=="ok"' >/dev/null; then
    log_success "Index stats passed"
else
    log_error "Index stats failed"
    echo "$output"
fi

log_section "Section 7 Complete"
