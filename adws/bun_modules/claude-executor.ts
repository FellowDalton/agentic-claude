/**
 * Claude Code executor module
 * Handles execution of Claude Code CLI via bash wrappers
 */

import { join, dirname } from "path";
import {
  AgentPromptRequest,
  AgentPromptResponse,
  AgentTemplateRequest,
  RetryCode,
  ClaudeCodeResultMessageSchema,
} from "./models.ts";
import { logger, sleep, truncateOutput } from "./utils.ts";

// Output file name constants
const OUTPUT_JSONL = "cc_raw_output.jsonl";
const OUTPUT_JSON = "cc_raw_output.json";
const FINAL_OBJECT_JSON = "cc_final_object.json";

/**
 * Execute Claude Code CLI via bash wrapper
 *
 * @param request Agent prompt configuration
 * @returns Agent response with output and status
 */
export async function executeClaudeCode(
  request: AgentPromptRequest
): Promise<AgentPromptResponse> {
  // Get path to bash wrapper
  const scriptDir = import.meta.dir;
  const bashScript = join(dirname(scriptDir), "bash", "claude-code-exec.sh");

  // Create output directory if needed
  const outputDir = dirname(request.output_file);
  await Bun.write(join(outputDir, ".placeholder"), "");

  // Prepare arguments for bash script
  const mcpConfigPath = request.working_dir
    ? join(request.working_dir, ".mcp.json")
    : "";
  const skipPermissions = request.dangerously_skip_permissions ? "true" : "false";

  const args = [
    request.prompt,
    request.model,
    request.output_file,
    request.working_dir || process.cwd(),
    mcpConfigPath,
    skipPermissions,
  ];

  try {
    // Execute bash wrapper
    const proc = Bun.spawn([bashScript, ...args], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
      cwd: request.working_dir || process.cwd(),
    });

    const exitCode = await proc.exited;

    // Parse the JSONL output
    const { messages, resultMessage } = await parseJSONLOutput(request.output_file);

    // Convert JSONL to JSON array
    await convertJSONLToJSON(request.output_file);

    // Save last entry as raw result
    const jsonFile = request.output_file.replace(".jsonl", ".json");
    await saveLastEntryAsRawResult(jsonFile);

    if (exitCode === 0 && resultMessage) {
      // Success case
      const isError = resultMessage.is_error || false;
      const subtype = resultMessage.subtype || "";

      // Handle error_during_execution case
      if (subtype === "error_during_execution") {
        return {
          output: "Error during execution: Agent encountered an error and did not return a result",
          success: false,
          session_id: resultMessage.session_id,
          retry_code: RetryCode.ERROR_DURING_EXECUTION,
        };
      }

      const resultText = resultMessage.result || "";

      // Truncate error outputs
      const finalOutput = isError && resultText.length > 1000
        ? truncateOutput(resultText, 800)
        : resultText;

      return {
        output: finalOutput,
        success: !isError,
        session_id: resultMessage.session_id,
        retry_code: RetryCode.NONE,
      };
    } else if (exitCode === 124) {
      // Timeout
      return {
        output: "Error: Claude Code command timed out after 5 minutes",
        success: false,
        session_id: undefined,
        retry_code: RetryCode.TIMEOUT_ERROR,
      };
    } else {
      // Other errors
      const stderr = await new Response(proc.stderr).text();
      let errorMsg = stderr || `Claude Code command failed with exit code ${exitCode}`;

      // Try to extract error from JSONL if available
      if (resultMessage?.is_error) {
        errorMsg = `Claude Code error: ${resultMessage.result}`;
      }

      return {
        output: truncateOutput(errorMsg, 800),
        success: false,
        session_id: resultMessage?.session_id,
        retry_code: RetryCode.CLAUDE_CODE_ERROR,
      };
    }
  } catch (error) {
    return {
      output: `Error executing Claude Code: ${error}`,
      success: false,
      session_id: undefined,
      retry_code: RetryCode.EXECUTION_ERROR,
    };
  }
}

/**
 * Execute Claude Code with retry logic
 *
 * @param request Agent prompt configuration
 * @param maxRetries Maximum number of retry attempts
 * @param retryDelays Delays in seconds between retries
 * @returns Agent response with output and status
 */
export async function executeClaudeCodeWithRetry(
  request: AgentPromptRequest,
  maxRetries: number = 3,
  retryDelays: number[] = [1, 3, 5]
): Promise<AgentPromptResponse> {
  // Ensure we have enough delays
  while (retryDelays.length < maxRetries) {
    retryDelays.push(retryDelays[retryDelays.length - 1] + 2);
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = retryDelays[attempt - 1];
      logger.warn(`Retrying in ${delay} seconds... (attempt ${attempt}/${maxRetries})`);
      await sleep(delay * 1000);
    }

    const response = await executeClaudeCode(request);

    // Check if we should retry
    if (response.success || response.retry_code === RetryCode.NONE) {
      return response;
    }

    // Check if this is a retryable error
    const retryableCodes = [
      RetryCode.CLAUDE_CODE_ERROR,
      RetryCode.TIMEOUT_ERROR,
      RetryCode.EXECUTION_ERROR,
      RetryCode.ERROR_DURING_EXECUTION,
    ];

    if (!retryableCodes.includes(response.retry_code)) {
      return response;
    }

    if (attempt < maxRetries) {
      logger.warn(`Attempt ${attempt + 1} failed: ${response.retry_code}`);
    } else {
      return response;
    }
  }

  // Should not reach here
  throw new Error("Unexpected retry logic error");
}

/**
 * Execute a template/slash command
 *
 * @param request Template execution request
 * @returns Agent response with output and status
 */
export async function executeTemplate(
  request: AgentTemplateRequest
): Promise<AgentPromptResponse> {
  // Construct prompt from slash command and args
  const prompt = `${request.slash_command} ${request.args.join(" ")}`.trim();

  // Create output directory with adw_id
  const projectRoot = join(import.meta.dir, "..", "..");
  const outputDir = join(projectRoot, "agents", request.adw_id, request.agent_name);
  await Bun.write(join(outputDir, ".placeholder"), "");

  // Build output file path
  const outputFile = join(outputDir, OUTPUT_JSONL);

  // Create prompt request
  const promptRequest: AgentPromptRequest = {
    prompt,
    adw_id: request.adw_id,
    agent_name: request.agent_name,
    model: request.model,
    dangerously_skip_permissions: true,
    output_file: outputFile,
    working_dir: request.working_dir,
  };

  // Save prompt before execution
  await savePrompt(prompt, request.adw_id, request.agent_name);

  // Execute with retry logic
  return await executeClaudeCodeWithRetry(promptRequest);
}

/**
 * Save prompt to logging directory
 *
 * @param prompt The prompt text
 * @param adwId ADW ID for tracking
 * @param agentName Agent name
 */
async function savePrompt(
  prompt: string,
  adwId: string,
  agentName: string
): Promise<void> {
  // Extract slash command from prompt
  const match = prompt.match(/^(\/\w+)/);
  if (!match) {
    return;
  }

  const slashCommand = match[1];
  const commandName = slashCommand.slice(1); // Remove leading slash

  // Create directory structure
  const projectRoot = join(import.meta.dir, "..", "..");
  const promptDir = join(projectRoot, "agents", adwId, agentName, "prompts");
  await Bun.write(join(promptDir, ".placeholder"), "");

  // Save prompt to file
  const promptFile = join(promptDir, `${commandName}.txt`);
  await Bun.write(promptFile, prompt);
}

/**
 * Parse JSONL output file
 *
 * @param outputFile Path to JSONL file
 * @returns All messages and the result message
 */
async function parseJSONLOutput(
  outputFile: string
): Promise<{ messages: any[]; resultMessage: any | null }> {
  try {
    const file = Bun.file(outputFile);
    const text = await file.text();
    const lines = text.trim().split("\n").filter((line) => line.trim());

    const messages = lines.map((line) => JSON.parse(line));

    // Find the result message (should be the last one)
    let resultMessage = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === "result") {
        resultMessage = messages[i];
        break;
      }
    }

    return { messages, resultMessage };
  } catch (error) {
    logger.error(`Error parsing JSONL output: ${error}`);
    return { messages: [], resultMessage: null };
  }
}

/**
 * Convert JSONL file to JSON array file
 *
 * @param jsonlFile Path to JSONL file
 * @returns Path to created JSON file
 */
async function convertJSONLToJSON(jsonlFile: string): Promise<string> {
  const outputDir = dirname(jsonlFile);
  const jsonFile = join(outputDir, OUTPUT_JSON);

  const { messages } = await parseJSONLOutput(jsonlFile);

  await Bun.write(jsonFile, JSON.stringify(messages, null, 2));

  return jsonFile;
}

/**
 * Save the last entry from JSON array as cc_final_object.json
 *
 * @param jsonFile Path to JSON array file
 * @returns Path to created file, or null if error
 */
async function saveLastEntryAsRawResult(jsonFile: string): Promise<string | null> {
  try {
    const file = Bun.file(jsonFile);
    const messages = await file.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return null;
    }

    const lastEntry = messages[messages.length - 1];

    const outputDir = dirname(jsonFile);
    const finalObjectFile = join(outputDir, FINAL_OBJECT_JSON);

    await Bun.write(finalObjectFile, JSON.stringify(lastEntry, null, 2));

    return finalObjectFile;
  } catch {
    return null;
  }
}
