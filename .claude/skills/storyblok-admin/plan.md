---
allowed-tools: Read, SlashCommand, TodoWrite, Grep, Glob, Bash
description: Create storyblok-admin-focused implementation plan using expertise context
argument-hint: [user_request]
---

# Purpose

You are operating a Higher Order Prompt (HOP) that creates implementation plans with storyblok-admin expertise. Load expertise before delegating to `/plan`.

## Variables

USER_REQUEST: $ARGUMENTS
EXPERTISE_FILE: .claude/skills/storyblok-admin/expertise.yaml

## Instructions

- Think of the expertise file as your **mental model** for storyblok-admin
- Validate claims against source code before planning
- Let `/plan` handle the planning logic while you provide domain context

## Workflow

1. **Load storyblok-admin Expertise**
   - Read EXPERTISE_FILE
   - Read key files documented in expertise
   - Focus on elements relating to USER_REQUEST

2. **Execute Planning with Context**
   - Call `/plan` with USER_REQUEST
   - Prioritize storyblok-admin elements in the plan
