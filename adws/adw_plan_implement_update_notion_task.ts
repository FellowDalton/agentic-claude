#!/usr/bin/env bun
/**
 * Plan, implement, and update Notion task workflow
 *
 * This script runs three slash commands in sequence:
 * 1. /plan_* - Generate implementation plan (routes based on prototype type)
 * 2. /implement - Execute the plan
 * 3. /update_notion_task - Update Notion page with result
 *
 * Usage:
 *   bun run adws/adw_plan_implement_update_notion_task.ts --adw-id abc123 --worktree-name app --task "Build todo app" --page-id 123abc --prototype vite_vue
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
    "page-id": { type: "string" },
    prototype: { type: "string" },
    model: { type: "string", default: "sonnet" },
    verbose: { type: "boolean", default: false },
  },
  strict: true,
  allowPositionals: false,
});

const adwId = values["adw-id"];
const worktreeName = values["worktree-name"];
const task = values.task;
const pageId = values["page-id"];
const prototype = values.prototype;
const model = values.model as "sonnet" | "opus";
const verbose = values.verbose;

// Validate required arguments
if (!adwId || !worktreeName || !task || !pageId) {
  console.error("Error: Missing required arguments");
  console.error("Usage: bun run adw_plan_implement_update_notion_task.ts --adw-id <id> --worktree-name <name> --task <desc> --page-id <id> [--prototype <type>]");
  process.exit(1);
}

// Sanitize worktree name
let sanitizedWorktree = worktreeName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 20);
sanitizedWorktree = sanitizedWorktree.replace(/-+/g, "-").replace(/^-|-$/g, "");

// Calculate paths
const worktreeBasePath = join(process.cwd(), "trees", sanitizedWorktree);
const targetDirectory = "tac8_app4__agentic_prototyping";
const agentWorkingDir = join(worktreeBasePath, targetDirectory);

// Determine plan command based on prototype type
let planCommand = "/plan";
if (prototype) {
  const validPrototypes = ["uv_script", "vite_vue", "bun_scripts", "uv_mcp"];
  if (validPrototypes.includes(prototype)) {
    planCommand = `/plan_${prototype}`;
  }
}

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
console.log("║       Notion Plan-Implement-Update Workflow              ║");
console.log("╚═══════════════════════════════════════════════════════════╝\n");
console.log(`  ADW ID:      ${adwId}`);
console.log(`  Worktree:    ${sanitizedWorktree}`);
console.log(`  Task:        ${task}`);
console.log(`  Page ID:     ${pageId}`);
console.log(`  Prototype:   ${prototype || "(none)"}`);
console.log(`  Plan Cmd:    ${planCommand}`);
console.log(`  Model:       ${model}`);
console.log(`  Working Dir: ${agentWorkingDir}\n`);

let workflowSuccess = true;
let commitHash: string | null = null;
let errorMessage: string | null = null;
let planPath: string | null = null;

// =============================================================================
// Phase 1: Run /plan_* command
// =============================================================================
console.log("─────────────────────────────────────────────────────────────");
console.log(`Phase 1: Planning (${planCommand})`);
console.log("─────────────────────────────────────────────────────────────\n");

const plannerName = `planner-${sanitizedWorktree}`;
const planRequest: AgentTemplateRequest = {
  agent_name: plannerName,
  slash_command: planCommand,
  args: [adwId, task],
  adw_id: adwId,
  model,
  working_dir: agentWorkingDir,
};

logger.info(`Starting planning process (${adwId}@${sanitizedWorktree} • plan)`);

try {
  const planResponse = await executeTemplate(planRequest);

  if (planResponse.success) {
    logger.success("Planning completed successfully");

    // Extract plan path from output (usually the last line)
    const lines = planResponse.output.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    if (lastLine && (lastLine.includes("specs/") || lastLine.includes("plan-"))) {
      planPath = lastLine.trim();
      logger.info(`Plan created: ${planPath}`);
    }

    if (verbose) {
      console.log("\n" + planResponse.output + "\n");
    }
  } else {
    workflowSuccess = false;
    errorMessage = `Planning phase failed: ${planResponse.output}`;
    logger.error("Planning failed:");
    console.error(planResponse.output);
  }

  const planOutputDir = join(process.cwd(), "agents", adwId, plannerName);
  await Bun.write(
    join(planOutputDir, "custom_summary_output.json"),
    JSON.stringify({
      phase: "plan",
      adw_id: adwId,
      worktree_name: sanitizedWorktree,
      task,
      page_id: pageId,
      slash_command: planCommand,
      args: [adwId, task],
      model,
      working_dir: agentWorkingDir,
      success: planResponse.success,
      session_id: planResponse.session_id,
      plan_path: planPath,
    }, null, 2)
  );
} catch (error) {
  workflowSuccess = false;
  errorMessage = `Planning phase error: ${error}`;
  logger.error(`Planning phase error: ${error}`);
}

// =============================================================================
// Phase 2: Run /implement command (if planning succeeded)
// =============================================================================
if (workflowSuccess && planPath) {
  console.log("\n─────────────────────────────────────────────────────────────");
  console.log("Phase 2: Implementation (/implement)");
  console.log("─────────────────────────────────────────────────────────────\n");

  const implementerName = `implementer-${sanitizedWorktree}`;
  const implementRequest: AgentTemplateRequest = {
    agent_name: implementerName,
    slash_command: "/implement",
    args: [planPath],
    adw_id: adwId,
    model,
    working_dir: agentWorkingDir,
  };

  logger.info(`Starting implementation (${adwId}@${sanitizedWorktree} • implement)`);

  try {
    const implementResponse = await executeTemplate(implementRequest);

    if (implementResponse.success) {
      logger.success("Implementation completed successfully");

      if (verbose) {
        console.log("\n" + implementResponse.output + "\n");
      }

      commitHash = await getCurrentCommitHash(agentWorkingDir);
      if (commitHash) {
        console.log(`\n  Commit hash: ${commitHash}\n`);
      }
    } else {
      workflowSuccess = false;
      errorMessage = `Implementation phase failed: ${implementResponse.output}`;
      logger.error("Implementation failed:");
      console.error(implementResponse.output);
    }

    const implementOutputDir = join(process.cwd(), "agents", adwId, implementerName);
    await Bun.write(
      join(implementOutputDir, "custom_summary_output.json"),
      JSON.stringify({
        phase: "implement",
        adw_id: adwId,
        worktree_name: sanitizedWorktree,
        task,
        page_id: pageId,
        slash_command: "/implement",
        args: [planPath],
        model,
        working_dir: agentWorkingDir,
        success: implementResponse.success,
        session_id: implementResponse.session_id,
        commit_hash: commitHash,
      }, null, 2)
    );
  } catch (error) {
    workflowSuccess = false;
    errorMessage = `Implementation phase error: ${error}`;
    logger.error(`Implementation phase error: ${error}`);
  }
} else if (!workflowSuccess) {
  logger.warn("Skipping implementation due to planning failure");
} else if (!planPath) {
  logger.warn("Skipping implementation: no plan path found");
  workflowSuccess = false;
  errorMessage = "Planning completed but no plan path was returned";
}

// =============================================================================
// Phase 3: Run /update_notion_task command
// =============================================================================
console.log("\n─────────────────────────────────────────────────────────────");
console.log("Phase 3: Update Notion Task (/update_notion_task)");
console.log("─────────────────────────────────────────────────────────────\n");

const updateStatus = workflowSuccess && commitHash ? "Done" : "Failed";

const updateContent = {
  status: updateStatus,
  adw_id: adwId,
  commit_hash: commitHash || "",
  error: errorMessage || "",
  timestamp: formatTimestamp(),
  model,
  workflow: "plan-implement-update",
  worktree_name: sanitizedWorktree,
  plan_path: planPath || "",
};

const updaterName = `notion-updater-${sanitizedWorktree}`;
const updateRequest: AgentTemplateRequest = {
  agent_name: updaterName,
  slash_command: "/update_notion_task",
  args: [pageId, updateStatus, JSON.stringify(updateContent)],
  adw_id: adwId,
  model,
  working_dir: process.cwd(),
};

logger.info(`Updating Notion task to status: ${updateStatus}`);

try {
  const updateResponse = await executeTemplate(updateRequest);

  if (updateResponse.success) {
    logger.success("Notion task updated successfully");

    if (verbose) {
      console.log("\n" + updateResponse.output + "\n");
    }
  } else {
    logger.error("Notion update failed:");
    console.error(updateResponse.output);
  }

  const updateOutputDir = join(process.cwd(), "agents", adwId, updaterName);
  await Bun.write(
    join(updateOutputDir, "custom_summary_output.json"),
    JSON.stringify({
      phase: "update_notion_task",
      adw_id: adwId,
      worktree_name: sanitizedWorktree,
      task,
      page_id: pageId,
      slash_command: "/update_notion_task",
      args: [pageId, updateStatus, JSON.stringify(updateContent)],
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

console.log(`  Plan:         ${planPath ? "✅ Created" : "❌ Failed"}`);
console.log(`  Implement:    ${workflowSuccess ? "✅ Success" : "❌ Failed"}`);
console.log(`  Update:       ℹ️  Executed`);
console.log(`  Final Status: ${workflowSuccess && commitHash ? "Done" : "Failed"}`);

if (commitHash) {
  console.log(`  Commit:       ${commitHash}`);
}

if (planPath) {
  console.log(`  Plan File:    ${planPath}`);
}

const workflowSummaryPath = join(process.cwd(), "agents", adwId, "workflow_summary.json");
await Bun.write(
  workflowSummaryPath,
  JSON.stringify({
    workflow: "plan_implement_update_notion_task",
    adw_id: adwId,
    worktree_name: sanitizedWorktree,
    task,
    page_id: pageId,
    prototype,
    plan_command: planCommand,
    plan_path: planPath,
    model,
    working_dir: agentWorkingDir,
    commit_hash: commitHash,
    overall_success: workflowSuccess,
    final_task_status: workflowSuccess && commitHash ? "Done" : "Failed",
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
