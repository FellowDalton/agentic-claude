---
name: frontend-dev
description: Self-improving frontend-dev expert skill with domain expertise, planning, Q&A, and automated knowledge maintenance.
---

# frontend-dev Expert Skill

Self-improving expert system for the frontend-dev domain. All domain knowledge lives in `expertise.yaml` and is kept synchronized with the codebase via the self-improve workflow.

## Domain Knowledge

Before starting any work, read and load your expertise from:
- `.claude/skills/frontend-dev/expertise.yaml`

This is your single source of truth. Validate its contents against the codebase before relying on it.

## Commands

| Command | Description |
|---------|-------------|
| `/skills:frontend-dev:question [question]` | Answer questions using expertise context (read-only) |
| `/skills:frontend-dev:plan [request]` | Create implementation plan with expertise context |
| `/skills:frontend-dev:plan_build_improve [request]` | Full cycle: plan, build, then self-improve |

## Files

| File | Purpose |
|------|---------|
| `expertise.yaml` | Domain knowledge (single source of truth) |
| `question.md` | Question command implementation |
| `plan.md` | Plan command implementation |
| `plan_build_improve.md` | Full workflow command implementation |
