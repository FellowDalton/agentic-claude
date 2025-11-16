/**
 * Agent execution framework for Claude Code
 * Main module that coordinates agent execution
 */

export * from "./models.ts";
export * from "./utils.ts";
export * from "./git-ops.ts";
export { executeTemplate, executeClaudeCode, executeClaudeCodeWithRetry } from "./claude-executor.ts";

// Re-export commonly used items for convenience
export { makeAdwId as generateShortId } from "./utils.ts";
