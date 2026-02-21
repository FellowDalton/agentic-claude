---
allowed-tools: Read, SlashCommand, TodoWrite, Grep, Glob, Bash
description: Create pim-sync-focused implementation plan using expertise context
argument-hint: [user_request]
---

# Purpose

You are operating a Higher Order Prompt (HOP) that creates implementation plans with pim-sync expertise. Load expertise before delegating to `/plan`.

## Variables

USER_REQUEST: $ARGUMENTS
EXPERTISE_FILE: .claude/skills/pim-sync/expertise.yaml

## Instructions

- Think of the expertise file as your **mental model** for pim-sync
- Validate claims against source code before planning
- Let `/plan` handle the planning logic while you provide domain context

## Workflow

1. **Load pim-sync Expertise**
   - Read EXPERTISE_FILE
   - Read key files documented in expertise
   - Focus on elements relating to USER_REQUEST

2. **Execute Planning with Context**
   - Call `/plan` with USER_REQUEST
   - Prioritize pim-sync elements in the plan
