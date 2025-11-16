/**
 * Git operations module
 * Provides functions for git operations using Bun.spawn
 */

import { logger } from "./utils.ts";

/**
 * Get the current git commit hash
 *
 * @param workingDir Directory to run git command in
 * @returns First 9 characters of commit hash, or null if error
 */
export async function getCurrentCommitHash(
  workingDir: string
): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
      cwd: workingDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      return null;
    }

    return output.trim().slice(0, 9);
  } catch (error) {
    logger.error(`Error getting commit hash: ${error}`);
    return null;
  }
}

/**
 * Get git status (short format)
 *
 * @param workingDir Directory to run git command in
 * @returns Git status output
 */
export async function getGitStatus(workingDir: string): Promise<string> {
  try {
    const proc = Bun.spawn(["git", "status", "--short"], {
      cwd: workingDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    return output.trim();
  } catch (error) {
    throw new Error(`Error getting git status: ${error}`);
  }
}

/**
 * Stage files for commit
 *
 * @param workingDir Directory to run git command in
 * @param files Array of file paths to add (relative to workingDir)
 */
export async function gitAdd(
  workingDir: string,
  files: string[]
): Promise<void> {
  try {
    const proc = Bun.spawn(["git", "add", ...files], {
      cwd: workingDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Git add failed: ${stderr}`);
    }
  } catch (error) {
    throw new Error(`Error adding files to git: ${error}`);
  }
}

/**
 * Create a git commit
 *
 * @param workingDir Directory to run git command in
 * @param message Commit message
 * @returns Commit hash of created commit
 */
export async function gitCommit(
  workingDir: string,
  message: string
): Promise<string> {
  try {
    const proc = Bun.spawn(["git", "commit", "-m", message], {
      cwd: workingDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Git commit failed: ${stderr}`);
    }

    // Get the commit hash that was just created
    return (await getCurrentCommitHash(workingDir)) || "";
  } catch (error) {
    throw new Error(`Error creating git commit: ${error}`);
  }
}

/**
 * Check if directory is a git repository
 *
 * @param workingDir Directory to check
 * @returns True if directory is in a git repository
 */
export async function isGitRepository(workingDir: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["git", "rev-parse", "--git-dir"], {
      cwd: workingDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get the current branch name
 *
 * @param workingDir Directory to run git command in
 * @returns Current branch name, or null if error
 */
export async function getCurrentBranch(
  workingDir: string
): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: workingDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      return null;
    }

    return output.trim();
  } catch (error) {
    logger.error(`Error getting current branch: ${error}`);
    return null;
  }
}
