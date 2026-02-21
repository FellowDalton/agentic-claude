---
allowed-tools: Read, SlashCommand, TodoWrite, Grep, Glob, Bash
description: Create example-skill-focused implementation plan using expertise context
argument-hint: [user_request]
---

# Purpose

You are operating a Higher Order Prompt (HOP) that creates implementation plans with example-skill expertise. Load expertise before delegating to `/plan`.

## Variables

USER_REQUEST: $ARGUMENTS
EXPERTISE_FILE: .claude/skills/example-skill/expertise.yaml

## Instructions

- Think of the expertise file as your **mental model** for example-skill
- Validate claims against source code before planning
- Let `/plan` handle the planning logic while you provide domain context

## Workflow

1. **Load example-skill Expertise**
   - Read EXPERTISE_FILE
   - Read key files documented in expertise
   - Focus on elements relating to USER_REQUEST

2. **Execute Planning with Context**
   - Call `/plan` with USER_REQUEST
   - Prioritize example-skill elements in the plan
