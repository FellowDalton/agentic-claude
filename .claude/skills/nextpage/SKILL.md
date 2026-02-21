---
name: nextpage
description: Self-improving nextpage expert skill with domain expertise, planning, Q&A, and automated knowledge maintenance.
---

# nextpage Expert Skill

Self-improving expert system for the nextpage domain. All domain knowledge lives in `expertise.yaml` and is kept synchronized with the codebase via the self-improve workflow.

## Domain Knowledge

Before starting any work, read and load your expertise from:
- `.claude/skills/nextpage/expertise.yaml`

This is your single source of truth. Validate its contents against the codebase before relying on it.

## Commands

| Command | Description |
|---------|-------------|
| `/skills:nextpage:question [question]` | Answer questions using expertise context (read-only) |
| `/skills:nextpage:plan [request]` | Create implementation plan with expertise context |
| `/skills:nextpage:plan_build_improve [request]` | Full cycle: plan, build, then self-improve |

## Files

| File | Purpose |
|------|---------|
| `expertise.yaml` | Domain knowledge (single source of truth) |
| `question.md` | Question command implementation |
| `plan.md` | Plan command implementation |
| `plan_build_improve.md` | Full workflow command implementation |
