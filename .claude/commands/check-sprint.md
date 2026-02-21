---
description: "Check the status of running sprint tracks"
---

# Check Sprint

Manual status check for running sprint tracks. Use this when the monitor is not running or to get a quick overview of track progress.

## Workflow

### Step 1: Find Active Worktrees

List all git worktrees:

```bash
git worktree list
```

Identify track worktrees by looking for sibling directories of the project root that follow the track naming patterns:
- `story-{N.N}` (e.g., `story-5.1`, `story-1.2`)
- `track-{letter}` (e.g., `track-a`, `track-b`)

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_PARENT=$(dirname "$PROJECT_ROOT")
ls -d "$WORKTREE_PARENT"/story-* "$WORKTREE_PARENT"/track-* 2>/dev/null
```

### Step 2: Check Each Worktree

For each track worktree found:

**2a. Get branch name:**
```bash
cd "{worktree_path}" && git rev-parse --abbrev-ref HEAD
```

**2b. Check completion status:**
```bash
test -f "{worktree_path}/.sprint_complete" && cat "{worktree_path}/.sprint_complete"
```

**2c. Check for blocking issues:**
```bash
test -f "{worktree_path}/.sprint_issues" && cat "{worktree_path}/.sprint_issues"
```

**2d. Check for recent git activity:**
```bash
cd "{worktree_path}" && git log --oneline -5 --format="%h %s (%cr)"
```

**2e. Check for existing PR:**
```bash
command -v gh >/dev/null 2>&1 && cd "{worktree_path}" && gh pr list --head "$(git rev-parse --abbrev-ref HEAD)" --json number,url,state --jq '.[0]'
```

### Step 3: Display Summary

```
SPRINT STATUS
═════════════

Track     Story           Branch                              Status
────────  ──────────────  ──────────────────────────────────  ────────────────
story-5.1  Story 5.1      story/5-1-pim-api-client            running
story-4.3  Story 4.3      story/4-3-media-migration            success (PR #42)
story-1.2  Story 1.2      story/1-2-dynamic-routing            blocked (1 issue)

Details:
  story-5.1: Last commit 2m ago — "feat: add PIM client base"
  story-4.3: Completed — .sprint_complete=success
  story-1.2: BLOCKED — "Build failed: missing dependency" (builder)
```

### Step 4: Suggest Actions

Based on status, suggest next steps:

- **completed tracks**: "Run `/monitor-tracks` or approve manually"
- **blocked tracks**: "Check `.sprint_issues` in the worktree for details"
- **running tracks**: "Still in progress. Check iTerm tabs or wait."
- **all done**: "All tracks complete. Run `/cleanup-worktrees` to clean up."
