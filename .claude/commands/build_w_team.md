---
description: Build with Agent Teams - orchestrate teammates to implement a plan
argument-hint: [path-to-plan]
---

# Build With Team

Orchestrate an Agent Team to implement the plan at `PATH_TO_PLAN`. You are the team lead. You NEVER write code directly - you coordinate teammates who do the work.

## Variables

PATH_TO_PLAN: $ARGUMENTS

## Workflow

### Step 1: Read & Parse the Plan
- If no `PATH_TO_PLAN` is provided, STOP and ask user.
- Read the plan file. Extract:
  - Team Members (names, roles, agent types)
  - Step by Step Tasks (IDs, dependencies, assignments)
  - Acceptance Criteria
  - Validation Commands

### Step 2: Create the Team
- Call `TeamCreate` with team name derived from the plan filename (e.g., `build-dynamic-routing`)
- This creates the shared task list all teammates will use

### Step 3: Create Tasks
- For each task in the plan's "Step by Step Tasks" section, call `TaskCreate`
- Set dependencies with `TaskUpdate` + `addBlockedBy` matching the plan's "Depends On" fields
- Assign owners with `TaskUpdate` + `owner` matching the plan's "Assigned To" fields

### Step 4: Spawn Teammates
- **Preflight Validation**: Before spawning any teammate, validate expert coverage for ALL team members:
  - For each team member in the plan, verify the `Expert` field is present and matches the pattern `/skills:<domain>:plan_build_improve`
  - Parse `<domain>` from the Expert field (e.g., `/skills:frontend-dev:plan_build_improve` -> `frontend-dev`)
  - If ANY member is missing a valid Expert field, STOP and report: `"BUILD BLOCKED: Team member '<name>' has no Expert field. Re-run planning with expert coverage or run /create-expert-skill to bootstrap."`
  - Do NOT proceed with spawning until all members pass preflight validation
- For each unique team member in the plan, spawn a teammate using the `Task` tool with the worker-safe expert activation pattern.
- Spawn template:
  ```
  Task({
    description: "<member role>",
    prompt: "You are <member name>, a teammate on team <team-name>. Your role: <role>.

  EXPERT ACTIVATION (MANDATORY):
  1. BEFORE starting work, run: /skills:<domain>:question '<your assigned task summary and acceptance criteria>'
     This loads domain expertise context. Record: expert_context_loaded: true
  2. Read your assigned tasks from TaskList, claim them (TaskUpdate status in_progress), implement them.
  3. AFTER completing work, run: /skills:<domain>:self-improve true '<task-id or focus>'
     This writes learnings back. Record: self_improve_ran: true
  4. Mark task complete (TaskUpdate status completed).

  Include expert_context_loaded and self_improve_ran in your completion report.
  The full plan is at <PATH_TO_PLAN>.",
    subagent_type: "<agent type from plan>",
    team_name: "<team-name>",
    name: "<member name>"
  })
  ```
- Derive `<domain>` from the member's Expert field by parsing `/skills:<domain>:plan_build_improve` to extract `<domain>`
- Spawn members whose tasks have no dependencies first
- Spawn remaining members as their dependencies resolve

### Step 5: Monitor & Coordinate
- Periodically check `TaskList` for progress
- If a teammate reports issues or gets stuck, provide guidance via `SendMessage`
- If tasks are blocked, investigate and help unblock
- Validate work quality as tasks complete
- **TDD Gate**: When all test-writer tasks are marked complete, verify `.tdd_lock` exists (`test -f .tdd_lock`). If missing and the plan includes a test-writer member, send the test-writer a message to create it. Do NOT allow builder tasks to proceed until `.tdd_lock` is confirmed present.

### Step 6: Run Validation
- Once all tasks are complete, run the Validation Commands from the plan
- If validation fails, create new tasks and assign to appropriate teammates
- Iterate until all acceptance criteria are met

### Step 6.5: Verify Expert Execution Evidence
- For each teammate, check their completion report for:
  - `expert_context_loaded: true`
  - `self_improve_ran: true`
- If any teammate is missing either field, send them a message asking them to complete the expert workflow steps
- Note: `0 learnings` from self-improve is a valid outcome -- gate on whether the step ran, not on whether files changed
- Do NOT finalize until all teammates have provided execution evidence

### Step 6.7: Generate Sprint Report
- After all validation passes, spawn a subagent to generate the sprint report:
  ```
  Task({
    description: "sprint report",
    prompt: "Run /skills:sprint-reporter:report <PATH_TO_PLAN>",
    subagent_type: "general-purpose"
  })
  ```
- This generates `.sprint_report.md` (written report) and `.sprint_voice.txt` (voice guide) in the worktree root
- Both files will be included in the commit so the monitor can read them

### Step 6.8: Present Sprint Report
- Read `.sprint_report.md` and display it to the user
- Check if `.sprint_voice.txt` exists
- If it does, ask the user: "Read aloud? [y/n]"
- If yes and TTS is configured, play via the project's TTS script. TTS is optional -- if no TTS script is available, skip playback and note that the voice text is available in `.sprint_voice.txt`.

### Step 6.9: Pre-Completion Quality Check
- Check for blocking issues: `cat .sprint_issues 2>/dev/null | grep -c '"blocking"'`
- Check TDD phase completed: `test -f .tdd_lock` (if plan includes a test-writer)
- If `.tdd_lock` missing and test-writer was in team, raise issue:
  `echo '{"severity":"blocking","reporter":"build-orchestrator","message":"TDD phase incomplete: .tdd_lock not found"}' >> .sprint_issues`
- Record whether blocking issues exist -- this determines the completion signal in Step 7

### Step 7: Finalize
- Send `shutdown_request` to all teammates
- Stage changed files (avoid temp files, logs, generated artifacts)
- Ensure `.sprint_report.md` and `.sprint_voice.txt` are staged
- Commit with a message referencing the plan
- Push to current branch
- Check the result of Step 6.9:
  - If blocking issues were found: `echo "blocked" > .sprint_complete`
  - If no blocking issues: `echo "success" > .sprint_complete`
- Call `TeamDelete` to clean up team resources

## Report

Present the plan's Acceptance Criteria with pass/fail status, the commit hash, and any issues encountered.
