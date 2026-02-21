---
description: "Start sprint orchestrator — analyze, launch tracks, and monitor completion"
---

# Run Sprint

Higher-order entry point for sprint orchestration. Delegates to three sub-commands:
1. `/analyze-sprint` — Parse sprint status, match workflows, build team compositions
2. `/launch-tracks` — Create worktrees and launch Claude sessions in iTerm tabs
3. `/monitor-tracks` — Poll for completion, create PRs, human checkpoints, merge

## Arguments

`$ARGUMENTS` contains the sprint status file path and optional flags:

**Required:**
- First positional arg: path to sprint-status.yaml

**Optional flags:**
- `--dry-run` — Show analysis only, do not launch tracks
- `--tracks A,B,C` — Only run specific tracks (comma-separated letters)
- `--max-parallel N` — Maximum parallel tracks (default: 3)
- `--yes` — Skip confirmation prompt
- `--launch-only` — Launch tracks but skip monitoring
- `--auto-merge` — Automatically merge approved tracks
- `--poll-interval N` — Seconds between monitor checks (default: 30)
- `--no-create-pr` — Skip GitHub PR creation
- `--teammate-mode M` — Agent Teams display mode (default: in-process)

## Workflow

### Step 1: Parse Arguments

Extract the sprint status file path from `$ARGUMENTS`. It should be the first non-flag argument.

Validate the file exists:
```bash
test -f "{sprint_file}" || echo "ERROR: Sprint status file not found: {sprint_file}"
```

Extract flags: `--dry-run`, `--tracks`, `--max-parallel`, `--yes`, `--launch-only`, `--auto-merge`, `--poll-interval`, `--no-create-pr`, `--teammate-mode`.

### Step 2: Phase 1 — Analyze Sprint

Run `/analyze-sprint` with the sprint file path and max-parallel value.

This produces a track plan with:
- Stories matched to workflows
- Team compositions built from orchestration templates
- Port allocations assigned
- Branch names and prompts generated

If `--tracks` was specified, filter the track plan to only include those tracks.

### Step 3: Show Track Plan and Confirm

Display the track plan summary from Phase 1.

If `--dry-run` is set: show the plan and STOP. Do not proceed to Phase 2.

If `--yes` is NOT set: ask for confirmation before proceeding:
```
This will:
  - Create {N} git worktrees
  - Open {N} iTerm tabs
  - Start Claude sessions with /plan_w_team

Proceed? [y/n]:
```

If the user does not confirm, abort.

### Step 4: Phase 2 — Launch Tracks

Run `/launch-tracks` with the analyzed track data.

This creates worktrees, sets up environments, and launches iTerm tabs.

Display the launch summary showing which tracks started successfully and any that were skipped.

### Step 5: Phase 3 — Monitor Tracks

If `--launch-only` is set: report the launched tracks and STOP. Tell the user:
```
Tracks launched. Monitor not started.
Run /check-sprint to see progress.
Run /monitor-tracks to start monitoring.
```

Otherwise, run `/monitor-tracks` with the launched track data and these options:
- `--poll-interval` (default 30)
- `--auto-merge` (if set)
- `--no-create-pr` (if set)

### Step 6: Final Report

After monitoring completes, display the final sprint execution summary with:
- Track statuses (completed, failed, blocked, merged)
- PR URLs (if created)
- Merge results (if auto-merge was enabled)
- Suggested next steps (`/cleanup-worktrees`, manual review)

## Notes

- This command does NOT contain implementation logic. It delegates entirely to sub-commands.
- Each sub-command can also be run independently for partial workflows.
- The command is designed to be interruptible: Ctrl+C during monitoring stops the poll but tracks continue running.
- Track data flows through the command chain: analyze -> launch -> monitor. Each phase enriches the data.
