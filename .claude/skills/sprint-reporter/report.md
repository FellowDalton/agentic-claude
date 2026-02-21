---
allowed-tools: Read, Grep, Glob, Bash, Write, TodoWrite
description: Generate sprint completion report and voice guide
argument-hint: [path-to-plan]
---

# Sprint Reporter - Generate Report

Generate `.sprint_report.md` (written report) and `.sprint_voice.txt` (voice guide) in the worktree root.

## Variables

PATH_TO_PLAN: $ARGUMENTS
EXPERTISE_FILE: .claude/skills/sprint-reporter/expertise.yaml
REPORT_FILE: .sprint_report.md
VOICE_FILE: .sprint_voice.txt

## Instructions

- Read EXPERTISE_FILE first to load report structure, file categorization rules, voice presentation rules, and ASCII diagram guidelines
- The written report is for the human reviewer at the checkpoint -- make it scannable and information-dense
- The voice script is a separate concern -- conversational, natural, no diagrams or raw file paths
- Both files are written to the worktree root (current working directory)
- Do NOT fabricate information -- only report what the git diff and plan file actually show

## Workflow

### 1. Gather Context

Read these sources in parallel:
- The plan file at `PATH_TO_PLAN` -- extract story ID, title, acceptance criteria, team members, tasks
- `git diff --stat origin/$(git rev-parse --abbrev-ref HEAD@{upstream} 2>/dev/null | sed 's|origin/||' || echo main)` -- get file change summary
- `git diff --name-status` against the base branch -- get NEW/MOD/DEL status per file
- `git log --oneline` against the base branch -- get commit history for this track
- `.ports.env` (if exists) -- get port assignments for testing URLs

### 2. Categorize File Changes

Using the `file_categorization.rules` from expertise:
- Read the `git diff --name-status` output
- Assign each file to a category
- For each file, write a short description based on the diff content (read key files if needed)
- Cap at `max_files_shown` from expertise, use overflow message for the rest

### 3. Build ASCII Architecture Diagram

Using the `ascii_diagrams` guidelines from expertise:
- Analyze the changes to understand what was added/modified architecturally
- Create a diagram showing the new/changed components and their relationships
- Keep it under 60 chars wide
- Focus on data flow or component hierarchy, whichever is more relevant

### 4. Write Testing Guide

Using the `testing_guide` patterns from expertise:
- Read `.ports.env` for port numbers
- List concrete commands to run (build, test, typecheck)
- List URLs to visit with the actual port and route slugs
- Describe what to look for / expected behavior

### 5. Check Acceptance Criteria

- Read the acceptance criteria from the plan file
- Check git diff and test results to determine pass/fail for each
- Format as `[x]` (passed) or `[ ]` (not verified) checklist

### 6. Build Team Summary

- Extract team member info from the plan file
- For each member: name, agent type, what they worked on (1 line)

### 7. Write .sprint_report.md

Assemble the full report using this structure:

```
================================================================
  SPRINT REPORT: Story {id} -- {title}
================================================================

## Summary
{2-3 sentences on what was built}

## Architecture
{ASCII diagram}

## Key Changes ({count} files)

  {TAG}  {filepath}  {short description}
  ...

## How to Test

  1. {step}: {command or URL}
  2. ...

## Acceptance Criteria

  [x] {criterion}
  [ ] {criterion}

## Team

  {name} ({agent type}) -> {task summary}
  ...

## PR Description

## Summary
{bullet points for PR body}

## Test plan
{testing checklist for PR body}

================================================================
```

Write this to REPORT_FILE in the current directory.

### 8. Write .sprint_voice.txt

Using the `voice_presentation` rules from expertise:
- Rewrite the report as a conversational voice guide
- Skip: ASCII diagrams, raw file lists, team details, PR description
- Include: what was built, key highlights, how to test (simplified), acceptance results
- Use natural language for file paths, numbers, ports per `speak_naturally` rules
- Keep under `max_chars` from `tts_integration` in expertise
- Tone: conversational, confident, concise

Write this to VOICE_FILE in the current directory.

## Report

Confirm both files were written:
- `.sprint_report.md` -- {line count} lines
- `.sprint_voice.txt` -- {char count} characters
- Story: {story_id}
- Files changed: {count}
- Acceptance criteria: {passed}/{total}
