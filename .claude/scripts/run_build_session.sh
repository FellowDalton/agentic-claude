#!/bin/bash
# Build session wrapper that guarantees .sprint_complete is written regardless of Claude exit.
#
# Usage: ./run_build_session.sh <spec_path>
#
# Wraps the `claude` CLI call so that even if the process crashes, gets killed,
# or times out, we always signal completion status to the track monitor.

set -euo pipefail

# Unset CLAUDECODE so this session isn't rejected as nested
# (the plan phase runs inside a Claude session that sets this env var)
unset CLAUDECODE 2>/dev/null || true

SPEC_PATH="${1:?Usage: run_build_session.sh <spec_path>}"
STORY_DISPLAY="${STORY_DISPLAY:-story}"

# Trap to guarantee .sprint_complete on any exit (including signals)
cleanup() {
    local exit_code=$?
    if [ ! -f .sprint_complete ]; then
        if [ $exit_code -eq 0 ]; then
            echo "success" > .sprint_complete
        else
            echo "failed:exit_code_${exit_code}" > .sprint_complete
        fi
    fi
}
trap cleanup EXIT

claude --dangerously-skip-permissions "/build_w_team $SPEC_PATH"
