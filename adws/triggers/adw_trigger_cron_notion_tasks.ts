#!/usr/bin/env bun
/**
 * Notion Task Monitor - Continuous polling for agent-ready tasks
 *
 * Monitors a Notion database for tasks with execution triggers and delegates them
 * to appropriate workflow scripts. Runs continuously with configurable polling interval.
 *
 * Usage:
 *   bun run adws/triggers/adw_trigger_cron_notion_tasks.ts [--once] [--dry-run] [--interval 15] [--max-tasks 3] [--database-id <id>]
 */

import { parseArgs } from "util";
import { join } from "path";
import {
  executeTemplate,
  AgentTemplateRequest,
  NotionTask,
  NotionTaskSchema,
  NotionTaskHelpers,
  makeAdwId,
  logger,
  parseJSON,
  sleep,
} from "../bun_modules/agent.ts";

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    once: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    interval: { type: "string", default: "15" },
    "max-tasks": { type: "string", default: "3" },
    "database-id": { type: "string" },
  },
  strict: true,
  allowPositionals: false,
});

const runOnce = values.once;
const dryRun = values["dry-run"];
const pollingInterval = parseInt(values.interval ?? "15", 10);
const maxTasks = parseInt(values["max-tasks"] ?? "3", 10);

// Get Notion database ID from CLI or environment
const databaseId = values["database-id"] || process.env["NOTION_AGENTIC_TASK_TABLE_ID"];
if (!databaseId) {
  logger.error("Error: Database ID not provided");
  logger.error("Use --database-id <id> or set NOTION_AGENTIC_TASK_TABLE_ID environment variable");
  process.exit(1);
}

logger.info("Notion Task Monitor starting...");
logger.info(`  Database ID: ${databaseId}`);
logger.info(`  Polling Interval: ${pollingInterval}s`);
logger.info(`  Max Concurrent Tasks: ${maxTasks}`);
logger.info(`  Dry Run: ${dryRun ? "Yes" : "No"}`);
logger.info(`  Run Once: ${runOnce ? "Yes" : "No"}\n`);

// Track active ADW IDs to prevent duplicates
const activeAdwIds = new Set<string>();

/**
 * Fetch eligible tasks from Notion
 */
async function getEligibleTasks(): Promise<NotionTask[]> {
  logger.info("Fetching tasks from Notion...");

  const request: AgentTemplateRequest = {
    agent_name: "notion-task-fetcher",
    slash_command: "/get_notion_tasks",
    args: [databaseId, JSON.stringify(["Not started", "HIL Review"]), "10"],
    adw_id: makeAdwId(),
    model: "sonnet",
    working_dir: process.cwd(),
  };

  try {
    const response = await executeTemplate(request);

    if (!response.success) {
      logger.error(`Failed to fetch Notion tasks: ${response.output}`);
      return [];
    }

    // Parse JSON response
    const taskData = parseJSON(response.output, undefined);
    if (!Array.isArray(taskData) || taskData.length === 0) {
      logger.info("No tasks returned from Notion");
      return [];
    }

    // Convert to NotionTask objects
    const tasks: NotionTask[] = [];
    for (const taskDict of taskData) {
      try {
        const notionTask = NotionTaskSchema.parse(taskDict);

        if (NotionTaskHelpers.isEligibleForProcessing(notionTask)) {
          tasks.push(notionTask);
          logger.info(`Found eligible task: ${notionTask.page_id} - ${notionTask.title}`);
        }
      } catch (error) {
        logger.error(`Failed to parse task: ${error}`);
      }
    }

    return tasks;
  } catch (error) {
    logger.error(`Exception while fetching tasks: ${error}`);
    return [];
  }
}

/**
 * Update Notion task status
 */
async function updateTaskStatus(
  pageId: string,
  status: string,
  updateContent: string
): Promise<boolean> {
  logger.info(`Updating task ${pageId} to status: ${status}`);

  const request: AgentTemplateRequest = {
    agent_name: "notion-task-updater",
    slash_command: "/update_notion_task",
    args: [pageId, status, updateContent],
    adw_id: makeAdwId(),
    model: "sonnet",
    working_dir: process.cwd(),
  };

  try {
    const response = await executeTemplate(request);

    if (response.success) {
      logger.success(`Successfully updated task ${pageId} to ${status}`);
      return true;
    } else {
      logger.error(`Failed to update task ${pageId}: ${response.output}`);
      return false;
    }
  } catch (error) {
    logger.error(`Exception while updating task ${pageId}: ${error}`);
    return false;
  }
}

/**
 * Generate worktree name from task description
 */
function generateWorktreeName(task: NotionTask): string {
  const suggested = task.worktree || task.tags["worktree"];
  if (suggested) {
    return suggested.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 20);
  }

  // Generate from title
  const base = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 15);

  const random = Math.random().toString(36).substring(2, 7);
  return `${base}-${random}`.replace(/^-|-$/g, "");
}

/**
 * Determine workflow type based on task attributes
 */
function determineWorkflow(task: NotionTask): "build" | "plan-implement" {
  // Check for prototype tag
  if (task.prototype || task.tags["prototype"]) {
    return "plan-implement";
  }

  // Check for workflow tag
  if (task.workflow_type === "plan" || task.tags["workflow"] === "plan") {
    return "plan-implement";
  }

  // Check task length
  if ((task.task_prompt?.length ?? 0) > 500) {
    return "plan-implement";
  }

  return "build";
}

/**
 * Delegate task to appropriate workflow script
 */
async function delegateTask(task: NotionTask): Promise<void> {
  // Generate ADW ID
  const adwId = makeAdwId();

  // Check for duplicates
  if (activeAdwIds.has(adwId)) {
    logger.warn(`Duplicate ADW ID detected: ${adwId}, regenerating...`);
    return delegateTask(task);
  }

  activeAdwIds.add(adwId);

  // Get model preference
  const model = NotionTaskHelpers.getPreferredModel(task);

  // Get worktree name
  const worktreeName = generateWorktreeName(task);

  // Get task prompt
  const taskPrompt = task.task_prompt || task.title;

  // Determine workflow
  const workflow = determineWorkflow(task);

  logger.info(`Delegating task ${task.page_id} with ADW ID ${adwId}`);
  logger.info(`  Model: ${model}`);
  logger.info(`  Worktree: ${worktreeName}`);
  logger.info(`  Workflow: ${workflow}`);

  // Claim task immediately
  const updateMetadata = {
    adw_id: adwId,
    timestamp: new Date().toISOString(),
    model,
    worktree_name: worktreeName,
    status: "In progress",
  };

  if (dryRun) {
    logger.info("[DRY RUN] Would claim task and spawn workflow");
    return;
  }

  const claimed = await updateTaskStatus(
    task.page_id,
    "In progress",
    JSON.stringify(updateMetadata)
  );

  if (!claimed) {
    logger.error(`Failed to claim task ${task.page_id}`);
    activeAdwIds.delete(adwId);
    return;
  }

  // Spawn workflow subprocess (detached)
  const workflowScript =
    workflow === "build"
      ? "adw_build_update_notion_task.ts"
      : "adw_plan_implement_update_notion_task.ts";

  const args = [
    "run",
    join(process.cwd(), "adws", workflowScript),
    "--adw-id",
    adwId,
    "--worktree-name",
    worktreeName,
    "--task",
    taskPrompt,
    "--page-id",
    task.page_id,
    "--model",
    model,
  ];

  // Add prototype flag if applicable
  if (workflow === "plan-implement" && (task.prototype || task.tags["prototype"])) {
    const prototypeType = task.prototype || task.tags["prototype"];
    args.push("--prototype", prototypeType);
  }

  logger.info(`Spawning workflow: bun ${args.join(" ")}`);

  // Spawn detached process
  const proc = Bun.spawn(args, {
    stdout: "ignore",
    stderr: "ignore",
    stdin: "ignore",
    detached: true,
    cwd: process.cwd(),
  });

  // Unref so parent can exit
  proc.unref();

  logger.success(`Task ${task.page_id} delegated successfully (PID: ${proc.pid})`);
}

/**
 * Process one batch of tasks
 */
async function processTasks(): Promise<void> {
  logger.info("Starting task processing cycle...");

  const tasks = await getEligibleTasks();

  if (tasks.length === 0) {
    logger.info("No eligible tasks found\n");
    return;
  }

  logger.info(`Found ${tasks.length} eligible task(s)`);

  // Limit to max concurrent tasks
  const tasksToProcess = tasks.slice(0, maxTasks);

  if (tasksToProcess.length < tasks.length) {
    logger.warn(`Limiting to ${maxTasks} tasks (found ${tasks.length})`);
  }

  // Delegate all tasks
  for (const task of tasksToProcess) {
    await delegateTask(task);
    // Small delay between delegations
    await sleep(500);
  }

  logger.info(`Processed ${tasksToProcess.length} task(s)\n`);
}

/**
 * Main monitoring loop
 */
async function monitor(): Promise<void> {
  let running = true;

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    logger.info("\nReceived SIGINT, shutting down gracefully...");
    running = false;
  });

  process.on("SIGTERM", () => {
    logger.info("\nReceived SIGTERM, shutting down gracefully...");
    running = false;
  });

  if (runOnce) {
    await processTasks();
    logger.info("Single run complete. Exiting.");
    return;
  }

  logger.info("Entering continuous monitoring mode...\n");

  while (running) {
    try {
      await processTasks();
    } catch (error) {
      logger.error(`Error during task processing: ${error}`);
    }

    if (!running) break;

    // Wait for next polling interval
    logger.info(`Waiting ${pollingInterval} seconds until next poll...\n`);
    for (let i = 0; i < pollingInterval && running; i++) {
      await sleep(1000);
    }
  }

  logger.info("Monitor stopped.");
}

// Start the monitor
await monitor();
