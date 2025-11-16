/**
 * Utility functions for the ADW system
 */

import { z } from "zod";

/**
 * Generate a short 8-character UUID for ADW tracking
 */
export function makeAdwId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Parse JSON that may be wrapped in markdown code blocks
 *
 * Handles various formats:
 * - Raw JSON
 * - JSON wrapped in ```json ... ```
 * - JSON wrapped in ``` ... ```
 * - JSON with extra whitespace or newlines
 *
 * @param text String containing JSON, possibly wrapped in markdown
 * @param schema Optional Zod schema to validate the result
 * @returns Parsed and optionally validated JSON
 * @throws Error if JSON cannot be parsed or validated
 */
export function parseJSON<T>(text: string, schema?: z.ZodType<T>): T | any {
  // Try to extract JSON from markdown code blocks
  // Pattern matches ```json\n...\n``` or ```\n...\n```
  const codeBlockPattern = /```(?:json)?\s*\n(.*?)\n```/s;
  const match = text.match(codeBlockPattern);

  let jsonStr: string;
  if (match && match[1]) {
    jsonStr = match[1].trim();
  } else {
    // No code block found, try to parse the entire text
    jsonStr = text.trim();
  }

  // Try to find JSON array or object boundaries if not already clean
  if (!jsonStr.startsWith("[") && !jsonStr.startsWith("{")) {
    // Look for JSON array
    const arrayStart = jsonStr.indexOf("[");
    const arrayEnd = jsonStr.lastIndexOf("]");

    // Look for JSON object
    const objStart = jsonStr.indexOf("{");
    const objEnd = jsonStr.lastIndexOf("}");

    // Determine which comes first and extract accordingly
    if (arrayStart !== -1 && (objStart === -1 || arrayStart < objStart)) {
      if (arrayEnd !== -1) {
        jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1);
      }
    } else if (objStart !== -1) {
      if (objEnd !== -1) {
        jsonStr = jsonStr.slice(objStart, objEnd + 1);
      }
    }
  }

  try {
    const result = JSON.parse(jsonStr);

    // If schema is provided, validate
    if (schema) {
      return schema.parse(result);
    }

    return result;
  } catch (error) {
    const preview = jsonStr.slice(0, 200);
    throw new Error(`Failed to parse JSON: ${error}. Text was: ${preview}...`);
  }
}

/**
 * Check that all required environment variables are set
 *
 * @throws Error if required environment variables are missing
 */
export function checkEnvVars(): void {
  const requiredVars = ["ANTHROPIC_API_KEY"];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    const errorMsg = "Error: Missing required environment variables:\n" +
      missingVars.map((v) => `  - ${v}`).join("\n");
    throw new Error(errorMsg);
  }
}

/**
 * Format a status message for agent operations
 *
 * @param action The action being performed
 * @param adwId The ADW ID for tracking
 * @param worktree The worktree/branch name
 * @param phase Optional phase name
 * @returns Formatted status message
 */
export function formatAgentStatus(
  action: string,
  adwId: string,
  worktree: string,
  phase?: string
): string {
  // Format the ADW ID (first 6 chars for brevity)
  const shortId = adwId.length > 6 ? adwId.slice(0, 6) : adwId;

  // Build the status components
  let statusMsg = `${action} (${shortId}@${worktree}`;

  if (phase) {
    statusMsg += ` • ${phase}`;
  }

  statusMsg += ")";

  return statusMsg;
}

/**
 * Format a status message specifically for worktree operations
 *
 * @param action The action being performed
 * @param worktree The worktree name
 * @param adwId Optional ADW ID for tracking
 * @returns Formatted status message
 */
export function formatWorktreeStatus(
  action: string,
  worktree: string,
  adwId?: string
): string {
  let baseMsg = `${action} worktree '${worktree}'`;

  if (adwId) {
    const shortId = adwId.length > 6 ? adwId.slice(0, 6) : adwId;
    baseMsg += ` (${shortId})`;
  }

  return baseMsg;
}

/**
 * Get filtered environment variables safe for subprocess execution
 *
 * Returns only the environment variables needed for ADW workflows.
 * This prevents accidental exposure of sensitive credentials to subprocesses.
 *
 * @returns Record containing only required environment variables
 */
export function getSafeSubprocessEnv(): Record<string, string> {
  const env = process.env;
  const safeEnvVars: Record<string, string | undefined> = {
    // Anthropic Configuration (required)
    ANTHROPIC_API_KEY: env["ANTHROPIC_API_KEY"],

    // GitHub Configuration (optional)
    GITHUB_PAT: env["GITHUB_PAT"],

    // Claude Code Configuration
    CLAUDE_CODE_PATH: env["CLAUDE_CODE_PATH"] || "claude",
    CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR:
      env["CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR"] || "true",

    // Agent Cloud Sandbox Environment (optional)
    E2B_API_KEY: env["E2B_API_KEY"],

    // Cloudflare tunnel token (optional)
    CLOUDFLARED_TUNNEL_TOKEN: env["CLOUDFLARED_TUNNEL_TOKEN"],

    // Essential system environment variables
    HOME: env["HOME"],
    USER: env["USER"],
    PATH: env["PATH"],
    SHELL: env["SHELL"],
    TERM: env["TERM"],
    LANG: env["LANG"],
    LC_ALL: env["LC_ALL"],

    // Python-specific (for compatibility)
    PYTHONPATH: env["PYTHONPATH"],
    PYTHONUNBUFFERED: "1",

    // Working directory tracking
    PWD: process.cwd(),
  };

  // Add GH_TOKEN as alias for GITHUB_PAT if it exists
  if (env["GITHUB_PAT"]) {
    safeEnvVars["GH_TOKEN"] = env["GITHUB_PAT"];
  }

  // Filter out undefined values
  return Object.fromEntries(
    Object.entries(safeEnvVars).filter(([_, v]) => v !== undefined)
  ) as Record<string, string>;
}

/**
 * Truncate output to a reasonable length for display
 *
 * @param output The output string to truncate
 * @param maxLength Maximum length before truncation
 * @param suffix Suffix to add when truncated
 * @returns Truncated string if needed, original if shorter than maxLength
 */
export function truncateOutput(
  output: string,
  maxLength: number = 500,
  suffix: string = "... (truncated)"
): string {
  // Check if this looks like JSONL data
  if (output.startsWith('{"type":') && output.includes('\n{"type":')) {
    // This is likely JSONL output - try to extract the last meaningful message
    const lines = output.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const line = lines[i];
        if (!line) continue;
        const data = JSON.parse(line);
        // Look for result message
        if (data.type === "result" && typeof data.result === "string") {
          return truncateOutput(data.result, maxLength, suffix);
        }
        // Look for assistant message
        if (data.type === "assistant" && data.message?.content) {
          const content = data.message.content;
          const text = Array.isArray(content) ? content[0]?.text : undefined;
          if (text) {
            return truncateOutput(text, maxLength, suffix);
          }
        }
      } catch {
        // Skip unparseable lines
      }
    }
    // If we couldn't extract anything meaningful, just show that it's JSONL
    return `[JSONL output with ${lines.length} messages]${suffix}`;
  }

  // Regular truncation logic
  if (output.length <= maxLength) {
    return output;
  }

  // Try to find a good break point (newline or space)
  const truncateAt = maxLength - suffix.length;

  // Look for newline near the truncation point
  const newlinePos = output.lastIndexOf("\n", truncateAt);
  if (newlinePos > truncateAt - 50 && newlinePos > 0) {
    return output.slice(0, newlinePos) + suffix;
  }

  // Look for space near the truncation point
  const spacePos = output.lastIndexOf(" ", truncateAt);
  if (spacePos > truncateAt - 20 && spacePos > 0) {
    return output.slice(0, spacePos) + suffix;
  }

  // Just truncate at the limit
  return output.slice(0, truncateAt) + suffix;
}

/**
 * Sleep for a specified number of milliseconds
 *
 * @param ms Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a timestamp as ISO string
 *
 * @param date Optional date to format (defaults to now)
 * @returns ISO formatted timestamp
 */
export function formatTimestamp(date?: Date): string {
  return (date || new Date()).toISOString();
}

/**
 * Console logging utilities with color support
 */
export const logger = {
  info(message: string): void {
    console.log(`\x1b[36mℹ\x1b[0m ${message}`);
  },

  success(message: string): void {
    console.log(`\x1b[32m✓\x1b[0m ${message}`);
  },

  error(message: string): void {
    console.error(`\x1b[31m✗\x1b[0m ${message}`);
  },

  warn(message: string): void {
    console.warn(`\x1b[33m⚠\x1b[0m ${message}`);
  },

  debug(message: string): void {
    if (process.env["DEBUG"]) {
      console.log(`\x1b[90m🔍\x1b[0m ${message}`);
    }
  },
};
