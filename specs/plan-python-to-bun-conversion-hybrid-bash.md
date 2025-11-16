# Plan: Python to Bun Conversion with Hybrid Bash Architecture

## Metadata
adw_id: `Turn every python script into a bun script. Do it systematically, so you are sure you get every detail right. I also only want to invoke Claude code, so locally so not use my API key. I have found that bash scripts work best when running Claude code programmatically, so try a mixed approach of bun and bash scripts, where bun will run a bash script anytime Claude code needs to be called, then bun will follow up in the end, when the script is done handling the output. Ultra think on this one and really impress me with your solution`
prompt: `Turn every python script into a bun script. Do it systematically, so you are sure you get every detail right. I also only want to invoke Claude code, so locally so not use my API key. I have found that bash scripts work best when running Claude code programmatically, so try a mixed approach of bun and bash scripts, where bun will run a bash script anytime Claude code needs to be called, then bun will follow up in the end, when the script is done handling the output. Ultra think on this one and really impress me with your solution`
task_type: refactor
complexity: complex

## Task Description

Convert the entire Python-based multi-agent rapid prototyping system to TypeScript/Bun while implementing a hybrid architecture where:
- **Bun (TypeScript)** handles all business logic, data models, validation, orchestration, and output processing
- **Bash scripts** serve as thin wrappers exclusively for Claude Code CLI invocations
- **Local Claude Code CLI** is used (no API key consumption from this system)
- All functionality is preserved including worktree management, task monitoring, and multi-agent workflows

This refactor must be **systematic and comprehensive**, ensuring every Python script is converted while maintaining 100% feature parity.

## Objective

Replace all 11 Python scripts with TypeScript/Bun equivalents using a hybrid Bun/Bash architecture that:
1. Eliminates Python dependency entirely from the system
2. Uses Bun's native TypeScript execution for superior performance
3. Delegates Claude Code CLI calls to bash scripts (avoiding subprocess issues)
4. Maintains all security features (environment filtering, detached processes)
5. Preserves all workflows (build, plan-implement, prototyping)
6. Ensures compatibility with existing `.claude/commands/` slash commands

## Problem Statement

The current Python-based architecture has several limitations:
- **Python dependency**: Requires UV and Python 3.10+ installation
- **Subprocess complexity**: Python subprocess handling is verbose and error-prone
- **Type safety**: Pydantic provides runtime validation but lacks compile-time type checking
- **Performance**: Python startup time impacts rapid task processing
- **Claude Code invocation**: Mixed results when calling Claude Code from Python subprocesses

The user has observed that **bash scripts work best for Claude Code invocation**, suggesting a hybrid approach where:
- Bun handles all application logic and orchestration
- Bash scripts exclusively handle Claude Code CLI execution
- Bun processes the output after bash scripts complete

## Solution Approach

### Hybrid Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Bun TypeScript Layer                     │
│  (Business Logic, Models, Validation, Orchestration)        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │   Needs Claude Code Call?    │
         └──────────┬───────────────────┘
                    │
                    ▼
         ┌──────────────────────────────┐
         │   Execute Bash Wrapper       │
         │   (claude-code-exec.sh)      │
         └──────────┬───────────────────┘
                    │
                    ▼
         ┌──────────────────────────────┐
         │   Claude Code CLI            │
         │   (--output-format stream-json) │
         └──────────┬───────────────────┘
                    │
                    ▼ (writes JSONL file)
         ┌──────────────────────────────┐
         │   Bash Script Exits          │
         └──────────┬───────────────────┘
                    │
                    ▼
         ┌──────────────────────────────┐
         │   Bun Reads JSONL Output     │
         │   Parses, Validates, Acts    │
         └──────────────────────────────┘
```

### Core Design Principles

1. **Single Responsibility**: Bash scripts do ONE thing - execute Claude Code CLI and exit
2. **Clean Interface**: Bash scripts accept standardized arguments and write to predictable output files
3. **Error Handling**: Bash scripts return meaningful exit codes; Bun handles all error logic
4. **No Business Logic in Bash**: All orchestration, retry logic, validation in TypeScript
5. **TypeScript-First**: Use Zod for runtime validation with TypeScript types derived from schemas

### Technology Stack

- **Bun Runtime**: Native TypeScript execution, fast startup, built-in SQLite/file APIs
- **Zod**: Runtime schema validation with TypeScript type inference
- **Bash Scripts**: Minimal wrappers for Claude Code CLI invocation only
- **TypeScript 5.x**: Modern language features with strict type checking

## Relevant Files

### Python Scripts to Convert (11 files)

#### Core Modules (adws/adw_modules/)
- **`adws/adw_modules/agent.py`** (634 lines) - Agent execution framework
  - Purpose: Core logic for executing Claude Code, retry logic, JSONL parsing
  - Key functions: `prompt_claude_code()`, `execute_template()`, `parse_jsonl_output()`
  - Complexity: HIGH - this is the heart of the system

- **`adws/adw_modules/data_models.py`** (728 lines) - Pydantic data models
  - Purpose: Define all data structures (tasks, workflows, configs)
  - Models: NotionTask, TeamworkTask, WorkflowState, AgentPromptRequest, etc.
  - Complexity: MEDIUM - straightforward conversion to Zod schemas

- **`adws/adw_modules/utils.py`** - Utility functions
  - Purpose: JSON parsing, string manipulation, file operations
  - Complexity: LOW - simple helper functions

#### Workflow Scripts (adws/)
- **`adws/adw_build_update_notion_task.py`** (577 lines) - Simple Notion workflow
  - Purpose: Execute /build → /update_notion_task sequence
  - Pattern: Click CLI → execute_template calls → git operations
  - Complexity: MEDIUM

- **`adws/adw_build_update_teamwork_task.py`** - Simple Teamwork workflow
  - Purpose: Execute /build → /update_teamwork_task sequence
  - Complexity: MEDIUM

- **`adws/adw_plan_implement_update_notion_task.py`** - Complex Notion workflow
  - Purpose: Execute /plan_* → /implement → /update_notion_task sequence
  - Handles prototype routing (uv_script, vite_vue, bun_scripts, uv_mcp)
  - Complexity: HIGH

- **`adws/adw_plan_implement_update_teamwork_task.py`** - Complex Teamwork workflow
  - Purpose: Execute /plan_* → /implement → /update_teamwork_task sequence
  - Complexity: HIGH

#### Monitoring Triggers (adws/adw_triggers/)
- **`adws/adw_triggers/adw_trigger_cron_notion_tasks.py`** - Notion monitor
  - Purpose: Poll Notion every 15s, detect eligible tasks, spawn workflow subprocesses
  - Pattern: Infinite loop → fetch tasks → delegate → spawn detached process
  - Complexity: HIGH

- **`adws/adw_triggers/adw_trigger_cron_teamwork_tasks.py`** - Teamwork monitor
  - Purpose: Poll Teamwork every 15s, detect eligible tasks, spawn workflow subprocesses
  - Complexity: HIGH

#### Legacy/Utility Scripts (adws/)
- **`adws/adw_slash_command.py`** - Slash command executor
  - Purpose: Direct slash command execution utility
  - Complexity: LOW

- **`adws/adw_prompt.py`** - Prompt executor
  - Purpose: Direct prompt execution utility
  - Complexity: LOW

### New Files

#### Bash Wrappers (adws/bash/)
- **`adws/bash/claude-code-exec.sh`** - Main Claude Code CLI wrapper
- **`adws/bash/claude-code-template.sh`** - Template execution wrapper
- **`adws/bash/lib/env-filter.sh`** - Environment variable filtering library
- **`adws/bash/lib/error-codes.sh`** - Standardized exit codes

#### TypeScript Core (adws/bun_modules/)
- **`adws/bun_modules/agent.ts`** - Agent execution framework (converted from agent.py)
- **`adws/bun_modules/models.ts`** - Zod schemas and TypeScript types (converted from data_models.py)
- **`adws/bun_modules/utils.ts`** - Utility functions (converted from utils.py)
- **`adws/bun_modules/claude-executor.ts`** - Bash script executor for Claude Code
- **`adws/bun_modules/git-ops.ts`** - Git operations (commit hash, worktree management)

#### TypeScript Workflows (adws/)
- **`adws/adw_build_update_notion_task.ts`** - Build workflow (Notion)
- **`adws/adw_build_update_teamwork_task.ts`** - Build workflow (Teamwork)
- **`adws/adw_plan_implement_update_notion_task.ts`** - Plan-implement workflow (Notion)
- **`adws/adw_plan_implement_update_teamwork_task.ts`** - Plan-implement workflow (Teamwork)

#### TypeScript Triggers (adws/triggers/)
- **`adws/triggers/adw_trigger_cron_notion_tasks.ts`** - Notion monitor
- **`adws/triggers/adw_trigger_cron_teamwork_tasks.ts`** - Teamwork monitor

#### TypeScript Utilities (adws/)
- **`adws/adw_slash_command.ts`** - Slash command executor
- **`adws/adw_prompt.ts`** - Prompt executor

#### Configuration
- **`adws/tsconfig.json`** - TypeScript configuration
- **`adws/package.json`** - Bun package manifest (for typing only, no runtime deps needed)

## Implementation Phases

### Phase 1: Foundation & Bash Wrappers
Establish the hybrid architecture foundation with bash wrappers and core TypeScript infrastructure.

**Goals**:
- Create bash wrapper scripts for Claude Code CLI invocation
- Set up TypeScript project structure with Bun
- Implement environment filtering in bash
- Define standardized interfaces between Bun and Bash

### Phase 2: Core Module Conversion
Convert the foundational Python modules that all other scripts depend on.

**Goals**:
- Convert data_models.py → models.ts (Zod schemas)
- Convert utils.py → utils.ts
- Convert agent.py → agent.ts + claude-executor.ts
- Implement JSONL parsing and retry logic in TypeScript
- Create git operations module

### Phase 3: Workflow Script Conversion
Convert the workflow execution scripts that orchestrate agent tasks.

**Goals**:
- Convert adw_build_update_notion_task.py → .ts
- Convert adw_build_update_teamwork_task.py → .ts
- Convert adw_plan_implement_update_notion_task.py → .ts
- Convert adw_plan_implement_update_teamwork_task.py → .ts
- Ensure all workflows use bash wrappers for Claude Code calls

### Phase 4: Monitoring & Triggers Conversion
Convert the cron-based monitoring services that poll task management platforms.

**Goals**:
- Convert adw_trigger_cron_notion_tasks.py → .ts
- Convert adw_trigger_cron_teamwork_tasks.py → .ts
- Implement detached subprocess spawning in Bun
- Test continuous polling and task delegation

### Phase 5: Utility Scripts & Integration Testing
Convert remaining utility scripts and perform comprehensive integration testing.

**Goals**:
- Convert adw_slash_command.py → .ts
- Convert adw_prompt.py → .ts
- Create migration guide
- Update documentation
- Comprehensive end-to-end testing

## Step by Step Tasks

### 1. Create Bash Wrapper Infrastructure
- Create `adws/bash/` directory structure
- Implement `adws/bash/lib/env-filter.sh` for safe environment variable filtering
  - Filter to only: ANTHROPIC_API_KEY, CLAUDE_CODE_PATH, HOME, USER, PATH, SHELL, TERM, PWD
  - Export filtered environment
- Implement `adws/bash/lib/error-codes.sh` for standardized exit codes
  - `EXIT_SUCCESS=0`
  - `EXIT_CLAUDE_ERROR=1`
  - `EXIT_TIMEOUT=124`
  - `EXIT_INVALID_ARGS=2`
- Create `adws/bash/claude-code-exec.sh` - main Claude Code CLI wrapper
  - Accept arguments: prompt, model, output_file, working_dir, mcp_config_path, skip_permissions
  - Source env-filter.sh and error-codes.sh
  - Build claude command with proper flags
  - Execute with timeout (default 5 minutes)
  - Write stdout to output_file as JSONL
  - Return appropriate exit code
- Create `adws/bash/claude-code-template.sh` - slash command wrapper
  - Accept arguments: slash_command, args (space-separated), output_file, model, working_dir
  - Construct prompt from slash_command and args
  - Call claude-code-exec.sh with constructed prompt
- Add executable permissions to all bash scripts
- Create bash script tests (manual validation)

### 2. Set Up TypeScript Project Structure
- Create `adws/bun_modules/` directory
- Create `adws/tsconfig.json` with strict type checking
  - `"strict": true`
  - `"target": "ES2022"`
  - `"module": "ESNext"`
  - `"moduleResolution": "bundler"`
  - `"types": ["bun-types"]`
- Create `adws/package.json` for type definitions only
  - Add `@types/node` for Node.js compatibility
  - Add `zod` for runtime validation
  - Add `bun-types` for Bun-specific APIs
- Create `.gitignore` entries for `node_modules/` in adws/
- Test basic Bun execution with hello-world script

### 3. Convert data_models.py → models.ts
- Install Zod: `cd adws && bun add zod`
- Create `adws/bun_modules/models.ts`
- Convert Pydantic BaseModel classes to Zod schemas
  - `NotionTask` → `NotionTaskSchema`
  - `TeamworkTask` → `TeamworkTaskSchema`
  - `AgentPromptRequest` → `AgentPromptRequestSchema`
  - `AgentPromptResponse` → `AgentPromptResponseSchema`
  - `AgentTemplateRequest` → `AgentTemplateRequestSchema`
  - `WorkflowState` → `WorkflowStateSchema`
  - `NotionCronConfig` → `NotionCronConfigSchema`
  - `TeamworkCronConfig` → `TeamworkCronConfigSchema`
  - All other models from data_models.py
- Derive TypeScript types from Zod schemas using `z.infer<typeof Schema>`
- Implement validators and custom validation logic
- Add helper methods as class methods or utility functions
- Export all schemas and types

### 4. Convert utils.py → utils.ts
- Create `adws/bun_modules/utils.ts`
- Convert all utility functions to TypeScript
  - `parseJSON()` - safe JSON parsing with Zod validation
  - String manipulation helpers
  - File operation helpers (using Bun's native file APIs)
- Add JSDoc comments for all exported functions
- Export all utilities

### 5. Create Claude Executor Module (claude-executor.ts)
- Create `adws/bun_modules/claude-executor.ts`
- Implement `executeClaudeCode()` function
  - Accept AgentPromptRequest
  - Prepare arguments for bash script
  - Execute `adws/bash/claude-code-exec.sh` using Bun.spawn
  - Wait for process completion
  - Check exit code
  - Return AgentPromptResponse
- Implement `executeTemplate()` function
  - Accept AgentTemplateRequest
  - Call `adws/bash/claude-code-template.sh`
  - Parse JSONL output file
  - Extract result message
  - Return AgentPromptResponse
- Implement retry logic with exponential backoff
- Handle timeout errors and retryable failures
- Add comprehensive error logging

### 6. Create Git Operations Module (git-ops.ts)
- Create `adws/bun_modules/git-ops.ts`
- Implement `getCurrentCommitHash(workingDir: string): Promise<string | null>`
  - Use Bun.spawn to execute `git rev-parse HEAD`
  - Return first 9 characters
  - Handle errors gracefully
- Implement `getGitStatus(workingDir: string): Promise<string>`
  - Execute `git status --short`
- Implement `gitAdd(workingDir: string, files: string[]): Promise<void>`
- Implement `gitCommit(workingDir: string, message: string): Promise<string>`
  - Return commit hash
- Export all git operations

### 7. Convert agent.py → agent.ts
- Create `adws/bun_modules/agent.ts`
- Import claude-executor and models
- Implement `generateShortId(): string` (8-char UUID)
- Implement `savePrompt(prompt: string, adwId: string, agentName: string): Promise<void>`
  - Create directory structure: `agents/{adwId}/{agentName}/prompts/`
  - Save prompt to `{command}.txt`
- Implement `parseJSONLOutput(outputFile: string)`
  - Read JSONL file using Bun.file
  - Parse each line as JSON
  - Find result message (type: "result")
  - Return all messages and result message
- Implement `convertJSONLToJSON(jsonlFile: string): string`
  - Read JSONL, convert to JSON array
  - Write to `cc_raw_output.json`
  - Return JSON file path
- Implement `saveLastEntryAsRawResult(jsonFile: string): string | null`
  - Extract last entry from JSON array
  - Write to `cc_final_object.json`
- Implement `getSafeSubprocessEnv(): Record<string, string>`
  - Filter environment variables (matches env-filter.sh)
  - Return safe env object
- Re-export executeTemplate from claude-executor
- Export all functions

### 8. Convert adw_build_update_notion_task.py → .ts
- Create `adws/adw_build_update_notion_task.ts`
- Add shebang: `#!/usr/bin/env bun`
- Import required modules (agent, models, utils, git-ops)
- Use Bun's built-in argument parsing or a library like `commander`
- Implement CLI argument parsing
  - `--adw-id`
  - `--worktree-name`
  - `--task`
  - `--page-id`
  - `--model`
  - `--verbose`
- Implement `printStatusPanel()` using console colors
- Implement main workflow logic
  - Check/create worktree
  - Execute /build via executeTemplate
  - Get commit hash via git-ops
  - Execute /update_notion_task via executeTemplate
  - Save workflow summary
- Add proper error handling and exit codes
- Make file executable: `chmod +x adws/adw_build_update_notion_task.ts`

### 9. Convert adw_build_update_teamwork_task.py → .ts
- Create `adws/adw_build_update_teamwork_task.ts`
- Follow same pattern as Notion version
- Replace Notion-specific logic with Teamwork equivalents
- Execute /update_teamwork_task instead of /update_notion_task
- Test with Teamwork task

### 10. Convert adw_plan_implement_update_notion_task.py → .ts
- Create `adws/adw_plan_implement_update_notion_task.ts`
- Implement 3-phase workflow
  - Phase 1: Planning (/plan_* based on prototype tag)
  - Phase 2: Implementation (/implement)
  - Phase 3: Update (/update_notion_task)
- Handle prototype type routing
  - Detect prototype tag (uv_script, vite_vue, bun_scripts, uv_mcp)
  - Route to appropriate /plan_{prototype} command
  - Execute /implement with plan file
- Parse plan file path from planning phase output
- Save comprehensive workflow state
- Make executable

### 11. Convert adw_plan_implement_update_teamwork_task.py → .ts
- Create `adws/adw_plan_implement_update_teamwork_task.ts`
- Follow same 3-phase pattern as Notion version
- Use Teamwork-specific update command
- Test with Teamwork prototype task

### 12. Convert adw_trigger_cron_notion_tasks.py → .ts
- Create `adws/triggers/adw_trigger_cron_notion_tasks.ts`
- Implement NotionTaskManager class
  - `getEligibleTasks()`: Fetch tasks via /get_notion_tasks
  - `updateTaskStatus()`: Update via /update_notion_task
  - `delegateTask()`: Spawn detached workflow subprocess
  - `_determineWorkflow()`: Route to build vs plan-implement
  - `_generateWorktreeName()`: Generate worktree name
- Implement NotionCronMonitor class
  - `run()`: Infinite polling loop
  - `processTasks()`: One batch of task processing
  - `_spawnWorkflowProcess()`: Detached Bun.spawn for workflow scripts
- Implement CLI argument parsing
  - `--interval` (default: 15)
  - `--max-tasks` (default: 3)
  - `--dry-run`
  - `--once`
  - `--database-id`
- Use Bun's scheduler or setInterval for polling
- Implement graceful shutdown (SIGINT/SIGTERM handlers)
- Test continuous monitoring

### 13. Convert adw_trigger_cron_teamwork_tasks.py → .ts
- Create `adws/triggers/adw_trigger_cron_teamwork_tasks.ts`
- Implement TeamworkTaskManager class (similar to Notion version)
- Implement TeamworkCronMonitor class
- Add Teamwork-specific status mapping logic
- Test continuous monitoring with Teamwork project

### 14. Convert adw_slash_command.py → .ts
- Create `adws/adw_slash_command.ts`
- Add shebang: `#!/usr/bin/env bun`
- Implement simple CLI for executing slash commands
- Parse arguments and call executeTemplate
- Display output
- Make executable

### 15. Convert adw_prompt.py → .ts
- Create `adws/adw_prompt.ts`
- Add shebang: `#!/usr/bin/env bun`
- Implement simple CLI for executing prompts
- Parse arguments and call executeClaudeCode
- Display output
- Make executable

### 16. Update Shebang Lines in Workflow Scripts
- Ensure all TypeScript workflow scripts have proper shebang
- Update Python script references in documentation
- Create compatibility symlinks if needed (e.g., `.py` → `.ts` for backwards compat)

### 17. Create Migration Guide
- Document the conversion process
- List all Python → TypeScript file mappings
- Explain bash wrapper architecture
- Provide examples of how to run converted scripts
- Add troubleshooting section

### 18. Update Documentation
- Update `README.md` with Bun-based instructions
- Update `CLAUDE.md` with new script paths
- Update `.env.sample` if needed
- Add "Why Bun?" section explaining benefits
- Document bash wrapper architecture

### 19. Integration Testing - Notion Workflows
- Test build-update workflow end-to-end
  - Create test Notion task with "execute" trigger
  - Run `bun run adws/triggers/adw_trigger_cron_notion_tasks.ts --once`
  - Verify task claimed, workflow executed, Notion updated
- Test plan-implement-update workflow
  - Create test task with {{prototype: vite_vue}} tag
  - Verify plan generated, app created, Notion updated
- Test all prototype types (uv_script, vite_vue, bun_scripts, uv_mcp)
- Verify worktree creation and isolation
- Check agent output logs are created correctly

### 20. Integration Testing - Teamwork Workflows
- Test build-update workflow with Teamwork task
- Test plan-implement-update workflow with Teamwork task
- Verify status updates and comments
- Test native tag parsing (prototype:vite_vue format)

### 21. Performance Benchmarking
- Measure script startup time (Python vs Bun)
- Measure task processing throughput
- Test concurrent task handling
- Verify no memory leaks in continuous monitoring
- Document performance improvements

### 22. Deprecate Python Scripts
- Move Python scripts to `adws/legacy_python/` directory
- Add deprecation notice in Python script docstrings
- Update references in documentation
- Keep Python scripts for reference but mark as deprecated

### 23. Final Validation & Cleanup
- Run all workflows end-to-end with real tasks
- Verify no Python dependencies remain in runtime path
- Check all bash scripts are executable
- Verify environment variable filtering works
- Test error scenarios and edge cases
- Review code for TODO/FIXME comments
- Remove debug logging
- Create release notes

## Testing Strategy

### Unit Testing
- Test Zod schema validation with valid/invalid data
- Test JSONL parsing with malformed input
- Test git operations error handling
- Test environment filtering logic
- Test retry mechanisms with simulated failures

### Integration Testing
- **Bash Wrapper Tests**:
  - Test claude-code-exec.sh with various prompts
  - Test timeout handling
  - Test exit code propagation
  - Test MCP config path handling

- **Workflow Tests**:
  - Test each workflow script independently
  - Verify phase sequencing
  - Test worktree creation/cleanup
  - Test status updates to Notion/Teamwork

- **Monitor Tests**:
  - Test task fetching and filtering
  - Test task delegation and subprocess spawning
  - Test concurrent task limiting
  - Test dry-run mode

### End-to-End Testing
- **Complete Prototype Generation**:
  1. Create Notion task: "Build a simple todo app {{prototype: vite_vue}}"
  2. Start Notion monitor: `bun run adws/triggers/adw_trigger_cron_notion_tasks.ts --once`
  3. Verify complete workflow execution
  4. Check generated app in `apps/` directory
  5. Verify Notion task updated with commit hash
  6. Test generated app runs correctly

- **HIL Review Cycle**:
  1. Create task with initial requirements
  2. Let system complete it
  3. Set status to "HIL Review"
  4. Add "continue - add more features"
  5. Verify system picks up continuation

### Error Scenario Testing
- Network failures during Notion/Teamwork API calls
- Claude Code CLI errors
- Git operation failures
- Invalid worktree names
- Malformed JSONL output
- Timeout scenarios
- Disk space issues

## Acceptance Criteria

1. **Complete Python Elimination**: Zero Python scripts in runtime execution path (all moved to legacy/)
2. **100% Feature Parity**: All workflows work identically to Python version
3. **Bash Wrapper Architecture**: All Claude Code calls go through bash scripts, no direct CLI invocation from Bun
4. **Performance**: Bun scripts start at least 2x faster than Python equivalents
5. **Type Safety**: All data structures have Zod schemas with TypeScript type inference
6. **Documentation**: Complete migration guide and updated README/CLAUDE.md
7. **Security**: Environment filtering maintains same security posture as Python version
8. **Monitoring**: Both Notion and Teamwork monitors run continuously without issues
9. **Testing**: All integration tests pass for both Notion and Teamwork workflows
10. **Executability**: All workflow and utility scripts are directly executable via shebang
11. **Error Handling**: Comprehensive error handling with meaningful error messages
12. **Logging**: Structured logging with appropriate verbosity levels
13. **No API Key Usage**: System uses only local Claude Code CLI (as requested)
14. **Backward Compatibility**: Existing `.claude/commands/` work without modification

## Validation Commands

Execute these commands to validate the conversion is complete and functional:

### 1. Verify Bun Installation
```bash
bun --version  # Should output Bun version 1.x+
```

### 2. Verify TypeScript Compilation
```bash
cd adws && bun build --target=bun bun_modules/agent.ts --outfile=/tmp/agent.js
# Should compile without errors
```

### 3. Verify Bash Wrappers Are Executable
```bash
test -x adws/bash/claude-code-exec.sh && echo "✓ claude-code-exec.sh is executable"
test -x adws/bash/claude-code-template.sh && echo "✓ claude-code-template.sh is executable"
```

### 4. Test Bash Wrapper Directly
```bash
./adws/bash/claude-code-exec.sh \
  "/help" \
  "sonnet" \
  "/tmp/test-output.jsonl" \
  "$(pwd)" \
  "" \
  "true"
# Should create /tmp/test-output.jsonl with Claude Code output
test -f /tmp/test-output.jsonl && echo "✓ Bash wrapper executed successfully"
```

### 5. Test Agent Module
```bash
bun run -e "import { generateShortId } from './adws/bun_modules/agent.ts'; console.log(generateShortId())"
# Should output 8-character ID
```

### 6. Test Model Validation
```bash
cat > /tmp/test-model.ts << 'EOF'
import { NotionTaskSchema } from './adws/bun_modules/models.ts';
const validTask = NotionTaskSchema.parse({
  page_id: "test-id",
  title: "Test Task",
  status: "Not started",
  content_blocks: [],
  tags: {}
});
console.log("✓ Model validation works:", validTask.title);
EOF
bun run /tmp/test-model.ts
```

### 7. Test Build Workflow Script (Dry Run)
```bash
bun run adws/adw_build_update_notion_task.ts \
  --adw-id test123 \
  --worktree-name test-worktree \
  --task "Test task" \
  --page-id fake-page-id \
  --model sonnet
# Should show workflow execution (may fail at Notion update, but structure should work)
```

### 8. Test Notion Monitor (Single Run)
```bash
bun run adws/triggers/adw_trigger_cron_notion_tasks.ts --once --dry-run
# Should fetch tasks and show what would be processed (no actual execution)
```

### 9. Test Teamwork Monitor (Single Run)
```bash
bun run adws/triggers/adw_trigger_cron_teamwork_tasks.ts --once --dry-run
# Should fetch Teamwork tasks and show delegation plan
```

### 10. Verify No Python in Runtime
```bash
# Check that workflow scripts don't call Python
! grep -r "python" adws/*.ts adws/triggers/*.ts adws/bun_modules/*.ts
echo "✓ No Python references in TypeScript code"
```

### 11. Verify Python Scripts Moved to Legacy
```bash
test -d adws/legacy_python && echo "✓ Legacy Python directory exists"
test -f adws/legacy_python/adw_modules/agent.py && echo "✓ Python files preserved in legacy"
```

### 12. End-to-End Workflow Test
```bash
# Requires actual Notion database with test task
# 1. Create test task in Notion with "execute" trigger
# 2. Run monitor once
bun run adws/triggers/adw_trigger_cron_notion_tasks.ts --once --max-tasks 1

# 3. Verify outputs
ls -la agents/*/  # Should show agent output directories
ls -la trees/     # Should show created worktree

# 4. Check logs
find agents/ -name "cc_raw_output.jsonl" -exec head -1 {} \;
```

### 13. Performance Benchmark
```bash
# Compare startup time: Python vs Bun
time python3 adws/legacy_python/adw_build_update_notion_task.py --help
time bun run adws/adw_build_update_notion_task.ts --help
# Bun should be significantly faster
```

### 14. Verify Git Operations
```bash
bun run -e "import { getCurrentCommitHash } from './adws/bun_modules/git-ops.ts'; console.log(await getCurrentCommitHash('.'))"
# Should output current commit hash
```

### 15. Full Integration Test (Requires Live Environment)
```bash
# Create a test prototype task in Notion/Teamwork
# Example: "Build a calculator app {{prototype: vite_vue}}"

# Run the monitor
bun run adws/triggers/adw_trigger_cron_notion_tasks.ts --interval 10 --max-tasks 1 &
MONITOR_PID=$!

# Wait for task to complete (check Notion for "Done" status)
# Then kill monitor
kill $MONITOR_PID

# Verify generated app
ls -la apps/calculator-app/
cd apps/calculator-app && bun run dev
# App should start successfully
```

## Notes

### Why Bun?

1. **Native TypeScript**: No compilation step, runs `.ts` files directly
2. **Performance**: 3-4x faster startup than Node.js, 10x+ faster than Python
3. **Built-in APIs**: File system, SQLite, shell operations without external dependencies
4. **Compatibility**: Drop-in Node.js replacement with better performance
5. **Developer Experience**: Fast package manager, built-in test runner, bundler

### Why Bash Wrappers for Claude Code?

1. **Subprocess Reliability**: User reported bash works best for Claude Code invocation
2. **Clean Separation**: Business logic (Bun) separate from CLI invocation (Bash)
3. **Error Handling**: Bash exit codes are simple and reliable
4. **Environment Isolation**: Bash can easily filter environment variables
5. **Debugging**: Easy to test bash scripts independently
6. **No API Key**: Ensures Claude Code CLI is used locally (as user requested)

### Zod vs Pydantic

| Feature | Pydantic (Python) | Zod (TypeScript) |
|---------|------------------|------------------|
| Runtime validation | ✅ Yes | ✅ Yes |
| Compile-time types | ❌ No | ✅ Yes (inferred) |
| Performance | Moderate | Fast |
| Type inference | Limited | Excellent |
| Ecosystem | Python-specific | JavaScript/TypeScript |

### Migration Strategy

- **Parallel Development**: Keep Python scripts working during conversion
- **Incremental Testing**: Test each converted script before moving to next
- **Preserve Legacy**: Keep Python in `legacy_python/` for reference
- **Feature Flags**: Use environment variable to toggle Python vs Bun (if needed)
- **Documentation First**: Update docs before deprecating Python

### Potential Challenges

1. **Subprocess Detachment**: Bun's `Bun.spawn` with detached mode equivalent to Python's `start_new_session=True`
2. **JSONL Streaming**: Need to handle streaming JSONL parsing carefully
3. **Environment Variables**: Ensure exact parity with Python's `get_safe_subprocess_env()`
4. **Retry Logic**: Implement exponential backoff correctly in TypeScript
5. **Git Operations**: Ensure subprocess error handling is robust
6. **Signal Handling**: SIGINT/SIGTERM for graceful monitor shutdown

### Future Enhancements (Out of Scope)

- SQLite-based task queue for better concurrency management
- Metrics dashboard using Bun's built-in SQLite
- WebSocket-based live monitoring UI
- Bun's native test runner for comprehensive test suite
- GitHub Actions CI/CD for automated testing

### Dependencies

**Runtime** (Bun only):
- Bun runtime (no npm dependencies needed for core functionality)
- Optional: `zod` for validation (can be embedded)

**Development**:
- `@types/node` - Node.js type definitions
- `bun-types` - Bun-specific type definitions
- `typescript` - TypeScript compiler (for IDE support)

**System**:
- Bash 4.0+ (for associative arrays in env filtering)
- Git 2.20+ (for worktree management)
- Claude Code CLI (locally installed, as user requested)

### Security Considerations

1. **Environment Filtering**: Maintain exact same filtering as Python version
2. **Subprocess Execution**: Use Bun.spawn with explicit argument arrays (no shell injection)
3. **Path Validation**: Sanitize worktree names and file paths
4. **JSONL Parsing**: Validate all parsed data with Zod schemas
5. **Error Messages**: Don't leak sensitive information in error outputs

### Performance Targets

- **Script Startup**: < 50ms (vs Python's 200-500ms)
- **Task Processing**: Process 3-5 tasks concurrently without blocking
- **Memory Usage**: < 100MB for monitor process
- **JSONL Parsing**: Parse 10MB JSONL file in < 100ms
- **Git Operations**: < 50ms for commit hash retrieval

### Compatibility Matrix

| Component | Python Version | Bun Version | Status |
|-----------|----------------|-------------|--------|
| Data Models | Pydantic | Zod | ✅ Equivalent |
| Agent Execution | subprocess | Bun.spawn | ✅ Equivalent |
| Environment Filtering | Python dict | Bash + TypeScript | ✅ Equivalent |
| JSONL Parsing | json.loads | JSON.parse | ✅ Equivalent |
| Git Operations | subprocess | Bun.spawn | ✅ Equivalent |
| File I/O | open() | Bun.file | ✅ Better |
| CLI Parsing | Click | Built-in/commander | ✅ Simpler |
| Retry Logic | Custom | Custom | ✅ Equivalent |

---

This plan provides a comprehensive, systematic approach to converting the entire Python codebase to Bun/TypeScript with a hybrid bash architecture, ensuring no detail is missed and delivering an impressive, production-ready solution.
