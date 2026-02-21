---
name: sprint-reporter
description: Self-improving sprint-reporter expert skill with domain expertise for generating sprint completion reports, voice guides, and PR descriptions.
---

# sprint-reporter Expert Skill

Self-improving expert system for the sprint-reporter domain. All domain knowledge lives in `expertise.yaml` and is kept synchronized with the codebase via the self-improve workflow.

## Domain Knowledge

Before starting any work, read and load your expertise from:
- `.claude/skills/sprint-reporter/expertise.yaml`

This is your single source of truth. Validate its contents against the codebase before relying on it.

## Commands

| Command | Description |
|---------|-------------|
| `/skills:sprint-reporter:question [question]` | Answer questions using expertise context (read-only) |
| `/skills:sprint-reporter:plan [request]` | Create implementation plan with expertise context |
| `/skills:sprint-reporter:plan_build_improve [request]` | Full cycle: plan, build, then self-improve |
| `/skills:sprint-reporter:report [path-to-plan]` | Generate sprint completion report and voice guide |

## Files

| File | Purpose |
|------|---------|
| `expertise.yaml` | Domain knowledge (single source of truth) |
| `question.md` | Question command implementation |
| `plan.md` | Plan command implementation |
| `plan_build_improve.md` | Full workflow command implementation |
| `self-improve.md` | Expertise validation and journal workflow |
| `self-improve.sh` | Hook script for automated self-improvement |
| `consolidate.md` | Merge journal entries into expertise.yaml |
| `report.md` | Sprint report and voice guide generator |
