---
description: "Phase 2: Create git worktrees and launch Claude sessions in iTerm tabs"
---

# Launch Tracks

Phase 2 of sprint orchestration. Creates git worktrees for each track, sets up the environment, and launches Claude sessions in iTerm tabs with `/plan_w_team`.

## Arguments

This command receives the track plan from `/analyze-sprint` (passed via the calling `/run-sprint` command). Each track has:
- `track_id`, `story_id`, `story_display`
- `branch`, `worktree_path`
- `frontend_port`, `backend_port`
- `story_prompt`, `orchestration_prompt`
- `team` composition

## Workflow

### Step 1: Preflight Checks

Before creating worktrees, verify the environment:

```bash
# Check git is available
git --version

# Check we're in a git repository
git rev-parse --is-inside-work-tree

# Get project root and worktree parent
PROJECT_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_PARENT=$(dirname "$PROJECT_ROOT")
```

### Step 2: Check for Uncommitted Changes

```bash
git status --short
```

If there are uncommitted changes, warn the user:
```
WARNING: You have uncommitted changes. Worktrees are created from the current branch state.
Consider committing or stashing before proceeding.
```

Do NOT auto-commit — let the user decide.

### Step 3: Fetch Latest

```bash
git fetch origin
```

### Step 4: Create Worktrees

For each track, create the git worktree. Run preflight checks first:

```bash
# Check if branch already exists
git branch --list "{branch}"

# Check if worktree path already exists
test -d "{worktree_path}"
```

**If branch or path exists**: Skip this track with a warning. Do not fail the entire sprint.

**If clear**, create the worktree:

```bash
git worktree add -b {branch} {worktree_path} origin/{base_branch}
```

Where `{base_branch}` is the current branch name (typically `test` or `main`). Determine it with:
```bash
git rev-parse --abbrev-ref HEAD
```

If the branch already exists but the worktree does not:
```bash
git worktree add {worktree_path} {branch}
```

### Step 5: Setup Worktree Environment

For each successfully created worktree:

**5a. Copy gitignored environment files:**

```bash
# Find .env files in the project root (these are gitignored)
for env_file in "$PROJECT_ROOT"/.env*; do
  if [ -f "$env_file" ]; then
    cp "$env_file" "{worktree_path}/$(basename "$env_file")"
  fi
done
```

**5b. Write port environment file:**

```bash
cat > "{worktree_path}/.ports.env" << EOF
FRONTEND_PORT={frontend_port}
BACKEND_PORT={backend_port}
EOF
```

### Step 6: Launch iTerm Tabs

**Platform check**: This step uses macOS-specific AppleScript for iTerm. On non-macOS platforms, skip to Step 6b (manual fallback).

**6a. macOS with iTerm (automated):**

For each track, create an iTerm tab and launch Claude:

```bash
osascript << 'EOF'
tell application "iTerm"
  activate
  if (count of windows) = 0 then
    create window with default profile
  end if
  tell current window
    -- Track: {story_display} ({story_id})
    create tab with default profile
    tell current session
      set name to "{story_display}-plan"
      write text "cd {worktree_path} && unset CLAUDECODE && STORY_DISPLAY={story_display} claude --dangerously-skip-permissions '/plan_w_team \"{story_prompt}\" \"{orchestration_prompt}\"'"
    end tell
  end tell
end tell
EOF
```

**IMPORTANT**: The `unset CLAUDECODE` is required when launching from within a Claude session. Without it, the new session thinks it's nested and may behave unexpectedly.

Add a 3-second delay between tab launches to avoid overwhelming iTerm:
```bash
sleep 3
```

**6b. Non-macOS fallback (manual):**

If not on macOS, print the commands for the user to run manually in separate terminals:

```
Launch these commands in separate terminal windows:

Track track-a ({story_display}):
  cd {worktree_path} && claude --dangerously-skip-permissions '/plan_w_team "{story_prompt}" "{orchestration_prompt}"'

Track track-b ({story_display}):
  cd {worktree_path} && claude --dangerously-skip-permissions '/plan_w_team "{story_prompt}" "{orchestration_prompt}"'
```

### Step 7: Report Launch Status

Display the launch summary:

```
TRACKS LAUNCHED
===============

track-a: Story {story_display} — {story_id}
  Worktree: {worktree_path}
  Branch: {branch}
  Ports: {frontend_port}/{backend_port}
  iTerm Tab: {story_display}-plan
  Status: RUNNING

track-b: Story {story_display} — {story_id}
  Worktree: {worktree_path}
  Branch: {branch}
  Ports: {frontend_port}/{backend_port}
  iTerm Tab: {story_display}-plan
  Status: RUNNING

Skipped:
  track-c: Branch already exists (story/2-1-existing-work)
```

### Step 8: Escape Handling

When building the Claude command string, handle special characters in story prompts and orchestration prompts:

- Use heredoc syntax to avoid shell escaping issues with quotes, parentheses, and special chars
- Write the full command to a temp file and source it if direct quoting fails:

```bash
TMPFILE=$(mktemp /tmp/story_{story_display}_XXXX.sh)
cat > "$TMPFILE" << 'STORY_CMD_EOF'
unset CLAUDECODE
cd "{worktree_path}" && STORY_DISPLAY={story_display} claude --dangerously-skip-permissions "$(cat <<'CLAUDE_PROMPT_EOF'
/plan_w_team "{story_prompt}" "{orchestration_prompt}"
CLAUDE_PROMPT_EOF
)"
# Self-cleanup
rm -f "$TMPFILE"
STORY_CMD_EOF
```

Then in the iTerm AppleScript:
```
write text "source {TMPFILE}"
```

This matches the pattern used in the Python orchestrator's `build_iterm_applescript()` function.
