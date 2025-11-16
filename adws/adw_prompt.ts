#!/usr/bin/env bun
/**
 * Execute a prompt directly with Claude Code
 *
 * Simple utility for sending prompts to Claude Code CLI
 *
 * Usage:
 *   bun run adws/adw_prompt.ts "<prompt>" [--model opus|sonnet]
 *
 * Examples:
 *   bun run adws/adw_prompt.ts "Explain how async/await works in TypeScript"
 *   bun run adws/adw_prompt.ts "Write a function to reverse a string" --model opus
 */

import { parseArgs } from "util";
import { join } from "path";
import {
  executeClaudeCode,
  AgentPromptRequest,
  makeAdwId,
  logger,
} from "./bun_modules/agent.ts";

// Parse arguments
const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    model: { type: "string", default: "sonnet" },
  },
  strict: false,
  allowPositionals: true,
});

if (positionals.length === 0) {
  console.error("Error: No prompt provided");
  console.error("Usage: bun run adw_prompt.ts \"<prompt>\" [--model opus|sonnet]");
  console.error("");
  console.error("Examples:");
  console.error('  bun run adw_prompt.ts "Explain how async/await works"');
  console.error('  bun run adw_prompt.ts "Write a function to reverse a string" --model opus');
  process.exit(1);
}

const prompt = positionals.join(" ");
const model = values.model as "sonnet" | "opus";

logger.info(`Executing prompt with ${model} model`);
logger.info(`Prompt: ${prompt.slice(0, 100)}${prompt.length > 100 ? "..." : ""}`);

// Generate output file
const adwId = makeAdwId();
const agentName = "prompt-executor";
const outputDir = join(process.cwd(), "agents", adwId, agentName);
const outputFile = join(outputDir, "cc_raw_output.jsonl");

const request: AgentPromptRequest = {
  prompt,
  adw_id: adwId,
  agent_name: agentName,
  model,
  dangerously_skip_permissions: false,
  output_file: outputFile,
  working_dir: process.cwd(),
};

try {
  const response = await executeClaudeCode(request);

  console.log("\n" + "=".repeat(60));
  console.log("Response:");
  console.log("=".repeat(60) + "\n");
  console.log(response.output);
  console.log("\n" + "=".repeat(60));

  if (response.success) {
    logger.success("Prompt executed successfully");
    logger.info(`Output saved to: ${outputFile}`);
    process.exit(0);
  } else {
    logger.error("Prompt execution failed");
    process.exit(1);
  }
} catch (error) {
  logger.error(`Error executing prompt: ${error}`);
  process.exit(2);
}
