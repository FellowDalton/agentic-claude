#!/usr/bin/env bun
/**
 * Execute a slash command directly
 *
 * Simple utility for executing Claude Code slash commands
 *
 * Usage:
 *   bun run adws/adw_slash_command.ts <slash_command> [args...]
 *
 * Examples:
 *   bun run adws/adw_slash_command.ts /help
 *   bun run adws/adw_slash_command.ts /plan abc123 "Build a calculator app"
 */

import { executeTemplate, AgentTemplateRequest, makeAdwId, logger } from "./bun_modules/agent.ts";

// Parse arguments
const args = Bun.argv.slice(2);

if (args.length === 0) {
  console.error("Error: No slash command provided");
  console.error("Usage: bun run adw_slash_command.ts <slash_command> [args...]");
  console.error("");
  console.error("Examples:");
  console.error("  bun run adw_slash_command.ts /help");
  console.error("  bun run adw_slash_command.ts /plan abc123 'Build a calculator app'");
  process.exit(1);
}

const slashCommand = args[0];
const commandArgs = args.slice(1);

if (!slashCommand.startsWith("/")) {
  console.error(`Error: Command must start with '/', got: ${slashCommand}`);
  process.exit(1);
}

logger.info(`Executing slash command: ${slashCommand}`);
if (commandArgs.length > 0) {
  logger.info(`Arguments: ${commandArgs.join(", ")}`);
}

const request: AgentTemplateRequest = {
  agent_name: "slash-command-executor",
  slash_command: slashCommand,
  args: commandArgs,
  adw_id: makeAdwId(),
  model: "sonnet",
  working_dir: process.cwd(),
};

try {
  const response = await executeTemplate(request);

  console.log("\n" + "=".repeat(60));
  console.log("Output:");
  console.log("=".repeat(60) + "\n");
  console.log(response.output);
  console.log("\n" + "=".repeat(60));

  if (response.success) {
    logger.success("Command executed successfully");
    process.exit(0);
  } else {
    logger.error("Command failed");
    process.exit(1);
  }
} catch (error) {
  logger.error(`Error executing command: ${error}`);
  process.exit(2);
}
