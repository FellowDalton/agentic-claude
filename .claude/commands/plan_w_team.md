---
description: Creates a concise engineering implementation plan based on user requirements and saves it to specs directory
argument-hint: [story prompt] [orchestration prompt]
model: opus
disallowed-tools: Task, EnterPlanMode
hooks:
  Stop:
    - hooks:
        - type: command
          command: >-
            python3 $CLAUDE_PROJECT_DIR/.claude/hooks/validators/validate_new_file.py
            --directory specs
            --extension .md
        - type: command
          command: >-
            python3 $CLAUDE_PROJECT_DIR/.claude/hooks/validators/validate_file_contains.py
            --directory specs
            --extension .md
            --contains '## Task Description'
            --contains '## Objective'
            --contains '## Relevant Files'
            --contains '## Step by Step Tasks'
            --contains '## Acceptance Criteria'
            --contains '## Team Orchestration'
            --contains '### Team Members'
            --contains '- Expert:'
        - type: command
          command: >-
            python3 $CLAUDE_PROJECT_DIR/.claude/hooks/validators/validate_plan_expert_coverage.py
            --directory specs
            --extension .md
---

# Plan With Team

Create a detailed implementation plan based on the user's requirements provided through the `STORY_PROMPT` variable. Analyze the request, think through the implementation approach, and save a comprehensive specification document to `PLAN_OUTPUT_DIRECTORY/<name-of-plan>.md` that can be used as a blueprint for actual development work. Follow the `Instructions` and work through the `Workflow` to create the plan.

## Variables

TEAM_MEMBERS: `.claude/agents/*-agent.md`
STORY_PROMPT: $1
ORCHESTRATION_PROMPT: $2 - Set a team of agents based on available `TEAM_MEMBERS`.
PLAN_OUTPUT_DIRECTORY: `specs/`
GENERAL_PURPOSE_AGENT: `general-purpose`

## Instructions

- **PLANNING ONLY**: Do NOT build, write code, or deploy agents. Your only output is a plan document saved to `PLAN_OUTPUT_DIRECTORY`.
- If no `STORY_PROMPT` is provided, stop and ask the user to provide it.
- If `ORCHESTRATION_PROMPT` is provided, use it to guide team composition, task granularity, dependency structure, and parallel/sequential decisions.
- Carefully analyze the user's requirements provided in the STORY_PROMPT variable
- Determine the task type (chore|feature|refactor|fix|enhancement) and complexity (simple|medium|complex)
- Think deeply (ultrathink) about the best approach to implement the requested functionality or solve the problem
- Understand the codebase directly without subagents to understand existing patterns and architecture
- Follow the Plan Format below to create a comprehensive implementation plan
- Include all required sections and conditional sections based on task type and complexity
- Generate a descriptive, kebab-case filename based on the main topic of the plan
- Save the complete implementation plan to `PLAN_OUTPUT_DIRECTORY/<descriptive-name>.md`
- Ensure the plan is detailed enough that another developer could follow it to implement the solution
- Include code examples or pseudo-code where appropriate to clarify complex concepts
- Consider edge cases, error handling, and scalability concerns
- Understand your role as the team lead. Refer to the `Team Orchestration` section for more details.

### Team Orchestration

As the team lead, you have access to powerful tools for coordinating work across multiple agents. You NEVER write code directly - you orchestrate team members using these tools.

#### Task Management Tools

**TaskCreate** - Create tasks in the shared task list:
```typescript
TaskCreate({
  subject: "Implement user authentication",
  description: "Create login/logout endpoints with JWT tokens. See specs/auth-plan.md for details.",
  activeForm: "Implementing authentication"  // Shows in UI spinner when in_progress
})
// Returns: taskId (e.g., "1")
```

**TaskUpdate** - Update task status, assignment, or dependencies:
```typescript
TaskUpdate({
  taskId: "1",
  status: "in_progress",  // pending -> in_progress -> completed
  owner: "builder-auth"   // Assign to specific team member
})
```

**TaskList** - View all tasks and their status:
```typescript
TaskList({})
// Returns: Array of tasks with id, subject, status, owner, blockedBy
```

**TaskGet** - Get full details of a specific task:
```typescript
TaskGet({ taskId: "1" })
// Returns: Full task including description
```

#### Task Dependencies

Use `addBlockedBy` to create sequential dependencies - blocked tasks cannot start until dependencies complete:

```typescript
// Task 2 depends on Task 1
TaskUpdate({
  taskId: "2",
  addBlockedBy: ["1"]  // Task 2 blocked until Task 1 completes
})

// Task 3 depends on both Task 1 and Task 2
TaskUpdate({
  taskId: "3",
  addBlockedBy: ["1", "2"]
})
```

Dependency chain example:
```
Task 1: Setup foundation     -> no dependencies
Task 2: Implement feature    -> blockedBy: ["1"]
Task 3: Write tests          -> blockedBy: ["2"]
Task 4: Final validation     -> blockedBy: ["1", "2", "3"]
```

#### Owner Assignment

Assign tasks to specific team members for clear accountability:

```typescript
// Assign task to a specific builder
TaskUpdate({
  taskId: "1",
  owner: "builder-api"
})

// Team members check for their assignments
TaskList({})  // Filter by owner to find assigned work
```

#### Agent Teams

Use Agent Teams for coordinated multi-agent execution. The team lead creates a team, spawns teammates, and coordinates via messaging.

**TeamCreate** - Create a team with shared task list:
```typescript
TeamCreate({
  team_name: "build-feature-x",
  description: "Implementing feature X"
})
```

**Spawn Teammates** - Deploy agents as team members:
```typescript
Task({
  description: "Implement auth endpoints",
  prompt: "You are auth-builder, a teammate on team build-feature-x. Your role: implement auth endpoints. Read your assigned tasks from TaskList, claim them, implement, and mark complete.",
  subagent_type: "general-purpose",
  team_name: "build-feature-x",
  name: "auth-builder"
})
```

#### Team Communication

Teammates communicate directly with each other via `SendMessage`:

```typescript
// Direct message to a specific teammate
SendMessage({
  type: "message",
  recipient: "frontend-dev",
  content: "The API endpoints are ready. The auth token format is JWT with HS256.",
  summary: "API endpoints ready for integration"
})

// Broadcast to all teammates (use sparingly)
SendMessage({
  type: "broadcast",
  content: "Blocking issue found in shared module, pausing all work.",
  summary: "Blocking issue - pause work"
})
```

#### Parallel Execution

Parallelism is managed by the dependency graph in the shared task list. Tasks without `blockedBy` dependencies can be worked on simultaneously by different teammates. No need for `run_in_background` - teammates work autonomously once spawned.

#### Shutdown & Cleanup

```typescript
// Request teammate to shut down
SendMessage({
  type: "shutdown_request",
  recipient: "auth-builder",
  content: "All tasks complete, shutting down team"
})

// Clean up team resources
TeamDelete({})
```

#### Orchestration Workflow

1. **Create team** with `TeamCreate`
2. **Create tasks** with `TaskCreate` for each step in the plan
3. **Set dependencies** with `TaskUpdate` + `addBlockedBy`
4. **Assign owners** with `TaskUpdate` + `owner`
5. **Spawn teammates** with `Task` + `team_name` + `name`
6. **Monitor progress** with `TaskList` and `SendMessage`
7. **Shutdown teammates** with `SendMessage` type `shutdown_request`
8. **Clean up** with `TeamDelete`

## Workflow

IMPORTANT: **PLANNING ONLY** - Do not execute, build, or deploy. Output is a plan document.

1. Analyze Requirements - Parse the STORY_PROMPT to understand the core problem and desired outcome
2. Understand Codebase - Without subagents, directly understand existing patterns, architecture, and relevant files
3. Design Solution - Develop technical approach including architecture decisions and implementation strategy
4. Define Team Members - Use `ORCHESTRATION_PROMPT` (if provided) to guide team composition. Identify from `.claude/agents/*-agent.md` or use `general-purpose`. Document in plan.
5. Define Step by Step Tasks - Use `ORCHESTRATION_PROMPT` (if provided) to guide task granularity and parallel/sequential structure. Write out tasks with IDs, dependencies, assignments. Document in plan.
6. Generate Filename - Create a descriptive kebab-case filename based on the plan's main topic
7. Save Plan - Write the plan to `PLAN_OUTPUT_DIRECTORY/<filename>.md`
8. Save & Report - Follow the `Report` section to write the plan to `PLAN_OUTPUT_DIRECTORY/<filename>.md` and provide a summary of key components
9. Codex Review Gate - Run the plan through Codex for independent review. Follow the `Codex Review Gate` section to invoke Codex, parse feedback, and revise the plan if needed before auto-executing

## Plan Format

- IMPORTANT: Replace <requested content> with the requested content. It's been templated for you to replace. Consider it a micro prompt to replace the requested content.
- IMPORTANT: Anything that's NOT in <requested content> should be written EXACTLY as it appears in the format below.
- IMPORTANT: Follow this EXACT format when creating implementation plans:

```md
# Plan: <task name>

## Task Description
<describe the task in detail based on the prompt>

## Objective
<clearly state what will be accomplished when this plan is complete>

<if task_type is feature or complexity is medium/complex, include these sections:>
## Problem Statement
<clearly define the specific problem or opportunity this task addresses>

## Solution Approach
<describe the proposed solution approach and how it addresses the objective>
</if>

## Relevant Files
Use these files to complete the task:

<list files relevant to the task with bullet points explaining why. Include new files to be created under an h3 'New Files' section if needed>

<if complexity is medium/complex, include this section:>
## Implementation Phases
### Phase 1: Foundation
<describe any foundational work needed>

### Phase 2: Core Implementation
<describe the main implementation work>

### Phase 3: Integration & Polish
<describe integration, testing, and final touches>
</if>

## Team Orchestration

- You operate as the team lead using Agent Teams and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `TeamCreate`, `Task`, `TaskCreate/TaskUpdate/TaskList`, and `SendMessage` to coordinate teammates.
  - This is critical. You're job is to act as a high level director of the team, not a builder.
  - You're role is to validate all work is going well and make sure the team is on track to complete the plan.
  - You'll orchestrate using the shared task list and direct messaging between teammates.
  - Communication is paramount. Teammates can message each other directly via `SendMessage` for coordination.
- Teammates are referenced by their name (not session ID). Each teammate has persistent context within the team session.

### Team Members
<list the team members you'll use to execute the plan>

- Builder
  - Name: <unique name for this builder - this allows you and other team members to reference THIS builder by name. Take note there may be multiple builders, the name make them unique.>
  - Role: <the single role and focus of this builder will play>
  - Agent Type: <the subagent type of this builder, you'll specify based on the name in TEAM_MEMBERS file or GENERAL_PURPOSE_AGENT if you want to use a general-purpose agent>
  - Expert: <REQUIRED. The expert skill command for this builder. Format: /skills:domain:plan_build_improve. Must be provided for EVERY team member. If no expert skill exists yet for this domain, add a prerequisite task that runs /create-expert-skill to bootstrap one, then assign the resulting skill command here.>
  - Resume: <default true. This lets the agent continue working with the same context. Pass false if you want to start fresh with a new context.>
- <continue with additional team members as needed in the same format as above>

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

<list step by step tasks as h3 headers. Start with foundational work, then core implementation, then validation.>

### 1. <First Task Name>
- **Task ID**: <unique kebab-case identifier, e.g., "setup-database">
- **Depends On**: <Task ID(s) this depends on, or "none" if no dependencies>
- **Assigned To**: <team member name from Team Members section>
- **Agent Type**: <subagent from TEAM_MEMBERS file or GENERAL_PURPOSE_AGENT if you want to use a general-purpose agent>
- **Parallel**: <true if can run alongside other tasks, false if must be sequential>
- <specific action to complete>
- <specific action to complete>

### 2. <Second Task Name>
- **Task ID**: <unique-id>
- **Depends On**: <previous Task ID, e.g., "setup-database">
- **Assigned To**: <team member name>
- **Agent Type**: <subagent type from TEAM_MEMBERS file or GENERAL_PURPOSE_AGENT if you want to use a general-purpose agent>
- **Parallel**: <true/false>
- <specific action>
- <specific action>

### 3. <Continue Pattern>

### N. <Final Validation Task>
- **Task ID**: validate-all
- **Depends On**: <all previous Task IDs>
- **Assigned To**: <validator team member>
- **Agent Type**: <validator agent>
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met

<continue with additional tasks as needed. Agent types must exist in .claude/agents/*-agent.md>

## Acceptance Criteria
<list specific, measurable criteria that must be met for the task to be considered complete>

## Validation Commands
Execute these commands to validate the task is complete:

<list specific commands to validate the work. Be precise about what to run>
- Example: `python3 -m py_compile apps/*.py` - Test to ensure the code compiles

## Notes
<optional additional context, considerations, or dependencies. If new libraries are needed, install via your package manager>
```

## Report

After creating and saving the implementation plan, provide a concise report with the following format:

```
Implementation Plan Created

File: PLAN_OUTPUT_DIRECTORY/<filename>.md
Topic: <brief description of what the plan covers>
Key Components:
- <main component 1>
- <main component 2>
- <main component 3>

Team Task List:
- <list of tasks, and owner (concise)>

Team members:
- <list of team members and their roles (concise)>

Automatically executing the plan...
```

## Codex Review Gate

**MANDATORY** - Do NOT skip this section. Run the Codex review gate and Auto-Execute steps below. If `codex` CLI is not installed, skip only the Codex review (not the Auto-Execute).

After saving the plan and showing the report, run the plan through Codex for independent review before auto-executing the build.

### Step 1: Prepare the Review
- Read the review prompt template from `.claude/codex/review_prompt.md`
- Replace `{{PLAN_CONTENT}}` with the full contents of the saved plan file

### Step 2: Invoke Codex

**IMPORTANT:** Use this EXACT command. Do NOT change the model. Do NOT try other models if it fails -- skip the review and proceed to Auto-Execute.

Write the prepared prompt to `/tmp/codex-review-prompt.txt`, then run:

```bash
codex exec \
  --model gpt-5.3-codex \
  --sandbox read-only \
  --output-schema .claude/codex/review_schema.json \
  -o /tmp/codex-plan-review.json \
  "$(cat /tmp/codex-review-prompt.txt)"
```

- The `--output-schema` flag ensures Codex responds with valid JSON matching the schema
- The `-o` flag writes the final response to a file for parsing
- `--sandbox read-only` ensures Codex can read the codebase but can't modify anything
- If this command fails for ANY reason, skip the Codex review and proceed directly to Auto-Execute. Do NOT retry with different models.

### Step 3: Parse and Decide
- Read `/tmp/codex-plan-review.json`
- Parse the JSON response
- Display a summary to the user:

```
Codex Review Results
Verdict: [approve/revise] (confidence: X.XX)
Summary: [one-sentence summary]
Issues: [count by severity]
```

- **If verdict is "approve"**: Proceed to Auto-Execute
- **If verdict is "revise"**:
  1. Display each critical/major issue with its suggestion
  2. Re-read the current plan
  3. Update the plan to address the critical and major issues
  4. Save the updated plan (overwrite the same file)
  5. Show a diff summary of what changed
  6. Do NOT re-run Codex review (avoid infinite loops - one review cycle only)
  7. Proceed to Auto-Execute with the updated plan

## Auto-Execute

**MANDATORY** - Do NOT skip this section. Always spawn the build tab regardless of Codex review outcome.

After creating the plan and showing the report, spawn a **new iTerm tab** to execute the build in a fresh Claude session with full visibility.

First, rename the current (plan) tab to reflect the build phase, then open a new build tab:

```bash
WORKDIR=$(pwd)
DISPLAY="${STORY_DISPLAY:-story}"
# Rename current plan tab to show it's done planning
printf '\e]1;%s-planned\a' "$DISPLAY"
# Open build tab with proper name
osascript <<EOF
tell application "iTerm"
    tell current window
        create tab with default profile
        tell current session
            set name to "${DISPLAY}-build"
            write text "cd $WORKDIR && STORY_DISPLAY=$DISPLAY .claude/scripts/run_build_session.sh <SPEC_PATH>"
        end tell
    end tell
end tell
EOF
```

Replace `<SPEC_PATH>` with the actual spec path (e.g., `specs/story-1-2-dynamic-page-routing.md`).

**IMPORTANT:** You MUST capture `WORKDIR=$(pwd)` first, then use `$WORKDIR` in the osascript. This ensures the new tab opens in the correct worktree directory.

**Tab Naming:** The `STORY_DISPLAY` env var (e.g., `5.1`) is set by the sprint orchestrator. The plan tab starts as `{display}-plan`, gets renamed to `{display}-planned` when done, and the new build tab is named `{display}-build`.

This opens a new visible tab where the user can watch the build execute.
