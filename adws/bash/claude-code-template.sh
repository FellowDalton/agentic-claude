#!/usr/bin/env bash
# Claude Code template/slash command execution wrapper
# This script constructs a prompt from slash command + args and calls claude-code-exec.sh
#
# Arguments:
#   $1 - slash_command (e.g., /build, /plan, /implement)
#   $2 - args (space-separated arguments for the command)
#   $3 - output_file (path to write JSONL output)
#   $4 - model (sonnet or opus)
#   $5 - working_dir (directory to execute in)
#   $6 - mcp_config_path (optional, empty string if not used)
#
# Exit codes: Same as claude-code-exec.sh

set -euo pipefail

# Source error codes
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/error-codes.sh"

# Validate arguments
if [[ $# -lt 6 ]]; then
    echo "Error: Invalid number of arguments" >&2
    echo "Usage: $0 <slash_command> <args> <output_file> <model> <working_dir> <mcp_config_path>" >&2
    exit "$EXIT_INVALID_ARGS"
fi

SLASH_COMMAND="$1"
ARGS="$2"
OUTPUT_FILE="$3"
MODEL="$4"
WORKING_DIR="$5"
MCP_CONFIG_PATH="$6"

# Validate slash command format
if [[ ! "$SLASH_COMMAND" =~ ^/ ]]; then
    echo "Error: Slash command must start with '/', got: $SLASH_COMMAND" >&2
    exit "$EXIT_INVALID_ARGS"
fi

# Construct full prompt from slash command and args
if [[ -n "$ARGS" ]]; then
    PROMPT="$SLASH_COMMAND $ARGS"
else
    PROMPT="$SLASH_COMMAND"
fi

# Call claude-code-exec.sh with the constructed prompt
# Always use skip_permissions=true for template execution (non-interactive)
exec "$SCRIPT_DIR/claude-code-exec.sh" \
    "$PROMPT" \
    "$MODEL" \
    "$OUTPUT_FILE" \
    "$WORKING_DIR" \
    "$MCP_CONFIG_PATH" \
    "true"
