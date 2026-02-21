---
allowed-tools: Read, Grep, Glob, Bash, Write, TodoWrite
description: Self-improve websocket expertise by validating against codebase
argument-hint: [check_git_diff (bool)] [focus_area (optional)]
---

# Purpose

Maintain websocket expertise accuracy by comparing against actual implementation. Learnings are always written to the JSONL journal — never directly to the expertise YAML. An orchestrator consolidates the journal into expertise.yaml separately.

## Variables

CHECK_GIT_DIFF: $1 default to false if not specified
FOCUS_AREA: $2 default to empty string
EXPERTISE_FILE: .claude/skills/websocket/expertise.yaml
JOURNAL_FILE: .claude/skills/websocket/expertise.learnings.jsonl

## Instructions

- This is a self-improvement workflow to keep websocket expertise synchronized with the actual codebase
- Think of the expertise file as your **mental model** and memory reference for all websocket-related functionality
- Always validate expertise against real implementation, not assumptions
- If FOCUS_AREA is provided, prioritize validation and updates for that specific area
- **NEVER edit expertise.yaml directly** — always write learnings to the JSONL journal
- Prioritize actionable, high-value expertise over verbose documentation
- Be thorough in validation but concise in documentation
- Write CLEARLY and CONCISELY for future engineers

## Workflow

### 0. Parse Branch Context

Parse the current branch for track/story context:
```bash
BRANCH=$(git branch --show-current)
```
Extract `track` and `story` from the branch name if it follows a pattern like `track-{id}/{story-slug}`. Otherwise set both to `"unknown"`.

### 1. Check Git Diff (Conditional)

- If CHECK_GIT_DIFF is "true", run `git diff` to identify recent changes
- If changes detected, note them for targeted validation
- If CHECK_GIT_DIFF is "false", skip this step

### 2. Read Current Expertise

- Read the entire EXPERTISE_FILE
- Identify key sections
- Note any areas that seem outdated or incomplete

### 3. Validate Against Codebase

- Read key implementation files documented in expertise
- Use Grep to search for patterns
- Compare documented expertise against actual code

### 4. Identify Discrepancies

- List all differences found
- For each discrepancy, note the section name and a concise description

### 5. Append to Learnings Journal

Append one JSONL entry per learning to JOURNAL_FILE.

Each line must be valid JSON with this schema:
```json
{"ts":"ISO-8601-timestamp","expert":"websocket","track":"<track-id>","story":"<story-slug>","type":"update|add|remove","section":"<yaml-section-name>","description":"<what changed and why>","content":"<the actual YAML snippet or value to add/change/remove>"}
```

- `ts`: current UTC timestamp in ISO-8601 format
- `expert`: the expert name (`websocket`)
- `track`: parsed from branch name, or `"unknown"`
- `story`: parsed from branch name, or `"unknown"`
- `type`: `"add"` for new entries, `"update"` for changes to existing, `"remove"` for deletions
- `section`: the top-level YAML section this learning belongs to
- `description`: human-readable summary of what changed
- `content`: the actual YAML content to apply (for `"remove"`, describe what to remove)

Use `Write` tool to append (or create) the file. If the file already exists, read it first and append new entries.

## Report

### Summary
- Whether git diff was checked
- Focus area (if any)
- Total discrepancies found
- Number of journal entries written

### Discrepancies Found
- What was incorrect/missing/outdated

### Journal Entries Written
- Added entries
- Updated entries
- Removed entries
