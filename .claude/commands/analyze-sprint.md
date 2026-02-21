---
description: "Phase 1: Analyze sprint status, match stories to workflows, build team compositions"
---

# Analyze Sprint

Phase 1 of sprint orchestration. Reads the sprint status YAML, finds ready-for-dev stories, matches them to workflows, builds team compositions, and outputs a structured track plan.

## Arguments

- `$1` — Path to sprint-status.yaml file (required)
- `$2` — Max parallel tracks (optional, default: 3)

## Port Allocation Table

Deterministic port mapping per track. No external registry needed — Claude manages this inline.

| Track    | Frontend Port | Backend Port |
|----------|--------------|--------------|
| track-a  | 3001         | 9101         |
| track-b  | 3002         | 9102         |
| track-c  | 3003         | 9103         |
| track-d  | 3004         | 9104         |
| track-e  | 3005         | 9105         |
| track-f  | 3006         | 9106         |

## Workflow

### Step 1: Read Sprint Status

Read the sprint status YAML file at `$1`:

```bash
cat "$1"
```

Parse the YAML content. The expected structure:

```yaml
project: "Project Name"
story_location: "path/to/stories"
development_status:
  epic-1: "Epic 1 Title"
  1-1-story-slug: ready-for-dev
  1-2-another-story: backlog
  epic-2: "Epic 2 Title"
  2-1-third-story: ready-for-dev
```

Extract all entries under `development_status` where:
- The key does NOT start with `epic-` (those are section headers)
- The key does NOT end with `-retrospective`
- The value is `ready-for-dev`

### Step 2: Check Dependencies

If a sprint overview file exists at the same directory as the sprint status file (sibling file `sprint-overview.md`):

```bash
SPRINT_DIR=$(dirname "$1")
test -f "$SPRINT_DIR/sprint-overview.md" && cat "$SPRINT_DIR/sprint-overview.md"
```

Parse markdown tables for a "Blocked By" column. Extract story dependencies using the pattern `X.Y` (e.g., `5.1`, `1.1b`). A story is blocked if any of its dependencies have a status other than `done` in the sprint status.

Filter out blocked stories from the ready list.

### Step 3: Match Stories to Workflows

Read the workflow definitions:

```bash
cat .claude/orchestration/workflows.yaml
```

For each unblocked ready-for-dev story:

1. **Read the story file** (if it exists at `{story_location}/stories/{story-id}.md`):
   ```bash
   test -f "{story_location}/stories/{story-id}.md" && cat "{story_location}/stories/{story-id}.md"
   ```

2. **Extract epic number** from the story ID: `1-2-story-slug` -> epic 1

3. **Score each workflow** against the story:
   - Epic match: +10 points (strong signal)
   - Each pattern keyword found in story content: +2 points
   - Highest score wins; ties go to the first match

4. **Fallback**: If no workflow matches (score = 0), use the `default` workflow from workflows.yaml

### Step 4: Read Orchestration Templates

For each matched workflow that has an `orchestration` field pointing to a template file:

```bash
cat .claude/orchestration/{template-file}.md
```

Extract the team structure from the `## Team Structure` section. Each team member has:
- **Name**: The member's role identifier
- **Agent Type**: `general-purpose` (portable) or a specific skill-backed type
- **Role**: What this member does

If no orchestration template exists, use the default team:
- `test-writer` (general-purpose) — Write failing tests from acceptance criteria
- `builder` (general-purpose) — Implement the story
- `validator` (general-purpose) — Validate the work

### Step 5: Assign Tracks

For each story (up to `$2` max parallel), assign tracks in order:

| Story Index | Track ID | Frontend Port | Backend Port |
|-------------|----------|--------------|--------------|
| 1st story   | track-a  | 3001         | 9101         |
| 2nd story   | track-b  | 3002         | 9102         |
| 3rd story   | track-c  | 3003         | 9103         |
| 4th story   | track-d  | 3004         | 9104         |
| 5th story   | track-e  | 3005         | 9105         |
| 6th story   | track-f  | 3006         | 9106         |

### Step 6: Generate Branch Names

For each track, the branch name follows the pattern:
```
story/{story-id}
```

Example: story ID `5-2-pim-to-storyblok-data-mapping` -> branch `story/5-2-pim-to-storyblok-data-mapping`

### Step 7: Build Prompts

For each track, build two prompts:

**Story Prompt** (first arg to `/plan_w_team`):
```
Story {story-id}: {Title from story file H1} - {Objective or first paragraph, max 200 chars}
```

**Orchestration Prompt** (second arg to `/plan_w_team`):
```
ORCHESTRATION: {workflow-name}
TEAM: {member1-name} ({agent-type}), {member2-name} ({agent-type}), ...
EXECUTION: {member1-name} -> {member2-name} -> {member3-name}
```

### Step 8: Output Track Plan

Display the analysis results as a structured summary:

```
SPRINT ANALYSIS
===============

Sprint: {project name}
Ready stories: {count}
Blocked stories: {count} (list IDs)
Tracks to launch: {count}

Track Plan:
───────────

track-a: Story {story-display} — {story-id}
  Workflow: {workflow-name}
  Branch: story/{story-id}
  Ports: frontend={port}, backend={port}
  Team: {member1} -> {member2} -> {member3}

track-b: Story {story-display} — {story-id}
  Workflow: {workflow-name}
  Branch: story/{story-id}
  Ports: frontend={port}, backend={port}
  Team: {member1} -> {member2}
```

This output is consumed by `/launch-tracks` in the next phase. Store the track plan data in memory for the calling command (`/run-sprint`) to pass forward.

### Step 9: Story Display Numbers

Convert full story IDs to short display numbers for human readability:
- `5-1-nextpage-pim-api-client` -> `5.1`
- `1-1b-test-framework-setup` -> `1.1b`
- `5-8a-bun-sync-service-setup` -> `5.8a`

Pattern: match `^(\d+)-(\d+[a-z]?)-` and format as `{group1}.{group2}`
