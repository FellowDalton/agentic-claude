# Claude Code Sprint Orchestrator Kit

A portable, self-contained sprint orchestration system for Claude Code. Drop `.claude/` into any project to get parallel track execution, team orchestration, self-improving expert skills, and sprint reporting.

## Quick Start

1. **Copy the kit** into your project root:
   ```bash
   cp -r claude-orchestrator/.claude/ your-project/.claude/
   mkdir -p your-project/specs
   ```

2. **Bootstrap domain experts** for your project:
   ```
   /create-expert-skill frontend-dev "Frontend development with React and CSS Modules"
   /create-expert-skill backend-api "REST API development and database integration"
   ```

3. **Configure workflows** -- edit `.claude/orchestration/workflows.yaml` to add patterns that match your project's story types. Point each workflow to an orchestration template in `.claude/orchestration/`.

4. **Create a sprint status YAML** (see Sprint Status Format below) and save it to `specs/sprint-status.yaml`.

5. **Run a sprint**:
   ```
   /run-sprint specs/sprint-status.yaml
   ```

## Expert Skill System

Expert skills are self-improving domain knowledge containers. Each skill has an `expertise.yaml` that serves as its mental model, kept in sync with the codebase via a JSONL journal pattern.

### How Skills Work

```
.claude/skills/{name}/
├── SKILL.md                    # Overview and command reference
├── expertise.yaml              # Domain knowledge (single source of truth)
├── expertise.learnings.jsonl   # Journal for learnings (never edit yaml directly)
├── question.md                 # Q&A without code changes
├── plan.md                     # Plan with expertise context
├── plan_build_improve.md       # Full cycle: plan -> build -> self-improve
├── self-improve.md             # Validate expertise, write to journal
├── self-improve.sh             # Hook script for automated maintenance
└── consolidate.md              # Merge journal into expertise.yaml
```

### Creating Skills

```
/create-expert-skill <name> "<description>"
```

This generates the full skill directory and a thin agent wrapper at `.claude/agents/{name}-agent.md`.

### Using Skills

```
/skills:{name}:question [question]           # Ask questions (read-only)
/skills:{name}:plan [request]                # Create implementation plan
/skills:{name}:plan_build_improve [request]  # Full plan -> build -> self-improve
```

### Included Skills

This kit ships with 19 pre-built expert skills, each carrying domain knowledge in their `expertise.yaml`:

| Skill | Domain | Agent Wrapper |
|-------|--------|---------------|
| `frontend-dev` | Next.js components, BEM CSS, Storyblok bloks | `frontend-dev-agent.md` |
| `frontend-tester` | Browser testing, Playwright | `frontend-tester-agent.md` |
| `frontend-validator` | Component validation (read-only) | `frontend-validator-agent.md` |
| `ibexa-format` | Ibexa CMS export format | `ibexa-format-agent.md` |
| `migration` | Content migration pipeline | `migration-agent.md` |
| `nextpage` | nextPage PIM API | `nextpage-agent.md` |
| `overstory` | Overstory multi-agent orchestration CLI | `overstory-agent.md` |
| `pim-sync` | PIM sync service | `pim-sync-agent.md` |
| `railway` | Railway deployment | `railway-agent.md` |
| `sprint-orchestrator` | Sprint orchestrator framework | `sprint-orchestrator-agent.md` |
| `sprint-reporter` | Sprint completion reports | (invoked by `/build_w_team`) |
| `storyblok-admin` | Storyblok space administration | `storyblok-admin-agent.md` |
| `storyblok-cli` | Storyblok CLI operations | `storyblok-cli-agent.md` |
| `storyblok-developer` | Storyblok SDK integration | `storyblok-developer-agent.md` |
| `storyblok-integrations` | External system sync | `storyblok-integrations-agent.md` |
| `tdd` | Test-driven development | `tdd-agent.md` |
| `teamwork` | Teamwork.com integration | `teamwork-agent.md` |
| `websocket` | WebSocket event bus | `websocket-agent.md` |

Use `/create-expert-skill` to add new domain experts as needed.

## Commands Reference

| Command | Description |
|---------|-------------|
| `/run-sprint [path]` | Entry point -- analyze, launch tracks, monitor completion |
| `/analyze-sprint [path]` | Phase 1: Parse sprint status, match workflows, build teams |
| `/launch-tracks` | Phase 2: Create git worktrees, launch Claude sessions in iTerm tabs |
| `/monitor-tracks` | Phase 3: Poll completion, create PRs, human checkpoints, merge |
| `/check-sprint` | Manual status check for running sprint tracks |
| `/cleanup-worktrees` | Remove sprint worktrees and prune git |
| `/plan_w_team [story] [orchestration]` | Create implementation plan with team orchestration |
| `/build_w_team [path-to-plan]` | Build from plan with agent teams |
| `/plan [request]` | Solo planning (no team orchestration) |
| `/create-expert-skill [name] [desc]` | Bootstrap a new self-improving expert skill |

## Sprint Status Format

Create a YAML file describing your sprint stories:

```yaml
sprint:
  name: "Sprint 5"
  base_branch: "main"

stories:
  - id: "5.1"
    title: "User authentication flow"
    status: "ready-for-dev"
    epic: 3
    file: "specs/story-5-1-auth-flow.md"  # optional detail file

  - id: "5.2"
    title: "Product listing page"
    status: "ready-for-dev"
    epic: 2

  - id: "5.3"
    title: "Database schema design"
    status: "backlog"
    epic: 3
```

The orchestrator picks up stories with `status: ready-for-dev` and assigns them to parallel tracks.

## Workflow Configuration

Edit `.claude/orchestration/workflows.yaml` to map story patterns to team templates:

```yaml
workflows:
  frontend-component:
    description: "Component implementation with testing"
    has_frontend: true
    patterns: ["component", "widget", "page"]
    orchestration: ".claude/orchestration/frontend-component.md"

  backend-api:
    description: "API endpoint implementation"
    has_frontend: false
    patterns: ["api", "endpoint", "service"]
    orchestration: ".claude/orchestration/backend-api.md"

default: frontend-component
```

Each orchestration template (`.md` file) defines the team structure: roles, agent types, execution order, task dependencies, and quality gates. See `.claude/orchestration/example-workflow.md` for the pattern.

## Sprint Execution Flow

```
/run-sprint
  │
  ├── /analyze-sprint     Read YAML, match workflows, assign tracks
  │     track-a: Story 5.1 -> backend-api    (ports 3001/9101)
  │     track-b: Story 5.2 -> frontend-component (ports 3002/9102)
  │
  ├── /launch-tracks      Create worktrees, open iTerm tabs
  │     Each tab runs: /plan_w_team -> /build_w_team
  │
  └── /monitor-tracks     Poll .sprint_complete markers
        On completion: quality gates -> PR -> human checkpoint -> merge
```

### Port Allocation

Tracks get deterministic port pairs:

| Track | Frontend Port | Backend Port |
|-------|--------------|--------------|
| track-a | 3001 | 9101 |
| track-b | 3002 | 9102 |
| track-c | 3003 | 9103 |
| track-d | 3004 | 9104 |
| track-e | 3005 | 9105 |
| track-f | 3006 | 9106 |

## Plan Validation

Plans created by `/plan_w_team` are validated by hook scripts:

- `validate_new_file.py` -- Ensures at least one new `.md` plan file is created in `specs/`
- `validate_file_contains.py` -- Checks plan has required sections (Task Description, Objective, etc.)
- `validate_plan_expert_coverage.py` -- Verifies each team member has a `/skills:{domain}:plan_build_improve` expert field

These run automatically as Stop hooks. No configuration needed.

## Portability Notes

### Required

- **python3** -- Plan validation hooks use stdlib only (no pip packages)
- **git** -- Worktree management for parallel tracks

### Optional

- **gh** CLI -- GitHub PR creation (gracefully skipped if not installed)
- **codex** CLI -- Independent plan review gate (skipped if not installed)
- **iTerm + macOS** -- Auto tab launch via osascript (falls back to printing CLI commands on other platforms)

### Not Required

- No `uv`, `pydantic`, `pyyaml`, or other Python package dependencies
- No project-specific integrations by default (GitHub, Railway, Teamwork are all opt-in)
- No external databases or services
