---
description: "Phase 3: Monitor running tracks for completion, create PRs, run human checkpoints, merge"
---

# Monitor Tracks

Phase 3 of sprint orchestration. Polls running tracks for completion markers, creates GitHub PRs, runs human checkpoints, and optionally merges approved branches.

## Arguments

This command receives the launched track data from `/launch-tracks`. Each track has:
- `track_id`, `story_id`, `story_display`
- `branch`, `worktree_path`
- `status` (should be RUNNING)

Options (from `/run-sprint`):
- `--no-create-pr` — Skip GitHub PR creation
- `--auto-merge` — Automatically merge approved tracks
- `--poll-interval N` — Seconds between checks (default: 30)

## Workflow

### Step 1: Start Poll Loop

Monitor tracks by polling every `{poll_interval}` seconds (default 30):

```bash
while true; do
  sleep {poll_interval}
  # Check each active track (Step 2)
done
```

Continue until all tracks are no longer active (completed, failed, merged, or blocked).

### Step 2: Check Each Active Track

For each track with status RUNNING, check for completion:

**2a. Check for `.sprint_complete` marker:**

```bash
test -f "{worktree_path}/.sprint_complete" && cat "{worktree_path}/.sprint_complete"
```

The marker file contains one of: `success`, `failed`, `blocked`

**2b. Check for blocking issues:**

```bash
test -f "{worktree_path}/.sprint_issues" && cat "{worktree_path}/.sprint_issues"
```

The `.sprint_issues` file uses JSONL format (one JSON object per line):
```json
{"severity":"blocking","message":"Build failed: type error in component","reporter":"builder"}
{"severity":"warning","message":"Missing test for edge case","reporter":"validator"}
```

If any entry has `"severity":"blocking"`, mark the track as BLOCKED and continue monitoring (issues may be resolved by the running Claude session).

**2c. Check for commit activity (fallback detection):**

```bash
cd "{worktree_path}" && git log "origin/{base_branch}..HEAD" --oneline
```

Look for commits containing keywords: `review complete`, `story complete`, `task complete`, `done`. These indicate the track finished even without a `.sprint_complete` marker.

### Step 3: On Track Completion

When a track completes (`.sprint_complete` exists with `success` status):

**3a. Read the sprint report (if available):**

```bash
test -f "{worktree_path}/.sprint_report.md" && cat "{worktree_path}/.sprint_report.md"
```

**3b. Create GitHub PR (if `--no-create-pr` is NOT set):**

Check if `gh` CLI is available:
```bash
command -v gh >/dev/null 2>&1
```

If available, push the branch and create a PR:
```bash
cd "{worktree_path}" && git push -u origin {branch}
```

```bash
cd "{worktree_path}" && gh pr create \
  --base {base_branch} \
  --title "Story {story_display}: {story_title}" \
  --body "$(cat .sprint_report.md 2>/dev/null || git diff {base_branch}...HEAD --stat)"
```

If `gh` is not installed, skip with a message:
```
GitHub CLI (gh) not installed — skipping PR creation.
Push manually: cd {worktree_path} && git push -u origin {branch}
```

**3c. Extract PR URL and number** from the `gh pr create` output for display.

### Step 4: Human Checkpoint

For each completed track, present a checkpoint for human review:

```
================================================================
HUMAN CHECKPOINT: {story_id}
================================================================

{sprint_report_content OR git diff summary}

Track: {track_id}
Branch: {branch}
PR: {pr_url} (if created)

Issues: {count} total, {blocking_count} blocking
----------------------------------------------------------------
Approve? [y/n/s(skip)]:
```

If no sprint report exists, show a git diff summary:
```bash
cd "{worktree_path}" && git diff --stat "origin/{base_branch}...HEAD"
```

**Responses:**
- `y` (approve) — Proceed to merge (if `--auto-merge`) or mark approved
- `n` (reject) — Mark track as rejected, do not merge
- `s` (skip) — Skip this checkpoint, continue monitoring other tracks

### Step 5: Merge Approved Tracks

If `--auto-merge` is set and the track was approved:

```bash
# Get current branch to return to it after merge
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Checkout base branch and pull latest
git checkout {base_branch}
git pull origin {base_branch}

# Merge with no-ff
git merge --no-ff {branch} -m "Merge {branch}: Story {story_display}"
```

**Merge conflict handling**: If the merge fails:
```bash
# Abort the failed merge
git merge --abort

# Return to original branch
git checkout "$CURRENT_BRANCH"
```

Mark the track as `blocked:merge_conflict` instead of crashing. Report:
```
MERGE CONFLICT: track-{letter} ({story_display})
  Branch {branch} has conflicts with {base_branch}.
  Resolve manually: cd {worktree_path} && git merge {base_branch}
```

After a successful merge:
```bash
# Return to original branch
git checkout "$CURRENT_BRANCH"
```

### Step 6: Final Summary

After all tracks complete (or timeout), display:

```
================================================================
SPRINT EXECUTION COMPLETE
================================================================

Track    Story    Status       PR           Merged
──────   ──────   ──────────   ──────────   ──────
track-a  5.2      completed    PR #42       yes
track-b  4.3      completed    PR #43       yes
track-c  1.2      failed       —            no
track-d  2.1      blocked      —            no

Completed: 2/4
Merged: 2/4
Failed: 1/4
Blocked: 1/4
================================================================
```

### Step 7: Cleanup Recommendation

After the summary, suggest cleanup:

```
To clean up worktrees for merged tracks:
  /cleanup-worktrees

To check remaining tracks:
  /check-sprint
```

## Notes

- GitHub PR creation and merge are optional. The command works without `gh` installed.
- The poll loop runs in the foreground. Press Ctrl+C to stop monitoring (tracks continue running in their iTerm tabs).
- Blocked tracks remain monitored — the running Claude session may resolve the blocking issue and write a new `.sprint_complete` marker.
- The `.sprint_issues` file is append-only JSONL. Each team member can append issues during execution.
