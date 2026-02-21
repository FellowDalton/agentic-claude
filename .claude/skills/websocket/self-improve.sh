#!/usr/bin/env bash
# Self-improve hook for websocket expert skill
# Triggered automatically by the Stop hook in the agent wrapper
# Invokes Claude to run the self-improve workflow against the codebase

set -euo pipefail

SKILL_DIR="${CLAUDE_PROJECT_DIR}/.claude/skills/websocket"
EXPERTISE_FILE="${SKILL_DIR}/expertise.yaml"

# Only run if expertise file exists
if [[ ! -f "$EXPERTISE_FILE" ]]; then
  echo "[websocket] No expertise.yaml found at ${EXPERTISE_FILE}, skipping self-improve."
  exit 0
fi

# Run the self-improve workflow via Claude
claude --print --skill websocket "Run the websocket skill in self-improve mode with CHECK_GIT_DIFF=true. Focus on any files that changed in the current session."
