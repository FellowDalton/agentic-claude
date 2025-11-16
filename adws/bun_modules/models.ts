/**
 * Data models for the multi-agent rapid prototyping system.
 *
 * Converted from Python/Pydantic to TypeScript/Zod for runtime validation
 * with compile-time type safety.
 */

import { z } from "zod";

// ============================================================================
// Enums and Constants
// ============================================================================

export const RetryCode = {
  NONE: "none",
  CLAUDE_CODE_ERROR: "claude_code_error",
  TIMEOUT_ERROR: "timeout_error",
  EXECUTION_ERROR: "execution_error",
  ERROR_DURING_EXECUTION: "error_during_execution",
} as const;

export type RetryCodeType = typeof RetryCode[keyof typeof RetryCode];

export const ModelType = {
  SONNET: "sonnet",
  OPUS: "opus",
} as const;

export type ModelTypeValue = typeof ModelType[keyof typeof ModelType];

// ============================================================================
// Agent Execution Models
// ============================================================================

/**
 * Claude Code agent prompt configuration
 */
export const AgentPromptRequestSchema = z.object({
  prompt: z.string(),
  adw_id: z.string(),
  agent_name: z.string().default("ops"),
  model: z.enum(["sonnet", "opus"]).default("sonnet"),
  dangerously_skip_permissions: z.boolean().default(false),
  output_file: z.string(),
  working_dir: z.string().optional(),
});

export type AgentPromptRequest = z.infer<typeof AgentPromptRequestSchema>;

/**
 * Claude Code agent response
 */
export const AgentPromptResponseSchema = z.object({
  output: z.string(),
  success: z.boolean(),
  session_id: z.string().optional(),
  retry_code: z.enum([
    RetryCode.NONE,
    RetryCode.CLAUDE_CODE_ERROR,
    RetryCode.TIMEOUT_ERROR,
    RetryCode.EXECUTION_ERROR,
    RetryCode.ERROR_DURING_EXECUTION,
  ]).default(RetryCode.NONE),
});

export type AgentPromptResponse = z.infer<typeof AgentPromptResponseSchema>;

/**
 * Claude Code agent template execution request (slash commands)
 */
export const AgentTemplateRequestSchema = z.object({
  agent_name: z.string(),
  slash_command: z.string(),
  args: z.array(z.string()),
  adw_id: z.string(),
  model: z.enum(["sonnet", "opus"]).default("sonnet"),
  working_dir: z.string().optional(),
});

export type AgentTemplateRequest = z.infer<typeof AgentTemplateRequestSchema>;

/**
 * Claude Code JSONL result message (last line of output)
 */
export const ClaudeCodeResultMessageSchema = z.object({
  type: z.string(),
  subtype: z.string(),
  is_error: z.boolean(),
  duration_ms: z.number(),
  duration_api_ms: z.number(),
  num_turns: z.number(),
  result: z.string(),
  session_id: z.string(),
  total_cost_usd: z.number(),
});

export type ClaudeCodeResultMessage = z.infer<typeof ClaudeCodeResultMessageSchema>;

// ============================================================================
// Notion Task Models
// ============================================================================

/**
 * Represents a task from the Notion database
 */
export const NotionTaskSchema = z.object({
  page_id: z.string(),
  title: z.string(),
  status: z.enum(["Not started", "In progress", "Done", "HIL Review", "Failed"]),
  content_blocks: z.array(z.record(z.any())).default([]),
  tags: z.record(z.string()).default({}),
  worktree: z.string().optional(),
  model: z.string().optional(),
  workflow_type: z.string().optional(),
  prototype: z.string().optional(),
  last_block_type: z.string().optional(),
  execution_trigger: z.string().optional(),
  task_prompt: z.string().optional(),
  assigned_to: z.string().optional(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
});

export type NotionTask = z.infer<typeof NotionTaskSchema>;

/**
 * Helper functions for NotionTask
 */
export const NotionTaskHelpers = {
  isEligibleForProcessing(task: NotionTask): boolean {
    return (
      (task.status === "Not started" || task.status === "HIL Review") &&
      (task.execution_trigger === "execute" || task.execution_trigger === "continue")
    );
  },

  extractAppContext(task: NotionTask): string | undefined {
    return task.tags["app"];
  },

  getPreferredModel(task: NotionTask): ModelTypeValue {
    const model = task.model || task.tags["model"] || "sonnet";
    return model === "opus" || model === "sonnet" ? model : "sonnet";
  },

  shouldUseFullWorkflow(task: NotionTask): boolean {
    return (
      task.workflow_type === "plan" ||
      task.tags["workflow"] === "plan" ||
      (task.task_prompt?.length ?? 0) > 500
    );
  },
};

/**
 * Update payload for Notion task progress
 */
export const NotionTaskUpdateSchema = z.object({
  page_id: z.string(),
  status: z.enum(["Not started", "In progress", "Done", "HIL Review", "Failed"]).optional(),
  content_blocks: z.array(z.record(z.any())).default([]),
  agent_output: z.string().optional(),
  update_type: z.enum(["status", "content", "progress", "completion", "error"]),
  adw_id: z.string().optional(),
  agent_name: z.string().optional(),
  session_id: z.string().optional(),
  commit_hash: z.string().optional(),
  error_message: z.string().optional(),
});

export type NotionTaskUpdate = z.infer<typeof NotionTaskUpdateSchema>;

// ============================================================================
// Teamwork Task Models
// ============================================================================

/**
 * Represents a task from Teamwork
 */
export const TeamworkTaskSchema = z.object({
  task_id: z.string(),
  project_id: z.string(),
  title: z.string(),
  status: z.string(),
  description: z.string().default(""),
  tags: z.record(z.string()).default({}),
  worktree: z.string().optional(),
  model: z.string().optional(),
  workflow_type: z.string().optional(),
  prototype: z.string().optional(),
  execution_trigger: z.string().optional(),
  task_prompt: z.string().optional(),
  assigned_to: z.string().optional(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.string().optional(),
  estimated_minutes: z.number().optional(),
});

export type TeamworkTask = z.infer<typeof TeamworkTaskSchema>;

/**
 * Helper functions for TeamworkTask
 */
export const TeamworkTaskHelpers = {
  isEligibleForProcessing(task: TeamworkTask): boolean {
    const eligibleStatuses = ["New", "To Do", "Review"];
    return (
      eligibleStatuses.includes(task.status) &&
      (task.execution_trigger === "execute" || task.execution_trigger === "continue")
    );
  },

  extractTagsFromDescription(description: string): Record<string, string> {
    const pattern = /\{\{(\w+):\s*([^}]+)\}\}/g;
    const tags: Record<string, string> = {};
    let match;
    while ((match = pattern.exec(description)) !== null) {
      if (match[1] && match[2]) {
        tags[match[1]] = match[2].trim();
      }
    }
    return tags;
  },

  getTaskPromptForAgent(task: TeamworkTask): string {
    if (task.execution_trigger === "continue") {
      return task.task_prompt || "";
    } else {
      let desc = task.description;
      // Remove inline tags
      desc = desc.replace(/\{\{[^}]+\}\}/g, "");
      // Remove execute trigger
      desc = desc.replace("execute", "");
      return desc.trim();
    }
  },

  extractAppContext(task: TeamworkTask): string | undefined {
    return task.tags["app"];
  },

  getPreferredModel(task: TeamworkTask): ModelTypeValue {
    const model = task.model || task.tags["model"] || "sonnet";
    return model === "opus" || model === "sonnet" ? model : "sonnet";
  },

  shouldUseFullWorkflow(task: TeamworkTask): boolean {
    return (
      task.workflow_type === "plan" ||
      task.tags["workflow"] === "plan" ||
      (task.task_prompt?.length ?? 0) > 500
    );
  },
};

/**
 * Update payload for Teamwork task status and comments
 */
export const TeamworkTaskUpdateSchema = z.object({
  task_id: z.string(),
  status: z.string().optional(),
  comment_body: z.string().optional(),
  update_type: z.enum(["status", "comment", "progress", "completion", "error"]),
  adw_id: z.string().optional(),
  agent_name: z.string().optional(),
  session_id: z.string().optional(),
  commit_hash: z.string().optional(),
  error_message: z.string().optional(),
});

export type TeamworkTaskUpdate = z.infer<typeof TeamworkTaskUpdateSchema>;

/**
 * Format Teamwork update as markdown comment
 */
export function formatTeamworkComment(update: TeamworkTaskUpdate): string {
  const emojiMap: Record<string, string> = {
    "In Progress": "🔄",
    "Complete": "✅",
    "Failed": "❌",
    "Review": "👁️",
    "Blocked": "🚫",
  };

  const emoji = (update.status ? emojiMap[update.status] : undefined) ?? "ℹ️";
  const timestamp = new Date().toISOString();

  const lines = [
    `${emoji} **Status Update: ${update.status}**`,
    `- **ADW ID**: ${update.adw_id || 'N/A'}`,
    `- **Timestamp**: ${timestamp}`,
  ];

  if (update.commit_hash) {
    lines.push(`- **Commit Hash**: ${update.commit_hash}`);
  }

  if (update.agent_name) {
    lines.push(`- **Agent**: ${update.agent_name}`);
  }

  lines.push("");
  lines.push("---");

  if (update.error_message) {
    lines.push(`**Error**: ${update.error_message}`);
  } else if (update.comment_body) {
    lines.push(update.comment_body);
  }

  return lines.join("\n");
}

// ============================================================================
// Workflow State Models
// ============================================================================

/**
 * Tracks the state of a Notion-based workflow execution
 */
export const NotionWorkflowStateSchema = z.object({
  adw_id: z.string(),
  page_id: z.string(),
  worktree_name: z.string(),
  task_description: z.string(),
  workflow_type: z.enum(["build_update", "plan_implement_update"]),
  phase: z.enum(["starting", "planning", "implementing", "updating", "completed", "failed"]),
  model: z.string(),
  started_at: z.string().default(() => new Date().toISOString()),
  completed_at: z.string().optional(),
  plan_path: z.string().optional(),
  commit_hash: z.string().optional(),
  error: z.string().optional(),
  notion_updates_count: z.number().default(0),
});

export type NotionWorkflowState = z.infer<typeof NotionWorkflowStateSchema>;

/**
 * Tracks the state of a Teamwork-based workflow execution
 */
export const TeamworkWorkflowStateSchema = z.object({
  adw_id: z.string(),
  task_id: z.string(),
  project_id: z.string(),
  worktree_name: z.string(),
  task_description: z.string(),
  workflow_type: z.enum(["build_update", "plan_implement_update"]),
  phase: z.enum(["starting", "planning", "implementing", "updating", "completed", "failed"]),
  model: z.string(),
  started_at: z.string().default(() => new Date().toISOString()),
  completed_at: z.string().optional(),
  plan_path: z.string().optional(),
  commit_hash: z.string().optional(),
  error: z.string().optional(),
  teamwork_updates_count: z.number().default(0),
});

export type TeamworkWorkflowState = z.infer<typeof TeamworkWorkflowStateSchema>;

/**
 * Helper to mark workflow as completed
 */
export function markWorkflowCompleted(
  state: NotionWorkflowState | TeamworkWorkflowState,
  success: boolean = true,
  error?: string,
  commit_hash?: string
): NotionWorkflowState | TeamworkWorkflowState {
  return {
    ...state,
    completed_at: new Date().toISOString(),
    phase: success ? "completed" : "failed",
    error: error || state.error,
    commit_hash: commit_hash || state.commit_hash,
  };
}

/**
 * Get workflow duration in seconds
 */
export function getWorkflowDuration(
  state: NotionWorkflowState | TeamworkWorkflowState
): number | null {
  if (!state.completed_at) {
    return null;
  }
  const started = new Date(state.started_at).getTime();
  const completed = new Date(state.completed_at).getTime();
  return (completed - started) / 1000;
}

// ============================================================================
// Configuration Models
// ============================================================================

/**
 * Configuration for Notion-based cron trigger
 */
export const NotionCronConfigSchema = z.object({
  database_id: z.string(),
  polling_interval: z.number().min(5).default(15),
  max_concurrent_tasks: z.number().min(1).max(10).default(3),
  default_model: z.enum(["opus", "sonnet"]).default("sonnet"),
  apps_directory: z.string().default("apps"),
  worktree_base_path: z.string().default("trees"),
  dry_run: z.boolean().default(false),
  status_filter: z.array(z.string()).default(["Not started", "HIL Review"]),
  enable_hil_review: z.boolean().default(true),
});

export type NotionCronConfig = z.infer<typeof NotionCronConfigSchema>;

/**
 * Configuration for Teamwork task monitoring cron job
 */
export const TeamworkCronConfigSchema = z.object({
  project_id: z.string(),
  polling_interval: z.number().min(5).default(15),
  max_concurrent_tasks: z.number().min(1).max(10).default(3),
  default_model: z.enum(["opus", "sonnet"]).default("sonnet"),
  apps_directory: z.string().default("apps"),
  worktree_base_path: z.string().default("trees"),
  dry_run: z.boolean().default(false),
  status_mapping: z.record(z.string()).default({
    "Not started": "New",
    "In progress": "In Progress",
    "Done": "Complete",
    "HIL Review": "Review",
    "Failed": "Blocked",
  }),
  status_filter: z.array(z.string()).default(["New", "To Do", "Review"]),
  enable_hil_review: z.boolean().default(true),
});

export type TeamworkCronConfig = z.infer<typeof TeamworkCronConfigSchema>;

/**
 * Map status from system to Teamwork
 */
export function mapStatusToTeamwork(
  config: TeamworkCronConfig,
  systemStatus: string
): string {
  return config.status_mapping[systemStatus] || systemStatus;
}

/**
 * Map status from Teamwork to system
 */
export function mapStatusFromTeamwork(
  config: TeamworkCronConfig,
  teamworkStatus: string
): string {
  const reverseMapping = Object.fromEntries(
    Object.entries(config.status_mapping).map(([k, v]) => [v, k])
  );
  return reverseMapping[teamworkStatus] || teamworkStatus;
}

/**
 * Request for automatic worktree creation
 */
export const WorktreeCreationRequestSchema = z.object({
  task_description: z.string(),
  suggested_name: z.string().optional(),
  base_branch: z.string().default("main"),
  app_context: z.string().optional(),
  prefix: z.string().optional(),
});

export type WorktreeCreationRequest = z.infer<typeof WorktreeCreationRequestSchema>;

/**
 * Generate arguments for /make_worktree_name command
 */
export function generateWorktreeNameArgs(request: WorktreeCreationRequest): string[] {
  return [
    request.task_description,
    request.app_context || "",
    request.prefix || "",
  ];
}

// ============================================================================
// Metrics Models
// ============================================================================

/**
 * Metrics for monitoring Notion agent performance
 */
export const NotionAgentMetricsSchema = z.object({
  tasks_processed: z.number().default(0),
  tasks_completed: z.number().default(0),
  tasks_failed: z.number().default(0),
  average_processing_time: z.number().default(0.0),
  notion_api_calls: z.number().default(0),
  notion_api_errors: z.number().default(0),
  worktrees_created: z.number().default(0),
  last_reset: z.string().default(() => new Date().toISOString()),
});

export type NotionAgentMetrics = z.infer<typeof NotionAgentMetricsSchema>;

/**
 * Calculate success rate for metrics
 */
export function calculateSuccessRate(metrics: NotionAgentMetrics | TeamworkAgentMetrics): number {
  const total = metrics.tasks_processed;
  return total > 0 ? (metrics.tasks_completed / total) * 100 : 0.0;
}

/**
 * Metrics for monitoring Teamwork agent performance
 */
export const TeamworkAgentMetricsSchema = z.object({
  tasks_processed: z.number().default(0),
  tasks_completed: z.number().default(0),
  tasks_failed: z.number().default(0),
  average_processing_time: z.number().default(0.0),
  teamwork_api_calls: z.number().default(0),
  teamwork_api_errors: z.number().default(0),
  worktrees_created: z.number().default(0),
  last_reset: z.string().default(() => new Date().toISOString()),
});

export type TeamworkAgentMetrics = z.infer<typeof TeamworkAgentMetricsSchema>;
