---
name: create-expert-skill
description: Creates complete self-improving expert skills under .claude/skills/. Use when user asks to create a new expert, add domain expertise, or set up a self-improving expert for a technology area.
allowed-tools: Write, Read, Bash, Glob, Grep
---

# Create Self-Improving Expert Skill

Creates a self-improving expert skill under `.claude/skills/` and a thin agent wrapper under `.claude/agents/` by using `.claude/templates/example-skill/` and `.claude/templates/example-agent.md` as the canonical templates (single source of truth). All files are created by copying the templates and replacing `example-skill` with the new expert name.

## What Gets Created

```
.claude/skills/{name}/
├── SKILL.md                    # Overview with domain knowledge reference and commands
├── plan.md                     # Slash command: plan with expertise context
├── question.md                 # Slash command: Q&A without code changes
├── plan_build_improve.md       # Slash command: full plan → build → self-improve cycle
├── self-improve.md             # Slash command: validate expertise, write to JSONL journal
├── consolidate.md              # Slash command: merge journal into expertise.yaml (orchestrator use)
├── self-improve.sh             # Stop hook script for automated expertise maintenance
├── expertise.yaml              # Domain knowledge (single source of truth, max 1000 lines)
├── expertise.learnings.jsonl   # JSONL journal for learnings (never edit expertise.yaml directly)

.claude/agents/{name}-agent.md  # Thin agent wrapper with skills reference and Stop hook
```

## Variables

EXPERT_NAME: $1 (kebab-case, e.g., "storyblok-developer")
DESCRIPTION: $2 (one-line purpose, e.g., "Storyblok CMS development and content modeling")
EXAMPLE_SKILL_DIR: .claude/templates/example-skill
EXAMPLE_AGENT_PATH: .claude/templates/example-agent.md
SKILL_OUTPUT_DIR: .claude/skills/${EXPERT_NAME}
AGENT_OUTPUT_PATH: .claude/agents/${EXPERT_NAME}-agent.md
CURRENT_DATE: Current date in YYYY-MM-DD format

## Instructions

- Read each file from EXAMPLE_SKILL_DIR and EXAMPLE_AGENT_PATH — these are the single source of truth
- Replace all occurrences of `example-skill` with EXPERT_NAME in file content
- Replace all occurrences of `Example` with EXPERT_TITLE (capitalized form) in file content
- Update the starter `expertise.yaml` with provided DESCRIPTION
- Create an empty `expertise.learnings.jsonl`
- Generate a thin agent wrapper from the example agent
- Validate the result

## Key Design Decisions

- **Self-improve always writes to JSONL journal** — never directly to expertise.yaml. This prevents merge conflicts when multiple agents run in parallel worktrees.
- **Consolidate is for the orchestrator** — not called by agents directly. It merges journal entries into expertise.yaml.
- **SKILL.md only exposes user-facing commands** — question, plan, plan_build_improve. Self-improve and consolidate are internal.

## Workflow

### 1. Parse and Validate Input

- Extract EXPERT_NAME from $1 — convert to kebab-case if needed
- Extract DESCRIPTION from $2
- Derive EXPERT_TITLE from EXPERT_NAME — capitalize words, replace hyphens with spaces (e.g., "frontend-dev" -> "Frontend Dev")
- Set CURRENT_DATE to today's date (YYYY-MM-DD)
- Validate EXPERT_NAME matches `[a-z0-9-]+`
- Check that SKILL_OUTPUT_DIR does NOT already exist — if it does, abort with error

### 2. Create Directory

```bash
mkdir -p ${SKILL_OUTPUT_DIR}
```

### 3. Generate Skill Files from Example

For each file in the example-skill directory (SKILL.md, plan.md, question.md, plan_build_improve.md, self-improve.md, consolidate.md, self-improve.sh):
1. Read the file from EXAMPLE_SKILL_DIR
2. Replace all `example-skill` with EXPERT_NAME
3. Replace all `Example` with EXPERT_TITLE (in headings and prose)
4. Write to `${SKILL_OUTPUT_DIR}/`

Make self-improve.sh executable: `chmod +x ${SKILL_OUTPUT_DIR}/self-improve.sh`

### 4. Generate Starter expertise.yaml

Create `${SKILL_OUTPUT_DIR}/expertise.yaml` with this content (replace placeholders with actual values):

```yaml
# ${EXPERT_TITLE} Expertise
version: "1.0"
last_updated: "${CURRENT_DATE}"

overview:
  description: "${DESCRIPTION}"

technology_stack:
  # TODO: Add technologies

patterns:
  # TODO: Document patterns as you discover them

key_files:
  # TODO: Add key files as you discover them
```

### 5. Create Empty Learnings Journal

Write an empty file at `${SKILL_OUTPUT_DIR}/expertise.learnings.jsonl`.

### 6. Generate Agent Wrapper from Example

1. Read EXAMPLE_AGENT_PATH
2. Replace all `example-skill` with EXPERT_NAME
3. Replace all `Example` with EXPERT_TITLE
4. Update the description with DESCRIPTION
5. Write to AGENT_OUTPUT_PATH

### 7. Validate

- Validate YAML: `python3 -c "import yaml; yaml.safe_load(open('${SKILL_OUTPUT_DIR}/expertise.yaml'))"`
- Verify self-improve.sh is executable: `test -x ${SKILL_OUTPUT_DIR}/self-improve.sh && echo OK || echo FAIL`
- List skill directory: `ls -la ${SKILL_OUTPUT_DIR}/`
- Verify agent wrapper exists: `test -f ${AGENT_OUTPUT_PATH} && echo OK || echo FAIL`
- Verify all 9 skill files exist (SKILL.md + 5 command .md files + self-improve.sh + expertise.yaml + expertise.learnings.jsonl)
- Verify agent wrapper exists (1 file)

## Report

### Expert Skill Created: ${EXPERT_TITLE}

**Skill Location**: `${SKILL_OUTPUT_DIR}/`
**Agent Wrapper**: `${AGENT_OUTPUT_PATH}`

### Files Generated

| File | Purpose |
|------|---------|
| `SKILL.md` | Overview with domain knowledge reference and commands |
| `plan.md` | Slash command: plan with expertise context |
| `question.md` | Slash command: Q&A without code changes |
| `plan_build_improve.md` | Slash command: full plan, build, self-improve cycle |
| `self-improve.md` | Slash command: validate expertise, write to JSONL journal |
| `consolidate.md` | Slash command: merge journal into expertise.yaml |
| `self-improve.sh` | Stop hook script for automated expertise maintenance |
| `expertise.yaml` | Domain knowledge — single source of truth |
| `expertise.learnings.jsonl` | JSONL journal for learnings |
| `${EXPERT_NAME}-agent.md` | Thin agent wrapper with Stop hook |

### Usage

**As a skill** (from any agent or prompt):
```
/skills:${EXPERT_NAME}:question [your question]
/skills:${EXPERT_NAME}:plan [your request]
/skills:${EXPERT_NAME}:plan_build_improve [your request]
```

**As an agent** (standalone with auto self-improvement):
```
Launch the ${EXPERT_NAME}-agent to handle: [your request]
```

### Next Steps

1. **Bootstrap expertise** — Run `/skills:${EXPERT_NAME}:self-improve` to auto-discover patterns from the codebase
2. **Customize agent** — Edit `.claude/agents/${EXPERT_NAME}-agent.md` to add domain-specific workflow steps or reporting format
