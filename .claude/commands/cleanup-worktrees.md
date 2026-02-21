---
description: "Remove sprint worktrees and prune stale references"
---

# Cleanup Worktrees

Remove git worktrees created during sprint execution and prune stale references.

## Arguments

- `$ARGUMENTS` — Optional: specific worktree paths or track names to clean up. If empty, cleans all track worktrees.

## Workflow

### Step 1: Find Track Worktrees

List all worktrees and identify track-related ones:

```bash
git worktree list
```

Find sibling directories matching track patterns:

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_PARENT=$(dirname "$PROJECT_ROOT")
ls -d "$WORKTREE_PARENT"/story-* "$WORKTREE_PARENT"/track-* 2>/dev/null
```

If `$ARGUMENTS` specifies particular tracks (e.g., `track-a story-5.1`), filter to only those.

### Step 2: Confirm Cleanup

Show what will be removed:

```
Worktrees to remove:
  /path/to/story-5.1  (branch: story/5-1-pim-api-client)
  /path/to/story-4.3  (branch: story/4-3-media-migration)

Proceed? [y/n]:
```

Wait for user confirmation before proceeding.

### Step 3: Remove Worktrees

For each worktree:

```bash
git worktree remove "{worktree_path}" --force
```

### Step 4: Prune Stale References

```bash
git worktree prune
```

### Step 5: Report Results

```
Cleanup Complete
════════════════
Removed: 2 worktrees
  - story-5.1 (story/5-1-pim-api-client)
  - story-4.3 (story/4-3-media-migration)
Pruned stale worktree references.
```
