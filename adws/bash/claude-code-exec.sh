#!/usr/bin/env bash
# Claude Code CLI execution wrapper
# This script is called by Bun/TypeScript to execute Claude Code CLI commands
#
# Arguments:
#   $1 - prompt (the command/prompt to send to Claude)
#   $2 - model (sonnet or opus)
#   $3 - output_file (path to write JSONL output)
#   $4 - working_dir (directory to execute in)
#   $5 - mcp_config_path (path to .mcp.json, optional, empty string if not used)
#   $6 - skip_permissions (true/false)
#
# Exit codes:
#   0 - Success
#   1 - Claude Code error (retryable)
#   2 - Invalid arguments
#   124 - Timeout
#   99 - Unknown error

set -euo pipefail

# Source error codes and environment filtering
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/error-codes.sh"
source "$SCRIPT_DIR/lib/env-filter.sh"

# Validate arguments
if [[ $# -lt 6 ]]; then
    echo "Error: Invalid number of arguments" >&2
    echo "Usage: $0 <prompt> <model> <output_file> <working_dir> <mcp_config_path> <skip_permissions>" >&2
    exit "$EXIT_INVALID_ARGS"
fi

PROMPT="$1"
MODEL="$2"
OUTPUT_FILE="$3"
WORKING_DIR="$4"
MCP_CONFIG_PATH="$5"
SKIP_PERMISSIONS="$6"

# Validate model
if [[ "$MODEL" != "sonnet" ]] && [[ "$MODEL" != "opus" ]]; then
    echo "Error: Model must be 'sonnet' or 'opus', got: $MODEL" >&2
    exit "$EXIT_INVALID_ARGS"
fi

# Validate working directory exists
if [[ ! -d "$WORKING_DIR" ]]; then
    echo "Error: Working directory does not exist: $WORKING_DIR" >&2
    exit "$EXIT_INVALID_ARGS"
fi

# Get Claude Code CLI path
CLAUDE_PATH="${CLAUDE_CODE_PATH:-claude}"

# Check if Claude Code is installed
if ! command -v "$CLAUDE_PATH" &> /dev/null; then
    echo "Error: Claude Code CLI not found at: $CLAUDE_PATH" >&2
    exit "$EXIT_CLAUDE_ERROR"
fi

# Apply filtered environment (ensures only safe vars are available)
get_safe_env

# Create output directory if needed
OUTPUT_DIR="$(dirname "$OUTPUT_FILE")"
mkdir -p "$OUTPUT_DIR"

# Build Claude Code command
CMD=("$CLAUDE_PATH" "-p" "$PROMPT")
CMD+=("--model" "$MODEL")
CMD+=("--output-format" "stream-json")
CMD+=("--verbose")

# Add MCP config if provided and exists
if [[ -n "$MCP_CONFIG_PATH" ]] && [[ -f "$MCP_CONFIG_PATH" ]]; then
    CMD+=("--mcp-config" "$MCP_CONFIG_PATH")
fi

# Add skip permissions flag if enabled
if [[ "$SKIP_PERMISSIONS" == "true" ]]; then
    CMD+=("--dangerously-skip-permissions")
fi

# Execute Claude Code with timeout (5 minutes = 300 seconds)
# Write stdout to output file, stderr to stderr
cd "$WORKING_DIR" || exit "$EXIT_INVALID_ARGS"

if timeout 300 "${CMD[@]}" > "$OUTPUT_FILE" 2>&1; then
    # Success
    exit "$EXIT_SUCCESS"
else
    EXIT_CODE=$?

    # Check if timeout occurred
    if [[ $EXIT_CODE -eq 124 ]]; then
        echo "Error: Claude Code command timed out after 5 minutes" >&2
        exit "$EXIT_TIMEOUT"
    fi

    # Claude Code error (retryable)
    echo "Error: Claude Code command failed with exit code $EXIT_CODE" >&2
    exit "$EXIT_CLAUDE_ERROR"
fi
