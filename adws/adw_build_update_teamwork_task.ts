#!/usr/bin/env bun
/**
 * Build and update Teamwork task workflow
 *
 * This script runs two slash commands in sequence:
 * 1. /build - Directly implements the task without planning
 * 2. /update_teamwork_task - Updates the Teamwork task with the result
 *
 * Usage:
 *   bun run adws/adw_build_update_teamwork_task.ts --adw-id abc123 --worktree-name feature --task "Fix bug" --task-id 123
 */

import { parseArgs } from "util";
import { join } from "path";
import {
  executeTemplate,
  AgentTemplateRequest,
  getCurrentCommitHash,
  logger,
  formatTimestamp,
} from "./bun_modules/agent.ts";

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "adw-id": { type: "string" },
    "worktree-name": { type: "string" },
    task: { type: "string" },
    "task-id": { type: "string" },
    model: { type: "string", default: "sonnet" },
    verbose: { type: "boolean", default: false },
  },
  strict: true,
  allowPositionals: false,
});

const adwId = values["adw-id"];
const worktreeName = values["worktree-name"];
const task = values.task;
const taskId = values["task-id"];
const model = values.model as "sonnet" | "opus";
const verbose = values.verbose;

// Validate required arguments
if (!adwId || !worktreeName || !task || !taskId) {
  console.error("Error: Missing required arguments");
  console.error("Usage: bun run adw_build_update_teamwork_task.ts --adw-id <id> --worktree-name <name> --task <desc> --task-id <id>");
  process.exit(1);
}

// Sanitize worktree name
let sanitizedWorktree = worktreeName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 20);
sanitizedWorktree = sanitizedWorktree.replace(/-+/g, "-").replace(/^-|-$/g, "");

// Calculate paths
const worktreeBasePath = join(process.cwd(), "trees", sanitizedWorktree);
const targetDirectory = "tac8_app4__agentic_prototyping";
const agentWorkingDir = join(worktreeBasePath, targetDirectory);

// Check if worktree exists
const worktreeExists = await Bun.file(worktreeBasePath).exists();

if (!worktreeExists) {
  logger.warn(`Worktree not found at: ${worktreeBasePath}`);
  logger.info("Creating worktree now...");

  const initRequest: AgentTemplateRequest = {
    agent_name: "worktree-initializer",
    slash_command: "/init_worktree",
    args: [sanitizedWorktree, targetDirectory],
    adw_id: adwId,
    model,
    working_dir: process.cwd(),
  };

  logger.info(`Creating worktree: ${sanitizedWorktree}`);
  const initResponse = await executeTemplate(initRequest);

  if (initResponse.success) {
    logger.success(`Worktree created successfully`);
  } else {
    logger.error("Failed to create worktree:");
    logger.error(initResponse.output);
    process.exit(1);
  }
}

// Print workflow configuration
console.log("\n╔═══════════════════════════════════════════════════════════╗");
console.log("║          Teamwork Build-Update Workflow                  ║");
console.log("╚═══════════════════════════════════════════════════════════╝\n");
console.log(`  ADW ID:      ${adwId}`);
console.log(`  Worktree:    ${sanitizedWorktree}`);
console.log(`  Task:        ${task}`);
console.log(`  Task ID:     ${taskId}`);
console.log(`  Model:       ${model}`);
console.log(`  Working Dir: ${agentWorkingDir}\n`);

let workflowSuccess = true;
let commitHash: string | null = null;
let errorMessage: string | null = null;

// =============================================================================
// Phase 1: Run /build command
// =============================================================================
console.log("─────────────────────────────────────────────────────────────");
console.log("Phase 1: Build (/build)");
console.log("─────────────────────────────────────────────────────────────\n");

const builderName = `builder-${sanitizedWorktree}`;
const buildRequest: AgentTemplateRequest = {
  agent_name: builderName,
  slash_command: "/build",
  args: [adwId, task],
  adw_id: adwId,
  model,
  working_dir: agentWorkingDir,
};

logger.info(`Starting build process (${adwId}@${sanitizedWorktree} • build)`);

try {
  const buildResponse = await executeTemplate(buildRequest);

  if (buildResponse.success) {
    logger.success("Build completed successfully");

    if (verbose) {
      console.log("\n" + buildResponse.output + "\n");
    }

    commitHash = await getCurrentCommitHash(agentWorkingDir);
    if (commitHash) {
      console.log(`\n  Commit hash: ${commitHash}\n`);
    }
  } else {
    workflowSuccess = false;
    errorMessage = `Build phase failed: ${buildResponse.output}`;
    logger.error("Build failed:");
    console.error(buildResponse.output);
  }

  const buildOutputDir = join(process.cwd(), "agents", adwId, builderName);
  await Bun.write(
    join(buildOutputDir, "custom_summary_output.json"),
    JSON.stringify({
      phase: "build",
      adw_id: adwId,
      worktree_name: sanitizedWorktree,
      task,
      task_id: taskId,
      slash_command: "/build",
      args: [adwId, task],
      model,
      working_dir: agentWorkingDir,
      success: buildResponse.success,
      session_id: buildResponse.session_id,
      commit_hash: commitHash,
    }, null, 2)
  );
} catch (error) {
  workflowSuccess = false;
  errorMessage = `Build phase error: ${error}`;
  logger.error(`Build phase error: ${error}`);
}

// =============================================================================
// Phase 2: Run /update_teamwork_task command
// =============================================================================
console.log("\n─────────────────────────────────────────────────────────────");
console.log("Phase 2: Update Teamwork Task (/update_teamwork_task)");
console.log("─────────────────────────────────────────────────────────────\n");

const updateStatus = workflowSuccess && commitHash ? "Complete" : "Blocked";

const updateContent = {
  status: updateStatus,
  adw_id: adwId,
  commit_hash: commitHash || "",
  error: errorMessage || "",
  timestamp: formatTimestamp(),
  model,
  workflow: "build-update",
  worktree_name: sanitizedWorktree,
};

const updaterName = `teamwork-updater-${sanitizedWorktree}`;
const updateRequest: AgentTemplateRequest = {
  agent_name: updaterName,
  slash_command: "/update_teamwork_task",
  args: [taskId, updateStatus, JSON.stringify(updateContent)],
  adw_id: adwId,
  model,
  working_dir: process.cwd(),
};

logger.info(`Updating Teamwork task to status: ${updateStatus}`);

try {
  const updateResponse = await executeTemplate(updateRequest);

  if (updateResponse.success) {
    logger.success("Teamwork task updated successfully");

    if (verbose) {
      console.log("\n" + updateResponse.output + "\n");
    }
  } else {
    logger.error("Teamwork update failed:");
    console.error(updateResponse.output);
  }

  const updateOutputDir = join(process.cwd(), "agents", adwId, updaterName);
  await Bun.write(
    join(updateOutputDir, "custom_summary_output.json"),
    JSON.stringify({
      phase: "update_teamwork_task",
      adw_id: adwId,
      worktree_name: sanitizedWorktree,
      task,
      task_id: taskId,
      slash_command: "/update_teamwork_task",
      args: [taskId, updateStatus, JSON.stringify(updateContent)],
      model,
      working_dir: process.cwd(),
      success: updateResponse.success,
      session_id: updateResponse.session_id,
      final_status: updateStatus,
    }, null, 2)
  );
} catch (error) {
  logger.error(`Update phase error: ${error}`);
}

// =============================================================================
// Workflow Summary
// =============================================================================
console.log("\n─────────────────────────────────────────────────────────────");
console.log("Workflow Summary");
console.log("─────────────────────────────────────────────────────────────\n");

console.log(`  Build:        ${workflowSuccess ? "✅ Success" : "❌ Failed"}`);
console.log(`  Update:       ℹ️  Executed`);
console.log(`  Final Status: ${workflowSuccess && commitHash ? "Complete" : "Blocked"}`);

if (commitHash) {
  console.log(`  Commit:       ${commitHash}`);
}

const workflowSummaryPath = join(process.cwd(), "agents", adwId, "workflow_summary.json");
await Bun.write(
  workflowSummaryPath,
  JSON.stringify({
    workflow: "build_update_teamwork_task",
    adw_id: adwId,
    worktree_name: sanitizedWorktree,
    task,
    task_id: taskId,
    model,
    working_dir: agentWorkingDir,
    commit_hash: commitHash,
    overall_success: workflowSuccess,
    final_task_status: workflowSuccess && commitHash ? "Complete" : "Blocked",
  }, null, 2)
);

console.log(`\n  Summary: ${workflowSummaryPath}\n`);

if (workflowSuccess) {
  logger.success("Workflow completed successfully!");
  process.exit(0);
} else {
  logger.warn("Workflow completed with errors");
  process.exit(1);
}
